/** POST /api/auth/forgot-password — sends a password reset link (same response for any email). */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requestPasswordReset } from "@/lib/auth/account";
import { accountErrorResponse, limitAccountEmail, parseBody, requestMeta } from "@/lib/http/account_routes";

const schema = z.object({ email: z.string().trim().email("Enter a valid email address.").max(254) });

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, schema);
  if ("response" in parsed) return parsed.response;
  const limited = await limitAccountEmail(req, parsed.data.email);
  if (limited) return limited;
  try {
    await requestPasswordReset(parsed.data.email, requestMeta(req));
    return NextResponse.json({
      success: true,
      message: "If an account exists for that address, a password reset link is on its way.",
    });
  } catch (err) {
    return accountErrorResponse(err, "Password reset request");
  }
}
