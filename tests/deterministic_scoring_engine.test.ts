/**
 * TLI DPDP Compliance Gap Analysis Tool — Deterministic Scoring Engine Test Suite
 *
 * Comprehensive verification of:
 * 1. Pure deterministic domain engine calculation logic and reproducibility.
 * 2. 4 strictly separated metrics (Completeness, Coverage, Evidence, Readiness).
 * 3. Handling of response options (Implemented, Partially, Not implemented).
 * 4. Handling of exceptions (Unknown / not verified, Approved N/A, Unapproved N/A).
 * 5. Isolation of the 4 unresolved question mappings (GOV-005, GOV-006, GOV-008, APP-006).
 * 6. Division-by-zero guards on empty or fully excluded assessments.
 * 7. Non-compensatory dual metric and statutory deficit register with penalty tiers.
 * 8. Governance flags (PROVISIONAL_PENDING_APPROVAL, isOfficialScore: false).
 * 9. Live PostgreSQL RLS integration and score persistence.
 */

import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../lib/db/pool.ts";
import manifestData from "../data/questionnaire_v1.json" with { type: "json" };
import controlsData from "../data/dpdp_controls.json" with { type: "json" };
import {
  calculateAssessmentScores,
  normalizeQuestionCode,
} from "../lib/scoring/engine.ts";
import {
  DEFAULT_PROVISIONAL_CONFIG,
  UNMAPPED_QUESTION_CODES,
  STATUTORY_DOMAIN_WEIGHTS,
} from "../lib/scoring/config.ts";
import {
  getAssessmentScores,
  persistAssessmentScores,
} from "../lib/scoring/service.ts";
import { executeWithRls } from "../lib/db/rls.ts";
import type { SessionUser } from "../lib/auth/types.ts";
import type {
  QuestionResponseInput,
  AssessorReviewInput,
  ScoringCalculationInput,
} from "../lib/scoring/types.ts";

const DEMO_TENANT_ID = "018f3a5b-7c8d-7e90-8000-000000000002"; // Alpha Healthcare
const DEMO_BETA_TENANT_ID = "018f3a5b-7c8d-7e90-8000-000000000003"; // Beta Express
const DEMO_CONSULTANT_USER_ID = "018f3a5b-7c8d-7e90-8000-000000000191"; // TLI Lead Consultant Demo
const DEMO_CUSTOMER_USER_ID = "018f3a5b-7c8d-7e90-8000-000000000192"; // Alpha Customer Demo
const DEMO_CONSULTANT_TENANT_ID = "018f3a5b-7c8d-7e90-8000-000000000001"; // Truth Labs Advisory

const consultantSession: SessionUser = {
  userId: DEMO_CONSULTANT_USER_ID,
  tenantId: DEMO_CONSULTANT_TENANT_ID,
  email: "consultant.demo@tli.local",
  fullName: "TLI Consultant Demo",
  role: "TLI_LEAD_CONSULTANT",
  tenantType: "TLI",
  tenantName: "Test Organisation",
  tenantSlug: "test-organisation",
  isSdf: false,
};

const customerAlphaSession: SessionUser = {
  userId: DEMO_CUSTOMER_USER_ID,
  tenantId: DEMO_TENANT_ID,
  email: "customer.demo@tli.local",
  fullName: "Alpha Health Demo Admin",
  role: "CLIENT_ADMIN",
  tenantType: "CLIENT",
  tenantName: "Test Organisation",
  tenantSlug: "test-organisation",
  isSdf: false,
};

const customerBetaSession: SessionUser = {
  userId: "018f3a5b-7c8d-7e90-8000-000000000121",
  tenantId: DEMO_BETA_TENANT_ID,
  email: "admin@betaexpress.example.com",
  fullName: "Rohan Kapoor",
  role: "CLIENT_ADMIN",
  tenantType: "CLIENT",
  tenantName: "Test Organisation",
  tenantSlug: "test-organisation",
  isSdf: false,
};

