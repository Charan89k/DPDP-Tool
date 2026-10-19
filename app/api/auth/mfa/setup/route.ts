/** POST /api/auth/mfa/setup — starts authenticator enrolment for the signed-in user. */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { beginMfaEnrolment } from "@/lib/auth/mfa";
import { mfaErrorResponse } from "@/lib/http/mfa_routes";

export async function POST(req: NextRequest) {
  const sessionUser = await getCurrentSession(req);
  if (!sessionUser) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try {
    return NextResponse.json(await beginMfaEnrolment(sessionUser), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return mfaErrorResponse(err, "MFA setup");
  }
}
