import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  verifyPassword,
  hashPassword,
  SYNTHETIC_SEED_HASH,
  SYNTHETIC_SEED_PASSWORD,
} from "../lib/auth/passwords.ts";
import { getSafeRedirectUrl } from "../lib/auth/redirects.ts";
import {
  createSessionToken,
  verifySessionToken,
  getSigningKey,
  TOKEN_ISSUER,
  TOKEN_AUDIENCE,
  DEFAULT_DEV_SECRET,
} from "../lib/auth/session.ts";
import { loginRateLimiter } from "../lib/auth/rate_limit.ts";
import {
  ALL_ROLES,
  TLI_ROLES,
  CLIENT_ROLES,
  canUploadEvidence,
  canReviewAssessment,
  canFinalizeAssessment,
  canAccessAllTenants,
  isTliRole,
  isClientRole,
} from "../lib/auth/rbac.ts";
import type { SessionUser } from "../lib/auth/types.ts";
import { SignJWT } from "jose";

describe("Phase 3C: Authentication & Session Tests", () => {
  it("should verify valid bcrypt password hashes", async () => {
    const rawPass = "MyStrongPass123!@#";
    const hashed = await hashPassword(rawPass);

    const valid = await verifyPassword(rawPass, hashed);
    assert.equal(valid, true, "Bcrypt verification should succeed for valid password");

    const invalid = await verifyPassword("WrongPassword!", hashed);
    assert.equal(invalid, false, "Bcrypt verification should reject incorrect password");
  });

  it("should support synthetic development test fixtures safely in dev mode", async () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    try {
      const valid = await verifyPassword(SYNTHETIC_SEED_PASSWORD, SYNTHETIC_SEED_HASH);
      assert.equal(valid, true, "Should recognize synthetic seed password in development");

      const invalid = await verifyPassword("IncorrectPassword123!", SYNTHETIC_SEED_HASH);
      assert.equal(invalid, false, "Should reject incorrect password for synthetic seed");
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    }
  });

  it("should unconditionally reject synthetic development credentials in production mode", async () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    try {
      // 1. Synthetic hash with synthetic password must fail closed in production
      const attempt1 = await verifyPassword(SYNTHETIC_SEED_PASSWORD, SYNTHETIC_SEED_HASH);
      assert.equal(attempt1, false, "Production mode must reject synthetic test hash");

      // 2. Synthetic password with any password hash must fail closed in production
      const realHash = await hashPassword("RealProductionPassword123!");
      const attempt2 = await verifyPassword(SYNTHETIC_SEED_PASSWORD, realHash);
      assert.equal(attempt2, false, "Production mode must reject synthetic test password");
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    }
  });

  it("should fail closed on null, undefined, or empty password verification", async () => {
    assert.equal(await verifyPassword("", "someHash"), false);
    // @ts-expect-error testing invalid inputs
    assert.equal(await verifyPassword(null, "someHash"), false);
    // @ts-expect-error testing invalid inputs
    assert.equal(await verifyPassword("password", null), false);
  });

  it("should enforce mandatory strong signing secret in production mode", () => {
    const originalEnv = process.env.NODE_ENV;
    const originalSecret = process.env.SESSION_SECRET;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";

    try {
      // Missing secret fails closed
      delete process.env.SESSION_SECRET;
      assert.throws(() => getSigningKey(), /FATAL SECURITY CONFIGURATION ERROR/);

      // Default dev fallback secret fails closed
      process.env.SESSION_SECRET = DEFAULT_DEV_SECRET;
      assert.throws(() => getSigningKey(), /Insecure or insufficient SESSION_SECRET/);

      // Placeholder string fails closed
      process.env.SESSION_SECRET = "REPLACE_WITH_A_REAL_PRODUCTION_SECRET_KEY_HERE";
      assert.throws(() => getSigningKey(), /Insecure or insufficient SESSION_SECRET/);

      // Short secret (< 32 chars) fails closed
      process.env.SESSION_SECRET = "too_short_secret_key";
      assert.throws(() => getSigningKey(), /Insecure or insufficient SESSION_SECRET/);

      // Valid strong 32+ char secret succeeds
      process.env.SESSION_SECRET = "a_very_strong_production_secret_key_exceeding_32_characters!";
      const key = getSigningKey();
      assert.ok(key instanceof Uint8Array);
      assert.ok(key.length >= 32);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
      if (originalSecret !== undefined) {
        process.env.SESSION_SECRET = originalSecret;
      } else {
        delete process.env.SESSION_SECRET;
      }
    }
  });

  it("should issue and verify cryptographically signed JWT sessions with issuer and audience", async () => {
    const sampleUser: SessionUser = {
      userId: "018f3a5b-7c8d-7e90-8000-000000000101",
      email: "admin@truthlabs.in",
      fullName: "TLI Super Administrator",
      role: "TLI_SUPER_ADMIN",
      tenantId: "018f3a5b-7c8d-7e90-8000-000000000001",
      tenantName: "Truth Labs International",
      tenantSlug: "truth-labs-advisory",
      tenantType: "TLI",
      isSdf: false,
    };

    const token = await createSessionToken(sampleUser);
    assert.ok(token, "Session token should be non-empty string");

    const verified = await verifySessionToken(token);
    assert.ok(verified, "Verification should succeed for authentic token");
    assert.equal(verified?.userId, sampleUser.userId);
    assert.equal(verified?.email, sampleUser.email);
    assert.equal(verified?.role, sampleUser.role);
    assert.equal(verified?.tenantId, sampleUser.tenantId);
    assert.equal(verified?.isSdf, false);
  });

  it("should reject tampered, malformed, or wrongly scoped JWT tokens (fail closed)", async () => {
    const sampleUser: SessionUser = {
      userId: "018f3a5b-7c8d-7e90-8000-000000000102",
      email: "lead.consultant@truthlabs.in",
      fullName: "Ananya Sengupta",
      role: "TLI_LEAD_CONSULTANT",
      tenantId: "018f3a5b-7c8d-7e90-8000-000000000001",
      tenantName: "Truth Labs International",
      tenantSlug: "truth-labs-advisory",
      tenantType: "TLI",
      isSdf: false,
    };

    const token = await createSessionToken(sampleUser);

    // Tampered payload
    const tampered = token.slice(0, -6) + "xxxxxx";
    assert.equal(await verifySessionToken(tampered), null, "Tampered token signature must fail verification");

    // Empty or junk token
    assert.equal(await verifySessionToken(""), null);
    assert.equal(await verifySessionToken("malformed.jwt"), null);

    // Token signed with wrong issuer
    const key = getSigningKey();
    const wrongIssuerToken = await new SignJWT({
      sub: sampleUser.userId,
      email: sampleUser.email,
      role: sampleUser.role,
      tenantId: sampleUser.tenantId,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("unauthorized-issuer")
      .setAudience(TOKEN_AUDIENCE)
      .setExpirationTime("8h")
      .sign(key);

    assert.equal(
      await verifySessionToken(wrongIssuerToken),
      null,
      "Token with unexpected issuer must be rejected"
    );

    // Token signed with wrong audience
    const wrongAudienceToken = await new SignJWT({
      sub: sampleUser.userId,
      email: sampleUser.email,
      role: sampleUser.role,
      tenantId: sampleUser.tenantId,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(TOKEN_ISSUER)
      .setAudience("unauthorized-audience")
      .setExpirationTime("8h")
      .sign(key);

    assert.equal(
      await verifySessionToken(wrongAudienceToken),
      null,
      "Token with unexpected audience must be rejected"
    );
  });

  it("should prevent open redirect attacks including backslash and scheme bypasses", () => {
    // Valid relative paths
    assert.equal(getSafeRedirectUrl("/dashboard"), "/dashboard");
    assert.equal(getSafeRedirectUrl("/dashboard/assessments"), "/dashboard/assessments");

    // Malicious external / protocol-relative targets
    assert.equal(getSafeRedirectUrl("https://evil.com"), "/dashboard");
    assert.equal(getSafeRedirectUrl("http://attacker.com/steal"), "/dashboard");
    assert.equal(getSafeRedirectUrl("//evil.com"), "/dashboard");
    assert.equal(getSafeRedirectUrl("/\\evil.com"), "/dashboard");
    assert.equal(getSafeRedirectUrl("/dashboard\\evil.com"), "/dashboard");
    assert.equal(getSafeRedirectUrl("javascript:alert(1)"), "/dashboard");
    assert.equal(getSafeRedirectUrl("/javascript:alert(1)"), "/dashboard");
    assert.equal(getSafeRedirectUrl("/data:text/html,evil"), "/dashboard");
    assert.equal(getSafeRedirectUrl(null), "/dashboard");
    assert.equal(getSafeRedirectUrl(""), "/dashboard");
  });

  it("should enforce sliding window rate limiting on repeated failed login attempts", async () => {
    
    const testKey = `ip:192.168.1.${Date.now() % 250}`;

    // First 4 attempts should not be rate limited
    for (let i = 0; i < 4; i++) {
      await loginRateLimiter.recordFailedAttempt(testKey);
      assert.equal((await loginRateLimiter.isRateLimited(testKey)).limited, false);
    }

    // 5th failed attempt reaches the threshold
    await loginRateLimiter.recordFailedAttempt(testKey);
    const limitStatus = await loginRateLimiter.isRateLimited(testKey);
    assert.equal(limitStatus.limited, true, "5 failed attempts must trigger rate limiting");
    assert.ok(limitStatus.retryAfterSeconds > 0, "Must provide retry-after seconds");

    // Successful login resets the counter
    await loginRateLimiter.resetAttempts(testKey);
    assert.equal((await loginRateLimiter.isRateLimited(testKey)).limited, false);
  });

  it("should resolve client IP only from trusted proxy headers and reject spoofed headers", async () => {
    const { resolveClientIp } = await import("../lib/auth/rate_limit.ts");
    const selfHosted = {};

    // 1. Behind a reverse proxy the rightmost X-Forwarded-For entry (appended by the proxy) wins;
    //    client-injected CF-Connecting-IP / X-Real-IP / leftmost entries are ignored.
    const spoofed = new Request("https://app.example", {
      headers: {
        "cf-connecting-ip": "203.0.113.195",
        "x-real-ip": "198.51.100.22",
        "x-forwarded-for": "203.0.113.250, 198.51.100.99",
      },
    });
    assert.equal(resolveClientIp(spoofed, selfHosted), "198.51.100.99");

    // 2. Explicitly trusted headers are honoured
    assert.equal(resolveClientIp(spoofed, { TRUST_CLOUDFLARE_IP_HEADER: "true" }), "203.0.113.195");
    assert.equal(resolveClientIp(spoofed, { CLOUDE5_TRUST_X_REAL_IP: "true" }), "198.51.100.22");

    // 3. Reject spoofed non-IP strings / injection attempts in forwarding header
    const req4 = new Request("https://app.example", {
      headers: { "x-forwarded-for": "attacker-spoofed-host; drop table users;" },
    });
    assert.equal(resolveClientIp(req4, selfHosted), "127.0.0.1", "Must fall back to 127.0.0.1 on invalid IP syntax");

    // 4. Default fallback
    assert.equal(resolveClientIp(new Request("https://app.example"), selfHosted), "127.0.0.1");
  });

  it("should prevent rate limit bypass via email case or whitespace variation", async () => {
    
    const rawEmail = "Lead.Consultant@TruthLabs.in ";
    const normalizedKey = `email:${rawEmail.trim().toLowerCase()}`;

    // Record 5 failed attempts on normalized email
    for (let i = 0; i < 5; i++) {
      await loginRateLimiter.recordFailedAttempt(normalizedKey);
    }

    // Checking varying capitalizations / whitespaces normalized to same key
    const checkVariant1 = `email:${"LEAD.CONSULTANT@TRUTHLABS.IN".trim().toLowerCase()}`;
    const checkVariant2 = `email:${"  lead.consultant@truthlabs.in  ".trim().toLowerCase()}`;

    assert.equal((await loginRateLimiter.isRateLimited(checkVariant1)).limited, true);
    assert.equal((await loginRateLimiter.isRateLimited(checkVariant2)).limited, true);
  });
});

describe("Phase 3C: RBAC Matrix & Role Permissions", () => {
  it("should verify 7 defined application roles", () => {
    assert.equal(ALL_ROLES.length, 7);
    assert.equal(TLI_ROLES.length, 3);
    assert.equal(CLIENT_ROLES.length, 4);
    assert.equal(isTliRole("TLI_LEAD_CONSULTANT"), true);
    assert.equal(isClientRole("CLIENT_ADMIN"), true);
  });

  it("should enforce TLI consultant review permissions", () => {
    assert.equal(canReviewAssessment("TLI_SUPER_ADMIN"), true);
    assert.equal(canReviewAssessment("TLI_LEAD_CONSULTANT"), true);
    assert.equal(canReviewAssessment("TLI_REVIEWER"), true);
    assert.equal(canReviewAssessment("CLIENT_ADMIN"), false);
    assert.equal(canReviewAssessment("CLIENT_CONTRIBUTOR"), false);
  });

  it("should enforce finalization authority (DEC-01)", () => {
    assert.equal(canFinalizeAssessment("TLI_LEAD_CONSULTANT"), true);
    assert.equal(canFinalizeAssessment("TLI_SUPER_ADMIN"), true);
    assert.equal(canFinalizeAssessment("TLI_REVIEWER"), false);
    assert.equal(canFinalizeAssessment("CLIENT_ADMIN"), false);
  });

  it("should block CLIENT_VIEWER from uploading evidence", () => {
    assert.equal(canUploadEvidence("CLIENT_CONTRIBUTOR"), true);
    assert.equal(canUploadEvidence("CLIENT_ADMIN"), true);
    assert.equal(canUploadEvidence("CLIENT_VIEWER"), false);
  });

  it("should allow cross-tenant inspection only to TLI_SUPER_ADMIN", () => {
    assert.equal(canAccessAllTenants("TLI_SUPER_ADMIN"), true);
    assert.equal(canAccessAllTenants("TLI_LEAD_CONSULTANT"), false);
    assert.equal(canAccessAllTenants("CLIENT_ADMIN"), false);
  });
});
