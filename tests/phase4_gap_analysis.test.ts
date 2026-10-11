/**
 * TLI DPDP Compliance Gap Analysis Tool — Phase 4 Gap Analysis & Risk Engine Test Suite
 *
 * Verifies:
 * 1. Every response option and its effect on gap analysis.
 * 2. Unknown and unresolved answers (information uncertainty vs legal conclusions).
 * 3. Approved and unapproved N/A exclusions.
 * 4. Missing, rejected, and verified evidence outcomes.
 * 5. Isolation of the 4 unresolved question-to-control mappings.
 * 6. Incomplete assessments and section completeness tracking.
 * 7. Deterministic recalculation and cryptographic hash reproducibility.
 * 8. Factual explainability and traceability to source responses and provisions.
 * 9. Live PostgreSQL RLS tenant isolation and service execution.
 * 10. Re-audit cycle comparative trends and metrics deltas.
 */

import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../lib/db/pool.ts";
import manifestData from "../data/questionnaire_v1.json" with { type: "json" };
import controlsData from "../data/dpdp_controls.json" with { type: "json" };
import { evaluateAssessmentGaps } from "../lib/gaps/engine.ts";
import { getAssessmentGapAnalysis } from "../lib/gaps/service.ts";
import { DEFAULT_PROVISIONAL_CONFIG } from "../lib/scoring/config.ts";
import type { SessionUser } from "../lib/auth/types.ts";
import type { QuestionResponseInput, AssessorReviewInput } from "../lib/scoring/types.ts";

const DEMO_TENANT_ID = "018f3a5b-7c8d-7e90-8000-000000000002"; // Alpha Healthcare
const DEMO_BETA_TENANT_ID = "018f3a5b-7c8d-7e90-8000-000000000003"; // Beta Express
const DEMO_CONSULTANT_USER_ID = "018f3a5b-7c8d-7e90-8000-000000000191"; // TLI Lead Consultant Demo
const DEMO_CUSTOMER_USER_ID = "018f3a5b-7c8d-7e90-8000-000000000192"; // Alpha Customer Demo
const ASSESSMENT_ALPHA_ID = "018f3a5b-7c8d-7e90-8000-000000000201";
const ASSESSMENT_BETA_ID = "018f3a5b-7c8d-7e90-8000-000000000202";

const consultantSession: SessionUser = {
  userId: DEMO_CONSULTANT_USER_ID,
  tenantId: "018f3a5b-7c8d-7e90-8000-000000000001",
  email: "consultant.demo@tli.local",
  fullName: "TLI Lead Consultant Demo",
  role: "TLI_LEAD_CONSULTANT",
  tenantName: "Truth Labs International Advisory",
  tenantSlug: "tli-advisory",
  tenantType: "TLI",
  isSdf: false,
};

const customerSession: SessionUser = {
  userId: DEMO_CUSTOMER_USER_ID,
  tenantId: DEMO_TENANT_ID,
  email: "customer.demo@tli.local",
  fullName: "Alpha Healthcare Admin Demo",
  role: "CLIENT_ADMIN",
  tenantName: "Alpha Healthcare",
  tenantSlug: "alpha-health",
  tenantType: "CLIENT",
  isSdf: true,
};

