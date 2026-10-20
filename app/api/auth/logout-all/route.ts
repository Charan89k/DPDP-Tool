/** POST /api/auth/logout-all — signs the current user out of every device. */

import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, getCurrentSession } from "@/lib/auth/session";
import { revokeAllSessions } from "@/lib/auth/account";
import { accountErrorResponse, requestMeta } from "@/lib/http/account_routes";
import { sessionErrorResponse } from "@/lib/http/session_errors";

export async function POST(req: NextRequest) {
  const sessionUser = await getCurrentSession(req);
  if (!sessionUser) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  try {
    await revokeAllSessions(sessionUser, requestMeta(req));
    await clearSessionCookie();
    return NextResponse.json({ success: true });
  } catch (err) {
    return sessionErrorResponse(err) ?? accountErrorResponse(err, "Sign out everywhere");
  }
}
