import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { getAssessmentGapAnalysis, GapsServiceError } from "@/lib/gaps";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const sessionUser = await getCurrentSession();
    if (!sessionUser) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "Assessment ID is required" },
        { status: 400 }
      );
    }

    const gapResult = await getAssessmentGapAnalysis(sessionUser, id);

    // Customer roles receive results with internal assessor notes removed (done in the service).
    return NextResponse.json(gapResult, { status: 200 });
  } catch (error) {
    console.error("GET /api/assessments/[id]/gaps error:", error);

    if (error instanceof GapsServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: "Failed to evaluate compliance gaps" },
      { status: 500 }
    );
  }
}

