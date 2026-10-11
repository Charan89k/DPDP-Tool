import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import {
  updateRemediationProgress,
  validateRemediationClosure,
} from "@/lib/remediation";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string; taskId: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { taskId } = await params;
    const body = await req.json();

    // Check if this is an assessor closure validation request
    if (body.action === "VALIDATE_CLOSE" || body.action === "REJECT_REOPEN") {
      const task = await validateRemediationClosure(session, taskId, {
        action: body.action,
        validationNotes: body.validationNotes || "",
      });
      return NextResponse.json({ ok: true, task }, { status: 200 });
    }

    // Otherwise, normal progress update or submission for closure
    const task = await updateRemediationProgress(session, taskId, {
      title: body.title,
      description: body.description,
      targetDate: body.targetDate,
      ownerUserId: body.ownerUserId,
      status: body.status,
      closureSubmissionNotes: body.closureSubmissionNotes,
    });

    return NextResponse.json({ ok: true, task }, { status: 200 });
  } catch (err: any) {
    console.error("Update remediation error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to update remediation task" },
      { status: 500 }
    );
  }
}

