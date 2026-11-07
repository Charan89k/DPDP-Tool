import { NextRequest, NextResponse, after } from "next/server";
import { processRazorpayWebhook } from "@/lib/payments/service";
import { dispatchReportDeliveriesInBackground } from "@/lib/payments/delivery";
import { PaymentConfigurationError } from "@/lib/payments/razorpay";

export const dynamic = "force-dynamic";

/** Razorpay webhooks are small JSON documents; anything larger is refused before hashing. */
const MAX_WEBHOOK_BYTES = 256 * 1024;

/**
 * Razorpay webhook endpoint (server to server, no session). Exempt from the browser CSRF origin
 * check in proxy.ts; authenticated instead by the X-Razorpay-Signature HMAC over the raw body.
 */
export async function POST(req: NextRequest) {
  try {
    if (Number(req.headers.get("content-length") || 0) > MAX_WEBHOOK_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    const rawBody = await req.text();
    if (Buffer.byteLength(rawBody) > MAX_WEBHOOK_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    const result = await processRazorpayWebhook(
      rawBody,
      req.headers.get("x-razorpay-signature"),
      req.headers.get("x-razorpay-event-id")
    );
    if (result.httpStatus !== 200) console.warn(`Razorpay webhook rejected: ${result.outcome}`);
    const paidId = result.newlyPaidPaymentId;
    if (paidId) after(() => dispatchReportDeliveriesInBackground(paidId));
    return NextResponse.json({ outcome: result.outcome }, { status: result.httpStatus });
  } catch (err) {
    if (err instanceof PaymentConfigurationError) {
      return NextResponse.json({ error: "Payments are not configured" }, { status: 503 });
    }
    // A 5xx makes Razorpay redeliver the event later; processing is idempotent.
    console.error("Razorpay webhook processing failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
