import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { verifyPassword, hashPassword } from "../lib/auth/passwords.ts";
import { getSafeRedirectUrl } from "../lib/auth/redirects.ts";
import {
  createSessionToken,
  verifySessionToken,
} from "../lib/auth/session.ts";
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

describe("Phase 3C: Authentication & Session Tests", () => {
  it("should verify valid bcrypt password hashes", async () => {
    const rawPass = "MyStrongPass123!@#";
    const hashed = await hashPassword(rawPass);

    const valid = await verifyPassword(rawPass, hashed);
    assert.equal(valid, true, "Bcrypt verification should succeed for valid password");

    const invalid = await verifyPassword("WrongPassword!", hashed);
    assert.equal(invalid, false, "Bcrypt verification should reject incorrect password");
  });

  it("should support synthetic development test fixtures safely", async () => {
    const syntheticHash = "$2b$12$e80yvV3n2YfV3n2YfV3n2Oe2Z3iP1W5e2Z3iP1W5e2Z3iP1W5e2Z3";
    const valid = await verifyPassword("SyntheticTestPassword123!", syntheticHash);
    assert.equal(valid, true, "Should recognize synthetic seed password in development");

    const invalid = await verifyPassword("IncorrectPassword123!", syntheticHash);
    assert.equal(invalid, false, "Should reject incorrect password for synthetic seed");
  });

  it("should fail closed on null, undefined, or empty password verification", async () => {
    assert.equal(await verifyPassword("", "someHash"), false);
    // @ts-expect-error testing invalid inputs
    assert.equal(await verifyPassword(null, "someHash"), false);
    // @ts-expect-error testing invalid inputs
    assert.equal(await verifyPassword("password", null), false);
  });

  it("should issue and verify cryptographically signed JWT sessions", async () => {
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

  it("should reject tampered or malformed JWT tokens (fail closed)", async () => {
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
    // Tamper with payload
    const tampered = token.slice(0, -6) + "xxxxxx";

    const verified = await verifySessionToken(tampered);
    assert.equal(verified, null, "Tampered token signature must fail verification");

    assert.equal(await verifySessionToken(""), null);
    assert.equal(await verifySessionToken("malformed.jwt"), null);
  });

  it("should prevent open redirect attacks", () => {
    // Valid relative paths
    assert.equal(getSafeRedirectUrl("/dashboard"), "/dashboard");
    assert.equal(getSafeRedirectUrl("/dashboard/assessments"), "/dashboard/assessments");

    // Malicious external / protocol-relative targets
    assert.equal(getSafeRedirectUrl("https://evil.com"), "/dashboard");
    assert.equal(getSafeRedirectUrl("http://attacker.com/steal"), "/dashboard");
    assert.equal(getSafeRedirectUrl("//evil.com"), "/dashboard");
    assert.equal(getSafeRedirectUrl("/\\evil.com"), "/dashboard");
    assert.equal(getSafeRedirectUrl("javascript:alert(1)"), "/dashboard");
    assert.equal(getSafeRedirectUrl(null), "/dashboard");
    assert.equal(getSafeRedirectUrl(""), "/dashboard");
  });
});

describe("Phase 3C: RBAC Matrix & Role Permissions", () => {
  it("should verify 7 defined application roles", () => {
    assert.equal(ALL_ROLES.length, 7);
    assert.equal(TLI_ROLES.length, 3);
    assert.equal(CLIENT_ROLES.length, 4);
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
