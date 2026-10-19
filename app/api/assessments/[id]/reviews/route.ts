/**
 * CloudE5 — Assessor Review Workspace API
 *
 * GET /api/assessments/[id]/reviews
 * Retrieves comprehensive review workspace state:
 * - Assessment metadata & scoping under RLS
 * - All 60 canonical questions (8 sections)
 * - Client submitted responses & comments (read-only)
 * - Independent assessor reviews, findings & validation flags
 * - Associated evidence documents (question-level and mapped-control level)
 * - Clarification threads and communication history
 * - Metric calculations (reviewed, pending, clarification requested, gaps)
 *
 * PUT /api/assessments/[id]/reviews
 * Updates assessor review status, findings, deficiency notes, and validation flags.
 * Enforces RBAC: Only CloudE5 assessors can review.
 * Records immutable version history in questionnaire_assessor_review_history.
 */

import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { executeWithRls } from "@/lib/db/rls";
import { canReviewAssessment } from "@/lib/auth/rbac";
import { z } from "zod";
import { errorMessage } from "@/lib/http/errors";
import manifestData from "../../../../../data/questionnaire_v1.json" with { type: "json" };
import { sessionErrorResponse } from "@/lib/http/session_errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const VALID_REVIEW_STATUSES = [
  "PENDING_REVIEW",
  "UNDER_REVIEW",
  "VERIFIED_COMPLIANT",
  "PARTIALLY_COMPLIANT",
  "NON_COMPLIANT",
  "CLARIFICATION_REQUESTED",
  "EXCLUSION_VERIFIED",
] as const;

type ReviewStatus = (typeof VALID_REVIEW_STATUSES)[number];

const reviewItemSchema = z.object({
  questionCode: z.string().trim().min(1).max(64),
  reviewStatus: z.enum(VALID_REVIEW_STATUSES).optional(),
  reviewFindings: z.string().max(10_000).optional(),
  evidenceDeficiencyNotes: z.string().max(10_000).optional(),
  requiresFurtherValidation: z.boolean().optional(),
});
const reviewBodySchema = z.union([
  z.object({ reviews: z.array(reviewItemSchema).min(1).max(200) }),
  reviewItemSchema,
]);

interface ClientResponseView {
  selectedOption: string | null;
  commentsAndJustification: string | null;
  questionnaireVersion: string;
  updatedAt: string | null;
}

interface AssessorReviewView {
  id: string;
  reviewStatus: ReviewStatus;
  reviewFindings: string;
  evidenceDeficiencyNotes: string;
  requiresFurtherValidation: boolean;
  reviewedByUserId: string | null;
  reviewedByUserName: string;
  reviewedAt: string | null;
  updatedAt: string | null;
}

interface ClarificationThreadView {
  id: string;
  questionCode: string | null;
  controlCode: string | null;
  title: string;
  status: string;
  createdAt: string | null;
  raisedByUserName: string;
  messages: Array<{
    id: string;
    authorUserId: string;
    authorName: string;
    authorRole: string;
    messageText: string;
    createdAt: string | null;
  }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const sessionUser = await getCurrentSession();
  const { id: assessmentId } = await params;

  if (!sessionUser) {
    return NextResponse.json(
      { error: "Authentication required to access review workspace." },
      { status: 401 }
    );
  }

  if (!canReviewAssessment(sessionUser.role)) {
    return NextResponse.json(
      { error: "Client roles do not have permission to access internal assessor review workspace." },
      { status: 403 }
    );
  }

