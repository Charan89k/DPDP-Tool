import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { serviceErrorResponse } from "@/lib/http/service_errors";
import { listAppointments } from "@/lib/consultations/service";
import { appointmentIcs, loadAppointmentDetails } from "@/lib/notifications/dispatch";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** The appointment as an .ics file (same UID and current SEQUENCE as the emailed invitation). */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    // Visibility through the tenant policy layer before reading details in the system context.
    if (!(await listAppointments(session)).some((a) => a.id === id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const ap = await loadAppointmentDetails(id);
    if (!ap) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const from = process.env.SMTP_FROM || "no-reply@localhost";
    const ics = appointmentIcs(ap, ap.status === "CANCELLED" ? "CANCEL" : "REQUEST", from.match(/<([^>]+)>/)?.[1] ?? from);
    return new NextResponse(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="tli-consultation-${id.slice(0, 8)}.ics"` } });
  } catch (err) {
    return serviceErrorResponse(err, "Preparing the calendar file");
  }
}
