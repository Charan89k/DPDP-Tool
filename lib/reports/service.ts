/**
 * CloudE5 — Report Service
 *
 * Coordinates draft compilation, document generation, formal lead approval,
 * immutable report snapshots, and download retrieval under PostgreSQL RLS.
 */

import { createHash } from "node:crypto";
import { executeWithRls } from "../db/rls.ts";
import type { SessionUser } from "../auth/types.ts";
import { isTliRole, canFinalizeAssessment } from "../auth/rbac.ts";
import { compileReportDocumentData } from "./generator.ts";
import type { ReportAudience } from "./generator.ts";
import { generateWordReport } from "./docx.ts";
import { executeAssessmentTransition } from "../lifecycle/service.ts";
import { getLocalStorageAdapter } from "../storage/local_adapter.ts";
import type { ReportSnapshotRecord, ReportDocumentData } from "./types.ts";

const DOCX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** A report file ready to download, whether generated now or read from the issued archive. */
export interface DownloadableReport {
  buffer: Buffer;
  filename: string;
  contentType: string;
  sha256: string;
  datasetSha256: string;
}

export interface GeneratedDocumentResult {
  buffer: Buffer;
  filename: string;
  contentType: string;
  data: ReportDocumentData;
  sha256: string;
}

/**
 * Fetches all report snapshots for an assessment under PostgreSQL RLS.
 */
export async function getAssessmentReportSnapshots(
  sessionUser: SessionUser,
  assessmentId: string
): Promise<ReportSnapshotRecord[]> {
  return await executeWithRls(sessionUser, async (client) => {
    const sql = `
      SELECT 
        rs.id,
        rs.assessment_id,
        rs.tenant_id,
        rs.report_type,
        rs.version_label,
        rs.s3_key,
        rs.file_sha256_hash,
        rs.dataset_sha256_hash,
        rs.generated_by_user_id,
        u1.full_name AS generated_by_name,
        rs.lead_approver_id,
        u2.full_name AS lead_approver_name,
        rs.approved_at,
        rs.created_at,
        rs.is_draft,
        rs.summary_metadata
      FROM report_snapshots rs
      LEFT JOIN users u1 ON u1.id = rs.generated_by_user_id
      LEFT JOIN users u2 ON u2.id = rs.lead_approver_id
      WHERE rs.assessment_id = $1
      ORDER BY rs.created_at DESC;
    `;
    const res = await client.query(sql, [assessmentId]);
    return res.rows.map((r) => ({
      id: r.id,
      assessmentId: r.assessment_id,
      tenantId: r.tenant_id,
      reportType: r.report_type,
      versionLabel: r.version_label,
      s3Key: r.s3_key,
      fileSha256Hash: r.file_sha256_hash,
      datasetSha256Hash: r.dataset_sha256_hash,
      generatedByUserId: r.generated_by_user_id,
      generatedByName: r.generated_by_name,
      leadApproverId: r.lead_approver_id,
      leadApproverName: r.lead_approver_name,
      approvedAt: r.approved_at ? new Date(r.approved_at).toISOString() : "",
      createdAt: new Date(r.created_at).toISOString(),
      isDraft: Boolean(r.is_draft),
      summaryMetadata: r.summary_metadata || {},
    }));
  });
}

/**
 * Generates an on-the-fly Word document report (.docx) using live assessment data.
 */
export async function generateReportDocument(
  sessionUser: SessionUser,
  assessmentId: string,
  isDraft: boolean = true,
  audience?: ReportAudience
): Promise<GeneratedDocumentResult> {
  // Compile live data under RLS
  const data = await compileReportDocumentData(sessionUser, assessmentId, isDraft, audience);

  // Generate binary Word document
  const buffer = await generateWordReport(data);

  // Calculate file SHA-256
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  data.auditTrail.documentSha256 = sha256;

  const prefix = data.auditTrail.isDraft ? "DRAFT_" : "FINAL_";
  const safeCode = data.assessment.engagementCode.replace(/[^A-Za-z0-9._-]/g, "_");
  const filename = `CloudE5_DPDP_Report_${prefix}${safeCode}_${new Date()
    .toISOString()
    .split("T")[0]}.docx`;

  return {
    buffer,
    filename,
    contentType: DOCX_CONTENT_TYPE,
    data,
    sha256,
  };
}

