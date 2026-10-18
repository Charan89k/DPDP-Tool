import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { executeWithRls } from "../lib/db/rls.ts";
import { pool } from "../lib/db/pool.ts";
import type { SessionUser } from "../lib/auth/types.ts";

const __filename = fileURLToPath(import.meta.url);
const BASE_DIR = path.dirname(path.dirname(__filename));
const JSON_PATH = path.join(BASE_DIR, "data", "questionnaire_v1.json");

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

const UNASSIGNED_REVIEWER: SessionUser = {
  userId: "018f3a5b-7c8d-7e90-8000-000000000103", // Karan Verma (assigned to Alpha, but NOT Beta)
  email: "reviewer.privacy@truthlabs.in",
  fullName: "Karan Verma",
  role: "TLI_REVIEWER",
  tenantId: "018f3a5b-7c8d-7e90-8000-000000000001",
  tenantName: "Truth Labs International",
  tenantSlug: "truth-labs-advisory",
  tenantType: "TLI",
  isSdf: false,
};

const ASSESSMENT_ALPHA_ID = "018f3a5b-7c8d-7e90-8000-000000000201";
const ASSESSMENT_BETA_ID = "018f3a5b-7c8d-7e90-8000-000000000202";

describe("Phase 3D.2: Assessor Review Workspace & Clarifications Engine", () => {
  after(async () => {
    await pool.end();
  });

  it("1. should verify canonical 60 questions and 8 sections structure for review workspace", () => {
    assert.ok(fs.existsSync(JSON_PATH), "Canonical questionnaire manifest must exist");
    const manifest = JSON.parse(fs.readFileSync(JSON_PATH, "utf-8"));

    assert.equal(manifest.sections.length, 8, "Must contain exactly 8 sections");
    assert.equal(manifest.questions.length, 60, "Must contain exactly 60 canonical questions");

    const expectedSections = ["GOV", "DAT", "NOT", "RGT", "SEC", "RET", "TPR", "APP"];
    const sectionCodes = manifest.sections.map((s: any) => s.code);
    assert.deepEqual(sectionCodes, expectedSections);

    for (const q of manifest.questions) {
      assert.ok(q.code && q.code.length > 0, "Question must have code");
      assert.ok(q.text && q.text.length > 0, "Question must have text");
      assert.equal(q.options.length, 5, "Question must have 5 options");
    }
  });

  it("2. should allow assigned lead consultant to record and update review findings under live RLS", async () => {
    const qCode = "GOV-002";
    const findingsText = "Audit indicates privacy policy is updated, but DPO contact details are missing from public footer.";
    const deficiencyText = "Provide updated website screenshots reflecting official DPO contact information.";

    const result = await executeWithRls(DEMO_CONSULTANT, async (client) => {
      // 1. Upsert review evaluation
      await client.query(
        `INSERT INTO questionnaire_assessor_reviews (
          assessment_id,
          question_code,
          review_status,
          review_findings,
          evidence_deficiency_notes,
          requires_further_validation,
          reviewed_by_user_id,
          reviewed_at
        ) VALUES ($1, $2, 'PARTIALLY_COMPLIANT', $3, $4, TRUE, $5, CURRENT_TIMESTAMP)
        ON CONFLICT (assessment_id, question_code)
        DO UPDATE SET
          review_status = EXCLUDED.review_status,
          review_findings = EXCLUDED.review_findings,
          evidence_deficiency_notes = EXCLUDED.evidence_deficiency_notes,
          requires_further_validation = EXCLUDED.requires_further_validation,
          reviewed_by_user_id = EXCLUDED.reviewed_by_user_id,
          reviewed_at = CURRENT_TIMESTAMP;`,
        [ASSESSMENT_ALPHA_ID, qCode, findingsText, deficiencyText, DEMO_CONSULTANT.userId]
      );

      // 2. Query back to verify persistence
      const res = await client.query(
        `SELECT 
          question_code,
          review_status,
          review_findings,
          evidence_deficiency_notes,
          requires_further_validation,
          reviewed_by_user_id
        FROM questionnaire_assessor_reviews
        WHERE assessment_id = $1 AND question_code = $2;`,
        [ASSESSMENT_ALPHA_ID, qCode]
      );

      return res.rows[0];
    });

    assert.ok(result, "Assessor review record must exist");
    assert.equal(result.question_code, qCode);
    assert.equal(result.review_status, "PARTIALLY_COMPLIANT");
    assert.equal(result.review_findings, findingsText);
    assert.equal(result.evidence_deficiency_notes, deficiencyText);
    assert.equal(result.requires_further_validation, true);
    assert.equal(result.reviewed_by_user_id, DEMO_CONSULTANT.userId);

    // Now update to VERIFIED_COMPLIANT
    const updated = await executeWithRls(DEMO_CONSULTANT, async (client) => {
      await client.query(
        `UPDATE questionnaire_assessor_reviews
         SET review_status = 'VERIFIED_COMPLIANT',
             requires_further_validation = FALSE,
             updated_at = CURRENT_TIMESTAMP
         WHERE assessment_id = $1 AND question_code = $2;`,
        [ASSESSMENT_ALPHA_ID, qCode]
      );

      const res = await client.query(
        `SELECT review_status, requires_further_validation
         FROM questionnaire_assessor_reviews
         WHERE assessment_id = $1 AND question_code = $2;`,
        [ASSESSMENT_ALPHA_ID, qCode]
      );
      return res.rows[0];
    });

    assert.equal(updated.review_status, "VERIFIED_COMPLIANT");
    assert.equal(updated.requires_further_validation, false);
  });

  it("3. should enforce append-only immutability on questionnaire_assessor_review_history", async () => {
    const qCode = "GOV-002";
    const historyId = "018f3a5b-7c8d-7e90-8000-000000000601";

    // 1. Insert history entry
    await executeWithRls(DEMO_CONSULTANT, async (client) => {
      await client.query(
        `INSERT INTO questionnaire_assessor_review_history (
          id,
          assessment_id,
          question_code,
          version_number,
          review_status,
          review_findings,
          reviewed_by_user_id
        ) VALUES ($1, $2, $3, 1, 'PARTIALLY_COMPLIANT', 'Initial finding', $4)
        ON CONFLICT (assessment_id, question_code, version_number) DO NOTHING;`,
        [historyId, ASSESSMENT_ALPHA_ID, qCode, DEMO_CONSULTANT.userId]
      );
    });

    // 2. Verify UPDATE is blocked
    await executeWithRls(DEMO_CONSULTANT, async (client) => {
      await assert.rejects(
        async () => {
          await client.query(
            `UPDATE questionnaire_assessor_review_history
             SET review_findings = 'Tampered finding'
             WHERE id = $1;`,
            [historyId]
          );
        },
        /(permission denied|Cannot modify or delete immutable record|Immutable forensic record)/,
        "UPDATE on review history must be blocked by permissions or trigger"
      );
    });

    // 3. Verify DELETE is blocked
    await executeWithRls(DEMO_CONSULTANT, async (client) => {
      await assert.rejects(
        async () => {
          await client.query(
            `DELETE FROM questionnaire_assessor_review_history WHERE id = $1;`,
            [historyId]
          );
        },
        /(permission denied|Cannot modify or delete immutable record|Immutable forensic record)/,
        "DELETE on review history must be blocked by permissions or trigger"
      );
    });
  });

  it("4. should strictly block client user from inserting or modifying questionnaire_assessor_reviews", async () => {
    // 1. Client attempts to INSERT review evaluation
    await executeWithRls(DEMO_CUSTOMER, async (client) => {
      await assert.rejects(
        async () => {
          await client.query(
            `INSERT INTO questionnaire_assessor_reviews (
              assessment_id,
              question_code,
              review_status,
              review_findings,
              reviewed_by_user_id
            ) VALUES ($1, 'SEC-002', 'VERIFIED_COMPLIANT', 'Self-certified by client', $2);`,
            [ASSESSMENT_ALPHA_ID, DEMO_CUSTOMER.userId]
          );
        },
        (err: any) => {
          return (
            err.message.includes("row-level security policy") ||
            err.code === "42501"
          );
        },
        "Client user must be rejected when attempting to insert assessor review"
      );
    });

    // 2. Client attempts to UPDATE existing review evaluation
    await executeWithRls(DEMO_CUSTOMER, async (client) => {
      const updateRes = await client.query(
        `UPDATE questionnaire_assessor_reviews
         SET review_status = 'VERIFIED_COMPLIANT'
         WHERE assessment_id = $1 AND question_code = 'GOV-001';`,
        [ASSESSMENT_ALPHA_ID]
      );
      assert.equal(updateRes.rowCount, 0, "Client user must not affect any rows on review UPDATE under RLS");
    });
  });

  it("5. should strictly preserve client questionnaire responses and block consultant mutation", async () => {
    const qCode = "GOV-003";

    // 1. Client user submits an answer
    await executeWithRls(DEMO_CUSTOMER, async (client) => {
      await client.query(
        `INSERT INTO assessment_questionnaire_responses (
          assessment_id,
          tenant_id,
          question_code,
          selected_option,
          comments_and_justification
        ) VALUES ($1, $2, $3, 'Implemented', 'Original client response narrative.')
        ON CONFLICT (assessment_id, question_code)
        DO UPDATE SET
          selected_option = EXCLUDED.selected_option,
          comments_and_justification = EXCLUDED.comments_and_justification;`,
        [ASSESSMENT_ALPHA_ID, DEMO_CUSTOMER.tenantId, qCode]
      );
    });

    // 2. Consultant attempts to tamper with / overwrite client response
    await executeWithRls(DEMO_CONSULTANT, async (client) => {
      const updateRes = await client.query(
        `UPDATE assessment_questionnaire_responses
         SET selected_option = 'Not implemented'
         WHERE assessment_id = $1 AND question_code = $2;`,
        [ASSESSMENT_ALPHA_ID, qCode]
      );
      assert.equal(updateRes.rowCount, 0, "Consultant UPDATE on client responses must affect 0 rows under RLS");

      // Verify consultant CAN read client response (read visibility granted)
      const readRes = await client.query(
        `SELECT selected_option, comments_and_justification
         FROM assessment_questionnaire_responses
         WHERE assessment_id = $1 AND question_code = $2;`,
        [ASSESSMENT_ALPHA_ID, qCode]
      );
      assert.equal(readRes.rowCount, 1, "Assigned consultant must have read visibility on client responses");
      assert.equal(readRes.rows[0].selected_option, "Implemented", "Original client response must be preserved exactly");
    });
  });

  it("6. should block unassigned consultant from recording review evaluations on unassigned assessment", async () => {
    // UNASSIGNED_REVIEWER is assigned to Alpha, but NOT to Beta Express
    await executeWithRls(UNASSIGNED_REVIEWER, async (client) => {
      await assert.rejects(
        async () => {
          await client.query(
            `INSERT INTO questionnaire_assessor_reviews (
              assessment_id,
              question_code,
              review_status,
              review_findings,
              reviewed_by_user_id
            ) VALUES ($1, 'GOV-001', 'VERIFIED_COMPLIANT', 'Unauthorized evaluation', $2);`,
            [ASSESSMENT_BETA_ID, UNASSIGNED_REVIEWER.userId]
          );
        },
        (err: any) => {
          return (
            err.message.includes("row-level security policy") ||
            err.code === "42501"
          );
        },
        "Unassigned reviewer must be blocked by RLS from inserting reviews on unassigned assessment"
      );
    });
  });

  it("7. should support bidirectional clarification threads and message replies between assessor and client", async () => {
    const qCode = "NOT-002";
    const threadTitle = "Verification of Grievance Redressal Escalation Link";
    const consultantMsg = "Does the patient portal include a direct hyperlink to the Data Protection Board grievance form?";
    const clientReply = "Yes, confirmed in Release v2.4 under Settings > Privacy Rights.";


    // 1. Consultant raises clarification thread
    const createRes = await executeWithRls(DEMO_CONSULTANT, async (client) => {
      const tRes = await client.query(
        `INSERT INTO clarification_threads (
          assessment_id,
          question_code,
          raised_by_user_id,
          title,
          status
        ) VALUES ($1, $2, $3, $4, 'OPEN')
        RETURNING id;`,
        [ASSESSMENT_ALPHA_ID, qCode, DEMO_CONSULTANT.userId, threadTitle]
      );
      const tid = tRes.rows[0].id;

      await client.query(
        `INSERT INTO clarification_messages (
          thread_id,
          author_user_id,
          message_text
        ) VALUES ($1, $2, $3);`,
        [tid, DEMO_CONSULTANT.userId, consultantMsg]
      );

      return tid;
    });

    const threadId: string = createRes;
    assert.ok(threadId, "Thread ID must be generated");

    // 2. Client user reads the thread and replies
    await executeWithRls(DEMO_CUSTOMER, async (client) => {
      // Verify client can SELECT the thread
      const tCheck = await client.query(
        `SELECT id, title, status FROM clarification_threads WHERE id = $1;`,
        [threadId]
      );
      assert.equal(tCheck.rowCount, 1, "Client must be able to read clarification thread");
      assert.equal(tCheck.rows[0].title, threadTitle);

      // Client posts reply message
      await client.query(
        `INSERT INTO clarification_messages (
          thread_id,
          author_user_id,
          message_text
        ) VALUES ($1, $2, $3);`,
        [threadId, DEMO_CUSTOMER.userId, clientReply]
      );
    });

    // 3. Consultant reviews messages and resolves thread
    await executeWithRls(DEMO_CONSULTANT, async (client) => {
      const msgsRes = await client.query(
        `SELECT author_user_id, message_text 
         FROM clarification_messages
         WHERE thread_id = $1
         ORDER BY created_at ASC;`,
        [threadId]
      );

      assert.equal(msgsRes.rowCount, 2, "Must contain exactly 2 messages in thread");
      assert.equal(msgsRes.rows[0].author_user_id, DEMO_CONSULTANT.userId);
      assert.equal(msgsRes.rows[0].message_text, consultantMsg);
      assert.equal(msgsRes.rows[1].author_user_id, DEMO_CUSTOMER.userId);
      assert.equal(msgsRes.rows[1].message_text, clientReply);

      // Resolve thread
      await client.query(
        `UPDATE clarification_threads
         SET status = 'RESOLVED',
             resolved_at = CURRENT_TIMESTAMP
         WHERE id = $1;`,
        [threadId]
      );

      const finalCheck = await client.query(
        `SELECT status, resolved_at FROM clarification_threads WHERE id = $1;`,
        [threadId]
      );
      assert.equal(finalCheck.rows[0].status, "RESOLVED");
      assert.ok(finalCheck.rows[0].resolved_at, "resolved_at must be populated");
    });
  });
});

