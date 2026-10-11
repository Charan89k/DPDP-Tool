/**
 * TLI DPDP Compliance Gap Analysis Tool — Assessment Lifecycle Service
 *
 * Implements server-side lifecycle transitions, precondition guards,
 * role authorization, audit logging, and immutable snapshot enforcement
 * strictly under PostgreSQL Row-Level Security (RLS).
 */

import type { PoolClient } from "pg";
import crypto from "crypto";
import { executeWithRls } from "@/lib/db/rls";
import type { SessionUser } from "@/lib/auth/types";
import {
  AssessmentStatus,
  AssessmentStateSummary,
  TransitionRequest,
  TransitionValidationResult,
  TransitionAuditLogEntry,
  ReauditCloneRequest,
} from "./types";
import {
  findTransitionRule,
  isRoleAuthorizedForTransition,
  getAllowedTransitionsForRole,
  isAssessmentImmutable,
} from "./rules";
import { calculateAssessmentScores } from "@/lib/scoring/engine";
import { DEFAULT_PROVISIONAL_CONFIG } from "@/lib/scoring/config";
import type { QuestionResponseInput, AssessorReviewInput } from "@/lib/scoring/types";

export class LifecycleError extends Error {
  code: string;
  statusCode: number;
  validationErrors?: string[];

  constructor(
    message: string,
    code: string = "LIFECYCLE_ERROR",
    statusCode: number = 400,
    validationErrors?: string[]
  ) {
    super(message);
    this.name = "LifecycleError";
    this.code = code;
    this.statusCode = statusCode;
    this.validationErrors = validationErrors;
  }
}

/**
 * Retrieves lifecycle state summary and allowed transitions for current session user.
 */
export async function getAssessmentLifecycleState(
  sessionUser: SessionUser,
  assessmentId: string
): Promise<AssessmentStateSummary> {
  return await executeWithRls(sessionUser, async (client: PoolClient) => {
    // 1. Fetch assessment
    const assessRes = await client.query(
      `SELECT 
        a.id,
        a.engagement_code,
        a.title,
        a.status,
        a.tenant_id,
        a.lead_consultant_id,
        a.is_partial_assessment,
        a.target_completion_date,
        a.submitted_at,
        a.reviewed_at,
        a.approved_at,
        a.issued_at,
        a.created_at,
        a.updated_at
      FROM assessments a
      WHERE a.id = $1;`,
      [assessmentId]
    );

    if (assessRes.rowCount === 0) {
      throw new LifecycleError("Assessment not found or access denied.", "NOT_FOUND", 404);
    }

    const row = assessRes.rows[0];
    const currentStatus = row.status as AssessmentStatus;

    // 2. Check user assignment
    let isAssigned = false;
    if (sessionUser.role === "TLI_SUPER_ADMIN") {
      isAssigned = true;
    } else {
      const assignRes = await client.query(
        `SELECT 1 FROM assessment_assignments 
         WHERE assessment_id = $1 AND user_id = $2;`,
        [assessmentId, sessionUser.userId]
      );
      isAssigned = (assignRes.rowCount ?? 0) > 0 || row.lead_consultant_id === sessionUser.userId;
    }

    // 3. Compute permitted transitions
    const allowedTransitions = getAllowedTransitionsForRole(
      currentStatus,
      sessionUser.role,
      isAssigned
    );

    return {
      id: row.id,
      engagementCode: row.engagement_code,
      title: row.title,
      currentStatus,
      tenantId: row.tenant_id,
      leadConsultantId: row.lead_consultant_id,
      isPartialAssessment: Boolean(row.is_partial_assessment),
      targetCompletionDate: row.target_completion_date,
      submittedAt: row.submitted_at,
      reviewedAt: row.reviewed_at,
      approvedAt: row.approved_at,
      issuedAt: row.issued_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      allowedTransitions,
      isImmutable: isAssessmentImmutable(currentStatus),
    };
  });
}

/**
 * Validates domain preconditions and role authorization for an assessment state transition.
 */
