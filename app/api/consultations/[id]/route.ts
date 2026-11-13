import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { serviceErrorResponse, requestMeta } from "@/lib/http/service_errors";
import { dispatchInBackground } from "@/lib/notifications/dispatch";
import { cancelAppointment, completeAppointment, confirmAppointment, rescheduleAppointment } from "@/lib/consultations/service";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("RESCHEDULE"), startsAt: z.string().datetime() }),
  z.object({ action: z.literal("CANCEL"), reason: z.string().max(500).default("") }),
  z.object({ action: z.literal("CONFIRM"), meetingUrl: z.string().max(500).nullish(), location: z.string().max(300).nullish() }),
  z.object({ action: z.literal("COMPLETE") }),
]);

/** Reschedule, cancel, confirm (TLI) or mark held (TLI). */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const body = parsed.data;
    if (body.action === "RESCHEDULE") await rescheduleAppointment(session, id, body.startsAt, requestMeta(req));
    if (body.action === "CANCEL") await cancelAppointment(session, id, body.reason, requestMeta(req));
    if (body.action === "CONFIRM") await confirmAppointment(session, id, { meetingUrl: body.meetingUrl, location: body.location }, requestMeta(req));
    if (body.action === "COMPLETE") await completeAppointment(session, id);
    after(dispatchInBackground);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serviceErrorResponse(err, "Updating the appointment");
  }
}
