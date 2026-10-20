/**
 * CloudE5 — Current Session Context
 *
 * GET /api/auth/me
 * Returns the signed-in user's profile after re-checking the session against the database, so
 * deactivated accounts and revoked sessions are reported as signed out.
 */

import { NextResponse } from "next/server";
import { clearSessionCookie, getCurrentSession } from "@/lib/auth/session";
import { DatabaseAuthorizationError, executeWithRls } from "@/lib/db/rls";
import { sessionErrorResponse } from "@/lib/http/session_errors";

export async function GET() {
  const sessionUser = await getCurrentSession();
  if (!sessionUser) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  try {
    await executeWithRls(sessionUser, async () => undefined);
  } catch (err) {
    if (err instanceof DatabaseAuthorizationError) {
      await clearSessionCookie();
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }
    // Signed in, but the organisation requires two-factor enrolment first (403 MFA_SETUP_REQUIRED).
    const sessionError = sessionErrorResponse(err);
    if (sessionError) return sessionError;
    console.error("Session check failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Unable to verify the session." }, { status: 500 });
  }

  return NextResponse.json({ authenticated: true, user: sessionUser }, { status: 200 });
}
