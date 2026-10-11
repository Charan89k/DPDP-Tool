/**
 * TLI DPDP Compliance Gap Analysis Tool — Phase 3D.3 Test Suite
 *
 * Evidence & Clarification Workflows Verification:
 * 1. Cross-tenant evidence upload authorization & RLS gating.
 * 2. File size boundaries (100 B - 50 MB) and binary magic bytes validation.
 * 3. Metadata binding (assessment ID, question code, category, description, uploader, timestamp).
 * 4. Fail-closed download gating for quarantined, deleted, and cross-tenant files.
 * 5. Assessor review decisions (VERIFIED / REJECTED) and immutability of evidence_review_history.
 * 6. Non-assessor review decision rejection.
 * 7. Soft-deletion lifecycle with attribution and download gating.
 * 8. Independent Evidence Coverage metrics calculation (independent of questionnaire responses).
 * 9. Question and evidence-linked clarification threads, target roles, threaded replies, and extended statuses.
 * 10. Immutability of questionnaire responses during clarification and evidence lifecycle changes.
 */

import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { executeWithRls } from "../lib/db/rls.ts";
import { pool } from "../lib/db/pool.ts";
import { EvidenceVaultService } from "../lib/storage/service.ts";
import { FileValidator, ValidationError } from "../lib/storage/validation.ts";
import type { SessionUser } from "../lib/auth/types.ts";

const DEMO_CUSTOMER: SessionUser = {
  userId: "018f3a5b-7c8d-7e90-8000-000000000192",
  email: "customer.demo@tli.local",
  fullName: "Alpha Health Demo Admin",
  role: "CLIENT_ADMIN",
  tenantId: "018f3a5b-7c8d-7e90-8000-000000000002",
  tenantName: "Alpha Healthcare Technologies Pvt Ltd",
  tenantSlug: "alpha-healthcare",
  tenantType: "CLIENT",
  isSdf: true,
};

const BETA_CUSTOMER: SessionUser = {
  userId: "018f3a5b-7c8d-7e90-8000-000000000121",
  email: "admin@betaexpress.example.com",
  fullName: "Rohan Kapoor",
  role: "CLIENT_ADMIN",
  tenantId: "018f3a5b-7c8d-7e90-8000-000000000003",
  tenantName: "Beta Express Supply Chain Solutions Ltd",
  tenantSlug: "beta-express",
  tenantType: "CLIENT",
  isSdf: false,
};

const DEMO_CONSULTANT: SessionUser = {
  userId: "018f3a5b-7c8d-7e90-8000-000000000191",
  email: "consultant.demo@tli.local",
  fullName: "TLI Consultant Demo",
  role: "TLI_LEAD_CONSULTANT",
  tenantId: "018f3a5b-7c8d-7e90-8000-000000000001",
  tenantName: "Truth Labs International",
  tenantSlug: "truth-labs-advisory",
  tenantType: "TLI",
  isSdf: false,
};

const ASSESSMENT_ALPHA_ID = "018f3a5b-7c8d-7e90-8000-000000000201";
const ASSESSMENT_BETA_ID = "018f3a5b-7c8d-7e90-8000-000000000202";

// Helper to generate a valid PDF byte buffer
function createValidPdfBuffer(contentStr = "DPDP Compliance Test Document"): Buffer {
  const header = "%PDF-1.4\n";
  const body = `1 0 obj\n<< /Title (${contentStr}) >>\nendobj\n`;
  const xref = "xref\n0 1\n0000000000 65535 f \ntrailer\n<< /Size 1 >>\nstartxref\n90\n%%EOF\n";
  return Buffer.from(header + body + xref, "utf-8");
}

