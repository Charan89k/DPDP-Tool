import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { serviceErrorResponse } from "@/lib/http/service_errors";
import { addAvailabilityException, getMyAvailability, removeAvailabilityException, saveMyAvailability } from "@/lib/consultations/service";

export const dynamic = "force-dynamic";

async function session401() {
  const session = await getCurrentSession();
  return session ?? null;
}

export async function GET() {
  try {
    const session = await session401();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json(await getMyAvailability(session));
  } catch (err) {
    return serviceErrorResponse(err, "Loading availability");
  }
}

const saveSchema = z.object({
  timezone: z.string().max(64),
  weeklyHours: z.record(z.string(), z.array(z.tuple([z.string(), z.string()]))),
  bufferMinutes: z.number().int(),
  slotStepMinutes: z.number().int(),
  minNoticeHours: z.number().int(),
  maxDaysAhead: z.number().int(),
  meetingUrl: z.string().max(500).nullable(),
  location: z.string().max(300).nullable(),
  isAccepting: z.boolean(),
});

export async function PUT(req: NextRequest) {
  try {
    const session = await session401();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const parsed = saveSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid availability." }, { status: 400 });
    return NextResponse.json(await saveMyAvailability(session, parsed.data));
  } catch (err) {
    return serviceErrorResponse(err, "Saving availability");
  }
}

const blockSchema = z.object({ startsOn: z.string(), endsOn: z.string(), reason: z.string().max(200).optional() });

/** Block dates. */
export async function POST(req: NextRequest) {
  try {
    const session = await session401();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const parsed = blockSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Enter a date range." }, { status: 400 });
    await addAvailabilityException(session, parsed.data);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return serviceErrorResponse(err, "Blocking dates");
  }
}

/** Unblock: DELETE /api/availability?exceptionId= */
export async function DELETE(req: NextRequest) {
  try {
    const session = await session401();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await removeAvailabilityException(session, req.nextUrl.searchParams.get("exceptionId") ?? "");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serviceErrorResponse(err, "Unblocking dates");
  }
}
