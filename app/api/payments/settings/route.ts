import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { PriceValidationError, setReportPricePaise } from "@/lib/payments/settings";
import { paymentErrorResponse } from "@/lib/http/payment_routes";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ amountRupees: z.number().finite().positive() });

/** Sets the price of the final report (super administrator only; checked against the database). */
export async function PUT(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.role !== "TLI_SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Enter the price in rupees." }, { status: 400 });
    const amountPaise = Math.round(parsed.data.amountRupees * 100);
    await setReportPricePaise(session, amountPaise);
    return NextResponse.json({ ok: true, amountPaise });
  } catch (err) {
    if (err instanceof PriceValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
    return paymentErrorResponse(err, "Saving the report price");
  }
}
