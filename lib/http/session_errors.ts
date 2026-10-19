/**
 * Maps session re-verification failures (signed out, revoked, deactivated, role changed, organisation
 * requires two-factor) to proper responses instead of a generic server error.
 */

import { NextResponse } from "next/server";
import { DatabaseAuthorizationError, MfaSetupRequiredError } from "../db/rls.ts";

export function sessionErrorResponse(err: unknown): NextResponse | null {
  if (err instanceof MfaSetupRequiredError) {
    return NextResponse.json({ error: err.message, code: "MFA_SETUP_REQUIRED" }, { status: 403 });
  }
  if (err instanceof DatabaseAuthorizationError) {
    return NextResponse.json({ error: "Your session is no longer valid. Please sign in again." }, { status: 401 });
  }
  return null;
}
