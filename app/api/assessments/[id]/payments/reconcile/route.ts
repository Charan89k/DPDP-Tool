import { NextRequest, NextResponse, after } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { reconcilePayments } from "@/lib/payments/service";
import { dispatchReportDeliveriesInBackground } from "@/lib/payments/delivery";
import { paymentErrorResponse } from "@/lib/http/payment_routes";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Re-checks this assessment's orders with Razorpay, e.g. after the browser closed mid-payment. */
export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const result = await reconcilePayments(session, id);
    after(() => Promise.all(result.settledPaymentIds.map(dispatchReportDeliveriesInBackground)));
    return NextResponse.json(result);
  } catch (err) {
    return paymentErrorResponse(err, "Checking the payment status");
  }
}
