import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { verifyCheckoutPayment } from "@/lib/payments/service";
import { dispatchReportDeliveriesInBackground } from "@/lib/payments/delivery";
import { paymentErrorResponse, requestMeta } from "@/lib/http/payment_routes";

export const dynamic = "force-dynamic";

const razorpayId = z.string().trim().min(10).max(64).regex(/^[A-Za-z0-9_]+$/);
const bodySchema = z.object({
  razorpay_order_id: razorpayId,
  razorpay_payment_id: razorpayId,
  razorpay_signature: z.string().trim().regex(/^[0-9a-f]{64}$/i),
});

/**
 * Razorpay Checkout success callback. The browser only relays ids; the server verifies the
 * signature and asks Razorpay for the payment before anything unlocks.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "The payment could not be verified." }, { status: 400 });

    const result = await verifyCheckoutPayment(
      session,
      {
        orderId: parsed.data.razorpay_order_id,
        paymentId: parsed.data.razorpay_payment_id,
        signature: parsed.data.razorpay_signature,
      },
      requestMeta(req)
    );
    if (result.newlyPaid) after(() => dispatchReportDeliveriesInBackground(result.paymentId));
    return NextResponse.json(result);
  } catch (err) {
    return paymentErrorResponse(err, "Verifying the payment");
  }
}
