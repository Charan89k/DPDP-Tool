import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { serviceErrorResponse } from "@/lib/http/service_errors";
import { dispatchInBackground } from "@/lib/notifications/dispatch";
import { respondToProposal, sendProposal } from "@/lib/remediation-requests/service";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const schema = z.object({ action: z.enum(["SEND", "ACCEPT", "DECLINE", "CLARIFY"]), note: z.string().max(2000).default("") });

/** TLI sends; the customer accepts, declines or asks a question. No payment is taken. */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    if (parsed.data.action === "SEND") await sendProposal(session, id);
    else await respondToProposal(session, id, parsed.data.action, parsed.data.note);
    after(dispatchInBackground);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serviceErrorResponse(err, "Updating the proposal");
  }
}
