/**
 * CloudE5 — Database-Backed Gap Analysis Service
 *
 * Implements tenant-scoped retrieval of questionnaire responses, assessor reviews,
 * evidence items, clarification threads, and historical re-audit cycles strictly
 * under PostgreSQL Row-Level Security (RLS).
 */

import { executeWithRls } from "../db/rls.ts";
import type { SessionUser } from "../auth/types.ts";
import { isClientRole } from "../auth/rbac.ts";
import { evaluateAssessmentGaps } from "./engine.ts";
import { DEFAULT_PROVISIONAL_CONFIG } from "../scoring/config.ts";
import type { ScoringModelConfig } from "../scoring/types.ts";
import type { GapAnalysisOutput } from "./types.ts";

export class GapsServiceError extends Error {
  code: string;
  statusCode: number;

  constructor(message: string, code: string, statusCode: number = 400) {
    super(message);
    this.name = "GapsServiceError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Retrieves full assessment dataset under RLS, evaluates compliance gaps,
 * and produces explainable risk prioritization.
 */
export async function getAssessmentGapAnalysis(
  sessionUser: SessionUser,
  assessmentId: string,
  config: ScoringModelConfig = DEFAULT_PROVISIONAL_CONFIG
): Promise<GapAnalysisOutput> {
  const result = await computeAssessmentGapAnalysis(sessionUser, assessmentId, config);
  return isClientRole(sessionUser.role) ? redactInternalAssessorNotes(result) : result;
}

/**
 * Removes internal assessor working notes before results reach customer users. Applied inside
 * the service so every caller (API routes and server-rendered pages) gets the same segregation.
 */
export function redactInternalAssessorNotes(result: GapAnalysisOutput): GapAnalysisOutput {
  const redact = <T extends { assessorReview?: { reviewFindings?: string | null; evidenceDeficiencyNotes?: string | null } | null }>(
    item: T
  ): T =>
    item.assessorReview
      ? { ...item, assessorReview: { ...item.assessorReview, reviewFindings: null, evidenceDeficiencyNotes: null } }
      : item;
  return {
    ...result,
    gaps: result.gaps.map(redact),
    unresolvedMappingItems: result.unresolvedMappingItems.map(redact),
  };
}

async function computeAssessmentGapAnalysis(
  sessionUser: SessionUser,
  assessmentId: string,
  config: ScoringModelConfig
): Promise<GapAnalysisOutput> {
  if (!assessmentId) {
    throw new GapsServiceError("Assessment ID is required", "INVALID_INPUT", 400);
  }

  return await executeWithRls(sessionUser, async (client) => {
    // 1. Fetch target assessment and parent assessment ID for re-audit trends
    const assessRes = await client.query(
      `SELECT 
        a.id,
        a.tenant_id,
        a.title,
        a.engagement_code,
        a.status,
        a.parent_assessment_id,
        fv.name AS framework_name,
        u.full_name AS lead_consultant_name,
        t.name AS tenant_name,
        t.is_sdf
      FROM assessments a
      LEFT JOIN framework_versions fv ON fv.id = a.framework_version_id
      LEFT JOIN users u ON u.id = a.lead_consultant_id
      LEFT JOIN tenants t ON t.id = a.tenant_id
      WHERE a.id = $1
      LIMIT 1;`,
      [assessmentId]
    );

    if (assessRes.rowCount === 0) {
      throw new GapsServiceError(
        "Assessment not found or access denied under RLS.",
        "ASSESSMENT_NOT_FOUND_OR_FORBIDDEN",
        404
      );
    }

    const assessment = assessRes.rows[0];

    // 2. Fetch responses from assessment_questionnaire_responses
    const respRes = await client.query(
      `SELECT 
        question_code,
        selected_option,
        comments_and_justification,
        updated_at
      FROM assessment_questionnaire_responses
      WHERE assessment_id = $1;`,
      [assessmentId]
    );

    const responses = respRes.rows.map((row) => ({
      questionCode: row.question_code,
      selectedOption: row.selected_option || null,
      commentsAndJustification: row.comments_and_justification || null,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    }));

    // 3. Fetch assessor reviews from questionnaire_assessor_reviews
    const revRes = await client.query(
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

    const assessorReviews = revRes.rows.map((row) => ({
      questionCode: row.question_code,
      reviewStatus: row.review_status,
      isExclusionApproved: row.review_status === "EXCLUSION_VERIFIED",
      reviewFindings: row.review_findings || null,
      evidenceDeficiencyNotes: row.evidence_deficiency_notes || null,
      requiresFurtherValidation: Boolean(row.requires_further_validation),
    }));

    // 4. Fetch evidence items
    const evRes = await client.query(
      `SELECT 
        ei.id,
        COALESCE(ei.question_code, c.code) AS question_code,
        ei.file_name,
        ei.file_size_bytes,
        ei.status,
        ei.created_at,
        ei.verification_notes
      FROM evidence_items ei
      LEFT JOIN assessment_controls ac ON ac.id = ei.assessment_control_id
      LEFT JOIN controls c ON c.id = ac.control_id
      WHERE (ei.assessment_id = $1 OR ac.assessment_id = $1)
        AND ei.status NOT IN ('DELETED', 'DELETION_PENDING');`,
      [assessmentId]
    );

    const evidenceItems = evRes.rows.map((row) => ({
      id: row.id,
      questionCode: row.question_code,
      fileName: row.file_name,
      fileSizeBytes: Number(row.file_size_bytes || 0),
      status: row.status,
      uploadedAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
      verificationNotes: row.verification_notes || null,
    }));

    // 5. Fetch clarification threads with message count
    const ctRes = await client.query(
      `SELECT 
        ct.id,
        ct.question_code,
        ct.status,
        ct.title,
        ct.target_role,
        COUNT(cm.id)::int AS message_count
      FROM clarification_threads ct
      LEFT JOIN clarification_messages cm ON cm.thread_id = ct.id
      WHERE ct.assessment_id = $1
      GROUP BY ct.id, ct.question_code, ct.status, ct.title, ct.target_role;`,
      [assessmentId]
    );

    const clarificationThreads = ctRes.rows.map((row) => ({
      id: row.id,
      questionCode: row.question_code,
      status: row.status,
      title: row.title,
      targetRole: row.target_role,
      messageCount: row.message_count,
    }));

    // 6. Query parent assessment data if this is a re-audit / subsequent iteration
    let priorAssessmentScores: any = null;
    if (assessment.parent_assessment_id) {
      const priorRes = await client.query(
        `SELECT 
          a.id,
          a.engagement_code,
          s.overall_maturity_score,
          s.overall_coverage_pct,
          s.critical_gaps_count,
          s.statutory_deficits_count,
          s.calculated_at
        FROM assessments a
        LEFT JOIN assessment_scores s ON s.assessment_id = a.id
        WHERE a.id = $1
        ORDER BY s.calculated_at DESC
        LIMIT 1;`,
        [assessment.parent_assessment_id]
      );

      if (priorRes.rowCount && priorRes.rowCount > 0) {
        const prior = priorRes.rows[0];

        // Fetch prior responses for question-level delta
        const priorRespRes = await client.query(
          `SELECT question_code, selected_option
           FROM assessment_questionnaire_responses
           WHERE assessment_id = $1;`,
          [assessment.parent_assessment_id]
        );

        const priorQuestionResponses: Record<string, string> = {};
        for (const r of priorRespRes.rows) {
          if (r.question_code && r.selected_option) {
            priorQuestionResponses[r.question_code] = r.selected_option;
          }
        }

        priorAssessmentScores = {
          id: prior.id,
          engagementCode: prior.engagement_code,
          calculatedAt: prior.calculated_at
            ? new Date(prior.calculated_at).toISOString()
            : new Date().toISOString(),
          overallReadinessPct: Number(prior.overall_coverage_pct || 0),
          overallMaturityScore: Number(prior.overall_maturity_score || 0),
          criticalGapsCount: Number(prior.critical_gaps_count || 0),
          totalGapsCount: Number(prior.statutory_deficits_count || 0),
          completenessPct: 100, // prior closed cycle baseline
          questionResponses: priorQuestionResponses,
        };
      }
    }

    // 7. Execute pure explainable gap analysis
    return evaluateAssessmentGaps(
      {
        assessmentId: assessment.id,
        engagementCode: assessment.engagement_code,
        tenantName: assessment.tenant_name,
        assessmentTitle: assessment.title,
        assessmentStatus: assessment.status,
        frameworkName: assessment.framework_name,
        leadConsultantName: assessment.lead_consultant_name,
        isSdf: assessment.is_sdf,
        responses,
        assessorReviews,
        evidenceItems,
        clarificationThreads,
        priorAssessmentScores,
      },
      config
    );
  });
}

