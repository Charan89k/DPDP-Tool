/**
 * TLI DPDP Compliance Gap Analysis Tool — Session Management Module
 *
 * Implements cryptographically signed, stateless session cookies using 'jose'.
 * Generates HMAC-SHA256 tokens with strict expiry and security attributes.
 *
 * Security:
 * - HttpOnly: true (prevents client-side XSS token theft)
 * - SameSite: 'lax' (mitigates CSRF)
 * - Secure: true in production
 * - Path: '/'
 * - Expiry: 8 hours (28,800 seconds)
 */

import { SignJWT, jwtVerify } from "jose";
import type { SessionUser, UserRole, TenantType } from "./types.ts";

export const SESSION_COOKIE_NAME = "tli_dpdp_session";
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60; // 8 hours

// Resolve secret key
function getSigningKey(): Uint8Array {
  const secret =
    process.env.SESSION_SECRET ||
    "tli_dpdp_local_development_secret_key_must_be_overridden_in_prod_32b";
  return new TextEncoder().encode(secret);
}

/**
 * Creates a signed JWT token encapsulating the authenticated SessionUser.
 */
export async function createSessionToken(user: SessionUser): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + SESSION_MAX_AGE_SECONDS;

  return new SignJWT({
    sub: user.userId,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    tenantId: user.tenantId,
    tenantName: user.tenantName,
    tenantSlug: user.tenantSlug,
    tenantType: user.tenantType,
    isSdf: user.isSdf,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(getSigningKey());
}

/**
 * Cryptographically verifies a JWT session token and returns the SessionUser.
 * Fails closed (returns null) on invalid signature, expiration, or missing claims.
 */
export async function verifySessionToken(
  token: string | undefined | null
): Promise<SessionUser | null> {
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getSigningKey(), {
      algorithms: ["HS256"],
    });

    if (
      !payload.sub ||
      !payload.email ||
      !payload.role ||
      !payload.tenantId
    ) {
      return null;
    }

    return {
      userId: payload.sub as string,
      email: payload.email as string,
      fullName: (payload.fullName as string) || "User",
      role: payload.role as UserRole,
      tenantId: payload.tenantId as string,
      tenantName: (payload.tenantName as string) || "Organization",
      tenantSlug: (payload.tenantSlug as string) || "org",
      tenantType: (payload.tenantType as TenantType) || "CLIENT",
      isSdf: Boolean(payload.isSdf),
    };
  } catch {
    // Fails closed on signature mismatch, expired token, or malformed bytes
    return null;
  }
}

/**
 * Resolves the currently authenticated user from incoming request cookies.
 * For use inside Next.js Server Components, Server Actions, and Route Handlers.
 */
export async function getCurrentSession(): Promise<SessionUser | null> {
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
    if (!sessionCookie?.value) {
      return null;
    }
    return await verifySessionToken(sessionCookie.value);
  } catch {
    return null;
  }
}

/**
 * Sets the secure HTTP-only session cookie in the current response context.
 */
export async function setSessionCookie(token: string): Promise<void> {
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
  } catch (err) {
    console.error("Failed to set session cookie in headers context:", err);
  }
}

/**
 * Clears the session cookie on user logout.
 */
export async function clearSessionCookie(): Promise<void> {
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  } catch (err) {
    console.error("Failed to clear session cookie in headers context:", err);
  }
}
