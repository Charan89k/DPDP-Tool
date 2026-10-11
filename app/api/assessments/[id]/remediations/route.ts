import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import {
  getAssessmentRemediations,
  createRemediationTask,
} from "@/lib/remediation";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const remediations = await getAssessmentRemediations(session, id);

    return NextResponse.json({ ok: true, remediations }, { status: 200 });
  } catch (err: any) {
    console.error("Fetch remediations error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch remediation tasks" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const task = await createRemediationTask(session, {
      assessmentId: id,
      questionCode: body.questionCode,
      title: body.title,
      description: body.description,
      priority: body.priority || "HIGH",
      targetDate: body.targetDate,
      ownerUserId: body.ownerUserId,
    });

    return NextResponse.json({ ok: true, task }, { status: 201 });
  } catch (err: any) {
    console.error("Create remediation error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create remediation task" },
      { status: 500 }
    );
  }
}

