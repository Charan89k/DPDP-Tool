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
  SYNTHETIC_SEED_HASH,
} from "@/lib/auth/passwords";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { loginRateLimiter, resolveClientIp } from "@/lib/auth/rate_limit";
import { SessionUser, UserRole, TenantType } from "@/lib/auth/types";

const loginSchema = z.object({
  email: z.string().email("Please provide a valid corporate email address."),
  password: z.string().min(1, "Password is required."),
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

    // 1. Enforce login rate limiting (max 5 failed attempts per IP / email per 15 min)
    const ipRateLimit = loginRateLimiter.isRateLimited(`ip:${clientIp}`);
    const emailRateLimit = loginRateLimiter.isRateLimited(`email:${normalizedEmail}`);

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
        u.email_verified_at, u.session_version,
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
    const recordFailure = () => {
      loginRateLimiter.recordFailedAttempt(`ip:${clientIp}`);
      loginRateLimiter.recordFailedAttempt(`email:${normalizedEmail}`);
    };

    // 3. Verify the password before revealing anything about the account. Unknown emails still
    // pay the bcrypt cost so response timing does not disclose which accounts exist.
    if (!row) {
      await consumePasswordVerificationTime(password);
      recordFailure();
      return NextResponse.json({ error: AUTH_FAILED_MSG }, { status: 401 });
    }

    const isSyntheticAccountInProduction =
      process.env.NODE_ENV === "production" && row.password_hash === SYNTHETIC_SEED_HASH;
    const isValidPassword =
      !isSyntheticAccountInProduction && (await verifyPassword(password, row.password_hash));

    if (!isValidPassword) {
      recordFailure();
      return NextResponse.json({ error: AUTH_FAILED_MSG }, { status: 401 });
    }

    // Account status is only disclosed to callers who proved knowledge of the password
    if (!row.is_active || row.tenant_status !== "ACTIVE") {
      recordFailure();
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

    // Reset rate limiter counters on successful login
    loginRateLimiter.resetAttempts(`ip:${clientIp}`);
    loginRateLimiter.resetAttempts(`email:${normalizedEmail}`);

    // 4. Construct authenticated SessionUser
    const sessionUser: SessionUser = {
      userId: row.id,
      email: row.email,
      fullName: row.full_name,
      role: row.role as UserRole,
      tenantId: row.tenant_id,
      tenantName: row.tenant_name,
      tenantSlug: row.tenant_slug,
      tenantType: row.tenant_type as TenantType,
      isSdf: Boolean(row.is_sdf),
      sessionVersion: Number(row.session_version ?? 0),
    };

    // 5. Generate JWT session token
    const token = await createSessionToken(sessionUser);

    // 6. Update last_login_at timestamp
    try {
      await pool.query("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1;", [
        sessionUser.userId,
      ]);
    } catch (updateErr) {
      console.warn("Failed to update last_login_at timestamp:", updateErr);
    }

    // 7. Emit audit log entry
    try {
      const userAgent = request.headers.get("user-agent") || "CloudE5-App";
      await pool.query(
        `INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, ip_address, user_agent, new_state)
         VALUES ($1, $2, 'USER_LOGIN', 'users', $2, $3, $4, $5);`,
        [
          sessionUser.tenantId,
          sessionUser.userId,
          clientIp,
          userAgent,
          JSON.stringify({ role: sessionUser.role, email: sessionUser.email }),
        ]
      );
    } catch (auditErr) {
      console.warn("Audit logging warning on login:", auditErr);
    }

    // 8. Set HTTP-only session cookie
    await setSessionCookie(token);

    return NextResponse.json(
      {
        success: true,
        user: sessionUser,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Unhandled error during login processing:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred during login. Please try again." },
      { status: 500 }
    );
  }
}

