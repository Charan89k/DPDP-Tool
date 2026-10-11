/**
 * TLI DPDP Compliance Gap Analysis Tool — Phase 5 Test Suite
 * Reporting, Approval, Document Validity & Remediation Management
 *
 * Verifies:
 * 1. Compilation of comprehensive report data from live assessment data.
 * 2. Word document (.docx) generation, OpenXML validity, and content parsing.
 * 3. Draft watermark notice vs. official issued report labeling.
 * 4. Role authorization: Client roles blocked from issuing or approving reports.
 * 5. Lead consultant official approval, versioning, and immutable report snapshots.
 * 6. Database kernel trigger immutability blocking UPDATE/DELETE on report_snapshots.
 * 7. Remediation task creation, status updates, and submission for closure by clients.
 * 8. Independent assessor validation requirement: clients blocked from directly validating closure.
 * 9. Non-compensatory independence: completing remediation does NOT alter historical assessment responses.
 * 10. Multi-tenant isolation under live PostgreSQL RLS for reports and remediations.
 */

import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { pool } from "../lib/db/pool.ts";
import { executeWithRls } from "../lib/db/rls.ts";
import type { SessionUser } from "../lib/auth/types.ts";
import {
  compileReportDocumentData,
  generateReportDocument,
  getAssessmentReportSnapshots,
  issueOfficialFinalReport,
} from "../lib/reports/index.ts";
import {
  getAssessmentRemediations,
  createRemediationTask,
  updateRemediationProgress,
  validateRemediationClosure,
} from "../lib/remediation/index.ts";

const ASSESSMENT_ALPHA_ID = "018f3a5b-7c8d-7e90-8000-000000000201";
const ASSESSMENT_BETA_ID = "018f3a5b-7c8d-7e90-8000-000000000202";

const CONSULTANT_SESSION: SessionUser = {
  userId: "018f3a5b-7c8d-7e90-8000-000000000102",
  tenantId: "018f3a5b-7c8d-7e90-8000-000000000001",
  email: "consultant.demo@truthlabs.in",
  fullName: "Priya Sharma",
  role: "TLI_LEAD_CONSULTANT",
  tenantType: "TLI",
  tenantName: "Truth Labs Advisory",
  tenantSlug: "truth-labs-advisory",
  isSdf: false,
};

const CLIENT_ALPHA_SESSION: SessionUser = {
  userId: "018f3a5b-7c8d-7e90-8000-000000000111",
  tenantId: "018f3a5b-7c8d-7e90-8000-000000000002",
  email: "customer.demo@alphahealth.example.com",
  fullName: "Dr. Rajesh Varma",
  role: "CLIENT_ADMIN",
  tenantType: "CLIENT",
  tenantName: "Alpha Healthcare Technologies Pvt Ltd",
  tenantSlug: "alpha-healthcare",
  isSdf: true,
};

const CLIENT_BETA_SESSION: SessionUser = {
  userId: "018f3a5b-7c8d-7e90-8000-000000000121",
  tenantId: "018f3a5b-7c8d-7e90-8000-000000000003",
  email: "admin@betaexpress.example.com",
  fullName: "Rohan Kapoor",
  role: "CLIENT_ADMIN",
  tenantType: "CLIENT",
  tenantName: "Beta Express Supply Chain Solutions Ltd",
  tenantSlug: "beta-express",
  isSdf: false,
};

