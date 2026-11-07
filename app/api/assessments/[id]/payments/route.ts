import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { createReportOrder } from "@/lib/payments/service";
import { getReportAccessView } from "@/lib/payments/queries";
import { paymentErrorResponse, requestMeta } from "@/lib/http/payment_routes";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Report readiness, price, payment history and email delivery status for the assessment. */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    return NextResponse.json(await getReportAccessView(session, id));
  } catch (err) {
    return paymentErrorResponse(err, "Loading payment status");
  }
}

/** Creates (or reuses) the Razorpay order for the issued report. Amount comes from the server. */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    return NextResponse.json(await createReportOrder(session, id, requestMeta(req)));
  } catch (err) {
    return paymentErrorResponse(err, "Starting the payment");
  }
}