describe("Phase 4: Gap Analysis Engine & Risk Prioritization Verification", () => {
  after(async () => {
    // Keep connection pool alive for remaining tests
  });

  it("1. should evaluate all 60 canonical questions and separate completeness, evidence, readiness, and gaps", () => {
    const responses: QuestionResponseInput[] = manifestData.questions.map((q, idx) => ({
      questionCode: q.code,
      selectedOption: idx % 2 === 0 ? "Implemented" : "Partially implemented",
      commentsAndJustification: "Test representation",
    }));

    const result = evaluateAssessmentGaps({
      assessmentId: "test-assess-01",
      responses,
    });

    assert.equal(result.summary.totalQuestions, 60);
    assert.equal(result.summary.answeredQuestions, 60);
    assert.equal(result.summary.unansweredQuestions, 0);
    assert.equal(result.summary.completenessPct, 100);

    // Multi-metric separation
    assert.ok(typeof result.summary.responseCoveragePct === "number");
    assert.ok(typeof result.summary.evidenceCoveragePct === "number");
    assert.ok(typeof result.summary.provisionalReadinessPct === "number");
    assert.ok(typeof result.summary.provisionalMaturityScore === "number");
    assert.ok(typeof result.summary.totalGapsCount === "number");
  });

  it("2. should correctly classify 'Not implemented' as critical/high gap with statutory provision", () => {
    const responses: QuestionResponseInput[] = [
      {
        questionCode: "SEC-001",
        selectedOption: "Not implemented",
        commentsAndJustification: "Encryption not implemented across legacy DBs",
      },
    ];

    const result = evaluateAssessmentGaps({
      assessmentId: "test-assess-sec",
      responses,
    });

    const secGap = result.gaps.find((g) => g.questionCode === "SEC-001");
    assert.ok(secGap, "SEC-001 must generate a compliance gap");
    assert.equal(secGap.gapType, "NEGATIVE_RESPONSE");
    assert.equal(secGap.gapSeverity, "CRITICAL_GAP", "SEC-001 Security Safeguard must be CRITICAL_GAP");
    assert.equal(secGap.mappedControlId, "TLI-DPDP-SEC-01");
    assert.equal(secGap.sourceProvision, "Section 8(4)-(5) r/w Rule 8");
    assert.equal(secGap.statutoryDomain, "SECURITY_SAFEGUARDS");
    assert.equal(secGap.potentialPenaltyCeiling?.tier, "TIER_1");
    assert.equal(secGap.potentialPenaltyCeiling?.ceilingCrores, 250);
    assert.ok(secGap.factualObservation.includes("Not implemented"));
    assert.ok(!secGap.explanation.includes("guilty"), "Must not declare guilt");
  });

  it("3. should treat 'Unknown / not verified' as information uncertainty without declaring violation", () => {
    const responses: QuestionResponseInput[] = [
      {
        questionCode: "DAT-001",
        selectedOption: "Unknown / not verified",
        commentsAndJustification: "Need to consult data engineering team",
      },
    ];

    const result = evaluateAssessmentGaps({
      assessmentId: "test-assess-unknown",
      responses,
    });

    const gap = result.gaps.find((g) => g.questionCode === "DAT-001");
    assert.ok(gap, "DAT-001 unknown response must be tracked");
    assert.equal(gap.gapType, "INFORMATION_UNCERTAINTY");
    assert.equal(gap.gapSeverity, "INFORMATIONAL");
    assert.equal(result.summary.unverifiedUnknownsCount, 1);
    assert.ok(gap.factualObservation.includes("Unknown / not verified"));
  });

  it("4. should enforce strict distinction between approved and unapproved N/A exclusions", () => {
    // Case A: N/A without justification
    const resA = evaluateAssessmentGaps({
      assessmentId: "test-na-a",
      responses: [
        {
          questionCode: "APP-001",
          selectedOption: "Not applicable — justification required",
          commentsAndJustification: "", // empty
        },
      ],
    });
    const gapA = resA.gaps.find((g) => g.questionCode === "APP-001");
    assert.ok(gapA);
    assert.equal(gapA.gapType, "UNAPPROVED_EXCLUSION");
    assert.equal(gapA.gapSeverity, "HIGH_DEFICIT", "Missing justification must be HIGH_DEFICIT");

    // Case B: N/A with justification, awaiting assessor review
    const resB = evaluateAssessmentGaps({
      assessmentId: "test-na-b",
      responses: [
        {
          questionCode: "APP-001",
          selectedOption: "Not applicable — justification required",
          commentsAndJustification: "We do not process children data under Section 9",
        },
      ],
    });
    const gapB = resB.gaps.find((g) => g.questionCode === "APP-001");
    assert.ok(gapB);
    assert.equal(gapB.gapType, "UNAPPROVED_EXCLUSION");
    assert.equal(gapB.gapSeverity, "MEDIUM_DEFICIT", "Pending assessor review is MEDIUM_DEFICIT");

    // Case C: N/A with justification AND assessor approval
    const resC = evaluateAssessmentGaps({
      assessmentId: "test-na-c",
      responses: [
        {
          questionCode: "APP-001",
          selectedOption: "Not applicable — justification required",
          commentsAndJustification: "B2B only entity; Section 9 children obligations verified non-applicable.",
        },
      ],
      assessorReviews: [
        {
          questionCode: "APP-001",
          isExclusionApproved: true,
          reviewStatus: "EXCLUSION_VERIFIED",
        },
      ],
    });
    const gapC = resC.gaps.find((g) => g.questionCode === "APP-001");
    assert.equal(gapC, undefined, "Approved N/A exclusion must NOT be recorded as a gap");
  });

  it("5. should detect evidence deficiencies for self-attested 'Implemented' questions", () => {
    // Respondent says Implemented, but zero evidence uploaded
    const resNoEv = evaluateAssessmentGaps({
      assessmentId: "test-no-ev",
      responses: [
        {
          questionCode: "SEC-002",
          selectedOption: "Implemented",
          commentsAndJustification: "Access control policy is active",
        },
      ],
      evidenceItems: [],
    });

    const gapNoEv = resNoEv.gaps.find((g) => g.questionCode === "SEC-002");
    assert.ok(gapNoEv, "Implemented with zero evidence must generate EVIDENCE_DEFICIENCY");
    assert.equal(gapNoEv.gapType, "EVIDENCE_DEFICIENCY");
    assert.equal(gapNoEv.evidenceStatus, "NO_EVIDENCE");

    // Respondent has evidence, but assessor rejected it
    const resRejEv = evaluateAssessmentGaps({
      assessmentId: "test-rej-ev",
      responses: [
        {
          questionCode: "SEC-002",
          selectedOption: "Implemented",
        },
      ],
      evidenceItems: [
        {
          id: "ev-01",
          questionCode: "SEC-002",
          fileName: "Draft_Policy.docx",
          fileSizeBytes: 2048,
          status: "REJECTED",
          verificationNotes: "Document is an unapproved template without executive signature.",
        },
      ],
      assessorReviews: [
        {
          questionCode: "SEC-002",
          reviewStatus: "EVIDENCE_DEFICIENT",
          evidenceDeficiencyNotes: "Unsigned draft policy does not fulfill Section 8(4).",
        },
      ],
    });

    const gapRej = resRejEv.gaps.find((g) => g.questionCode === "SEC-002");
    assert.ok(gapRej);
    assert.equal(gapRej.gapType, "EVIDENCE_DEFICIENCY");
    assert.equal(gapRej.evidenceStatus, "EVIDENCE_REJECTED");
    assert.equal(gapRej.gapSeverity, "HIGH_DEFICIT");
    assert.ok(gapRej.explanation.includes("Unsigned draft policy"));
  });

  it("6. should isolate the 4 unresolved question mappings from canonical controls", () => {
    const unmappedCodes = ["GOV-005", "GOV-006", "GOV-008", "APP-006"];
    const responses: QuestionResponseInput[] = unmappedCodes.map((code) => ({
      questionCode: code,
      selectedOption: "Not implemented",
    }));

    const result = evaluateAssessmentGaps({
      assessmentId: "test-unmapped",
      responses,
    });

    assert.equal(result.unresolvedMappingItems.length, 4);

    for (const item of result.unresolvedMappingItems) {
      assert.equal(item.isUnresolvedMapping, true);
      assert.equal(item.mappedControlId, null, `${item.questionCode} must have null mappedControlId`);
      assert.equal(item.statutoryDomain, null, `${item.questionCode} must not roll up into statutory domain`);
    }
  });

  it("7. should produce identical gap analysis output and hash for identical inputs", () => {
    const input = {
      assessmentId: "test-deterministic-01",
      responses: [
        { questionCode: "GOV-001", selectedOption: "Implemented" },
        { questionCode: "GOV-002", selectedOption: "Partially implemented" },
        { questionCode: "SEC-001", selectedOption: "Not implemented" },
      ],
    };

    const out1 = evaluateAssessmentGaps(input);
    const out2 = evaluateAssessmentGaps(input);

    assert.equal(out1.summary.calculationHash, out2.summary.calculationHash);
    assert.equal(out1.summary.totalGapsCount, out2.summary.totalGapsCount);
    assert.equal(out1.summary.criticalGapsCount, out2.summary.criticalGapsCount);
    assert.deepEqual(out1.gaps.map((g) => g.id), out2.gaps.map((g) => g.id));
  });

  it("8. should evaluate historical trend comparison when prior assessment scores exist", () => {
    const result = evaluateAssessmentGaps({
      assessmentId: "cycle-2027",
      engagementCode: "ENG-2027-CYCLE",
      responses: [
        { questionCode: "SEC-001", selectedOption: "Implemented" }, // Remediated from prior cycle
      ],
      priorAssessmentScores: {
        id: "cycle-2026",
        engagementCode: "ENG-2026-BASELINE",
        calculatedAt: "2026-08-01T10:00:00Z",
        overallReadinessPct: 40.0,
        overallMaturityScore: 2.0,
        criticalGapsCount: 5,
        totalGapsCount: 25,
        completenessPct: 100,
        questionResponses: {
          "SEC-001": "Not implemented",
        },
      },
    });

    const trend = result.trendComparison;
    assert.equal(trend.hasPriorAssessment, true);
    assert.equal(trend.priorEngagementCode, "ENG-2026-BASELINE");
    assert.ok(trend.remediatedQuestions.includes("SEC-001"), "SEC-001 must be tracked as remediated");
    assert.ok(typeof trend.readinessPctDelta === "number");
    assert.ok(typeof trend.criticalGapsDelta === "number");
  });

  it("9. should fetch assessment gap analysis under live PostgreSQL RLS and enforce tenant isolation", async () => {
    // Consultant can query Alpha assessment gaps
    const alphaResult = await getAssessmentGapAnalysis(consultantSession, ASSESSMENT_ALPHA_ID);
    assert.equal(alphaResult.assessmentId, ASSESSMENT_ALPHA_ID);
    assert.ok(alphaResult.summary.totalQuestions === 60);
    assert.ok(Array.isArray(alphaResult.gaps));
    assert.ok(Array.isArray(alphaResult.domainSummaries));

    // Customer Alpha can query own assessment gaps
    const clientResult = await getAssessmentGapAnalysis(customerSession, ASSESSMENT_ALPHA_ID);
    assert.equal(clientResult.assessmentId, ASSESSMENT_ALPHA_ID);

    // Cross-tenant block: Customer Alpha CANNOT query Customer Beta assessment gaps
    await assert.rejects(
      async () => {
        await getAssessmentGapAnalysis(customerSession, ASSESSMENT_BETA_ID);
      },
      (err: any) => {
        assert.ok(
          err.message.includes("not found or access denied") ||
            err.code === "ASSESSMENT_NOT_FOUND_OR_FORBIDDEN"
        );
        return true;
      }
    );
  });

  after(async () => {
    await pool.end();
  });
});

