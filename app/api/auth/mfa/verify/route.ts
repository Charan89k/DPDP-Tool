/** POST /api/auth/mfa/verify — second sign-in step: exchanges the challenge and a code for a session. */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { completeMfaChallenge, MFA_CHALLENGE_COOKIE } from "@/lib/auth/mfa";
import { loadSessionUser, startSession } from "@/lib/auth/signin";
import { resolveClientIp } from "@/lib/auth/rate_limit";
import { mfaErrorResponse } from "@/lib/http/mfa_routes";
import { parseBody } from "@/lib/http/account_routes";

const schema = z.object({ code: z.string().trim().min(6).max(20) });

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, schema);
  if ("response" in parsed) return parsed.response;
  try {
    const userId = await completeMfaChallenge(req.cookies.get(MFA_CHALLENGE_COOKIE)?.value, parsed.data.code);
    const sessionUser = await loadSessionUser(userId);
    if (!sessionUser) {
      return NextResponse.json({ error: "This account cannot sign in." }, { status: 403 });
    }
    await startSession(sessionUser, {
      ip: resolveClientIp(req),
      userAgent: req.headers.get("user-agent") || "CloudE5-App",
      method: "PASSWORD_AND_MFA",
    });
    const response = NextResponse.json({ success: true, user: sessionUser });
    response.cookies.set(MFA_CHALLENGE_COOKIE, "", { path: "/api/auth/mfa", maxAge: 0 });
    return response;
  } catch (err) {
    return mfaErrorResponse(err, "MFA verification");
  }
}
