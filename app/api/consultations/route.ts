import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { serviceErrorResponse, requestMeta } from "@/lib/http/service_errors";
import { dispatchInBackground } from "@/lib/notifications/dispatch";
import { bookAppointment, listAppointments } from "@/lib/consultations/service";

export const dynamic = "force-dynamic";

/** Appointments visible to the caller (filters: status, tenantId, assessorId, from, to). */
export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const q = req.nextUrl.searchParams;
    const filters = Object.fromEntries(["status", "tenantId", "assessorId", "from", "to"].map((k) => [k, q.get(k) || undefined]));
    return NextResponse.json({ appointments: await listAppointments(session, filters) });
  } catch (err) {
    return serviceErrorResponse(err, "Loading appointments");
  }
}

const bookingSchema = z.object({
  typeId: z.string().min(1).max(64),
  assessorId: z.string().min(1).max(64),
  startsAt: z.string().datetime(),
  agenda: z.string().max(2000).default(""),
  clientTimezone: z.string().max(64).default("Asia/Kolkata"),
  assessmentId: z.string().max(64).nullish(),
  remediationRequestId: z.string().max(64).nullish(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const parsed = bookingSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Choose a consultation type, an assessor and a time." }, { status: 400 });
    const result = await bookAppointment(session, parsed.data, requestMeta(req));
    after(dispatchInBackground);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return serviceErrorResponse(err, "Booking the consultation");
  }
}
