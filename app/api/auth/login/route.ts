/**
 * CloudE5 — Authentication Login Endpoint
 *
 * POST /api/auth/login
 * Validates user credentials, issues cryptographically signed session tokens,
 * sets HTTP-only session cookies, and emits audit records.
 * Prevents account enumeration through uniform error messages.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool } from "@/lib/db/pool";
import {
  consumePasswordVerificationTime,
  verifyPassword,
} from "@/lib/auth/passwords";
import { loadSessionUser, startSession } from "@/lib/auth/signin";
import { createMfaChallenge, MFA_CHALLENGE_COOKIE, MFA_CHALLENGE_MAX_AGE_SECONDS } from "@/lib/auth/mfa";
import { loginRateLimiter, resolveClientIp } from "@/lib/auth/rate_limit";

const loginSchema = z.object({
  email: z.string().email("Please provide a valid corporate email address.").max(254),
  password: z.string().min(1, "Password is required.").max(200),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parseResult = loginSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { email, password } = parseResult.data;
    const normalizedEmail = email.trim().toLowerCase();
    const clientIp = resolveClientIp(request);

    // 1. Count this attempt atomically before checking the password (max 5 per IP / email per
    //    15 min). A successful sign-in resets the email counter
    //    and takes its own attempt back off the IP counter.
    const ipRateLimit = await loginRateLimiter.hit(`ip:${clientIp}`);
    const emailRateLimit = await loginRateLimiter.hit(`email:${normalizedEmail}`);

    if (ipRateLimit.limited || emailRateLimit.limited) {
      const retryAfter = Math.max(ipRateLimit.retryAfterSeconds, emailRateLimit.retryAfterSeconds);
      return NextResponse.json(
        { error: "Too many failed login attempts. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
          },
        }
      );
    }

    // 2. Fetch user by email
    const query = `
      SELECT 
        u.id, u.tenant_id, u.email, u.password_hash, u.full_name, u.role, u.is_active,
        u.email_verified_at, u.session_version, u.mfa_enabled,
        t.name AS tenant_name, t.slug AS tenant_slug, t.type AS tenant_type, t.is_sdf, t.status AS tenant_status
      FROM users u
      JOIN tenants t ON t.id = u.tenant_id
      WHERE LOWER(u.email) = $1
      LIMIT 1;
    `;
    const result = await pool.query(query, [normalizedEmail]);
    const row = result.rows[0];

    // Uniform failure message to prevent account enumeration
    const AUTH_FAILED_MSG = "Invalid email or password.";

    // 3. Verify the password before revealing anything about the account. Unknown emails still
    // pay the bcrypt cost so response timing does not disclose which accounts exist.
    if (!row) {
      await consumePasswordVerificationTime(password);
      return NextResponse.json({ error: AUTH_FAILED_MSG }, { status: 401 });
    }

    const isValidPassword = await verifyPassword(password, row.password_hash);

    if (!isValidPassword) {
      return NextResponse.json({ error: AUTH_FAILED_MSG }, { status: 401 });
    }

    // Account status is only disclosed to callers who proved knowledge of the password
    if (!row.is_active || row.tenant_status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Account or organization is inactive. Please contact your administrator." },
        { status: 403 }
      );
    }

    if (!row.email_verified_at) {
      return NextResponse.json(
        {
          error: "Please verify your email address before signing in. Check your inbox for the verification link.",
          code: "EMAIL_NOT_VERIFIED",
        },
        { status: 403 }
      );
    }

    // A correct password clears this account's counter. The per-IP counter also holds failures
    // against other accounts, so only this attempt is taken back off it; earlier failures stay counted.
    await loginRateLimiter.refundAttempt(`ip:${clientIp}`);
    await loginRateLimiter.resetAttempts(`email:${normalizedEmail}`);

    const userAgent = request.headers.get("user-agent") || "CloudE5-App";

    // 4. Accounts with two-factor authentication get a short-lived challenge, not a session.
    if (row.mfa_enabled) {
      const challenge = await createMfaChallenge(row.id, Number(row.session_version ?? 0));
      const response = NextResponse.json({ success: true, mfaRequired: true }, { status: 200 });
      response.cookies.set(MFA_CHALLENGE_COOKIE, challenge, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/api/auth/mfa",
        maxAge: MFA_CHALLENGE_MAX_AGE_SECONDS,
      });
      return response;
    }

    // 5. Issue the session
    // The session must carry the credential state that was just verified: if a password reset or
    // sign-out-everywhere happened in between, the version moved on and this login is refused.
    const sessionUser = await loadSessionUser(row.id);
    if (!sessionUser || sessionUser.sessionVersion !== Number(row.session_version ?? 0)) {
      return NextResponse.json({ error: AUTH_FAILED_MSG }, { status: 401 });
    }
    await startSession(sessionUser, { ip: clientIp, userAgent, method: "PASSWORD" });
    return NextResponse.json({ success: true, user: sessionUser }, { status: 200 });
  } catch (err) {
    console.error("Unhandled error during login processing:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred during login. Please try again." },
      { status: 500 }
    );
  }
}

