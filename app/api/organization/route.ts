/**
 * GET   /api/organization — the signed-in user's organisation profile.
 * PATCH /api/organization — update the profile (organisation administrators only).
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { DatabaseAuthorizationError } from "@/lib/db/rls";
import {
  getOrganizationProfile,
  OrganizationError,
  organizationProfileSchema,
  updateOrganizationProfile,
} from "@/lib/organization/profile";
import { parseBody } from "@/lib/http/account_routes";

function errorResponse(err: unknown) {
  if (err instanceof OrganizationError) {
    return NextResponse.json({ error: err.message }, { status: err.statusCode });
  }
  if (err instanceof DatabaseAuthorizationError) {
    return NextResponse.json({ error: "Your session is no longer valid. Please sign in again." }, { status: 401 });
  }
  console.error("Organisation profile request failed:", err instanceof Error ? err.message : err);
  return NextResponse.json({ error: "Unable to process the organisation profile." }, { status: 500 });
}

export async function GET(req: NextRequest) {
  const sessionUser = await getCurrentSession(req);
  if (!sessionUser) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try {
    return NextResponse.json({ organization: await getOrganizationProfile(sessionUser) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: NextRequest) {
  const sessionUser = await getCurrentSession(req);
  if (!sessionUser) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const parsed = await parseBody(req, organizationProfileSchema);
  if ("response" in parsed) return parsed.response;
  try {
    return NextResponse.json({ organization: await updateOrganizationProfile(sessionUser, parsed.data) });
  } catch (err) {
    return errorResponse(err);
  }
}
