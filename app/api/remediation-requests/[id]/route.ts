import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { serviceErrorResponse } from "@/lib/http/service_errors";
import { dispatchInBackground } from "@/lib/notifications/dispatch";
import { getRemediationRequest, performRequestAction, postMessage, updateDraftRequest } from "@/lib/remediation-requests/service";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    return NextResponse.json(await getRemediationRequest(session, id));
  } catch (err) {
    return serviceErrorResponse(err, "Loading the remediation request");
  }
}

const draftSchema = z.object({ questionCodes: z.array(z.string().max(16)).min(1).max(60).optional(), helpDescription: z.string().max(5000).optional(), wantsConsultation: z.boolean().optional() });

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const parsed = draftSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid draft." }, { status: 400 });
    await updateDraftRequest(session, id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serviceErrorResponse(err, "Saving the draft");
  }
}

const actionSchema = z.object({
  action: z.enum(["SUBMIT", "CANCEL", "RESPOND", "START_REVIEW", "REQUEST_CLARIFICATION", "DECLINE_REQUEST", "START_ENGAGEMENT", "COMPLETE", "MESSAGE"]),
  message: z.string().max(5000).default(""),
});

/** Status actions and messages. */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const parsed = actionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    if (parsed.data.action === "MESSAGE") await postMessage(session, id, parsed.data.message);
    else await performRequestAction(session, id, parsed.data.action, parsed.data.message);
    after(dispatchInBackground);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serviceErrorResponse(err, "Updating the remediation request");
  }
}
