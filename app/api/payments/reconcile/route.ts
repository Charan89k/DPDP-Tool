import { NextResponse, after } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { isTliRole } from "@/lib/auth/rbac";
import { reconcilePayments } from "@/lib/payments/service";
import { dispatchReportDeliveriesInBackground } from "@/lib/payments/delivery";
import { paymentErrorResponse } from "@/lib/http/payment_routes";

export const dynamic = "force-dynamic";

/** Reconciles every order the TLI user can see against Razorpay (missed webhooks, refunds). */
export async function POST() {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isTliRole(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const result = await reconcilePayments(session);
    after(() => Promise.all(result.settledPaymentIds.map(dispatchReportDeliveriesInBackground)));
    return NextResponse.json(result);
  } catch (err) {
    return paymentErrorResponse(err, "Reconciling payments");
  }
}