/**
 * Issues the official final compliance assessment report.
 * Strictly gated: Only authorized Lead Consultant or Super Admin can issue.
 * Client users are blocked with an authority error.
 * Enforces lifecycle progression to FINAL_ISSUED and stores immutable snapshot in report_snapshots.
 */
export async function issueOfficialFinalReport(
  sessionUser: SessionUser,
  assessmentId: string
): Promise<ReportSnapshotRecord> {
  // 1. Authorization Gate
  if (!isTliRole(sessionUser.role) || !canFinalizeAssessment(sessionUser.role)) {
    throw new Error(
      `Authority violation: Role ${sessionUser.role} is not authorized to approve or issue final compliance reports (DEC-01).`
    );
  }

  // 2. Fetch assessment status
  const currentAssessment = await executeWithRls(sessionUser, async (client) => {
    const res = await client.query(
      `SELECT id, status, tenant_id, engagement_code, lead_consultant_id FROM assessments WHERE id = $1;`,
      [assessmentId]
    );
    if (res.rowCount === 0) {
      throw new Error(`Assessment ${assessmentId} not found.`);
    }
    return res.rows[0];
  });

  // 3. Ensure assessment progresses through lifecycle
  if (currentAssessment.status === "DRAFT_REPORT_GENERATED") {
    await executeAssessmentTransition(sessionUser, assessmentId, {
      targetStatus: "LEAD_APPROVED",
      reason: "Lead Consultant formal methodology review and approval sign-off.",
    });
  }

  if (currentAssessment.status !== "FINAL_ISSUED") {
    await executeAssessmentTransition(sessionUser, assessmentId, {
      targetStatus: "FINAL_ISSUED",
      reason: "Official issuance of final compliance evaluation report to client.",
    });
  }

  // 4. Generate the official report: the full consultant copy and a customer copy without internal
  //    assessor notes. Both are archived now and later downloads serve these files, so content
  //    changed after issuance can never appear in an official report without a new issuance.
  const reportDoc = await generateReportDocument(sessionUser, assessmentId, false, "consultant");
  const clientDoc = await generateReportDocument(sessionUser, assessmentId, false, "client");

  // 5. Store the files under the assessment's own identifier (engagement codes are display data)
  const s3Key = issuedReportKey(currentAssessment.tenant_id, assessmentId, "consultant");
  const clientS3Key = issuedReportKey(currentAssessment.tenant_id, assessmentId, "client");
  // A failed write must not record an issued snapshot that points at a missing file. The assessment
  // is already FINAL_ISSUED at this point, so retrying issuance skips the transitions and retries this.
  try {
    await getLocalStorageAdapter().saveFile(s3Key, reportDoc.buffer);
    await getLocalStorageAdapter().saveFile(clientS3Key, clientDoc.buffer);
  } catch (err) {
    console.error("Failed to store final report file:", err);
    throw new Error("The final report could not be stored. Please retry issuing the report.");
  }

  // 6. Record immutable snapshot in report_snapshots under RLS
  const snapshot = await executeWithRls(sessionUser, async (client) => {
    const insertSql = `
      INSERT INTO report_snapshots (
        assessment_id,
        tenant_id,
        report_type,
        version_label,
        s3_key,
        file_sha256_hash,
        dataset_sha256_hash,
        generated_by_user_id,
        lead_approver_id,
        approved_at,
        is_draft,
        summary_metadata
      ) VALUES ($1, $2, 'DOCX', 'FINAL-V1.0', $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, FALSE, $8)
      RETURNING *;
    `;

    const summaryMeta = {
      completenessPct: reportDoc.data.executiveSummary.completenessPct,
      evidenceCoveragePct: reportDoc.data.executiveSummary.evidenceCoveragePct,
      provisionalReadinessPct: reportDoc.data.executiveSummary.provisionalReadinessPct,
      provisionalMaturityScore: reportDoc.data.executiveSummary.provisionalMaturityScore,
      criticalGapsCount: reportDoc.data.executiveSummary.criticalGapsCount,
      templateVersion: reportDoc.data.auditTrail.reportTemplateVersion,
      issuedAt: new Date().toISOString(),
      fileName: reportDoc.filename,
      clientS3Key,
      clientFileSha256: clientDoc.sha256,
    };

    const res = await client.query(insertSql, [
      assessmentId,
      currentAssessment.tenant_id,
      s3Key,
      reportDoc.sha256,
      reportDoc.data.auditTrail.datasetSha256,
      sessionUser.userId,
      currentAssessment.lead_consultant_id || sessionUser.userId,
      JSON.stringify(summaryMeta),
    ]);

    return res.rows[0];
  });

  return {
    id: snapshot.id,
    assessmentId: snapshot.assessment_id,
    tenantId: snapshot.tenant_id,
    reportType: snapshot.report_type,
    versionLabel: snapshot.version_label,
    s3Key: snapshot.s3_key,
    fileSha256Hash: snapshot.file_sha256_hash,
    datasetSha256Hash: snapshot.dataset_sha256_hash,
    generatedByUserId: snapshot.generated_by_user_id,
    leadApproverId: snapshot.lead_approver_id,
    approvedAt: snapshot.approved_at ? new Date(snapshot.approved_at).toISOString() : "",
    createdAt: new Date(snapshot.created_at).toISOString(),
    isDraft: Boolean(snapshot.is_draft),
    summaryMetadata: snapshot.summary_metadata || {},
  };
}

