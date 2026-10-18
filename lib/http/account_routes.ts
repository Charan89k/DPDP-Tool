/**
 * Shared request handling for public account endpoints (registration, verification, reset).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { z } from "zod";
import { AccountError } from "../auth/account.ts";
import type { RequestMeta } from "../auth/account.ts";
import { accountEmailRateLimiter, resolveClientIp } from "../auth/rate_limit.ts";

export function requestMeta(req: NextRequest): RequestMeta {
  return { ip: resolveClientIp(req), userAgent: req.headers.get("user-agent") || undefined };
}

/** Parses and validates a JSON body; returns a 400 response on failure. */
export async function parseBody<T>(
  req: NextRequest,
  schema: z.ZodType<T>
): Promise<{ data: T } | { response: NextResponse }> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { response: NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }) };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      response: NextResponse.json(
        { error: "Please correct the highlighted fields.", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      ),
    };
  }
  return { data: parsed.data };
}

/**
 * Applies per-IP and per-email limits to endpoints that send email. Every call counts as an
 * attempt, so the limit caps email volume regardless of outcome.
 */
export function limitAccountEmail(req: NextRequest, email: string): NextResponse | null {
  const keys = [`ip:${resolveClientIp(req)}`, `email:${email.trim().toLowerCase()}`];
  for (const key of keys) {
    const status = accountEmailRateLimiter.isRateLimited(key);
    if (status.limited) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a few minutes and try again." },
        { status: 429, headers: { "Retry-After": String(status.retryAfterSeconds) } }
      );
    }
  }
  keys.forEach((key) => accountEmailRateLimiter.recordFailedAttempt(key));
  return null;
}

export function accountErrorResponse(err: unknown, context: string): NextResponse {
  if (err instanceof AccountError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
  }
  console.error(`${context} failed:`, err instanceof Error ? err.message : err);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
