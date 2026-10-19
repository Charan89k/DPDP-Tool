/** POST /api/auth/verify-email — consumes an email verification token. */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyEmail } from "@/lib/auth/account";
import { accountErrorResponse, parseBody, requestMeta } from "@/lib/http/account_routes";

const schema = z.object({ token: z.string().min(20).max(200) });

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, schema);
  if ("response" in parsed) return parsed.response;
  try {
    await verifyEmail(parsed.data.token, requestMeta(req));
    return NextResponse.json({ success: true, message: "Email verified. You can now sign in." });
  } catch (err) {
    return accountErrorResponse(err, "Email verification");
  }
}
