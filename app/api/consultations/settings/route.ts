import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { serviceErrorResponse } from "@/lib/http/service_errors";
import { listAppointmentTypes, saveAppointmentType, setReminderOffsets } from "@/lib/consultations/service";
import { getReminderOffsets } from "@/lib/notifications/queue";
import { pool } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ types: await listAppointmentTypes(false), reminderOffsets: await getReminderOffsets(pool) });
  } catch (err) {
    return serviceErrorResponse(err, "Loading consultation settings");
  }
}

const schema = z.union([
  z.object({
    appointmentType: z.object({
      id: z.string().max(64).optional(),
      name: z.string().trim().min(3).max(120),
      description: z.string().max(500).default(""),
      durationMinutes: z.number().int(),
      requiresApproval: z.boolean(),
      isActive: z.boolean(),
      sortOrder: z.number().int().min(0).max(999),
    }),
  }),
  z.object({ reminderOffsets: z.array(z.number().int()).min(1).max(4) }),
]);

/** Super administrator: appointment types and reminder timing. */
export async function PUT(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid settings." }, { status: 400 });
    if ("appointmentType" in parsed.data) await saveAppointmentType(session, parsed.data.appointmentType);
    else await setReminderOffsets(session, parsed.data.reminderOffsets);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serviceErrorResponse(err, "Saving consultation settings");
  }
}
