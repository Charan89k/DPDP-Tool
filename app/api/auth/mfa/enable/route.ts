/** POST /api/auth/mfa/enable — confirms enrolment with a code; returns one-time recovery codes. */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { confirmMfaEnrolment } from "@/lib/auth/mfa";
import { mfaErrorResponse } from "@/lib/http/mfa_routes";
import { loadSessionUser } from "@/lib/auth/signin";
import { createSessionToken, getCurrentSession, setSessionCookie } from "@/lib/auth/session";
import { parseBody } from "@/lib/http/account_routes";

const schema = z.object({ code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from your app.") });

export async function POST(req: NextRequest) {
  const sessionUser = await getCurrentSession(req);
  if (!sessionUser) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const parsed = await parseBody(req, schema);
  if ("response" in parsed) return parsed.response;
  try {
    const result = await confirmMfaEnrolment(sessionUser, parsed.data.code);
    await reissueCurrentSession(sessionUser.userId);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return mfaErrorResponse(err, "MFA enable");
  }
}

/** Other sessions were revoked; keep this browser signed in with the new session version. */
async function reissueCurrentSession(userId: string) {
  const fresh = await loadSessionUser(userId);
  if (fresh) await setSessionCookie(await createSessionToken(fresh));
}
