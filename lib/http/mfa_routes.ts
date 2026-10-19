/** Shared error handling for MFA endpoints. */

import { NextResponse } from "next/server";
import { MfaError } from "../auth/mfa.ts";
import { DatabaseAuthorizationError, MfaSetupRequiredError } from "../db/rls.ts";

export function mfaErrorResponse(err: unknown, context: string): NextResponse {
  if (err instanceof MfaError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
  }
  if (err instanceof MfaSetupRequiredError) {
    return NextResponse.json({ error: err.message, code: "MFA_SETUP_REQUIRED" }, { status: 403 });
  }
  if (err instanceof DatabaseAuthorizationError) {
    return NextResponse.json({ error: "Your session is no longer valid. Please sign in again." }, { status: 401 });
  }
  console.error(`${context} failed:`, err instanceof Error ? err.message : err);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
