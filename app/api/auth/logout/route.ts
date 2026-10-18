/**
 * CloudE5 — Logout Endpoint
 *
 * POST /api/auth/logout
 * Clears the authenticated session cookie.
 */

import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";

export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ success: true, message: "Logged out successfully." }, { status: 200 });
}

