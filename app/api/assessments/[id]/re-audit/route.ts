/**
 * CloudE5 — Assessment Re-audit Clone API
 *
 * POST /api/assessments/[id]/re-audit
 * Clones a finalized assessment into a new versioned engagement linked via parent_assessment_id.
 * Enforces consultant authority and historical dataset immutability.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { calendarDateSchema } from "@/lib/http/dates";
import { getCurrentSession } from "@/lib/auth/session";
import { cloneAssessmentForReaudit, LifecycleError } from "@/lib/lifecycle";
import type { ReauditCloneRequest } from "@/lib/lifecycle/types";
import { sessionErrorResponse } from "@/lib/http/session_errors";

const reauditBodySchema = z.object({
  engagementCode: z.string().trim().max(100).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  targetCompletionDate: calendarDateSchema.optional(),
  copyResponses: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const sessionUser = await getCurrentSession();
  const { id: assessmentId } = await params;

  if (!sessionUser) {
    return NextResponse.json(
      { error: "Authentication required to initiate re-audit cycle." },
      { status: 401 }
    );
  }

  // The body is optional; when one is sent it must be valid JSON.
  let raw: unknown = {};
  const text = await request.text();
  if (text.trim()) {
    try {
      raw = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
  }
  const parsed = reauditBodySchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: `Invalid re-audit request: ${issue?.message ?? "malformed"}${issue?.path.length ? ` (${issue.path.join(".")})` : ""}` },
      { status: 400 }
    );
  }
  const body: ReauditCloneRequest = parsed.data;

  try {
    const newAssessment = await cloneAssessmentForReaudit(
      sessionUser,
      assessmentId,
      body
    );

    return NextResponse.json(
      {
        success: true,
        assessment: newAssessment,
      },
      { status: 201 }
    );
  } catch (err) {
    const sessionError = sessionErrorResponse(err);
    if (sessionError) return sessionError;
    if (err instanceof LifecycleError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.statusCode }
      );
    }
    console.error("Failed to initiate assessment re-audit cycle:", err);
    return NextResponse.json(
      { error: "Failed to initiate re-audit cycle." },
      { status: 500 }
    );
  }
}

