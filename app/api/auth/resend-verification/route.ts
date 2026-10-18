/** POST /api/auth/resend-verification — re-sends the verification email (same response for any email). */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resendVerification } from "@/lib/auth/account";
import { accountErrorResponse, limitAccountEmail, parseBody } from "@/lib/http/account_routes";

const schema = z.object({ email: z.string().trim().email("Enter a valid email address.").max(254) });

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, schema);
  if ("response" in parsed) return parsed.response;
  const limited = limitAccountEmail(req, parsed.data.email);
  if (limited) return limited;
  try {
    await resendVerification(parsed.data.email);
    return NextResponse.json({
      success: true,
      message: "If that address belongs to an unverified account, a new verification link is on its way.",
    });
  } catch (err) {
    return accountErrorResponse(err, "Verification resend");
  }
}
