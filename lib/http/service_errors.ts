/**
 * TLI — Maps service-layer errors of the consultation and remediation routes to HTTP responses.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sessionErrorResponse } from "./session_errors.ts";
import { resolveClientIp } from "../auth/rate_limit.ts";
import { ConsultationError } from "../consultations/service.ts";
import { RemediationRequestError } from "../remediation-requests/service.ts";
import { PaymentError } from "../payments/records.ts";
import { RemediationError } from "../remediation/service.ts";
import { ValidationError } from "../storage/validation.ts";

export function requestMeta(req: NextRequest) {
  return { ipAddress: resolveClientIp(req), userAgent: req.headers.get("user-agent")?.slice(0, 300) || null };
}

export function serviceErrorResponse(err: unknown, context: string): NextResponse {
  const sessionError = sessionErrorResponse(err);
  if (sessionError) return sessionError;
  if (err instanceof ConsultationError || err instanceof RemediationRequestError || err instanceof PaymentError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof RemediationError) return NextResponse.json({ error: err.message }, { status: err.statusCode });
  if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
  console.error(`${context}:`, err instanceof Error ? err.message : err);
  return NextResponse.json({ error: `${context} failed. Please try again.` }, { status: 500 });
}
