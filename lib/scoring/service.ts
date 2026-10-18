/**
 * CloudE5 — Deterministic Scoring Service
 *
 * Provides database-backed calculation and persistence of assessment scoring
 * strictly under PostgreSQL Row-Level Security (RLS) and trusted session context.
 *
 * Governance:
 * - Pure calculations are delegated to calculateAssessmentScores().
 * - Scoring methodology is strictly flagged as PROVISIONAL_PENDING_APPROVAL (DEC-08, DEC-09).
 * - Official compliance score flags remain FALSE until formal methodology ratification.
 * - Respects assessment lifecycle states and RLS isolation.
 */

import { executeWithRls } from "../db/rls.ts";
import type { SessionUser } from "../auth/types.ts";
import { calculateAssessmentScores, normalizeQuestionCode } from "./engine.ts";
import { DEFAULT_PROVISIONAL_CONFIG } from "./config.ts";
import type {
  ScoringCalculationInput,
  ScoringEngineOutput,
  ScoringModelConfig,
  QuestionResponseInput,
  AssessorReviewInput,
} from "./types.ts";

export class ScoringServiceError extends Error {
  code: string;
  statusCode: number;

  constructor(
    message: string,
    code: string,
    statusCode: number = 400
  ) {
    super(message);
    this.name = "ScoringServiceError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Retrieves assessment responses, reviews, and evidence under RLS,
 * executes pure deterministic scoring, and returns complete evaluation details.
 */
export async function getAssessmentScores(
  sessionUser: SessionUser,
  assessmentId: string,
  config: ScoringModelConfig = DEFAULT_PROVISIONAL_CONFIG
): Promise<ScoringEngineOutput> {
  if (!assessmentId) {
    throw new ScoringServiceError("Assessment ID is required", "INVALID_INPUT", 400);
  }

  return await executeWithRls(sessionUser, async (client) => {
    // 1. Fetch assessment scoping and lifecycle status
    const assessRes = await client.query(
      `SELECT 
        a.id,
        a.tenant_id,
        a.title,
        a.engagement_code,
        a.status,
        a.framework_version_id,
        a.created_at,
        a.updated_at
      FROM assessments a
      WHERE a.id = $1
      LIMIT 1;`,
      [assessmentId]
    );

    if (assessRes.rowCount === 0) {
      throw new ScoringServiceError(
        "Assessment not found or access denied.",
        "ASSESSMENT_NOT_FOUND_OR_FORBIDDEN",
        404
      );
    }

    const assessment = assessRes.rows[0];

    // 2. Query client responses from assessment_questionnaire_responses
    const responsesRes = await client.query(
      `SELECT 
        question_code,
        selected_option,
        comments_and_justification,
        updated_at
      FROM assessment_questionnaire_responses
      WHERE assessment_id = $1;`,
      [assessmentId]
    );

    const responses: QuestionResponseInput[] = responsesRes.rows.map((row) => ({
      questionCode: row.question_code,
      selectedOption: row.selected_option || null,
      commentsAndJustification: row.comments_and_justification || null,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    }));

    // 3. Query independent assessor reviews from questionnaire_assessor_reviews
    const reviewsRes = await client.query(
      `SELECT 
        question_code,
        review_status,
        review_findings,
        evidence_deficiency_notes,
        requires_further_validation
      FROM questionnaire_assessor_reviews
      WHERE assessment_id = $1;`,
      [assessmentId]
    );

    const assessorReviews: AssessorReviewInput[] = reviewsRes.rows.map((row) => ({
      questionCode: row.question_code,
      reviewStatus: row.review_status,
      isExclusionApproved: row.review_status === "EXCLUSION_VERIFIED",
      reviewFindings: row.review_findings || null,
      evidenceDeficiencyNotes: row.evidence_deficiency_notes || null,
      requiresFurtherValidation: Boolean(row.requires_further_validation),
    }));

    // 4. Query evidence coverage (questions with active or verified evidence)
    const evidenceRes = await client.query(
      `SELECT DISTINCT
        COALESCE(ei.question_code, c.code) AS question_code
      FROM evidence_items ei
      LEFT JOIN assessment_controls ac ON ac.id = ei.assessment_control_id
      LEFT JOIN controls c ON c.id = ac.control_id
      WHERE (ei.assessment_id = $1 OR ac.assessment_id = $1)
        AND ei.status NOT IN ('DELETED', 'DELETION_PENDING', 'QUARANTINED');`,
      [assessmentId]
    );

    const questionsWithEvidence = evidenceRes.rows
      .map((r) => r.question_code)
      .filter((code): code is string => Boolean(code));

    // 5. Construct pure calculation input
    const inputRevision = assessment.updated_at
      ? new Date(assessment.updated_at).toISOString()
      : new Date(assessment.created_at).toISOString();

    const calcInput: ScoringCalculationInput = {
      assessmentId: assessment.id,
      engagementCode: assessment.engagement_code,
      assessmentStatus: assessment.status,
      responses,
      assessorReviews,
      evidenceCoverage: {
        totalEvidenceItems: questionsWithEvidence.length,
        questionsWithEvidence,
      },
      inputRevision,
    };

    // 6. Invoke pure deterministic scoring calculation
    const output = calculateAssessmentScores(calcInput, config);

    // 7. If assessment is in frozen lifecycle (FINAL_ISSUED or LEAD_APPROVED), attach notice
    if (assessment.status === "FINAL_ISSUED" || assessment.status === "LEAD_APPROVED") {
      output.metadata.notices = [
        `LIFECYCLE LOCKED: Assessment is in '${assessment.status}' status. Scores reflect the frozen assessment dataset.`,
        ...output.metadata.notices,
      ];
    }

    return output;
  });
}

/**
 * Persists calculated scores snapshot into assessment_scores under RLS.
 */
export async function persistAssessmentScores(
  sessionUser: SessionUser,
  assessmentId: string,
  config: ScoringModelConfig = DEFAULT_PROVISIONAL_CONFIG
): Promise<{ scoreId: string; calculationHash: string }> {
  const scoresOutput = await getAssessmentScores(sessionUser, assessmentId, config);

  return await executeWithRls(sessionUser, async (client) => {
    // 1. Resolve scoring model ID
    const modelRes = await client.query(
      `SELECT id FROM scoring_models WHERE code = $1 LIMIT 1;`,
      [config.modelCode]
    );

    let scoringModelId: string;
    if (modelRes.rowCount && modelRes.rowCount > 0) {
      scoringModelId = modelRes.rows[0].id;
    } else {
      // Fallback to active canonical scoring model
      const fallbackRes = await client.query(
        `SELECT id FROM scoring_models WHERE status = 'ACTIVE' LIMIT 1;`
      );
      if (fallbackRes.rowCount && fallbackRes.rowCount > 0) {
        scoringModelId = fallbackRes.rows[0].id;
      } else {
        throw new ScoringServiceError(
          "No registered scoring model found in database.",
          "SCORING_MODEL_NOT_FOUND",
          500
        );
      }
    }

    // 2. Compute potential penalty exposure from Tier 1 and Tier 2 deficits
    let totalPenaltyExposureInr = 0;
    for (const deficit of scoresOutput.statutoryDeficits) {
      if (deficit.severity === "CRITICAL_GAP") {
        if (deficit.statutoryDomain === "SECURITY_SAFEGUARDS") {
          totalPenaltyExposureInr = Math.max(
            totalPenaltyExposureInr,
            config.penaltyTiers.TIER_1.ceilingAmountInr
          );
        } else if (
          deficit.statutoryDomain === "BREACH_READINESS" ||
          deficit.statutoryDomain === "CHILDREN_DISABLED_DATA"
        ) {
          totalPenaltyExposureInr = Math.max(
            totalPenaltyExposureInr,
            config.penaltyTiers.TIER_2.ceilingAmountInr
          );
        }
      }
    }

    // 3. Insert record into assessment_scores
    const insertRes = await client.query(
      `INSERT INTO assessment_scores (
        assessment_id,
        scoring_model_id,
        overall_maturity_score,
        overall_coverage_pct,
        domain_scores_json,
        statutory_deficits_count,
        critical_gaps_count,
        high_gaps_count,
        medium_gaps_count,
        low_gaps_count,
        potential_penalty_exposure_inr,
        calculation_hash,
        calculated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
      ) RETURNING id;`,
      [
        assessmentId,
        scoringModelId,
        scoresOutput.metrics.indicativeMaturityScore ?? 0,
        scoresOutput.metrics.responseCoveragePct,
        JSON.stringify({
          metrics: scoresOutput.metrics,
          domains: scoresOutput.domainBreakdown,
          sections: scoresOutput.sectionBreakdown,
          unmapped: scoresOutput.unmappedQuestions.map((q) => q.questionCode),
          metadata: scoresOutput.metadata,
        }),
        scoresOutput.statutoryDeficits.length,
        scoresOutput.metrics.notImplementedCount,
        scoresOutput.metrics.partiallyImplementedCount,
        scoresOutput.metrics.totalUnapprovedNa,
        scoresOutput.metrics.totalUnknowns,
        totalPenaltyExposureInr,
        scoresOutput.metadata.calculationHash,
        scoresOutput.metadata.calculatedAt,
      ]
    );

    return {
      scoreId: insertRes.rows[0].id,
      calculationHash: scoresOutput.metadata.calculationHash,
    };
  });
}