function issuedReportKey(tenantId: string, assessmentId: string, audience: ReportAudience): string {
  const suffix = audience === "client" ? "-client" : "";
  return `reports/${tenantId}/${assessmentId}/FINAL-V1.0${suffix}.docx`;
}

/**
 * Returns the archived official report for an issued assessment, or null when none was archived.
 * Customer users receive the customer copy; consultants the full copy. Read under RLS, so only
 * users who can see the assessment's snapshots can download them.
 */
export async function getIssuedReportDocument(
  sessionUser: SessionUser,
  assessmentId: string
): Promise<DownloadableReport | null> {
  const snapshot = await executeWithRls(sessionUser, async (client) => {
    const res = await client.query(
      `SELECT s3_key, file_sha256_hash, dataset_sha256_hash, summary_metadata
       FROM report_snapshots
       WHERE assessment_id = $1 AND is_draft = FALSE AND report_type = 'DOCX'
       ORDER BY created_at DESC
       LIMIT 1;`,
      [assessmentId]
    );
    return res.rows[0] ?? null;
  });
  if (!snapshot) return null;

  const meta = parseSummaryMetadata(snapshot.summary_metadata);
  const forClient = !isTliRole(sessionUser.role);
  const key = forClient ? meta.clientS3Key : snapshot.s3_key;
  const expectedSha256 = forClient ? meta.clientFileSha256 : snapshot.file_sha256_hash;
  // Snapshots archived before customer copies existed have no customer file: fall back to a
  // freshly generated copy rather than serve the consultant file with its internal notes.
  if (typeof key !== "string" || typeof expectedSha256 !== "string") return null;

  const buffer = await getLocalStorageAdapter().readFile(key);
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  if (sha256 !== expectedSha256) {
    throw new Error(`Archived report for assessment ${assessmentId} failed its integrity check.`);
  }
  return {
    buffer,
    filename: typeof meta.fileName === "string" ? meta.fileName : `CloudE5_DPDP_Report_FINAL_${assessmentId}.docx`,
    contentType: DOCX_CONTENT_TYPE,
    sha256,
    datasetSha256: snapshot.dataset_sha256_hash,
  };
}

function parseSummaryMetadata(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
