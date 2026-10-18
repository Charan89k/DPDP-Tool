/** POST /api/auth/mfa/disable — turns off two-factor after re-checking password and a code. */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { disableMfa } from "@/lib/auth/mfa";
import { mfaErrorResponse } from "@/lib/http/mfa_routes";
import { loadSessionUser } from "@/lib/auth/signin";
import { createSessionToken, getCurrentSession, setSessionCookie } from "@/lib/auth/session";
import { parseBody } from "@/lib/http/account_routes";

const schema = z.object({
  password: z.string().min(1).max(200),
  code: z.string().trim().min(6).max(20),
});

export async function POST(req: NextRequest) {
  const sessionUser = await getCurrentSession(req);
  if (!sessionUser) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const parsed = await parseBody(req, schema);
  if ("response" in parsed) return parsed.response;
  try {
    await disableMfa(sessionUser, parsed.data.password, parsed.data.code);
    const fresh = await loadSessionUser(sessionUser.userId);
    if (fresh) await setSessionCookie(await createSessionToken(fresh));
    return NextResponse.json({ success: true });
  } catch (err) {
    return mfaErrorResponse(err, "MFA disable");
  }
}
