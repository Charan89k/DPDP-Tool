import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { serviceErrorResponse } from "@/lib/http/service_errors";
import { dispatchInBackground } from "@/lib/notifications/dispatch";
import { createRemediationRequest, listRemediationRequests } from "@/lib/remediation-requests/service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const q = req.nextUrl.searchParams;
    return NextResponse.json({ requests: await listRemediationRequests(session, { status: q.get("status") || undefined, tenantId: q.get("tenantId") || undefined, assessorId: q.get("assessorId") || undefined }) });
  } catch (err) {
    return serviceErrorResponse(err, "Loading remediation requests");
  }
}

const schema = z.object({
  assessmentId: z.string().min(1).max(64),
  questionCodes: z.array(z.string().max(16)).min(1).max(60),
  helpDescription: z.string().max(5000).default(""),
  wantsConsultation: z.boolean().default(false),
  submit: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Select at least one gap." }, { status: 400 });
    const result = await createRemediationRequest(session, parsed.data);
    after(dispatchInBackground);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return serviceErrorResponse(err, "Creating the remediation request");
  }
}
