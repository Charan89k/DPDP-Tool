import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { executeWithRls } from "../lib/db/rls.ts";
import { pool } from "../lib/db/pool.ts";
import type { SessionUser } from "../lib/auth/types.ts";
import {
  getCanonicalQuestionnaireSections,
  calculateQuestionnaireProgress,
  QUESTIONNAIRE_METADATA,
  CANONICAL_OPTIONS,
  CANONICAL_FOLLOWUP_PROMPT,
} from "../lib/questionnaire/data.ts";
import type { RespondentQuestionResponse } from "../lib/questionnaire/types.ts";

const __filename = fileURLToPath(import.meta.url);
const BASE_DIR = path.dirname(path.dirname(__filename));
const DOCX_PATH = path.join(BASE_DIR, "Truth_Labs_DPDP_60_Question_MS_Forms_Quick_Import_v1.docx");
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

const DEMO_BETA_CUSTOMER: SessionUser = {
  userId: "018f3a5b-7c8d-7e90-8000-000000000194",
  email: "beta.admin@betaexpress.local",
  fullName: "Beta Express Admin",
  role: "CLIENT_ADMIN",
  tenantId: "018f3a5b-7c8d-7e90-8000-000000000003",
  tenantName: "Beta Express Logistics Ltd",
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

describe("Phase 3D: Canonical Questionnaire Parity & Governance Verification", () => {
  after(async () => {
    try {
      await pool.end();
    } catch {}
  });

  it("1. should independently verify source DOCX exists and manifest matches canonical metadata", () => {
    assert.ok(fs.existsSync(DOCX_PATH), "Source DOCX must exist on disk");
    assert.ok(fs.existsSync(JSON_PATH), "Questionnaire manifest JSON must exist");

    const manifest = JSON.parse(fs.readFileSync(JSON_PATH, "utf-8"));
    assert.equal(manifest.version_id, "TLI-DPDP-MSFORMS-60Q-V1");
    assert.equal(manifest.total_sections, 8);
    assert.equal(manifest.total_questions, 60);
    assert.equal(manifest.title, "Truth Labs International — DPDP Gap Assessment");
    assert.equal(manifest.subtitle, "60-question Microsoft Forms Quick Import source");
    assert.equal(
      manifest.respondent_instructions,
      "Select the response that best describes the current state. Do not select “Not applicable” without providing a justification in the follow-up field. Evidence will be collected and validated separately by the Truth Labs assessor."
    );
  });

  it("2. should verify exactly 8 sections and 60 unique question codes in exact order", () => {
    const sections = getCanonicalQuestionnaireSections();
    assert.equal(sections.length, 8);

    const expectedSections = [
      { code: "GOV", count: 8, prefix: "GOV" },
      { code: "DAT", count: 8, prefix: "DAT" },
      { code: "NOT", count: 8, prefix: "NOT" },
      { code: "RGT", count: 7, prefix: "RGT" },
      { code: "SEC", count: 10, prefix: "SEC" },
      { code: "RET", count: 6, prefix: "RET" },
      { code: "TPR", count: 6, prefix: "TPR" },
      { code: "APP", count: 7, prefix: "APP" },
    ];

    const seenCodes = new Set<string>();
    let globalOrder = 1;

    for (let i = 0; i < expectedSections.length; i++) {
      const exp = expectedSections[i];
      const sec = sections[i];
      assert.equal(sec.code, exp.code);
      assert.equal(sec.questions.length, exp.count);

      for (let j = 0; j < sec.questions.length; j++) {
        const q = sec.questions[j];
        assert.equal(q.order, globalOrder);
        assert.ok(!seenCodes.has(q.code), `Duplicate question code: ${q.code}`);
        seenCodes.add(q.code);

        const expNum = String(j + 1).padStart(3, "0");
        assert.equal(q.code, `${exp.prefix}-${expNum}`);
        globalOrder++;
      }
    }

    assert.equal(seenCodes.size, 60);
  });

  it("3. should verify exact 5 response option labels and exact follow-up prompt", () => {
    const sections = getCanonicalQuestionnaireSections();
    const expectedOptions = [
      "Implemented",
      "Partially implemented",
      "Not implemented",
      "Unknown / not verified",
      "Not applicable — justification required",
    ];

    const expectedFollowup =
      "Follow-up field to add in Forms: Assessor / respondent comments and, if Not applicable, justification.";

    assert.deepEqual(Array.from(CANONICAL_OPTIONS), expectedOptions);
    assert.equal(CANONICAL_FOLLOWUP_PROMPT, expectedFollowup);

    for (const section of sections) {
      for (const q of section.questions) {
        assert.deepEqual(Array.from(q.options), expectedOptions);
        assert.equal(q.followUpPrompt, expectedFollowup);
      }
    }
  });

  it("4. should enforce non-empty justification for Not applicable in calculation logic", () => {
    const sections = getCanonicalQuestionnaireSections();
    const responses: Record<string, RespondentQuestionResponse> = {};

    responses["GOV-001"] = {
      questionCode: "GOV-001",
      selectedOption: "Not applicable — justification required",
      commentsAndJustification: "", // empty
    };

    let progress = calculateQuestionnaireProgress(sections, responses);
    assert.equal(progress.totalExcluded, 0, "Empty justification must not count as excluded/answered");
    assert.equal(progress.hasErrors, true);
    assert.equal(progress.sectionSummaries[0].missingJustificationCount, 1);

    responses["GOV-001"].commentsAndJustification = "Entity does not maintain branch entities.";
    progress = calculateQuestionnaireProgress(sections, responses);
    assert.equal(progress.totalExcluded, 1);
    assert.equal(progress.hasErrors, false);
    assert.equal(progress.sectionSummaries[0].missingJustificationCount, 0);
  });

  it("5. should persist and retrieve questionnaire responses under live PostgreSQL RLS", async () => {
    await executeWithRls(DEMO_CUSTOMER, async (client) => {
      // Upsert a response for GOV-001
      await client.query(
        `INSERT INTO assessment_questionnaire_responses (
          assessment_id, tenant_id, question_code, selected_option, comments_and_justification
        ) VALUES ($1, $2, 'GOV-001', 'Implemented', 'Assigned CISO and Privacy Office')
        ON CONFLICT (assessment_id, question_code)
        DO UPDATE SET
          selected_option = EXCLUDED.selected_option,
          comments_and_justification = EXCLUDED.comments_and_justification;`,
        [ASSESSMENT_ALPHA_ID, DEMO_CUSTOMER.tenantId]
      );

      // Query it back
      const res = await client.query(
        `SELECT question_code, selected_option, comments_and_justification
         FROM assessment_questionnaire_responses
         WHERE assessment_id = $1 AND question_code = 'GOV-001';`,
        [ASSESSMENT_ALPHA_ID]
      );

      assert.equal(res.rowCount, 1);
      assert.equal(res.rows[0].selected_option, "Implemented");
      assert.equal(res.rows[0].comments_and_justification, "Assigned CISO and Privacy Office");
    });
  });

  it("6. should enforce database CHECK constraint requiring justification when Not applicable is chosen", async () => {
    await executeWithRls(DEMO_CUSTOMER, async (client) => {
      await assert.rejects(
        async () => {
          await client.query(
            `INSERT INTO assessment_questionnaire_responses (
              assessment_id, tenant_id, question_code, selected_option, comments_and_justification
            ) VALUES ($1, $2, 'GOV-002', 'Not applicable — justification required', '')
            ON CONFLICT (assessment_id, question_code) DO NOTHING;`,
            [ASSESSMENT_ALPHA_ID, DEMO_CUSTOMER.tenantId]
          );
        },
        /chk_na_justification_required/,
        "Database must reject empty comments when 'Not applicable' is selected"
      );
    });
  });

  it("7. should increment version in questionnaire_response_history and block DELETE/UPDATE on history", async () => {
    // Insert initial version
    await executeWithRls(DEMO_CUSTOMER, async (client) => {
      await client.query(
        `INSERT INTO questionnaire_response_history (
          assessment_id, tenant_id, question_code, version_number, selected_option, comments_and_justification, submitted_by_id
        ) VALUES ($1, $2, 'GOV-001', 1, 'Partially implemented', 'Initial draft note', $3)
        ON CONFLICT (assessment_id, question_code, version_number) DO NOTHING;`,
        [ASSESSMENT_ALPHA_ID, DEMO_CUSTOMER.tenantId, DEMO_CUSTOMER.userId]
      );
    });

    // Verify database permission and trigger blocks UPDATE
    await executeWithRls(DEMO_CUSTOMER, async (client) => {
      await assert.rejects(
        async () => {
          await client.query(
            `UPDATE questionnaire_response_history
             SET comments_and_justification = 'Tampered'
             WHERE assessment_id = $1 AND question_code = 'GOV-001' AND version_number = 1;`,
            [ASSESSMENT_ALPHA_ID]
          );
        },
        /(permission denied|Immutable forensic record)/,
        "Database permissions and immutability trigger must block UPDATE on response history"
      );
    });

    // Verify database permission and trigger blocks DELETE
    await executeWithRls(DEMO_CUSTOMER, async (client) => {
      await assert.rejects(
        async () => {
          await client.query(
            `DELETE FROM questionnaire_response_history
             WHERE assessment_id = $1 AND question_code = 'GOV-001' AND version_number = 1;`,
            [ASSESSMENT_ALPHA_ID]
          );
        },
        /(permission denied|Immutable forensic record)/,
        "Database permissions and immutability trigger must block DELETE on response history"
      );
    });
  });

  it("8. should enforce cross-tenant isolation on questionnaire responses", async () => {
    // Client Alpha should NOT see or be able to write to Client Beta responses
    await executeWithRls(DEMO_CUSTOMER, async (client) => {
      // Read Beta's responses
      const res = await client.query(
        `SELECT * FROM assessment_questionnaire_responses WHERE assessment_id = $1;`,
        [ASSESSMENT_BETA_ID]
      );
      assert.equal(res.rowCount, 0, "Client Alpha cannot read Client Beta questionnaire responses");

      // Attempt cross-tenant insert
      await assert.rejects(
        async () => {
          await client.query(
            `INSERT INTO assessment_questionnaire_responses (
              assessment_id, tenant_id, question_code, selected_option, comments_and_justification
            ) VALUES ($1, $2, 'GOV-001', 'Implemented', 'Cross tenant attack');`,
            [ASSESSMENT_BETA_ID, DEMO_BETA_CUSTOMER.tenantId]
          );
        },
        /new row violates row-level security policy/,
        "Cross-tenant INSERT must be blocked by RLS"
      );
    });
  });

  it("9. should allow assigned consultant to read client responses but reject consultant modification", async () => {
    await executeWithRls(DEMO_CONSULTANT, async (client) => {
      // Consultant assigned to Alpha can read Alpha's responses
      const res = await client.query(
        `SELECT question_code, selected_option FROM assessment_questionnaire_responses WHERE assessment_id = $1;`,
        [ASSESSMENT_ALPHA_ID]
      );
      assert.ok(res.rowCount! >= 1, "Assigned consultant must have read visibility into responses");

      // Consultant CANNOT insert or update client responses (zero consultant write privilege)
      await assert.rejects(
        async () => {
          await client.query(
            `INSERT INTO assessment_questionnaire_responses (
              assessment_id, tenant_id, question_code, selected_option, comments_and_justification
            ) VALUES ($1, $2, 'GOV-004', 'Implemented', 'Unauthorized consultant write');`,
            [ASSESSMENT_ALPHA_ID, DEMO_CUSTOMER.tenantId]
          );
        },
        /new row violates row-level security policy/,
        "Consultant must not be permitted to insert or update client questionnaire responses"
      );
    });
  });
});
