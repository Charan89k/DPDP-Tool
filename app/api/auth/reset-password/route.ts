/** POST /api/auth/reset-password — sets a new password with a single-use reset token. */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resetPassword } from "@/lib/auth/account";
import { accountErrorResponse, parseBody, requestMeta } from "@/lib/http/account_routes";

const schema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(1, "Choose a new password.").max(200),
});

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, schema);
  if ("response" in parsed) return parsed.response;
  try {
    await resetPassword(parsed.data.token, parsed.data.password, requestMeta(req));
    return NextResponse.json({
      success: true,
      message: "Your password has been changed and all other sessions were signed out. You can now sign in.",
    });
  } catch (err) {
    return accountErrorResponse(err, "Password reset");
  }
}
