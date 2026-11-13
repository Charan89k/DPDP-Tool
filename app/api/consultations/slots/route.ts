import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { serviceErrorResponse } from "@/lib/http/service_errors";
import { findSlots } from "@/lib/consultations/service";

export const dynamic = "force-dynamic";

/** Real availability: /api/consultations/slots?typeId=&from=YYYY-MM-DD&to=YYYY-MM-DD[&assessorId=] */
export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const q = req.nextUrl.searchParams;
    const slots = await findSlots({ typeId: q.get("typeId") ?? "", fromDate: q.get("from") ?? "", toDate: q.get("to") ?? "", assessorId: q.get("assessorId") || undefined });
    return NextResponse.json({ slots });
  } catch (err) {
    return serviceErrorResponse(err, "Loading available times");
  }
}