export async function validateTransitionGuards(
  client: PoolClient,
  assessment: any,
  from: AssessmentStatus,
  to: AssessmentStatus,
  sessionUser: SessionUser,
  reason?: string
): Promise<TransitionValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Validate rule existence
  const rule = findTransitionRule(from, to);
  if (!rule) {
    errors.push(`Invalid state transition: Cannot transition from ${from} to ${to}.`);
    return { valid: false, errors, warnings };
  }

  // 2. Validate role authorization
  if (!isRoleAuthorizedForTransition(rule, sessionUser.role)) {
    errors.push(
      `Unauthorized: Role ${sessionUser.role} is not permitted to execute transition ${from} -> ${to}.`
    );
    return { valid: false, errors, warnings };
  }

  // 3. Consultant assignment verification (unless Super Admin)
  if (sessionUser.role !== "TLI_SUPER_ADMIN") {
    if (rule.requiresLeadAssignment || rule.requiresReviewerAssignment) {
      const assignRes = await client.query(
        `SELECT 1 FROM assessment_assignments 
         WHERE assessment_id = $1 AND user_id = $2;`,
        [assessment.id, sessionUser.userId]
      );
      const isAssigned =
        (assignRes.rowCount ?? 0) > 0 || assessment.lead_consultant_id === sessionUser.userId;
      if (!isAssigned) {
        errors.push(
          `Consultant assignment required: User is not assigned to assessment ${assessment.engagement_code}.`
        );
      }
    }
  }

  // 4. Mandatory reason guard
  if (rule.requiresReason && (!reason || reason.trim().length === 0)) {
    errors.push(
      rule.reasonPrompt || "A mandatory written justification is required to execute this transition."
    );
  }

  // 5. State-Specific Domain Guards

  // A. DATA_GATHERING -> SUBMITTED_FOR_REVIEW
  if (to === "SUBMITTED_FOR_REVIEW") {
    const responsesRes = await client.query(
      `SELECT question_code, selected_option, comments_and_justification 
       FROM assessment_questionnaire_responses 
       WHERE assessment_id = $1;`,
      [assessment.id]
    );

    const answered = responsesRes.rows.filter((r) => r.selected_option !== null);
    const answeredCount = answered.length;

    // Check N/A justifications
    for (const resp of answered) {
      if (resp.selected_option === "Not applicable — justification required") {
        if (!resp.comments_and_justification || resp.comments_and_justification.trim().length === 0) {
          errors.push(
            `Question ${resp.question_code} is marked Not Applicable but lacks mandatory statutory justification.`
          );
        }
      }
    }

    // Completeness check
    if (!assessment.is_partial_assessment) {
      if (answeredCount < 60) {
        errors.push(
          `Submission blocked: Only ${answeredCount} of 60 canonical questions answered. Standard submission requires 100% completion. (To submit an incomplete assessment, an approved partial assessment exception must be enabled).`
        );
      }
    } else {
      if (!reason || reason.trim().length === 0) {
        errors.push(
          "Approved Partial Assessment submission requires a documented business rationale or justification."
        );
      }
    }
  }

  // B. SUBMITTED_FOR_REVIEW -> DATA_GATHERING (Submission Withdrawal)
  if (from === "SUBMITTED_FOR_REVIEW" && to === "DATA_GATHERING") {
    const reviewsRes = await client.query(
      `SELECT COUNT(*) AS cnt FROM questionnaire_assessor_reviews 
       WHERE assessment_id = $1 AND review_status != 'PENDING_REVIEW';`,
      [assessment.id]
    );
    const reviewedCount = parseInt(reviewsRes.rows[0]?.cnt || "0", 10);
    if (reviewedCount > 0) {
      errors.push(
        `Cannot withdraw submission: Assessor review has already commenced (${reviewedCount} question(s) reviewed).`
      );
    }
  }

  // C. UNDER_REVIEW -> CLARIFICATION_PENDING
  if (to === "CLARIFICATION_PENDING") {
    const activeThreadsRes = await client.query(
      `SELECT COUNT(*) AS cnt FROM clarification_threads 
       WHERE assessment_id = $1 AND status IN ('OPEN', 'IN_PROGRESS', 'REQUIRES_FURTHER_INFO');`,
      [assessment.id]
    );
    const activeThreadsCount = parseInt(activeThreadsRes.rows[0]?.cnt || "0", 10);
    if (activeThreadsCount === 0) {
      errors.push(
        "Cannot transition to CLARIFICATION_PENDING: No active or open clarification threads exist for this assessment."
      );
    }
  }

  // D. CLARIFICATION_PENDING -> UNDER_REVIEW
  if (from === "CLARIFICATION_PENDING" && to === "UNDER_REVIEW") {
    const unresolvedThreadsRes = await client.query(
      `SELECT COUNT(*) AS cnt FROM clarification_threads 
       WHERE assessment_id = $1 AND status IN ('OPEN', 'IN_PROGRESS', 'REQUIRES_FURTHER_INFO');`,
      [assessment.id]
    );
    const unresolvedCount = parseInt(unresolvedThreadsRes.rows[0]?.cnt || "0", 10);
    if (unresolvedCount > 0) {
      errors.push(
        `Cannot return to review: ${unresolvedCount} clarification thread(s) remain unresolved. All threads must be responded to or resolved.`
      );
    }
  }

  // E. UNDER_REVIEW -> REVIEW_COMPLETED
  if (to === "REVIEW_COMPLETED") {
    // 1. Zero open clarification threads
    const openThreadsRes = await client.query(
      `SELECT COUNT(*) AS cnt FROM clarification_threads 
       WHERE assessment_id = $1 AND status IN ('OPEN', 'IN_PROGRESS', 'REQUIRES_FURTHER_INFO');`,
      [assessment.id]
    );
    const openThreadsCount = parseInt(openThreadsRes.rows[0]?.cnt || "0", 10);
    if (openThreadsCount > 0) {
      errors.push(
        `Cannot complete review: ${openThreadsCount} clarification thread(s) remain unresolved.`
      );
    }

    // 2. Unverified N/A exclusions
    const naResponsesRes = await client.query(
      `SELECT qr.question_code, ar.review_status 
       FROM assessment_questionnaire_responses qr
       LEFT JOIN questionnaire_assessor_reviews ar 
         ON ar.assessment_id = qr.assessment_id AND ar.question_code = qr.question_code
       WHERE qr.assessment_id = $1 AND qr.selected_option = 'Not applicable — justification required';`,
      [assessment.id]
    );

    const unverifiedNa = naResponsesRes.rows.filter(
      (r) => r.review_status !== "EXCLUSION_VERIFIED"
    );
    if (unverifiedNa.length > 0) {
      const codes = unverifiedNa.map((r) => r.question_code).join(", ");
      errors.push(
        `Cannot complete review: Proposed N/A exclusion for question(s) [${codes}] has not been verified by assessor (EXCLUSION_VERIFIED required).`
      );
    }

    // 3. Evaluated questions check
    if (!assessment.is_partial_assessment) {
      const evaluatedRes = await client.query(
        `SELECT COUNT(*) AS cnt FROM questionnaire_assessor_reviews 
         WHERE assessment_id = $1 AND review_status != 'PENDING_REVIEW';`,
        [assessment.id]
      );
      const evaluatedCount = parseInt(evaluatedRes.rows[0]?.cnt || "0", 10);
      if (evaluatedCount < 60) {
        errors.push(
          `Cannot complete review: Only ${evaluatedCount} of 60 canonical questions have been evaluated by assessor.`
        );
      }
    }
  }

  // F. REVIEW_COMPLETED -> DRAFT_REPORT_GENERATED
  if (to === "DRAFT_REPORT_GENERATED") {
    // Scoring check: verify that score calculations exist or can be generated
    const scoreRes = await client.query(
      `SELECT id FROM assessment_scores WHERE assessment_id = $1 LIMIT 1;`,
      [assessment.id]
    );
    if (scoreRes.rowCount === 0) {
      warnings.push("Deterministic scores not yet saved; will calculate and persist during report generation.");
    }
  }

  // G. DRAFT_REPORT_GENERATED -> LEAD_APPROVED
  if (to === "LEAD_APPROVED") {
    if (
      sessionUser.role !== "TLI_LEAD_CONSULTANT" &&
      sessionUser.role !== "TLI_SUPER_ADMIN"
    ) {
      errors.push(
        "Authority violation: Only the assigned TLI Lead Consultant or Super Administrator can grant formal approval (DEC-01)."
      );
    }
  }

  // H. LEAD_APPROVED -> FINAL_ISSUED
  if (to === "FINAL_ISSUED") {
    if (
      sessionUser.role !== "TLI_LEAD_CONSULTANT" &&
      sessionUser.role !== "TLI_SUPER_ADMIN"
    ) {
      errors.push(
        "Authority violation: Only TLI Lead Consultant or Super Administrator can issue the final assessment report."
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Executes an assessment state transition, enforces immutability, and appends an audit log.
 */
export async function executeAssessmentTransition(
  sessionUser: SessionUser,
  assessmentId: string,
  request: TransitionRequest
): Promise<AssessmentStateSummary> {
  const { targetStatus, reason, metadata } = request;

  return await executeWithRls(sessionUser, async (client: PoolClient) => {
    // 1. Fetch current assessment with lock
    const assessRes = await client.query(
      `SELECT * FROM assessments WHERE id = $1 FOR UPDATE;`,
      [assessmentId]
    );

    if (assessRes.rowCount === 0) {
      throw new LifecycleError("Assessment not found or access denied.", "NOT_FOUND", 404);
    }

    const assessment = assessRes.rows[0];
    const fromStatus = assessment.status as AssessmentStatus;

    // 2. Validate transition guards
    const guardResult = await validateTransitionGuards(
      client,
      assessment,
      fromStatus,
      targetStatus,
      sessionUser,
      reason
    );

    if (!guardResult.valid) {
      throw new LifecycleError(
        `Transition to ${targetStatus} rejected: ${guardResult.errors.join(" ")}`,
        "VALIDATION_FAILED",
        422,
        guardResult.errors
      );
    }

    // 3. Prepare timestamp updates
    let submittedAt = assessment.submitted_at;
    let reviewedAt = assessment.reviewed_at;
    let approvedAt = assessment.approved_at;
    let issuedAt = assessment.issued_at;

    if (targetStatus === "SUBMITTED_FOR_REVIEW" && !submittedAt) {
      submittedAt = new Date().toISOString();
    }
    if (targetStatus === "UNDER_REVIEW" && !reviewedAt) {
      reviewedAt = new Date().toISOString();
    }
    if (targetStatus === "LEAD_APPROVED") {
      approvedAt = new Date().toISOString();
    }
    if (targetStatus === "FINAL_ISSUED") {
      issuedAt = new Date().toISOString();
    }

    // 4. Update assessment status
    await client.query(
      `UPDATE assessments 
       SET 
         status = $1,
         submitted_at = $2,
         reviewed_at = $3,
         approved_at = $4,
         issued_at = $5,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $6;`,
      [targetStatus, submittedAt, reviewedAt, approvedAt, issuedAt, assessmentId]
    );

    // 5. If FINAL_ISSUED, compute cryptographic snapshot
    let snapshotHash = "";
    if (targetStatus === "FINAL_ISSUED") {
      // Gather dataset for SHA-256 fingerprint
      const respDataRes = await client.query(
        `SELECT question_code, selected_option, comments_and_justification 
         FROM assessment_questionnaire_responses 
         WHERE assessment_id = $1 ORDER BY question_code ASC;`,
        [assessmentId]
      );
      const revDataRes = await client.query(
        `SELECT question_code, review_status, review_findings 
         FROM questionnaire_assessor_reviews 
         WHERE assessment_id = $1 ORDER BY question_code ASC;`,
        [assessmentId]
      );

      const datasetPayload = JSON.stringify({
        assessmentId,
        engagementCode: assessment.engagement_code,
        issuedAt,
        responses: respDataRes.rows,
        reviews: revDataRes.rows,
      });

      snapshotHash = crypto.createHash("sha256").update(datasetPayload).digest("hex");

      // Record snapshot in report_snapshots
      await client.query(
        `INSERT INTO report_snapshots (
          assessment_id,
          tenant_id,
          report_type,
          version_label,
          s3_key,
          file_sha256_hash,
          dataset_sha256_hash,
          generated_by_user_id,
          lead_approver_id,
          approved_at
        ) VALUES ($1, $2, 'PDF', 'FINAL-V1.0', $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
        ON CONFLICT DO NOTHING;`,
        [
          assessmentId,
          assessment.tenant_id,
          `reports/${assessment.tenant_id}/${assessment.engagement_code}-FINAL.pdf`,
          snapshotHash,
          snapshotHash,
          sessionUser.userId,
          assessment.lead_consultant_id,
        ]
      );
    }

    // 6. Append Immutable Forensic Audit Log
    const auditNewState = {
      status: targetStatus,
      reason: reason || null,
      actorRole: sessionUser.role,
      actorUserId: sessionUser.userId,
      snapshotHash: snapshotHash || undefined,
      ...(metadata || {}),
    };

    await client.query(
      `INSERT INTO audit_logs (
        tenant_id,
        user_id,
        action,
        entity_type,
        entity_id,
        previous_state,
        new_state
      ) VALUES ($1, $2, 'ASSESSMENT_STATE_TRANSITION', 'assessments', $3, $4, $5);`,
      [
        assessment.tenant_id,
        sessionUser.userId,
        assessmentId,
        JSON.stringify({ status: fromStatus }),
        JSON.stringify(auditNewState),
      ]
    );

    // 7. Return refreshed summary
    const isAssigned =
      sessionUser.role === "TLI_SUPER_ADMIN" ||
      assessment.lead_consultant_id === sessionUser.userId;

    const allowedTransitions = getAllowedTransitionsForRole(
      targetStatus,
      sessionUser.role,
      isAssigned
    );

    return {
      id: assessment.id,
      engagementCode: assessment.engagement_code,
      title: assessment.title,
      currentStatus: targetStatus,
      tenantId: assessment.tenant_id,
      leadConsultantId: assessment.lead_consultant_id,
      isPartialAssessment: Boolean(assessment.is_partial_assessment),
      targetCompletionDate: assessment.target_completion_date,
      submittedAt,
      reviewedAt,
      approvedAt,
      issuedAt,
      createdAt: assessment.created_at,
      updatedAt: new Date().toISOString(),
      allowedTransitions,
      isImmutable: isAssessmentImmutable(targetStatus),
    };
  });
}

/**
 * Retrieves transition history audit trail for an assessment under RLS.
 */
export async function getAssessmentTransitionHistory(
  sessionUser: SessionUser,
  assessmentId: string
): Promise<TransitionAuditLogEntry[]> {
  return await executeWithRls(sessionUser, async (client: PoolClient) => {
    const res = await client.query(
      `SELECT 
        al.id,
        al.tenant_id,
        al.user_id,
        al.action,
        al.previous_state,
        al.new_state,
        al.timestamp
      FROM audit_logs al
      WHERE al.entity_type = 'assessments'
        AND al.entity_id = $1
        AND al.action = 'ASSESSMENT_STATE_TRANSITION'
      ORDER BY al.timestamp DESC;`,
      [assessmentId]
    );

    return res.rows.map((row) => {
      const prevState = row.previous_state || {};
      const nextState = row.new_state || {};
      return {
        id: row.id,
        tenantId: row.tenant_id,
        userId: row.user_id,
        userRole: nextState.actorRole,
        action: row.action,
        previousStatus: prevState.status as AssessmentStatus,
        newStatus: nextState.status as AssessmentStatus,
        reason: nextState.reason,
        metadata: nextState,
        timestamp: row.timestamp,
      };
    });
  });
}

/**
 * Clones a finalized assessment into a new assessment for a periodic re-audit cycle.
 */
export async function cloneAssessmentForReaudit(
  sessionUser: SessionUser,
  parentAssessmentId: string,
  request: ReauditCloneRequest = {}
): Promise<AssessmentStateSummary> {
  // Authorization: Only TLI Lead Consultant or Super Admin can initiate re-audit
  if (
    sessionUser.role !== "TLI_LEAD_CONSULTANT" &&
    sessionUser.role !== "TLI_SUPER_ADMIN"
  ) {
    throw new LifecycleError(
      "Insufficient permissions: Only TLI Lead Consultants or Super Administrators can initiate re-audit cycles.",
      "UNAUTHORIZED",
      403
    );
  }

  return await executeWithRls(sessionUser, async (client: PoolClient) => {
    // 1. Fetch parent assessment
    const parentRes = await client.query(
      `SELECT * FROM assessments WHERE id = $1;`,
      [parentAssessmentId]
    );

    if (parentRes.rowCount === 0) {
      throw new LifecycleError("Parent assessment not found.", "NOT_FOUND", 404);
    }

    const parent = parentRes.rows[0];

    // Verify parent is in an approved/issued/remediation/archived state
    if (!["LEAD_APPROVED", "FINAL_ISSUED", "REMEDIATION_ACTIVE", "ARCHIVED"].includes(parent.status)) {
      throw new LifecycleError(
        `Cannot initiate re-audit: Parent assessment must be finalized (current status: ${parent.status}).`,
        "INVALID_STATE",
        422
      );
    }

    // 2. Generate new engagement code
    const newEngagementCode =
      request.engagementCode ||
      `${parent.engagement_code}-REAUDIT-${Date.now().toString().slice(-4)}`;

    const newTitle =
      request.title ||
      `${parent.title} (Re-assessment Cycle)`;

    // 3. Insert new assessment in DRAFT
    const insertRes = await client.query(
      `INSERT INTO assessments (
        tenant_id,
        framework_version_id,
        scoring_model_id,
        parent_assessment_id,
        engagement_code,
        title,
        status,
        lead_consultant_id,
        target_completion_date
      ) VALUES ($1, $2, $3, $4, $5, $6, 'DRAFT', $7, $8)
      RETURNING *;`,
      [
        parent.tenant_id,
        parent.framework_version_id,
        parent.scoring_model_id,
        parentAssessmentId,
        newEngagementCode,
        newTitle,
        parent.lead_consultant_id,
        request.targetCompletionDate || null,
      ]
    );

    const newAssessment = insertRes.rows[0];

    // 4. Assign lead consultant
    await client.query(
      `INSERT INTO assessment_assignments (assessment_id, user_id, assignment_role)
       VALUES ($1, $2, 'ENGAGEMENT_LEAD')
       ON CONFLICT (assessment_id, user_id) DO NOTHING;`,
      [newAssessment.id, parent.lead_consultant_id]
    );

    // 5. Optionally copy client responses
    if (request.copyResponses) {
      await client.query(
        `INSERT INTO assessment_questionnaire_responses (
          assessment_id,
          tenant_id,
          question_code,
          questionnaire_version,
          selected_option,
          comments_and_justification
        )
        SELECT 
          $1,
          tenant_id,
          question_code,
          questionnaire_version,
          selected_option,
          comments_and_justification
        FROM assessment_questionnaire_responses
        WHERE assessment_id = $2;`,
        [newAssessment.id, parentAssessmentId]
      );
    }

    // 6. Record audit log for cloning
    await client.query(
      `INSERT INTO audit_logs (
        tenant_id,
        user_id,
        action,
        entity_type,
        entity_id,
        new_state
      ) VALUES ($1, $2, 'ASSESSMENT_CLONED_REAUDIT', 'assessments', $3, $4);`,
      [
        parent.tenant_id,
        sessionUser.userId,
        newAssessment.id,
        JSON.stringify({
          parentAssessmentId,
          parentEngagementCode: parent.engagement_code,
          newEngagementCode,
          copyResponses: Boolean(request.copyResponses),
        }),
      ]
    );

    return {
      id: newAssessment.id,
      engagementCode: newAssessment.engagement_code,
      title: newAssessment.title,
      currentStatus: "DRAFT",
      tenantId: newAssessment.tenant_id,
      leadConsultantId: newAssessment.lead_consultant_id,
      isPartialAssessment: false,
      targetCompletionDate: newAssessment.target_completion_date,
      submittedAt: null,
      reviewedAt: null,
      approvedAt: null,
      issuedAt: null,
      createdAt: newAssessment.created_at,
      updatedAt: newAssessment.updated_at,
      allowedTransitions: getAllowedTransitionsForRole("DRAFT", sessionUser.role, true),
      isImmutable: false,
    };
  });
}

