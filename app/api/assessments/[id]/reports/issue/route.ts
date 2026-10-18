import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { issueOfficialFinalReport } from "@/lib/reports";
import { isTliRole, canFinalizeAssessment } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isTliRole(session.role) || !canFinalizeAssessment(session.role)) {
      return NextResponse.json(
        {
          error:
            "Authority violation: Only Lead Consultant or Super Administrator can approve and issue final reports (DEC-01).",
        },
        { status: 403 }
      );
    }

    const { id } = await params;
    const snapshot = await issueOfficialFinalReport(session, id);

    return NextResponse.json({ ok: true, snapshot }, { status: 200 });
  } catch (err) {
    console.error("Report issuance error:", err);
    return NextResponse.json(
      { error: "Failed to issue final report" },
      { status: 500 }
    );
  }
}

