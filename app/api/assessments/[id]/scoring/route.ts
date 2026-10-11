/**
 * TLI DPDP Compliance Gap Analysis Tool — Deterministic Scoring Engine API
 *
 * GET /api/assessments/[id]/scoring
 * Computes and returns deterministic assessment scoring, including:
 * - 4 strictly separate metrics: Completeness %, Response Coverage %, Evidence Coverage %, Readiness Score %
 * - 8 Section breakdowns and 13 Statutory Domain breakdowns
 * - Explicit tracking of Unscored Unknowns and Unapproved Exclusions
 * - Statutory Deficit Register with penalty tier maximum ceilings
 * - Cryptographic calculation hash (SHA-256)
 * - Mandatory provisional methodology disclaimers (DEC-08, DEC-09)
 *
 * POST /api/assessments/[id]/scoring
 * Persists an immutable score snapshot into assessment_scores table under RLS.
 * Restricted to authorized consultants and administrators.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { canReviewAssessment } from "@/lib/auth/rbac";
import {
  getAssessmentScores,
  persistAssessmentScores,
  ScoringServiceError,
} from "@/lib/scoring";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const sessionUser = await getCurrentSession();

  if (!sessionUser) {
    return NextResponse.json(
      { error: "Authentication required to access scoring engine." },
      { status: 401 }
    );
  }

  const { id: assessmentId } = await params;
  if (!assessmentId) {
    return NextResponse.json(
      { error: "Assessment ID parameter is required." },
      { status: 400 }
    );
  }

  try {
    const scoresOutput = await getAssessmentScores(sessionUser, assessmentId);

    return NextResponse.json(
      {
        success: true,
        data: scoresOutput,
      },
      { status: 200 }
    );
  } catch (error: any) {
    if (error instanceof ScoringServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    console.error("Scoring engine error:", error);
    return NextResponse.json(
      {
        error: error.message || "An unexpected error occurred while calculating assessment scores.",
        code: "INTERNAL_SCORING_ERROR",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const sessionUser = await getCurrentSession();

  if (!sessionUser) {
    return NextResponse.json(
      { error: "Authentication required to persist assessment scores." },
      { status: 401 }
    );
  }

  if (!canReviewAssessment(sessionUser.role)) {
    return NextResponse.json(
      { error: "Forbidden: Only authorized TLI assessors or admins may snapshot scores." },
      { status: 403 }
    );
  }

  const { id: assessmentId } = await params;
  if (!assessmentId) {
    return NextResponse.json(
      { error: "Assessment ID parameter is required." },
      { status: 400 }
    );
  }

  try {
    const snapshot = await persistAssessmentScores(sessionUser, assessmentId);

    return NextResponse.json(
      {
        success: true,
        message: "Assessment score snapshot persisted successfully.",
        data: snapshot,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof ScoringServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    console.error("Persist scoring snapshot error:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to persist score snapshot.",
        code: "PERSIST_SNAPSHOT_ERROR",
      },
      { status: 500 }
    );
  }
}

