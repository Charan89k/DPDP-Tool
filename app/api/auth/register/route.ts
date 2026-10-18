/**
 * POST /api/auth/register — self-service organisation registration.
 * Creates a CLIENT organisation with the caller as its first administrator and sends an email
 * verification link. The response is identical whether or not the email is already registered.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { registerOrganization } from "@/lib/auth/account";
import { registrationRateLimiter } from "@/lib/auth/rate_limit";
import { accountErrorResponse, limitAccountEmail, parseBody, requestMeta } from "@/lib/http/account_routes";

const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  email: z.string().trim().email("Enter a valid work email address.").max(254),
  password: z.string().min(1, "Choose a password.").max(200),
  organizationName: z.string().trim().min(2, "Enter your organisation's name.").max(160),
  industry: z.string().trim().max(120).optional().nullable(),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "Please confirm you have read the terms of use." }) }),
});

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, registerSchema);
  if ("response" in parsed) return parsed.response;
  const limited = await limitAccountEmail(req, parsed.data.email);
  if (limited) return limited;
  const globalLimit = await registrationRateLimiter.hit("global:registrations");
  if (globalLimit.limited) {
    return NextResponse.json(
      { error: "Registration is temporarily busy. Please try again later." },
      { status: 429, headers: { "Retry-After": String(globalLimit.retryAfterSeconds) } }
    );
  }

  try {
    const outcome = await registerOrganization(parsed.data, requestMeta(req));
    return NextResponse.json(
      {
        success: true,
        message: "Check your inbox for a link to verify your email address and activate your workspace.",
        emailDelivered: outcome.emailDelivery.sent,
      },
      { status: 202 }
    );
  } catch (err) {
    return accountErrorResponse(err, "Registration");
  }
}
