/**
 * TLI — Shared helpers for the payment API routes.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveClientIp } from "../auth/rate_limit.ts";
import { PaymentError } from "../payments/records.ts";
import type { RequestMeta } from "../payments/records.ts";
import { PaymentConfigurationError } from "../payments/razorpay.ts";
import { sessionErrorResponse } from "./session_errors.ts";

export function requestMeta(req: NextRequest): RequestMeta {
  return { ipAddress: resolveClientIp(req), userAgent: req.headers.get("user-agent")?.slice(0, 300) || null };
}

/** Maps payment errors to their status; anything unexpected is logged and reported generically. */
export function paymentErrorResponse(err: unknown, context: string): NextResponse {
  const sessionError = sessionErrorResponse(err);
  if (sessionError) return sessionError;
  if (err instanceof PaymentError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof PaymentConfigurationError) {
    console.error(`${context}: ${err.message}`);
    return NextResponse.json({ error: "Online payment is not available right now. Please contact TLI." }, { status: 503 });
  }
  console.error(`${context}:`, err instanceof Error ? err.message : err);
  return NextResponse.json({ error: `${context} failed. Please try again.` }, { status: 500 });
}
