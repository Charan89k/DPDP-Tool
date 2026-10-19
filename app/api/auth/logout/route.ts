/**
 * CloudE5 — Logout Endpoint
 *
 * POST /api/auth/logout
 * Revokes the current session (so a copied cookie cannot be replayed) and clears the cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, getCurrentSession } from "@/lib/auth/session";
import { revokeSession } from "@/lib/auth/account";

export async function POST(req: NextRequest) {
  const sessionUser = await getCurrentSession(req);
  if (sessionUser) {
    try {
      await revokeSession(sessionUser);
    } catch (err) {
      console.error("Session revocation on logout failed:", err instanceof Error ? err.message : err);
    }
  }
  await clearSessionCookie();
  return NextResponse.json({ success: true, message: "Logged out successfully." }, { status: 200 });
}
