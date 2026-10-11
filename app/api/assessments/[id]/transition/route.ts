/**
 * TLI DPDP Compliance Gap Analysis Tool — Assessment Lifecycle Transition API
 *
 * GET /api/assessments/[id]/transition
 * Retrieves current lifecycle state, permitted transitions for authenticated caller,
 * and immutable transition audit trail under PostgreSQL Row-Level Security.
 *
 * POST /api/assessments/[id]/transition
 * Validates and executes an authorized state transition under RLS transaction,
 * enforcing data completeness, exclusion verifications, clarification closures,
 * and immutable forensic logging.
 */

import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import {
  getAssessmentLifecycleState,
  getAssessmentTransitionHistory,
  executeAssessmentTransition,
  LifecycleError,
} from "@/lib/lifecycle";
import type { TransitionRequest } from "@/lib/lifecycle/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const sessionUser = await getCurrentSession();
  const { id: assessmentId } = await params;

  if (!sessionUser) {
    return NextResponse.json(
      { error: "Authentication required to view assessment lifecycle state." },
      { status: 401 }
    );
  }

  try {
    const [stateSummary, history] = await Promise.all([
      getAssessmentLifecycleState(sessionUser, assessmentId),
      getAssessmentTransitionHistory(sessionUser, assessmentId),
    ]);

    return NextResponse.json(
      {
        success: true,
        lifecycle: stateSummary,
        history,
      },
      { status: 200 }
    );
  } catch (err: any) {
    if (err instanceof LifecycleError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.statusCode }
      );
    }
    console.error("Failed to fetch assessment lifecycle state:", err);
    return NextResponse.json(
      { error: "Failed to retrieve assessment lifecycle details." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const sessionUser = await getCurrentSession();
  const { id: assessmentId } = await params;

  if (!sessionUser) {
    return NextResponse.json(
      { error: "Authentication required to execute lifecycle transition." },
      { status: 401 }
    );
  }

  let body: TransitionRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Malformed request payload. JSON object expected." },
      { status: 400 }
    );
  }

  if (!body.targetStatus) {
    return NextResponse.json(
      { error: "Missing required parameter 'targetStatus'." },
      { status: 400 }
    );
  }

  try {
    const updatedState = await executeAssessmentTransition(
      sessionUser,
      assessmentId,
      body
    );

    return NextResponse.json(
      {
        success: true,
        lifecycle: updatedState,
      },
      { status: 200 }
    );
  } catch (err: any) {
    if (err instanceof LifecycleError) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          validationErrors: err.validationErrors || [],
        },
        { status: err.statusCode }
      );
    }
    console.error("Failed to execute lifecycle transition:", err);
    return NextResponse.json(
      { error: err.message || "Failed to execute lifecycle transition." },
      { status: 500 }
    );
  }
}

