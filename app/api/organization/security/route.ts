/** POST /api/organization/security — organisation administrators require (or stop requiring) two-factor. */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { setOrganizationMfaRequirement } from "@/lib/auth/mfa";
import { getCurrentSession } from "@/lib/auth/session";
import { parseBody } from "@/lib/http/account_routes";
import { mfaErrorResponse } from "@/lib/http/mfa_routes";

const schema = z.object({ requireMfa: z.boolean() });

export async function POST(req: NextRequest) {
  const sessionUser = await getCurrentSession(req);
  if (!sessionUser) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const parsed = await parseBody(req, schema);
  if ("response" in parsed) return parsed.response;
  try {
    await setOrganizationMfaRequirement(sessionUser, parsed.data.requireMfa);
    return NextResponse.json({ requireMfa: parsed.data.requireMfa });
  } catch (err) {
    return mfaErrorResponse(err, "Organisation two-factor requirement");
  }
}
