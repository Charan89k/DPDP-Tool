import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { serviceErrorResponse } from "@/lib/http/service_errors";
import { listAppointmentTypes, listBookableAssessors } from "@/lib/consultations/service";

export const dynamic = "force-dynamic";

/** Consultation types and the assessors currently taking bookings. */
export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const [types, assessors] = await Promise.all([listAppointmentTypes(true), listBookableAssessors()]);
    return NextResponse.json({ types, assessors: assessors.map((a) => ({ userId: a.userId, fullName: a.fullName })) });
  } catch (err) {
    return serviceErrorResponse(err, "Loading consultation options");
  }
}