describe("Phase 3D.4: Deterministic Scoring Engine & Governance Verification", () => {
  after(async () => {
    await pool.end();
  });
  // =========================================================================
  // TEST 1: Question Code Normalization
  // =========================================================================
  it("1. should correctly normalize 2-digit, 3-digit, and varied case question codes", () => {
    assert.equal(normalizeQuestionCode("GOV-01"), "GOV-001");
    assert.equal(normalizeQuestionCode("gov-01"), "GOV-001");
    assert.equal(normalizeQuestionCode("GOV-001"), "GOV-001");
    assert.equal(normalizeQuestionCode("DAT-05"), "DAT-005");
    assert.equal(normalizeQuestionCode("sec-12"), "SEC-012");
    assert.equal(normalizeQuestionCode("SEC-012"), "SEC-012");
    assert.equal(normalizeQuestionCode("MISC"), "MISC");
    assert.equal(normalizeQuestionCode(""), "");
  });

  // =========================================================================
  // TEST 2: Full Implementation (100% on all 60 questions)
  // =========================================================================
  it("2. should calculate 100.0% readiness and 5.00 maturity for fully implemented assessment", () => {
    const responses: QuestionResponseInput[] = manifestData.questions.map((q) => ({
      questionCode: q.code,
      selectedOption: "Implemented",
      commentsAndJustification: "Verified complete organizational implementation.",
    }));

    const input: ScoringCalculationInput = {
      assessmentId: "test-assess-1",
      engagementCode: "ENG-001",
      responses,
      evidenceCoverage: {
        totalEvidenceItems: 60,
        questionsWithEvidence: manifestData.questions.map((q) => q.code),
      },
    };

    const output = calculateAssessmentScores(input);

    // Verify Strictly Separated Metrics
    assert.equal(output.metrics.totalCanonicalQuestions, 60);
    assert.equal(output.metrics.totalAnswered, 60);
    assert.equal(output.metrics.totalApplicable, 60);
    assert.equal(output.metrics.totalConclusive, 60);
    assert.equal(output.metrics.totalScored, 60);
    assert.equal(output.metrics.totalUnknowns, 0);
    assert.equal(output.metrics.totalApprovedExcluded, 0);
    assert.equal(output.metrics.totalUnapprovedNa, 0);
    assert.equal(output.metrics.implementedCount, 60);
    assert.equal(output.metrics.partiallyImplementedCount, 0);
    assert.equal(output.metrics.notImplementedCount, 0);

    // 4 Independent Measures
    assert.equal(output.metrics.assessmentCompletenessPct, 100.0);
    assert.equal(output.metrics.responseCoveragePct, 100.0);
    assert.equal(output.metrics.evidenceCoveragePct, 100.0);
    assert.equal(output.metrics.indicativeReadinessPercentage, 100.0);
    assert.equal(output.metrics.indicativeMaturityScore, 5.0);
    assert.equal(output.metrics.conservativeReadinessPercentage, 100.0);

    assert.equal(output.metrics.isComplete, true);
    assert.equal(output.metrics.isIncomplete, false);
    assert.equal(output.metrics.hasUnknowns, false);
    assert.equal(output.metrics.hasUnapprovedExclusions, false);

    // Zero Deficits in Register
    assert.equal(output.statutoryDeficits.length, 0);

    // All 8 sections must have 100.0%
    assert.equal(output.sectionBreakdown.length, 8);
    for (const sec of output.sectionBreakdown) {
      assert.equal(sec.indicativePercentage, 100.0);
      assert.equal(sec.indicativeMaturityScore, 5.0);
      assert.equal(sec.isComplete, true);
    }

    // All 13 statutory domains evaluated (12 mapped at 100.0%, 1 unmapped PENALTY_READINESS is null)
    assert.equal(output.domainBreakdown.length, 13);
    for (const dom of output.domainBreakdown) {
      if (dom.mappedQuestionsCount > 0) {
        assert.equal(dom.indicativeDomainPercentage, 100.0);
        assert.equal(dom.domainMaturityScore, 5.0);
      } else {
        assert.equal(dom.indicativeDomainPercentage, null);
        assert.equal(dom.domainMaturityScore, null);
      }
      assert.equal(dom.gapCount, 0);
      assert.equal(dom.partialCount, 0);
    }
  });

  // =========================================================================
  // TEST 3: Incomplete Assessment (30 answered, 30 unanswered)
  // =========================================================================
  it("3. should handle incomplete assessment with separated completeness and conservative measures", () => {
    // Only first 30 questions answered as Implemented
    const responses: QuestionResponseInput[] = manifestData.questions.slice(0, 30).map((q) => ({
      questionCode: q.code,
      selectedOption: "Implemented",
    }));

    const input: ScoringCalculationInput = {
      responses,
    };

    const output = calculateAssessmentScores(input);

    assert.equal(output.metrics.totalCanonicalQuestions, 60);
    assert.equal(output.metrics.totalAnswered, 30);
    assert.equal(output.metrics.totalUnanswered, 30);
    assert.equal(output.metrics.assessmentCompletenessPct, 50.0);

    // Indicative percentage among scored is 100%, BUT conservative treats unassessed as 0
    assert.equal(output.metrics.indicativeReadinessPercentage, 100.0);
    assert.equal(output.metrics.conservativeReadinessPercentage, 50.0); // 3000 / 60 = 50.0%

    assert.equal(output.metrics.isComplete, false);
    assert.equal(output.metrics.isIncomplete, true);

    // Notice must be present
    assert.ok(
      output.metadata.notices.some((n) => n.includes("INCOMPLETE ASSESSMENT"))
    );
  });

  // =========================================================================
  // TEST 4: Unknown Responses Tracked Unscored
  // =========================================================================
  it("4. should track 'Unknown / not verified' as unscored without converting to 0 or 100", () => {
    const responses: QuestionResponseInput[] = manifestData.questions.map((q, idx) => ({
      questionCode: q.code,
      selectedOption: idx < 10 ? "Unknown / not verified" : "Implemented",
    }));

    const output = calculateAssessmentScores({ responses });

    assert.equal(output.metrics.totalAnswered, 60);
    assert.equal(output.metrics.totalUnknowns, 10);
    assert.equal(output.metrics.totalScored, 50); // only 50 scored
    assert.equal(output.metrics.totalConclusive, 50);

    // Unknowns depress response coverage
    assert.equal(output.metrics.responseCoveragePct, 83.3); // (50 / 60) * 100 = 83.333... -> 83.3%
    assert.equal(output.metrics.indicativeReadinessPercentage, 100.0); // 5000 / 50 = 100.0%
    assert.equal(output.metrics.conservativeReadinessPercentage, 83.3); // 5000 / 60 = 83.3%

    assert.equal(output.metrics.hasUnknowns, true);

    // Deficit register flags the 10 unknown questions as UNVERIFIED_RISK
    const unknownDeficits = output.statutoryDeficits.filter(
      (d) => d.severity === "UNVERIFIED_RISK"
    );
    assert.equal(unknownDeficits.length, 10);

    // Evaluation detail check
    const unknownEval = output.questionEvaluations.find(
      (qe) => qe.evaluationStatus === "UNSCORED_UNKNOWN"
    );
    assert.ok(unknownEval);
    assert.equal(unknownEval.rawPoints, null);
    assert.equal(unknownEval.isScored, false);
    assert.equal(unknownEval.isConclusive, false);
  });

  // =========================================================================
  // TEST 5: Approved N/A Exclusion vs Unapproved N/A Exclusion
  // =========================================================================
  it("5. should exclude N/A only when valid justification exists AND assessor approved it", () => {
    // 58 Implemented, 1 Approved N/A (q0), 1 Unapproved N/A (q1)
    const q0 = manifestData.questions[0]; // GOV-001
    const q1 = manifestData.questions[1]; // GOV-002

    const responses: QuestionResponseInput[] = manifestData.questions.map((q) => {
      if (q.code === q0.code) {
        return {
          questionCode: q.code,
          selectedOption: "Not applicable — justification required",
          commentsAndJustification: "Legitimate statutory exemption applies.",
        };
      }
      if (q.code === q1.code) {
        return {
          questionCode: q.code,
          selectedOption: "Not applicable — justification required",
          commentsAndJustification: "", // Missing justification!
        };
      }
      return {
        questionCode: q.code,
        selectedOption: "Implemented",
      };
    });

    // Assessor approved q0 only
    const assessorReviews: AssessorReviewInput[] = [
      {
        questionCode: q0.code,
        reviewStatus: "EXCLUSION_VERIFIED",
        isExclusionApproved: true,
      },
      {
        questionCode: q1.code,
        reviewStatus: "PENDING_REVIEW",
        isExclusionApproved: false,
      },
    ];

    const output = calculateAssessmentScores({ responses, assessorReviews });

    // q0 is EXCLUDED_APPROVED
    const eval0 = output.questionEvaluations.find(
      (qe) => qe.questionCode === normalizeQuestionCode(q0.code)
    );
    assert.ok(eval0);
    assert.equal(eval0.evaluationStatus, "EXCLUDED_APPROVED");
    assert.equal(eval0.isExcluded, true);
    assert.equal(eval0.isScored, false);

    // q1 is UNAPPROVED_NA
    const eval1 = output.questionEvaluations.find(
      (qe) => qe.questionCode === normalizeQuestionCode(q1.code)
    );
    assert.ok(eval1);
    assert.equal(eval1.evaluationStatus, "UNAPPROVED_NA");
    assert.equal(eval1.isExcluded, false);
    assert.equal(eval1.hasValidJustification, false);

    // Totals
    assert.equal(output.metrics.totalApprovedExcluded, 1);
    assert.equal(output.metrics.totalUnapprovedNa, 1);
    assert.equal(output.metrics.totalApplicable, 59); // 60 - 1
    assert.equal(output.metrics.totalScored, 58); // 58 Implemented
    assert.equal(output.metrics.totalConclusive, 58);
    assert.equal(output.metrics.hasUnapprovedExclusions, true);

    // q1 appears in statutoryDeficits as UNAPPROVED_EXCLUSION
    const unapprovedDeficit = output.statutoryDeficits.find(
      (d) => d.questionCode === normalizeQuestionCode(q1.code)
    );
    assert.ok(unapprovedDeficit);
    assert.equal(unapprovedDeficit.severity, "UNAPPROVED_EXCLUSION");

    // q0 does NOT appear in deficits
    const approvedDeficit = output.statutoryDeficits.find(
      (d) => d.questionCode === normalizeQuestionCode(q0.code)
    );
    assert.equal(approvedDeficit, undefined);
  });

  // =========================================================================
  // TEST 6: Unresolved Question Mappings Isolation (GOV-005, GOV-006, GOV-008, APP-006)
  // =========================================================================
  it("6. should isolate the 4 unresolved question mappings from statutory domain rollups", () => {
    assert.equal(UNMAPPED_QUESTION_CODES.length, 4);
    assert.deepEqual([...UNMAPPED_QUESTION_CODES], [
      "GOV-005",
      "GOV-006",
      "GOV-008",
      "APP-006",
    ]);

    const responses: QuestionResponseInput[] = manifestData.questions.map((q) => ({
      questionCode: q.code,
      selectedOption: "Implemented",
    }));

    const output = calculateAssessmentScores({ responses });

    // Verify unmappedQuestions array contains exactly 4 questions
    assert.equal(output.unmappedQuestions.length, 4);
    const unmappedCodes = output.unmappedQuestions.map((q) => q.questionCode);
    for (const code of UNMAPPED_QUESTION_CODES) {
      assert.ok(unmappedCodes.includes(code));
    }

    // Verify that all 4 unmapped questions have mappingStatus = 'UNRESOLVED_PENDING_EXCEL_SHEET'
    // and canonicalControlId = null and statutoryDomain = null
    for (const q of output.unmappedQuestions) {
      assert.equal(q.mappingStatus, "UNRESOLVED_PENDING_EXCEL_SHEET");
      assert.equal(q.canonicalControlId, null);
      assert.equal(q.statutoryDomain, null);
    }

    // Sum of mappedQuestionsCount across all 13 statutory domains must equal exactly 56 (60 - 4)
    const totalMappedToDomains = output.domainBreakdown.reduce(
      (acc, d) => acc + d.mappedQuestionsCount,
      0
    );
    assert.equal(totalMappedToDomains, 56);
  });

  // =========================================================================
  // TEST 7: Deterministic Repeatability & Cryptographic Hash
  // =========================================================================
  it("7. should produce identical calculation hash and outputs for identical inputs", () => {
    const responses: QuestionResponseInput[] = manifestData.questions.map((q, idx) => ({
      questionCode: q.code,
      selectedOption:
        idx % 4 === 0
          ? "Implemented"
          : idx % 4 === 1
          ? "Partially implemented"
          : idx % 4 === 2
          ? "Not implemented"
          : "Unknown / not verified",
    }));

    const inputA: ScoringCalculationInput = {
      assessmentId: "repro-1",
      inputRevision: "fixed-rev-123",
      responses,
    };

    const inputB: ScoringCalculationInput = {
      assessmentId: "repro-1",
      inputRevision: "fixed-rev-123",
      // Reversed order of responses to test order independence in map
      responses: [...responses].reverse(),
    };

    const outputA = calculateAssessmentScores(inputA);
    const outputB = calculateAssessmentScores(inputB);

    assert.equal(outputA.metadata.calculationHash, outputB.metadata.calculationHash);
    assert.equal(
      outputA.metrics.indicativeReadinessPercentage,
      outputB.metrics.indicativeReadinessPercentage
    );
    assert.equal(
      outputA.metrics.indicativeMaturityScore,
      outputB.metrics.indicativeMaturityScore
    );
    assert.equal(
      outputA.metrics.responseCoveragePct,
      outputB.metrics.responseCoveragePct
    );
    assert.equal(outputA.statutoryDeficits.length, outputB.statutoryDeficits.length);

    // Modifying one response changes the calculation hash
    const inputModified: ScoringCalculationInput = {
      assessmentId: "repro-1",
      inputRevision: "fixed-rev-123",
      responses: responses.map((r, i) =>
        i === 0 ? { ...r, selectedOption: "Not implemented" } : r
      ),
    };
    const outputModified = calculateAssessmentScores(inputModified);
    assert.notEqual(outputA.metadata.calculationHash, outputModified.metadata.calculationHash);
  });

  // =========================================================================
  // TEST 8: Division-by-Zero Guards (Empty Assessment & All Excluded)
  // =========================================================================
  it("8. should guard against zero division on completely empty or all-excluded assessments", () => {
    // Empty assessment (0 responses)
    const emptyOutput = calculateAssessmentScores({ responses: [] });
    assert.equal(emptyOutput.metrics.totalAnswered, 0);
    assert.equal(emptyOutput.metrics.totalScored, 0);
    assert.equal(emptyOutput.metrics.indicativeReadinessPercentage, null);
    assert.equal(emptyOutput.metrics.indicativeMaturityScore, null);
    assert.equal(emptyOutput.metrics.conservativeReadinessPercentage, 0.0);
    assert.equal(emptyOutput.metrics.assessmentCompletenessPct, 0.0);
    assert.equal(emptyOutput.metrics.responseCoveragePct, 0.0);
    assert.equal(emptyOutput.metrics.hasZeroScorableQuestions, true);

    for (const sec of emptyOutput.sectionBreakdown) {
      assert.equal(sec.indicativePercentage, null);
      assert.equal(sec.indicativeMaturityScore, null);
    }
    for (const dom of emptyOutput.domainBreakdown) {
      assert.equal(dom.indicativeDomainPercentage, null);
      assert.equal(dom.domainMaturityScore, null);
    }

    // All-excluded assessment (60 approved N/A)
    const allNaResponses: QuestionResponseInput[] = manifestData.questions.map((q) => ({
      questionCode: q.code,
      selectedOption: "Not applicable — justification required",
      commentsAndJustification: "Statutory exemption documented.",
    }));
    const allNaReviews: AssessorReviewInput[] = manifestData.questions.map((q) => ({
      questionCode: q.code,
      reviewStatus: "EXCLUSION_VERIFIED",
      isExclusionApproved: true,
    }));

    const allNaOutput = calculateAssessmentScores({
      responses: allNaResponses,
      assessorReviews: allNaReviews,
    });

    assert.equal(allNaOutput.metrics.totalApprovedExcluded, 60);
    assert.equal(allNaOutput.metrics.totalApplicable, 0);
    assert.equal(allNaOutput.metrics.totalScored, 0);
    assert.equal(allNaOutput.metrics.indicativeReadinessPercentage, null);
    assert.equal(allNaOutput.metrics.indicativeMaturityScore, null);
    assert.equal(allNaOutput.metrics.conservativeReadinessPercentage, null);
    assert.equal(allNaOutput.metrics.responseCoveragePct, 100.0); // 0 / 0 handled gracefully as 100%
  });

  // =========================================================================
  // TEST 9: Non-Compensatory Dual Metric & Statutory Penalty Ceilings
  // =========================================================================
  it("9. should preserve non-compensatory exposure: high readiness score does not hide Tier 1 deficit", () => {
    // 59 Implemented (100) and 1 Critical Security Gap on SEC-001 (0)
    const responses: QuestionResponseInput[] = manifestData.questions.map((q) => {
      const isSec1 = normalizeQuestionCode(q.code) === "SEC-001";
      return {
        questionCode: q.code,
        selectedOption: isSec1 ? "Not implemented" : "Implemented",
      };
    });

    const output = calculateAssessmentScores({ responses });

    // Overall readiness is high: (59 * 100) / 60 = 5900 / 60 = 98.3%
    assert.equal(output.metrics.indicativeReadinessPercentage, 98.3);
    assert.equal(output.metrics.indicativeMaturityScore, 4.92);

    // BUT Statutory Deficit Register MUST expose the Tier 1 critical gap
    assert.equal(output.statutoryDeficits.length, 1);
    const deficit = output.statutoryDeficits[0];
    assert.equal(deficit.questionCode, "SEC-001");
    assert.equal(deficit.severity, "CRITICAL_GAP");
    assert.equal(deficit.statutoryDomain, "SECURITY_SAFEGUARDS");
    assert.ok(deficit.potentialPenaltyCeiling.includes("Tier 1"));
    assert.ok(deficit.potentialPenaltyCeiling.includes("250 Crores"));

    // Security Safeguards domain score is pulled down
    const secDomain = output.domainBreakdown.find(
      (d) => d.domainCode === "SECURITY_SAFEGUARDS"
    );
    assert.ok(secDomain);
    assert.equal(secDomain.gapCount, 1);
    assert.ok(secDomain.indicativeDomainPercentage! < 100.0);
  });

  // =========================================================================
  // TEST 10: Governance Metadata & Provisional Status
  // =========================================================================
  it("10. should enforce PROVISIONAL_PENDING_APPROVAL and isOfficialScore: false", () => {
    const output = calculateAssessmentScores({
      responses: [
        { questionCode: "GOV-001", selectedOption: "Implemented" },
      ],
    });

    assert.equal(output.metadata.methodologyStatus, "PROVISIONAL_PENDING_APPROVAL");
    assert.equal(output.metadata.isOfficialScore, false);
    assert.equal(output.metadata.scoringModelCode, "SCORING-V1-PROVISIONAL");
    assert.ok(output.metadata.disclaimer.includes("Data Protection Board of India"));
    assert.ok(output.metadata.disclaimer.includes("DEC-01"));
    assert.ok(output.metadata.disclaimer.includes("DEC-08"));
    assert.ok(output.metadata.notices.some((n) => n.includes("PROVISIONAL METHODOLOGY")));
    assert.equal(output.metadata.assumptions.length, 6);
  });

  // =========================================================================
  // TEST 11: Live PostgreSQL RLS Integration & Persistence
  // =========================================================================
  it("11. should calculate and persist assessment scores under live PostgreSQL RLS", async () => {
    // Uses pristine seeded Beta Express assessment (assigned to consultant, isolated from Alpha)
    const testAssessmentId = "018f3a5b-7c8d-7e90-8000-000000000202";

    // 1. Seed client questionnaire responses under customerBetaSession
    await executeWithRls(customerBetaSession, async (client) => {
      await client.query(
        `INSERT INTO assessment_questionnaire_responses (
          assessment_id, tenant_id, question_code, questionnaire_version,
          selected_option, comments_and_justification
        ) VALUES 
          ($1, $2, 'GOV-001', '1.0.0', 'Implemented', 'Charter approved'),
          ($1, $2, 'DAT-001', '1.0.0', 'Partially implemented', 'Work in progress'),
          ($1, $2, 'SEC-001', '1.0.0', 'Not applicable — justification required', 'Statutory exemption');`,
        [testAssessmentId, DEMO_BETA_TENANT_ID]
      );
    });

    try {
      // Assessor verifies exclusion on SEC-001 under consultantSession
      await executeWithRls(consultantSession, async (client) => {
        await client.query(
          `INSERT INTO questionnaire_assessor_reviews (
            assessment_id, question_code, review_status, review_findings,
            evidence_deficiency_notes, requires_further_validation, reviewed_by_user_id
          ) VALUES (
            $1, 'SEC-001', 'EXCLUSION_VERIFIED', 'Exclusion accepted per documentation',
            '', false, $2
          );`,
          [testAssessmentId, DEMO_CONSULTANT_USER_ID]
        );
      });

      // 2. Execute getAssessmentScores via service under RLS
      const scoreResult = await getAssessmentScores(consultantSession, testAssessmentId);

      assert.equal(scoreResult.metrics.totalAnswered, 3);
      assert.equal(scoreResult.metrics.implementedCount, 1);
      assert.equal(scoreResult.metrics.partiallyImplementedCount, 1);
      assert.equal(scoreResult.metrics.totalApprovedExcluded, 1);
      assert.equal(scoreResult.metrics.totalApplicable, 59);
      assert.equal(scoreResult.metrics.totalScored, 2); // 1 Implemented (100) + 1 Partial (50)
      assert.equal(scoreResult.metrics.indicativeReadinessPercentage, 75.0); // (100 + 50) / 2 = 75.0%

      // 3. Persist score snapshot under RLS
      const persistRes = await persistAssessmentScores(consultantSession, testAssessmentId);
      assert.ok(persistRes.scoreId);
      assert.ok(persistRes.calculationHash);

      // 4. Verify record in assessment_scores table
      await executeWithRls(consultantSession, async (client) => {
        const checkRes = await client.query(
          `SELECT 
            id, overall_maturity_score, overall_coverage_pct, critical_gaps_count, calculation_hash
           FROM assessment_scores
           WHERE id = $1;`,
          [persistRes.scoreId]
        );
        assert.equal(checkRes.rowCount, 1);
        const row = checkRes.rows[0];
        assert.equal(row.calculation_hash, persistRes.calculationHash);
      });

      // 5. Verify Client Alpha cannot access Client Beta assessment score under RLS
      await assert.rejects(
        async () => {
          await getAssessmentScores(customerAlphaSession, testAssessmentId);
        },
        (err: any) => {
          assert.equal(err.code, "ASSESSMENT_NOT_FOUND_OR_FORBIDDEN");
          return true;
        }
      );
    } finally {
      // Clean up test items using admin pool
      try {
        await pool.query("DELETE FROM assessment_scores WHERE assessment_id = $1;", [testAssessmentId]);
        await pool.query("DELETE FROM questionnaire_assessor_reviews WHERE assessment_id = $1;", [testAssessmentId]);
        await pool.query("DELETE FROM assessment_questionnaire_responses WHERE assessment_id = $1;", [testAssessmentId]);
      } catch (e) {
        console.error("Test cleanup error:", e);
      }
    }
  });
});
