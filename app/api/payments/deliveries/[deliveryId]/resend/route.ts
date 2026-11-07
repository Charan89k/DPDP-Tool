import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { resendReportDelivery } from "@/lib/payments/delivery";
import { paymentErrorResponse, requestMeta } from "@/lib/http/payment_routes";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ deliveryId: string }>;
}

/** Manual resend of a paid report email by a TLI lead consultant or administrator. */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { deliveryId } = await params;
    // Optional body {"confirmAlreadySent": true}: required to send an already-sent email again.
    const body: unknown = await req.json().catch(() => null);
    const confirmAlreadySent = Boolean(body && typeof body === "object" && (body as { confirmAlreadySent?: unknown }).confirmAlreadySent === true);
    return NextResponse.json(await resendReportDelivery(session, deliveryId, requestMeta(req), { confirmAlreadySent }));
  } catch (err) {
    return paymentErrorResponse(err, "Resending the report");
  }
}
