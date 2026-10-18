/**
 * CloudE5 — Current Session Context
 *
 * GET /api/auth/me
 * Returns the currently authenticated user's session profile.
 */

import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";

export async function GET() {
  const sessionUser = await getCurrentSession();

  if (!sessionUser) {
    return NextResponse.json(
      { authenticated: false, user: null },
      { status: 401 }
    );
  }

  return NextResponse.json(
    {
      authenticated: true,
      user: sessionUser,
    },
    { status: 200 }
  );
}

