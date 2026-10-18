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
import { generateWordReport } from "./docx.ts";
import { executeAssessmentTransition } from "../lifecycle/service.ts";
import { getLocalStorageAdapter } from "../storage/local_adapter.ts";
import type { ReportSnapshotRecord, ReportDocumentData } from "./types.ts";

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
  isDraft: boolean = true
): Promise<GeneratedDocumentResult> {
  // Compile live data under RLS
  const data = await compileReportDocumentData(sessionUser, assessmentId, isDraft);

  // Generate binary Word document
  const buffer = await generateWordReport(data);

  // Calculate file SHA-256
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  data.auditTrail.documentSha256 = sha256;

  const prefix = data.auditTrail.isDraft ? "DRAFT_" : "FINAL_";
  const filename = `TLI_DPDP_Report_${prefix}${data.assessment.engagementCode}_${new Date()
    .toISOString()
    .split("T")[0]}.docx`;

  return {
    buffer,
    filename,
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
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

  // 4. Generate official non-draft report
  const reportDoc = await generateReportDocument(sessionUser, assessmentId, false);

  // 5. Store report file in storage vault
  const s3Key = `reports/${currentAssessment.tenant_id}/${currentAssessment.engagement_code}-FINAL-V1.0.docx`;
  try {
    await getLocalStorageAdapter().saveFile(s3Key, reportDoc.buffer);
  } catch (err) {
    console.warn("Storage save notification:", err);
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
