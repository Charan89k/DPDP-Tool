/**
 * CloudE5 — Assessment Evidence & Coverage API Endpoint
 *
 * GET /api/assessments/[id]/evidence
 * Returns all active compliance evidence items associated with the specified assessment
 * under PostgreSQL Row-Level Security, alongside independent Evidence Coverage metrics
 * (distinct questions supported out of the 60 canonical questions).
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { executeWithRls } from "@/lib/db/rls";
import { errorMessage } from "@/lib/http/errors";
import { sessionErrorResponse } from "@/lib/http/session_errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  req: NextRequest,
  { params }: RouteParams
) {
  const sessionUser = await getCurrentSession();

  if (!sessionUser) {
    return NextResponse.json(
      { error: "Authentication required to view assessment evidence." },
      { status: 401 }
    );
  }

  const { id: assessmentId } = await params;
  if (!assessmentId) {
    return NextResponse.json(
      { error: "Missing required assessment ID parameter." },
      { status: 400 }
    );
  }

  try {
    const result = await executeWithRls(sessionUser, async (client) => {
      // 1. Verify assessment exists and caller has access under RLS
      const assessRes = await client.query(
        "SELECT id, tenant_id, engagement_code FROM assessments WHERE id = $1 LIMIT 1;",
        [assessmentId]
      );
      if (assessRes.rowCount === 0) {
        throw new Error("ASSESSMENT_NOT_FOUND_OR_FORBIDDEN");
      }

      // 2. Query all active evidence items for this assessment
      const evidenceRes = await client.query(
        `SELECT 
          ei.id,
          ei.tenant_id,
          ei.assessment_id,
          ei.question_code,
          COALESCE(c.code, ei.question_code, 'GENERIC') AS control_code,
          ei.evidence_category,
          ei.description,
          ei.file_name,
          ei.file_size_bytes,
          ei.mime_type,
          ei.sha256_hash,
          ei.status,
          ei.uploaded_by_user_id,
          u.full_name AS uploaded_by_name,
          ei.verified_by_reviewer_id,
          r.full_name AS verified_by_name,
          ei.verification_notes,
          ei.verified_at,
          ei.created_at
        FROM evidence_items ei
        LEFT JOIN users u ON u.id = ei.uploaded_by_user_id
        LEFT JOIN users r ON r.id = ei.verified_by_reviewer_id
        LEFT JOIN assessment_controls ac ON ac.id = ei.assessment_control_id
        LEFT JOIN controls c ON c.id = ac.control_id
        WHERE ei.assessment_id = $1 AND ei.status != 'DELETED'
        ORDER BY ei.created_at DESC;`,
        [assessmentId]
      );

      const items = evidenceRes.rows.map((row) => ({
        id: row.id,
        assessmentId: row.assessment_id,
        questionCode: row.question_code || row.control_code || "GENERIC",
        category: row.evidence_category || "Policy / Procedure",
        description: row.description || "",
        fileName: row.file_name,
        fileSizeBytes: Number(row.file_size_bytes),
        mimeType: row.mime_type,
        sha256: row.sha256_hash,
        status: row.status,
        uploadedByUserId: row.uploaded_by_user_id,
        uploadedByName: row.uploaded_by_name || "Authorized User",
        verifiedByReviewerId: row.verified_by_reviewer_id,
        verifiedByName: row.verified_by_name || null,
        verificationNotes: row.verification_notes || null,
        verifiedAt: row.verified_at ? row.verified_at.toISOString() : null,
        createdAt: row.created_at ? row.created_at.toISOString() : null,
      }));

      // 3. Compute independent Evidence Coverage metrics (independent of questionnaire responses and readiness scores)
      const CANONICAL_TOTAL_QUESTIONS = 60;
      const questionCodesWithEvidence = new Set<string>();
      let verifiedCount = 0;
      let activeCount = 0;
      let rejectedCount = 0;
      const categoryBreakdown: Record<string, number> = {};

      for (const item of items) {
        if (item.status === "VERIFIED" || item.status === "ACTIVE") {
          if (item.questionCode && item.questionCode !== "GENERIC") {
            questionCodesWithEvidence.add(item.questionCode);
          }
        }

        if (item.status === "VERIFIED") {
          verifiedCount++;
        } else if (item.status === "ACTIVE") {
          activeCount++;
        } else if (item.status === "REJECTED") {
          rejectedCount++;
        }

        const cat = item.category || "Uncategorized";
        categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
      }

      const questionsWithEvidence = questionCodesWithEvidence.size;
      const coveragePercentage = Math.round((questionsWithEvidence / CANONICAL_TOTAL_QUESTIONS) * 100);

      return {
        items,
        metrics: {
          totalQuestions: CANONICAL_TOTAL_QUESTIONS,
          questionsWithEvidence,
          coveragePercentage,
          totalEvidence: items.length,
          verifiedCount,
          activeCount,
          rejectedCount,
          categoryBreakdown,
        },
      };
    });

    return NextResponse.json({
      success: true,
      assessmentId,
      ...result,
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

    console.error("Failed to retrieve assessment evidence:", err);
    return NextResponse.json(
      { error: "Internal server error occurred while retrieving assessment evidence." },
      { status: 500 }
    );
  }
}