  try {
    const data = await executeWithRls(sessionUser, async (client) => {
      // 1. Verify assessment exists & accessible under RLS
      const assessRes = await client.query(
        `SELECT 
          a.id,
          a.tenant_id,
          a.engagement_code,
          a.title,
          a.status,
          a.lead_consultant_id,
          a.target_completion_date,
          a.created_at,
          u.full_name AS lead_consultant_name,
          t.name AS tenant_name,
          t.slug AS tenant_slug,
          t.is_sdf,
          fv.name AS framework_name
        FROM assessments a
        LEFT JOIN users u ON u.id = a.lead_consultant_id
        LEFT JOIN tenants t ON t.id = a.tenant_id
        LEFT JOIN framework_versions fv ON fv.id = a.framework_version_id
        WHERE a.id = $1
        LIMIT 1;`,
        [assessmentId]
      );

      if (assessRes.rowCount === 0) {
        return null;
      }
      const assessment = assessRes.rows[0];

      // 2. Fetch client questionnaire responses
      const clientResponsesRes = await client.query(
        `SELECT 
          question_code,
          selected_option,
          comments_and_justification,
          questionnaire_version,
          updated_at
        FROM assessment_questionnaire_responses
        WHERE assessment_id = $1;`,
        [assessmentId]
      );
      const clientResponsesMap = new Map<string, ClientResponseView>();
      for (const row of clientResponsesRes.rows) {
        clientResponsesMap.set(row.question_code, {
          selectedOption: row.selected_option || null,
          commentsAndJustification: row.comments_and_justification || null,
          questionnaireVersion: row.questionnaire_version,
          updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
        });
      }

      // 3. Fetch assessor reviews
      const reviewsRes = await client.query(
        `SELECT 
          r.id,
          r.question_code,
          r.review_status,
          r.review_findings,
          r.evidence_deficiency_notes,
          r.requires_further_validation,
          r.reviewed_by_user_id,
          r.reviewed_at,
          r.updated_at,
          u.full_name AS reviewed_by_user_name
        FROM questionnaire_assessor_reviews r
        LEFT JOIN users u ON u.id = r.reviewed_by_user_id
        WHERE r.assessment_id = $1;`,
        [assessmentId]
      );
      const reviewsMap = new Map<string, AssessorReviewView>();
      for (const row of reviewsRes.rows) {
        reviewsMap.set(row.question_code, {
          id: row.id,
          reviewStatus: row.review_status,
          reviewFindings: row.review_findings || "",
          evidenceDeficiencyNotes: row.evidence_deficiency_notes || "",
          requiresFurtherValidation: Boolean(row.requires_further_validation),
          reviewedByUserId: row.reviewed_by_user_id,
          reviewedByUserName: row.reviewed_by_user_name || "Assessor",
          reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
          updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
        });
      }

      // 4. Fetch evidence items
      const evidenceRes = await client.query(
        `SELECT 
          ei.id,
          ei.file_name,
          ei.file_size_bytes,
          ei.mime_type,
          ei.status,
          ei.question_code,
          c.code AS control_code,
          ei.created_at,
          ei.verified_at,
          ei.verification_notes
        FROM evidence_items ei
        LEFT JOIN assessment_controls ac ON ac.id = ei.assessment_control_id
        LEFT JOIN controls c ON c.id = ac.control_id
        WHERE (ei.assessment_id = $1 OR ac.assessment_id = $1) AND ei.status != 'DELETED'
        ORDER BY ei.created_at DESC;`,
        [assessmentId]
      );
      const evidenceList = evidenceRes.rows.map((row) => ({
        id: row.id,
        fileName: row.file_name,
        fileSizeBytes: Number(row.file_size_bytes),
        mimeType: row.mime_type,
        status: row.status,
        questionCode: row.question_code || null,
        controlCode: row.control_code || null,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
        verifiedAt: row.verified_at ? new Date(row.verified_at).toISOString() : null,
        verificationNotes: row.verification_notes || null,
      }));

      // 5. Fetch clarification threads & messages
      const threadsRes = await client.query(
        `SELECT 
          ct.id AS thread_id,
          ct.question_code,
          c.code AS control_code,
          ct.title,
          ct.status AS thread_status,
          ct.created_at AS thread_created_at,
          u.full_name AS raised_by_user_name,
          cm.id AS message_id,
          cm.author_user_id,
          cm.message_text,
          cm.created_at AS message_created_at,
          mu.full_name AS author_name,
          mu.role AS author_role
        FROM clarification_threads ct
        LEFT JOIN assessment_controls ac ON ac.id = ct.assessment_control_id
        LEFT JOIN controls c ON c.id = ac.control_id
        LEFT JOIN users u ON u.id = ct.raised_by_user_id
        LEFT JOIN clarification_messages cm ON cm.thread_id = ct.id
        LEFT JOIN users mu ON mu.id = cm.author_user_id
        WHERE ct.assessment_id = $1 OR ac.assessment_id = $1
        ORDER BY ct.created_at ASC, cm.created_at ASC;`,
        [assessmentId]
      );

      const threadsMap = new Map<string, ClarificationThreadView>();
      for (const row of threadsRes.rows) {
        if (!threadsMap.has(row.thread_id)) {
          threadsMap.set(row.thread_id, {
            id: row.thread_id,
            questionCode: row.question_code || null,
            controlCode: row.control_code || null,
            title: row.title,
            status: row.thread_status,
            createdAt: row.thread_created_at ? new Date(row.thread_created_at).toISOString() : null,
            raisedByUserName: row.raised_by_user_name || "User",
            messages: [],
          });
        }
        if (row.message_id) {
          threadsMap.get(row.thread_id)!.messages.push({
            id: row.message_id,
            authorUserId: row.author_user_id,
            authorName: row.author_name || "User",
            authorRole: row.author_role || "",
            messageText: row.message_text,
            createdAt: row.message_created_at ? new Date(row.message_created_at).toISOString() : null,
          });
        }
      }
      const clarificationThreads = Array.from(threadsMap.values());

      return {
        assessment,
        clientResponsesMap,
        reviewsMap,
        evidenceList,
        clarificationThreads,
      };
    });

    if (data === null) {
      return NextResponse.json(
        { error: "Assessment not found or unauthorized access under tenant RLS." },
        { status: 404 }
      );
    }

    // Merge with 60 canonical questions from manifest
    const questions = manifestData.questions.map((q) => {
      const clientResp = data.clientResponsesMap.get(q.code) || null;
      const review = data.reviewsMap.get(q.code) || {
        reviewStatus: "PENDING_REVIEW",
        reviewFindings: "",
        evidenceDeficiencyNotes: "",
        requiresFurtherValidation: false,
        reviewedByUserName: null,
        reviewedAt: null,
      };

      // Find matching evidence items: direct question code or mapped canonical control
      const matchingEvidence = data.evidenceList.filter(
        (e) =>
          e.questionCode === q.code ||
          (q.canonical_control_id && e.controlCode === q.canonical_control_id)
      );

      // Find matching clarification threads
      const matchingThreads = data.clarificationThreads.filter(
        (t) =>
          t.questionCode === q.code ||
          (q.canonical_control_id && t.controlCode === q.canonical_control_id)
      );

      return {
        code: q.code,
        order: q.order,
        sectionCode: q.section_code,
        sectionTitle: q.section_title,
        text: q.text,
        options: q.options,
        followUpPrompt: q.follow_up_prompt,
        canonicalControlId: q.canonical_control_id || null,
        mappingStatus: q.mapping_status,
        mappingNotes: q.mapping_notes,
        clientResponse: clientResp,
        assessorReview: review,
        evidence: matchingEvidence,
        clarifications: matchingThreads,
      };
    });

    // Compute metrics
    const totalQuestions = questions.length; // 60
    let clientAnsweredCount = 0;
    let assessorReviewedCount = 0;
    let pendingReviewCount = 0;
    let clarificationRequestedCount = 0;
    let deficienciesCount = 0;
    let requiresValidationCount = 0;

    for (const q of questions) {
      if (q.clientResponse && q.clientResponse.selectedOption) {
        clientAnsweredCount++;
      }
      const st = q.assessorReview.reviewStatus;
      if (
        st === "VERIFIED_COMPLIANT" ||
        st === "PARTIALLY_COMPLIANT" ||
        st === "NON_COMPLIANT" ||
        st === "EXCLUSION_VERIFIED"
      ) {
        assessorReviewedCount++;
      } else {
        pendingReviewCount++;
      }
      if (st === "CLARIFICATION_REQUESTED") {
        clarificationRequestedCount++;
      }
      if (st === "PARTIALLY_COMPLIANT" || st === "NON_COMPLIANT") {
        deficienciesCount++;
      }
      if (q.assessorReview.requiresFurtherValidation) {
        requiresValidationCount++;
      }
    }

    return NextResponse.json({
      success: true,
      assessment: data.assessment,
      sections: manifestData.sections,
      questions,
      metrics: {
        totalQuestions,
        clientAnsweredCount,
        assessorReviewedCount,
        pendingReviewCount,
        clarificationRequestedCount,
        deficienciesCount,
        requiresValidationCount,
        assessorProgressPct: Math.round((assessorReviewedCount / totalQuestions) * 100),
        clientProgressPct: Math.round((clientAnsweredCount / totalQuestions) * 100),
      },
      userRole: sessionUser.role,
      isAssessor: canReviewAssessment(sessionUser.role),
    });
  } catch (err) {
    const sessionError = sessionErrorResponse(err);
    if (sessionError) return sessionError;
    console.error("Failed to load assessor review workspace:", err);
    return NextResponse.json(
      { error: "Failed to retrieve review workspace under tenant boundary." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  const sessionUser = await getCurrentSession();
  const { id: assessmentId } = await params;

  if (!sessionUser) {
    return NextResponse.json(
      { error: "Authentication required to record review findings." },
      { status: 401 }
    );
  }

  // RBAC: Only authorized assessors can record review evaluations
  if (!canReviewAssessment(sessionUser.role)) {
    return NextResponse.json(
      { error: "Access denied. Only authorized CloudE5 assessors can record review evaluations." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  // Single question update or a batch under "reviews".
  const parsed = reviewBodySchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: `Invalid review payload: ${issue?.message ?? "malformed"}${issue?.path.length ? ` (${issue.path.join(".")})` : ""}` },
      { status: 400 }
    );
  }
  const items = "reviews" in parsed.data ? parsed.data.reviews : [parsed.data];

  try {
    const result = await executeWithRls(sessionUser, async (client) => {
      // 1. Verify assessment exists and user has assignment
      const assessRes = await client.query(
        "SELECT id, status FROM assessments WHERE id = $1 LIMIT 1;",
        [assessmentId]
      );
      if (assessRes.rowCount === 0) {
        throw new Error("ASSESSMENT_NOT_FOUND_OR_FORBIDDEN");
      }

      let updatedCount = 0;

      for (const item of items) {
        const status = item.reviewStatus || "UNDER_REVIEW";
        const findings = item.reviewFindings !== undefined ? item.reviewFindings : null;
        const deficiencyNotes =
          item.evidenceDeficiencyNotes !== undefined ? item.evidenceDeficiencyNotes : null;
        const reqValidation = Boolean(item.requiresFurtherValidation);

        // Upsert into questionnaire_assessor_reviews
        const upsertRes = await client.query(
          `INSERT INTO questionnaire_assessor_reviews (
            assessment_id,
            question_code,
            review_status,
            review_findings,
            evidence_deficiency_notes,
            requires_further_validation,
            reviewed_by_user_id,
            reviewed_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT (assessment_id, question_code)
          DO UPDATE SET
            review_status = EXCLUDED.review_status,
            review_findings = EXCLUDED.review_findings,
            evidence_deficiency_notes = EXCLUDED.evidence_deficiency_notes,
            requires_further_validation = EXCLUDED.requires_further_validation,
            reviewed_by_user_id = EXCLUDED.reviewed_by_user_id,
            reviewed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id;`,
          [
            assessmentId,
            item.questionCode,
            status,
            findings,
            deficiencyNotes,
            reqValidation,
            sessionUser.userId,
          ]
        );

        if (upsertRes.rowCount && upsertRes.rowCount > 0) {
          updatedCount++;

          // Query next version number for history
          const histVerRes = await client.query(
            `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_ver
             FROM questionnaire_assessor_review_history
             WHERE assessment_id = $1 AND question_code = $2;`,
            [assessmentId, item.questionCode]
          );
          const nextVersion = histVerRes.rows[0].next_ver;

          // Insert immutable version history record
          await client.query(
            `INSERT INTO questionnaire_assessor_review_history (
              assessment_id,
              question_code,
              version_number,
              review_status,
              review_findings,
              evidence_deficiency_notes,
              requires_further_validation,
              reviewed_by_user_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
            [
              assessmentId,
              item.questionCode,
              nextVersion,
              status,
              findings,
              deficiencyNotes,
              reqValidation,
              sessionUser.userId,
            ]
          );
        }
      }

      return { updatedCount };
    });

    return NextResponse.json({
      success: true,
      assessmentId,
      updatedCount: result.updatedCount,
    });
  } catch (err) {
    const sessionError = sessionErrorResponse(err);
    if (sessionError) return sessionError;
    if (errorMessage(err) === "ASSESSMENT_NOT_FOUND_OR_FORBIDDEN") {
      return NextResponse.json(
        { error: "Assessment not found or access denied." },
        { status: 404 }
      );
    }
    console.error("Failed to persist assessor review findings:", err);
    return NextResponse.json(
      { error: "Failed to persist review findings under RLS security boundary." },
      { status: 500 }
    );
  }
}

