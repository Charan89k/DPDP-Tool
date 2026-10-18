/**
 * CloudE5 — Assessment Responses API
 *
 * GET /api/assessments/[id]/responses
 * Fetches saved questionnaire responses for the assessment.
 *
 * PUT /api/assessments/[id]/responses
 * Upserts questionnaire responses and records immutable version audit history.
 * Multi-tenant isolation and assessment lifecycle boundaries are enforced at the DB kernel via RLS.
 */

import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { executeWithRls } from "@/lib/db/rls";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const VALID_OPTIONS = [
  "Implemented",
  "Partially implemented",
  "Not implemented",
  "Unknown / not verified",
  "Not applicable — justification required",
] as const;

export async function GET(request: Request, { params }: RouteParams) {
  const sessionUser = await getCurrentSession();
  const { id: assessmentId } = await params;

  if (!sessionUser) {
    return NextResponse.json(
      { error: "Authentication required to access questionnaire responses." },
      { status: 401 }
    );
  }

  try {
    const responses = await executeWithRls(sessionUser, async (client) => {
      // First verify assessment exists and is accessible
      const assessRes = await client.query(
        "SELECT id, tenant_id, status FROM assessments WHERE id = $1 LIMIT 1;",
        [assessmentId]
      );
      if (assessRes.rowCount === 0) {
        return null;
      }

      const rows = await client.query(
        `SELECT 
          question_code,
          selected_option,
          comments_and_justification,
          questionnaire_version,
          updated_at
        FROM assessment_questionnaire_responses
        WHERE assessment_id = $1
        ORDER BY question_code ASC;`,
        [assessmentId]
      );

      const mapped: Record<string, {
        questionCode: string;
        selectedOption?: string;
        commentsAndJustification?: string;
        questionnaireVersion: string;
        updatedAt: string;
      }> = {};

      for (const r of rows.rows) {
        mapped[r.question_code] = {
          questionCode: r.question_code,
          selectedOption: r.selected_option || undefined,
          commentsAndJustification: r.comments_and_justification || undefined,
          questionnaireVersion: r.questionnaire_version,
          updatedAt: r.updated_at.toISOString(),
        };
      }

      return mapped;
    });

    if (responses === null) {
      return NextResponse.json(
        { error: "Assessment not found or unauthorized access." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      assessmentId,
      responses,
    });
  } catch (err) {
    console.error("Failed to fetch assessment questionnaire responses:", err);
    return NextResponse.json(
      { error: "Failed to retrieve questionnaire responses under tenant security boundary." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  const sessionUser = await getCurrentSession();
  const { id: assessmentId } = await params;

  if (!sessionUser) {
    return NextResponse.json(
      { error: "Authentication required to submit questionnaire responses." },
      { status: 401 }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const { responses } = body;
  if (!responses || typeof responses !== "object") {
    return NextResponse.json(
      { error: "Missing or invalid 'responses' object in payload." },
      { status: 400 }
    );
  }

  // Validate all items
  for (const [code, item] of Object.entries<any>(responses)) {
    if (item.selectedOption && !VALID_OPTIONS.includes(item.selectedOption)) {
      return NextResponse.json(
        { error: `Invalid option '${item.selectedOption}' for question ${code}.` },
        { status: 400 }
      );
    }
    if (
      item.selectedOption === "Not applicable — justification required" &&
      (!item.commentsAndJustification || item.commentsAndJustification.trim().length === 0)
    ) {
      return NextResponse.json(
        {
          error: `Non-empty justification is required for question ${code} when 'Not applicable' is selected.`,
          questionCode: code,
        },
        { status: 400 }
      );
    }
  }

  try {
    const result = await executeWithRls(sessionUser, async (client) => {
      // Check assessment status and tenant
      const assessRes = await client.query(
        "SELECT id, tenant_id, status FROM assessments WHERE id = $1 LIMIT 1;",
        [assessmentId]
      );
      if (assessRes.rowCount === 0) {
        throw new Error("ASSESSMENT_NOT_FOUND_OR_FORBIDDEN");
      }

      const assessment = assessRes.rows[0];
      const tenantId = assessment.tenant_id;

      let savedCount = 0;

      for (const [qCode, item] of Object.entries<any>(responses)) {
        if (!item || (!item.selectedOption && !item.commentsAndJustification)) {
          continue;
        }

        // Upsert response
        const upsertRes = await client.query(
          `INSERT INTO assessment_questionnaire_responses (
            assessment_id,
            tenant_id,
            question_code,
            questionnaire_version,
            selected_option,
            comments_and_justification,
            updated_at
          ) VALUES ($1, $2, $3, '1.0.0', $4, $5, CURRENT_TIMESTAMP)
          ON CONFLICT (assessment_id, question_code)
          DO UPDATE SET
            selected_option = EXCLUDED.selected_option,
            comments_and_justification = EXCLUDED.comments_and_justification,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id;`,
          [
            assessmentId,
            tenantId,
            qCode,
            item.selectedOption || null,
            item.commentsAndJustification || null,
          ]
        );

        if (upsertRes.rowCount && upsertRes.rowCount > 0) {
          savedCount++;

          // Query current latest version number for history
          const histVerRes = await client.query(
            `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_ver
             FROM questionnaire_response_history
             WHERE assessment_id = $1 AND question_code = $2;`,
            [assessmentId, qCode]
          );
          const nextVersion = histVerRes.rows[0].next_ver;

          // Insert immutable history record if an option was selected
          if (item.selectedOption) {
            await client.query(
              `INSERT INTO questionnaire_response_history (
                assessment_id,
                tenant_id,
                question_code,
                version_number,
                selected_option,
                comments_and_justification,
                submitted_by_id
              ) VALUES ($1, $2, $3, $4, $5, $6, $7);`,
              [
                assessmentId,
                tenantId,
                qCode,
                nextVersion,
                item.selectedOption,
                item.commentsAndJustification || null,
                sessionUser.userId,
              ]
            );
          }
        }
      }

      return { savedCount };
    });

    return NextResponse.json({
      success: true,
      assessmentId,
      savedCount: result.savedCount,
    });
  } catch (err: any) {
    if (err.message === "ASSESSMENT_NOT_FOUND_OR_FORBIDDEN") {
      return NextResponse.json(
        { error: "Assessment not found or access denied." },
        { status: 404 }
      );
    }
    console.error("Failed to persist questionnaire responses:", err);
    return NextResponse.json(
      { error: err.message || "Failed to persist responses under tenant boundary." },
      { status: 500 }
    );
  }
}