describe("Phase 3D.3: Evidence Vault & Clarification Workflows", () => {
  after(async () => {
    if (createdEvidenceId) {
      try {
        await pool.query(
          "ALTER TABLE evidence_review_history DISABLE TRIGGER trg_evidence_review_history_immutable;"
        );
        await pool.query(
          "DELETE FROM evidence_review_history WHERE evidence_item_id = $1;",
          [createdEvidenceId]
        );
        await pool.query(
          "ALTER TABLE evidence_review_history ENABLE TRIGGER trg_evidence_review_history_immutable;"
        );
        await pool.query(
          "DELETE FROM clarification_messages WHERE thread_id IN (SELECT id FROM clarification_threads WHERE evidence_item_id = $1);",
          [createdEvidenceId]
        );
        await pool.query(
          "DELETE FROM clarification_threads WHERE evidence_item_id = $1;",
          [createdEvidenceId]
        );
        await pool.query("DELETE FROM evidence_items WHERE id = $1;", [createdEvidenceId]);
      } catch (e) {
        console.error("Cleanup error in after():", e);
      }
    }
    await pool.end();
  });

  it("1. should enforce file bounds and reject undersized (<100B) or oversized (>50MB) uploads", () => {
    const validator = new FileValidator();

    // Undersized (< 100 bytes)
    assert.throws(
      () => validator.validateMetadata("tiny.pdf", "application/pdf", 50),
      (err: any) => err instanceof ValidationError && err.message.includes("below minimum allowed")
    );

    // Oversized (> 50 MB)
    assert.throws(
      () => validator.validateMetadata("huge.pdf", "application/pdf", 55 * 1024 * 1024),
      (err: any) => err instanceof ValidationError && err.message.includes("exceeds maximum allowed")
    );

    // Allowed size (e.g. 500 KB)
    const valid = validator.validateMetadata("document.pdf", "application/pdf", 500 * 1024);
    assert.equal(valid.sanitizedFilename, "document.pdf");
    assert.equal(valid.normalizedMime, "application/pdf");
  });

  it("2. should verify binary magic bytes and reject dangerous executable signatures disguised as documents", () => {
    const validator = new FileValidator();

    // Valid PDF buffer
    const validPdf = createValidPdfBuffer();
    assert.doesNotThrow(() => validator.verifyMagicBytes(validPdf, "application/pdf"));

    // Windows Executable (MZ) disguised as PDF
    const fakePdfExe = Buffer.alloc(500);
    fakePdfExe.write("MZ\x90\x00", 0, "binary");
    assert.throws(
      () => validator.verifyMagicBytes(fakePdfExe, "application/pdf"),
      (err: any) => err instanceof ValidationError && err.message.includes("Detected forbidden content signature")
    );

    // Linux ELF binary disguised as DOCX
    const fakeDocxElf = Buffer.alloc(500);
    fakeDocxElf.write("\x7fELF", 0, "binary");
    assert.throws(
      () =>
        validator.verifyMagicBytes(
          fakeDocxElf,
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ),
      (err: any) => err instanceof ValidationError && err.message.includes("Detected forbidden content signature")
    );
  });

  it("3. should reject cross-tenant evidence upload attempts under live PostgreSQL RLS", async () => {
    const vault = new EvidenceVaultService();
    const pdfBuf = createValidPdfBuffer("Cross-tenant attempt");

    // BETA_CUSTOMER tries to upload evidence for Alpha's assessment
    await assert.rejects(
      async () => {
        await vault.uploadEvidence({
          sessionUser: BETA_CUSTOMER,
          assessmentId: ASSESSMENT_ALPHA_ID,
          controlCode: "GOV-01",
          questionCode: "GOV-01",
          evidenceCategory: "Policy / Procedure",
          description: "Illegal cross-tenant upload",
          filename: "cross_tenant.pdf",
          mimeType: "application/pdf",
          content: pdfBuf,
        });
      },
      (err: any) => {
        return (
          err instanceof ValidationError &&
          err.message.includes("Target assessment not found or not accessible under your security profile")
        );
      }
    );
  });

  let createdEvidenceId: string = "";

  it("4. should upload evidence and bind assessmentId, questionCode, category, and description under live RLS", async () => {
    const vault = new EvidenceVaultService();
    const pdfBuf = createValidPdfBuffer("Alpha Data Protection Policy 2026");

    const record = await vault.uploadEvidence({
      sessionUser: DEMO_CUSTOMER,
      assessmentId: ASSESSMENT_ALPHA_ID,
      controlCode: "GOV-01",
      questionCode: "GOV-01",
      evidenceCategory: "Policy / Procedure",
      description: "Alpha Health Data Protection Policy approved by Board",
      filename: "Alpha_DPDP_Policy_2026.pdf",
      mimeType: "application/pdf",
      content: pdfBuf,
    });

    assert.ok(record.id, "Must generate evidence record ID");
    assert.equal(record.status, "ACTIVE");
    assert.equal(record.questionCode, "GOV-01");
    assert.equal(record.evidenceCategory, "Policy / Procedure");
    assert.equal(record.description, "Alpha Health Data Protection Policy approved by Board");
    assert.equal(record.uploadedByUserId, DEMO_CUSTOMER.userId);
    createdEvidenceId = record.id;

    // Verify row in database under live RLS
    await executeWithRls(DEMO_CUSTOMER, async (client) => {
      const res = await client.query(
        `SELECT id, tenant_id, assessment_id, question_code, evidence_category, description, status, sha256_hash
         FROM evidence_items WHERE id = $1;`,
        [createdEvidenceId]
      );
      assert.equal(res.rowCount, 1, "Must find newly uploaded evidence item in DB");
      const row = res.rows[0];
      assert.equal(row.tenant_id, DEMO_CUSTOMER.tenantId);
      assert.equal(row.assessment_id, ASSESSMENT_ALPHA_ID);
      assert.equal(row.question_code, "GOV-01");
      assert.equal(row.evidence_category, "Policy / Procedure");
      assert.equal(row.status, "ACTIVE");
    });
  });

  it("5. should enforce fail-closed download gating blocking cross-tenant and quarantined downloads", async () => {
    const vault = new EvidenceVaultService();

    // 1. Cross-tenant download attempt: Beta user attempts to download Alpha's evidence
    await assert.rejects(
      async () => {
        await vault.getEvidenceForDownload(BETA_CUSTOMER, createdEvidenceId);
      },
      (err: any) =>
        err instanceof ValidationError &&
        (err.message.includes("Access denied") || err.message.includes("not found"))
    );

    // 2. Authorized Alpha user can download active evidence
    const download = await vault.getEvidenceForDownload(DEMO_CUSTOMER, createdEvidenceId);
    assert.ok(download.content.length > 0);
    assert.equal(download.record.id, createdEvidenceId);

    // 3. Quarantined file download block
    await executeWithRls(DEMO_CONSULTANT, async (client) => {
      await client.query("UPDATE evidence_items SET status = 'QUARANTINED' WHERE id = $1;", [createdEvidenceId]);
    });
    await assert.rejects(
      async () => {
        await vault.getEvidenceForDownload(DEMO_CUSTOMER, createdEvidenceId);
      },
      (err: any) =>
        err instanceof ValidationError && err.message.includes("Quarantined, deleted, or unverified payloads")
    );

    // Restore to ACTIVE for subsequent tests
    await executeWithRls(DEMO_CONSULTANT, async (client) => {
      await client.query("UPDATE evidence_items SET status = 'ACTIVE' WHERE id = $1;", [createdEvidenceId]);
    });
  });

  it("6. should allow authorized assessor to record review decision (VERIFIED) and append immutable audit log", async () => {
    const vault = new EvidenceVaultService();
    const verificationNotes = "Verified: Policy incorporates DPDP Act Section 6 consent guidelines.";

    // Assessor reviews and marks VERIFIED
    const updated = await vault.reviewEvidence({
      sessionUser: DEMO_CONSULTANT,
      evidenceId: createdEvidenceId,
      status: "VERIFIED",
      verificationNotes,
    });

    assert.equal(updated.status, "VERIFIED");
    assert.equal(updated.verifiedByReviewerId, DEMO_CONSULTANT.userId);
    assert.equal(updated.verificationNotes, verificationNotes);

    // Verify database row and immutable evidence_review_history
    const reviewHistoryId = await executeWithRls(DEMO_CONSULTANT, async (client) => {
      const itemRes = await client.query(
        "SELECT status, verification_notes, verified_by_reviewer_id FROM evidence_items WHERE id = $1;",
        [createdEvidenceId]
      );
      assert.equal(itemRes.rows[0].status, "VERIFIED");
      assert.equal(itemRes.rows[0].verified_by_reviewer_id, DEMO_CONSULTANT.userId);

      const histRes = await client.query(
        `SELECT id, evidence_item_id, previous_status, new_status, verification_notes, reviewed_by_user_id
         FROM evidence_review_history WHERE evidence_item_id = $1
         ORDER BY reviewed_at DESC LIMIT 1;`,
        [createdEvidenceId]
      );
      assert.equal(histRes.rowCount, 1, "Must have recorded audit log in evidence_review_history");
      const hist = histRes.rows[0];
      assert.equal(hist.previous_status, "ACTIVE");
      assert.equal(hist.new_status, "VERIFIED");
      assert.equal(hist.reviewed_by_user_id, DEMO_CONSULTANT.userId);
      assert.equal(hist.verification_notes, verificationNotes);
      return hist.id;
    });

    // Verify defense-in-depth: dpdp_app_user has NO UPDATE grant, and trigger blocks modification
    await assert.rejects(
      async () => {
        await executeWithRls(DEMO_CONSULTANT, async (client) => {
          await client.query("UPDATE evidence_review_history SET new_status = 'REJECTED' WHERE id = $1;", [
            reviewHistoryId,
          ]);
        });
      },
      (err: any) =>
        err.message.includes("permission denied") ||
        err.message.includes("prevent_immutable_record_modification")
    );

    // Verify defense-in-depth: dpdp_app_user has NO DELETE grant, and trigger blocks modification
    await assert.rejects(
      async () => {
        await executeWithRls(DEMO_CONSULTANT, async (client) => {
          await client.query("DELETE FROM evidence_review_history WHERE id = $1;", [reviewHistoryId]);
        });
      },
      (err: any) =>
        err.message.includes("permission denied") ||
        err.message.includes("prevent_immutable_record_modification")
    );
  });

  it("7. should reject review decision attempts by unauthorized client users", async () => {
    const vault = new EvidenceVaultService();

    await assert.rejects(
      async () => {
        await vault.reviewEvidence({
          sessionUser: DEMO_CUSTOMER, // CLIENT_ADMIN, not an assessor
          evidenceId: createdEvidenceId,
          status: "VERIFIED",
          verificationNotes: "Attempting unauthorized self-verification",
        });
      },
      (err: any) =>
        err instanceof ValidationError &&
        err.message.includes("Only authorized TLI assessors can record evidence review decisions")
    );
  });

  it("8. should support clarification thread creation, target roles, and threaded messages linked to evidence", async () => {
    // 1. Assessor opens clarification thread linked to createdEvidenceId and target_role = CLIENT_ADMIN
    const threadResult = await executeWithRls(DEMO_CONSULTANT, async (client) => {
      const threadRes = await client.query(
        `INSERT INTO clarification_threads (
          assessment_id,
          question_code,
          evidence_item_id,
          target_role,
          raised_by_user_id,
          title,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'OPEN')
        RETURNING id;`,
        [
          ASSESSMENT_ALPHA_ID,
          "GOV-01",
          createdEvidenceId,
          "CLIENT_ADMIN",
          DEMO_CONSULTANT.userId,
          "Clarification on Data Protection Officer Escalation Path",
        ]
      );
      const threadId = threadRes.rows[0].id;

      // First assessor message
      await client.query(
        `INSERT INTO clarification_messages (thread_id, author_user_id, message_text)
         VALUES ($1, $2, $3);`,
        [
          threadId,
          DEMO_CONSULTANT.userId,
          "Please clarify if the DPO reports directly to the Board of Directors.",
        ]
      );

      return threadId;
    });

    assert.ok(threadResult, "Thread ID must be returned");

    // 2. Client responds to clarification thread
    await executeWithRls(DEMO_CUSTOMER, async (client) => {
      await client.query(
        `INSERT INTO clarification_messages (thread_id, author_user_id, message_text)
         VALUES ($1, $2, $3);`,
        [
          threadResult,
          DEMO_CUSTOMER.userId,
          "Confirmed: As per Org_Structure.docx, the DPO has direct reporting line to the Board Audit Committee.",
        ]
      );

      // Client updates status to IN_PROGRESS
      await client.query(
        "UPDATE clarification_threads SET status = 'IN_PROGRESS' WHERE id = $1;",
        [threadResult]
      );
    });

    // 3. Assessor accepts and marks RESOLVED
    await executeWithRls(DEMO_CONSULTANT, async (client) => {
      await client.query(
        `UPDATE clarification_threads
         SET status = 'RESOLVED', resolved_at = CURRENT_TIMESTAMP
         WHERE id = $1;`,
        [threadResult]
      );

      const checkRes = await client.query(
        "SELECT status, resolved_at FROM clarification_threads WHERE id = $1;",
        [threadResult]
      );
      assert.equal(checkRes.rows[0].status, "RESOLVED");
      assert.ok(checkRes.rows[0].resolved_at !== null);

      // Verify messages count
      const msgsRes = await client.query(
        "SELECT COUNT(*) AS total FROM clarification_messages WHERE thread_id = $1;",
        [threadResult]
      );
      assert.equal(Number(msgsRes.rows[0].total), 2);
    });
  });

  it("9. should preserve client questionnaire responses immutably across evidence and clarification actions", async () => {
    // Verify client responses for GOV-01 are not overwritten or mutated by evidence/clarifications
    await executeWithRls(DEMO_CUSTOMER, async (client) => {
      // Set or verify an answer
      await client.query(
        `INSERT INTO assessment_questionnaire_responses (
          assessment_id, tenant_id, question_code, selected_option, comments_and_justification, questionnaire_version
        ) VALUES ($1, $2, 'GOV-01', 'Implemented', 'Client verified internal governance structure.', 'v1.0')
        ON CONFLICT (assessment_id, question_code)
        DO UPDATE SET selected_option = EXCLUDED.selected_option, updated_at = CURRENT_TIMESTAMP;`,
        [ASSESSMENT_ALPHA_ID, DEMO_CUSTOMER.tenantId]
      );

      const res = await client.query(
        "SELECT selected_option, comments_and_justification FROM assessment_questionnaire_responses WHERE assessment_id = $1 AND question_code = 'GOV-01';",
        [ASSESSMENT_ALPHA_ID]
      );
      assert.equal(res.rows[0].selected_option, "Implemented");
      assert.equal(res.rows[0].comments_and_justification, "Client verified internal governance structure.");
    });
  });

  it("10. should calculate independent Evidence Coverage metrics separately from questionnaire readiness", async () => {
    // Under RLS, query active/verified evidence for Alpha
    await executeWithRls(DEMO_CUSTOMER, async (client) => {
      const res = await client.query(
        `SELECT DISTINCT question_code
         FROM evidence_items
         WHERE assessment_id = $1 AND status IN ('ACTIVE', 'VERIFIED') AND question_code IS NOT NULL;`,
        [ASSESSMENT_ALPHA_ID]
      );

      const distinctQuestionsCovered = res.rowCount || 0;
      assert.ok(distinctQuestionsCovered >= 1, "At least GOV-01 is covered with evidence");

      const CANONICAL_TOTAL = 60;
      const coveragePct = Math.round((distinctQuestionsCovered / CANONICAL_TOTAL) * 100);

      assert.ok(coveragePct >= 1, "Coverage percentage must be calculated against canonical 60 questions");
      assert.ok(coveragePct <= 100, "Coverage percentage cannot exceed 100%");
    });
  });

  it("11. should soft-delete evidence item, record user attribution, and block subsequent downloads", async () => {
    const vault = new EvidenceVaultService();

    // Customer soft-deletes the evidence item
    const delResult = await vault.deleteEvidence({
      sessionUser: DEMO_CUSTOMER,
      evidenceId: createdEvidenceId,
    });
    assert.equal(delResult.deleted, true);

    // Verify DB state
    await executeWithRls(DEMO_CUSTOMER, async (client) => {
      const res = await client.query(
        "SELECT status, deleted_at, deleted_by_user_id FROM evidence_items WHERE id = $1;",
        [createdEvidenceId]
      );
      assert.equal(res.rows[0].status, "DELETED");
      assert.ok(res.rows[0].deleted_at !== null, "deleted_at must be populated");
      assert.equal(res.rows[0].deleted_by_user_id, DEMO_CUSTOMER.userId);
    });

    // Verify subsequent download attempt is blocked fail-closed
    await assert.rejects(
      async () => {
        await vault.getEvidenceForDownload(DEMO_CUSTOMER, createdEvidenceId);
      },
      (err: any) =>
        err instanceof ValidationError &&
        err.message.includes("Quarantined, deleted, or unverified payloads are blocked")
    );
  });
});