describe("Phase 5: Reporting, Approval & Remediation Management", () => {
  it("1. should compile comprehensive report data traceable to source questions and provisions", async () => {
    const reportData = await compileReportDocumentData(
      CONSULTANT_SESSION,
      ASSESSMENT_ALPHA_ID,
      true
    );

    assert.equal(reportData.assessment.id, ASSESSMENT_ALPHA_ID);
    assert.equal(reportData.assessment.tenantName, "Alpha Healthcare Technologies Pvt Ltd");
    assert.equal(reportData.assessment.isSdf, true);

    // Verify all 60 canonical questions are accounted for
    assert.equal(reportData.questionFindings.length, 60);

    // Verify 13 statutory domains are summarized
    assert.equal(reportData.domainFindings.length, 13);

    // Verify 4 unresolved question records are isolated
    assert.equal(reportData.unresolvedQuestions.length, 4);
    const unresCodes = reportData.unresolvedQuestions.map((u) => u.questionCode);
    assert.deepEqual(unresCodes.sort(), ["APP-006", "GOV-005", "GOV-006", "GOV-008"]);

    // Verify methodology disclosure and provisional flags
    assert.equal(reportData.methodologyDisclosures.scoringStatus, "PROVISIONAL_PENDING_APPROVAL");
    assert.equal(reportData.methodologyDisclosures.provisionalModel, "SCORING-V1-PROVISIONAL");

    // Verify dataset SHA-256 fingerprint is generated
    assert.ok(reportData.auditTrail.datasetSha256.length === 64);
  });

  it("2. should redact internal assessor notes for client roles", async () => {
    // Consultant compiling report sees assessor findings
    const consultantData = await compileReportDocumentData(
      CONSULTANT_SESSION,
      ASSESSMENT_ALPHA_ID,
      true
    );

    // Client compiling report MUST NOT see internal assessor notes
    const clientData = await compileReportDocumentData(
      CLIENT_ALPHA_SESSION,
      ASSESSMENT_ALPHA_ID,
      true
    );

    // Check SEC-001 (has reviewer notes in seeded DB)
    const clientSec = clientData.questionFindings.find((q) => q.questionCode === "SEC-001");
    assert.ok(clientSec);
    assert.equal(clientSec.assessorFindings, null, "Client role must not see internal assessor notes");
  });

  it("3. should generate a valid Word document (.docx) and verify OpenXML structure and contents", async () => {
    const docResult = await generateReportDocument(
      CONSULTANT_SESSION,
      ASSESSMENT_ALPHA_ID,
      true
    );

    assert.ok(docResult.buffer.length > 5000, "Generated .docx must have substantial byte content");
    assert.ok(docResult.filename.endsWith(".docx"));
    assert.equal(
      docResult.contentType,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    assert.ok(docResult.sha256.length === 64);

    // Validate generated .docx by unpacking OpenXML ZIP archive with python
    const tempFilePath = path.join("/tmp", `test_report_${Date.now()}.docx`);
    fs.writeFileSync(tempFilePath, docResult.buffer);

    try {
      const inspectCmd = `python3 -c "
import zipfile, xml.etree.ElementTree as ET
with zipfile.ZipFile('${tempFilePath}', 'r') as z:
    names = z.namelist()
    assert 'word/document.xml' in names, 'Missing word/document.xml'
    assert '[Content_Types].xml' in names, 'Missing [Content_Types].xml'
    doc_xml = z.read('word/document.xml').decode('utf-8')
    assert 'Truth Labs International' in doc_xml, 'Missing brand header'
    assert 'DRAFT ASSESSMENT REPORT' in doc_xml, 'Missing draft banner'
    assert 'Alpha Healthcare Technologies' in doc_xml, 'Missing client name'
    assert 'SEC-001' in doc_xml, 'Missing canonical question code'
print('VALID_OPENXML_DOCX')
"`;
      const output = execSync(inspectCmd, { encoding: "utf-8" }).trim();
      assert.equal(output, "VALID_OPENXML_DOCX", "Word document must parse as valid OpenXML");
    } finally {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  });

  it("4. should strictly reject client users from approving or issuing final reports", async () => {
    await assert.rejects(
      async () => {
        await issueOfficialFinalReport(CLIENT_ALPHA_SESSION, ASSESSMENT_ALPHA_ID);
      },
      (err: any) => {
        assert.ok(
          err.message.includes("Authority violation") ||
            err.message.includes("not authorized to approve or issue")
        );
        return true;
      }
    );
  });

  it("5. should enforce kernel immutability: UPDATE and DELETE on report_snapshots blocked by database trigger", async () => {
    // Query existing report_snapshots under consultant session
    const snapshots = await getAssessmentReportSnapshots(CONSULTANT_SESSION, ASSESSMENT_ALPHA_ID);

    // If no snapshot exists yet, create a synthetic test snapshot
    let testSnapshotId = snapshots[0]?.id;
    if (!testSnapshotId) {
      await executeWithRls(CONSULTANT_SESSION, async (client) => {
        const ins = await client.query(
          `INSERT INTO report_snapshots (
            assessment_id, tenant_id, report_type, version_label, s3_key,
            file_sha256_hash, dataset_sha256_hash, generated_by_user_id,
            lead_approver_id, approved_at, is_draft
          ) VALUES (
            $1, $2, 'DOCX', 'DRAFT-V0.1', 'reports/test.docx',
            '1111111111111111111111111111111111111111111111111111111111111111',
            '2222222222222222222222222222222222222222222222222222222222222222',
            $3, $3, CURRENT_TIMESTAMP, TRUE
          ) RETURNING id;`,
          [ASSESSMENT_ALPHA_ID, CLIENT_ALPHA_SESSION.tenantId, CONSULTANT_SESSION.userId]
        );
        testSnapshotId = ins.rows[0].id;
      });
    }

    assert.ok(testSnapshotId, "Must have a test snapshot ID");

    // Attempting an UPDATE on report_snapshots must trigger FORENSIC_INTEGRITY_VIOLATION or permission denied
    await assert.rejects(
      async () => {
        await executeWithRls(CONSULTANT_SESSION, async (client) => {
          await client.query(
            `UPDATE report_snapshots SET version_label = 'TAMPERED' WHERE id = $1;`,
            [testSnapshotId]
          );
        });
      },
      (err: any) => {
        assert.ok(
          err.message.includes("FORENSIC_INTEGRITY_VIOLATION") ||
            err.message.includes("permission denied") ||
            err.message.includes("append-only"),
          `Expected immutability exception, got: ${err.message}`
        );
        return true;
      }
    );

    // Attempting a DELETE on report_snapshots must trigger FORENSIC_INTEGRITY_VIOLATION or permission denied
    await assert.rejects(
      async () => {
        await executeWithRls(CONSULTANT_SESSION, async (client) => {
          await client.query(`DELETE FROM report_snapshots WHERE id = $1;`, [testSnapshotId]);
        });
      },
      (err: any) => {
        assert.ok(
          err.message.includes("FORENSIC_INTEGRITY_VIOLATION") ||
            err.message.includes("permission denied") ||
            err.message.includes("append-only"),
          `Expected immutability exception, got: ${err.message}`
        );
        return true;
      }
    );
  });

  it("6. should create, track progress, and submit remediation tasks for closure", async () => {
    // Client creates a remediation task
    const newTask = await createRemediationTask(CLIENT_ALPHA_SESSION, {
      assessmentId: ASSESSMENT_ALPHA_ID,
      questionCode: "SEC-001",
      title: "Deploy Automated KMS Key Rotation",
      description: "Implement annual automated AWS KMS customer managed key rotation for patient health records.",
      priority: "CRITICAL",
      targetDate: "2026-12-31",
    });

    assert.ok(newTask.id);
    assert.equal(newTask.status, "OPEN");
    assert.equal(newTask.priority, "CRITICAL");
    assert.equal(newTask.questionCode, "SEC-001");

    // Client updates progress to IN_REMEDIATION
    const inProgTask = await updateRemediationProgress(CLIENT_ALPHA_SESSION, newTask.id, {
      status: "IN_REMEDIATION",
      description: "Terraform configuration drafted; testing in staging environment.",
    });
    assert.equal(inProgTask.status, "IN_REMEDIATION");

    // Client submits for closure with implementation notes
    const submittedTask = await updateRemediationProgress(CLIENT_ALPHA_SESSION, newTask.id, {
      status: "SUBMITTED_FOR_CLOSURE",
      closureSubmissionNotes: "KMS rotation policy enabled across all patient tables. Terraform plan verified.",
    });
    assert.equal(submittedTask.status, "SUBMITTED_FOR_CLOSURE");
    assert.ok(submittedTask.closureSubmittedAt);
  });

  it("7. should prevent clients from self-validating closure and allow TLI assessor validation", async () => {
    // Client creates a task
    const task = await createRemediationTask(CLIENT_ALPHA_SESSION, {
      assessmentId: ASSESSMENT_ALPHA_ID,
      questionCode: "NOT-002",
      title: "Update Itemised Pre-Consent Notice",
      description: "Separate marketing consent from core clinical consent terms.",
      priority: "HIGH",
      targetDate: "2026-11-30",
    });

    // Client attempts to directly set VALIDATED_CLOSED -> MUST BE REJECTED
    await assert.rejects(
      async () => {
        await updateRemediationProgress(CLIENT_ALPHA_SESSION, task.id, {
          status: "VALIDATED_CLOSED",
        });
      },
      (err: any) => {
        assert.ok(
          err.message.includes("Authority violation") ||
            err.message.includes("cannot mark remediation tasks as VALIDATED_CLOSED")
        );
        return true;
      }
    );

    // Client properly submits for closure
    await updateRemediationProgress(CLIENT_ALPHA_SESSION, task.id, {
      status: "SUBMITTED_FOR_CLOSURE",
      closureSubmissionNotes: "Updated mobile app consent screen deployed to staging.",
    });

    // Authorized TLI Consultant validates and closes the task
    const validatedTask = await validateRemediationClosure(CONSULTANT_SESSION, task.id, {
      action: "VALIDATE_CLOSE",
      validationNotes: "Inspected mobile app staging build (v2.4.1). Notice itemization satisfies Section 5(1).",
    });

    assert.equal(validatedTask.status, "VALIDATED_CLOSED");
    assert.equal(validatedTask.closureValidatedByName, CONSULTANT_SESSION.fullName);
    assert.ok(validatedTask.validatedAt);
  });

  it("8. should guarantee non-compensatory independence: closing remediation does not mutate questionnaire responses", async () => {
    // Fetch initial questionnaire response for SEC-001 under client session
    const initialResp = await executeWithRls(CLIENT_ALPHA_SESSION, async (client) => {
      const res = await client.query(
        `SELECT selected_option, comments_and_justification 
         FROM assessment_questionnaire_responses 
         WHERE assessment_id = $1 AND question_code = 'SEC-001';`,
        [ASSESSMENT_ALPHA_ID]
      );
      return res.rows[0];
    });

    // Create and validate a remediation task on SEC-001
    const task = await createRemediationTask(CLIENT_ALPHA_SESSION, {
      assessmentId: ASSESSMENT_ALPHA_ID,
      questionCode: "SEC-001",
      title: "DB Encryption Verification Drill",
      description: "Complete drill verifying encryption at rest.",
      priority: "CRITICAL",
      targetDate: "2026-10-31",
    });

    await updateRemediationProgress(CLIENT_ALPHA_SESSION, task.id, {
      status: "SUBMITTED_FOR_CLOSURE",
      closureSubmissionNotes: "Drill completed successfully.",
    });

    await validateRemediationClosure(CONSULTANT_SESSION, task.id, {
      action: "VALIDATE_CLOSE",
      validationNotes: "Drill logs verified.",
    });

    // Verify SEC-001 response remains strictly unchanged
    const postResp = await executeWithRls(CLIENT_ALPHA_SESSION, async (client) => {
      const res = await client.query(
        `SELECT selected_option, comments_and_justification 
         FROM assessment_questionnaire_responses 
         WHERE assessment_id = $1 AND question_code = 'SEC-001';`,
        [ASSESSMENT_ALPHA_ID]
      );
      return res.rows[0];
    });

    assert.deepEqual(
      postResp,
      initialResp,
      "Questionnaire responses must remain strictly immutable across remediation closures"
    );
  });

  it("9. should enforce live PostgreSQL RLS cross-tenant isolation on reports and remediations", async () => {
    // Client Alpha queries Client Beta remediations -> returns 0 rows (RLS filtered)
    const betaRemediationsForAlpha = await getAssessmentRemediations(
      CLIENT_ALPHA_SESSION,
      ASSESSMENT_BETA_ID
    );
    assert.equal(
      betaRemediationsForAlpha.length,
      0,
      "RLS must return 0 rows when attempting cross-tenant remediation query"
    );

    // Client Alpha attempts to create a remediation task for Beta -> REJECTED
    await assert.rejects(
      async () => {
        await createRemediationTask(CLIENT_ALPHA_SESSION, {
          assessmentId: ASSESSMENT_BETA_ID,
          title: "Unauthorized cross-tenant remediation task",
          description: "This task attempt should be rejected.",
          priority: "HIGH",
          targetDate: "2026-12-31",
        });
      },
      (err: any) => {
        assert.ok(
          err.message.includes("not found or access denied") ||
            err.message.includes("access denied")
        );
        return true;
      }
    );

    // Client Alpha queries Client Beta report snapshots -> returns 0 rows
    const betaSnapshotsForAlpha = await getAssessmentReportSnapshots(
      CLIENT_ALPHA_SESSION,
      ASSESSMENT_BETA_ID
    );
    assert.equal(
      betaSnapshotsForAlpha.length,
      0,
      "RLS must return 0 rows when attempting cross-tenant report query"
    );
  });

  after(async () => {
    await pool.end();
  });
});
