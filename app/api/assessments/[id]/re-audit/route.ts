/**
 * TLI DPDP Compliance Gap Analysis Tool — Assessment Re-audit Clone API
 *
 * POST /api/assessments/[id]/re-audit
 * Clones a finalized assessment into a new versioned engagement linked via parent_assessment_id.
 * Enforces consultant authority and historical dataset immutability.
 */

import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { cloneAssessmentForReaudit, LifecycleError } from "@/lib/lifecycle";
import type { ReauditCloneRequest } from "@/lib/lifecycle/types";

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

  let body: ReauditCloneRequest = {};
  try {
    body = await request.json();
  } catch {
    // Optional JSON body
  }

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
  } catch (err: any) {
    if (err instanceof LifecycleError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.statusCode }
      );
    }
    console.error("Failed to initiate assessment re-audit cycle:", err);
    return NextResponse.json(
      { error: err.message || "Failed to initiate re-audit cycle." },
      { status: 500 }
    );
  }
}

