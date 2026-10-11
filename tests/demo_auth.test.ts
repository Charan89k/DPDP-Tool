import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../lib/db/pool.ts";
import {
  verifyPassword,
  SYNTHETIC_SEED_HASH,
  SYNTHETIC_SEED_PASSWORD,
  getDemoPassword,
} from "../lib/auth/passwords.ts";
import {
  canReviewAssessment,
  canFinalizeAssessment,
  canAccessAllTenants,
  canUploadEvidence,
} from "../lib/auth/rbac.ts";
import type { SessionUser } from "../lib/auth/types.ts";

describe("Phase 3D: Demo Authentication & Tenant Scoping Tests", () => {
  it("should configure and verify demo password via DEMO_USER_PASSWORD in non-production", async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalDemoPass = process.env.DEMO_USER_PASSWORD;
    process.env.NODE_ENV = "development";

    try {
      // Default dev password verification
      delete process.env.DEMO_USER_PASSWORD;
      assert.equal(getDemoPassword(), SYNTHETIC_SEED_PASSWORD);
      assert.equal(await verifyPassword(SYNTHETIC_SEED_PASSWORD, SYNTHETIC_SEED_HASH), true);

      // Custom configured demo password
      process.env.DEMO_USER_PASSWORD = "CustomLocalSecretPass2026!";
      assert.equal(getDemoPassword(), "CustomLocalSecretPass2026!");
      assert.equal(await verifyPassword("CustomLocalSecretPass2026!", SYNTHETIC_SEED_HASH), true);
      assert.equal(await verifyPassword("WrongPassword123!", SYNTHETIC_SEED_HASH), false);
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalDemoPass !== undefined) {
        process.env.DEMO_USER_PASSWORD = originalDemoPass;
      } else {
        delete process.env.DEMO_USER_PASSWORD;
      }
    }
  });

  it("should unconditionally reject DEMO_USER_PASSWORD in production mode", async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalDemoPass = process.env.DEMO_USER_PASSWORD;
    process.env.NODE_ENV = "production";
    process.env.DEMO_USER_PASSWORD = "CustomLocalSecretPass2026!";

    try {
      const valid = await verifyPassword("CustomLocalSecretPass2026!", SYNTHETIC_SEED_HASH);
      assert.equal(valid, false, "Production mode must reject any synthetic seed or demo password");
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalDemoPass !== undefined) {
        process.env.DEMO_USER_PASSWORD = originalDemoPass;
      } else {
        delete process.env.DEMO_USER_PASSWORD;
      }
    }
  });

  it("should verify seeded demo accounts in PostgreSQL database with correct roles and tenants", async () => {
    const res = await pool.query(`
      SELECT 
        u.email, u.role, u.password_hash, u.is_active,
        t.name AS tenant_name, t.slug AS tenant_slug, t.type AS tenant_type
      FROM users u
      JOIN tenants t ON t.id = u.tenant_id
      WHERE u.email IN ('consultant.demo@tli.local', 'customer.demo@tli.local')
      ORDER BY u.email;
    `);

    assert.equal(res.rows.length, 2, "Both demo accounts must exist in database");

    const consultant = res.rows.find((r) => r.email === "consultant.demo@tli.local");
    assert.ok(consultant);
    assert.equal(consultant.role, "TLI_LEAD_CONSULTANT");
    assert.equal(consultant.tenant_type, "TLI");
    assert.equal(consultant.is_active, true);
    assert.equal(consultant.password_hash, SYNTHETIC_SEED_HASH);

    const customer = res.rows.find((r) => r.email === "customer.demo@tli.local");
    assert.ok(customer);
    assert.equal(customer.role, "CLIENT_ADMIN");
    assert.equal(customer.tenant_slug, "alpha-healthcare");
    assert.equal(customer.is_active, true);
    assert.equal(customer.password_hash, SYNTHETIC_SEED_HASH);
  });

  it("should enforce role and permission boundaries for consultant vs customer demo personas", () => {
    const consultantUser: SessionUser = {
      userId: "demo-consultant-id",
      email: "consultant.demo@tli.local",
      fullName: "TLI Consultant Demo",
      role: "TLI_LEAD_CONSULTANT",
      tenantId: "tli-tenant-id",
      tenantName: "Truth Labs International",
      tenantSlug: "truth-labs",
      tenantType: "TLI",
      isSdf: false,
    };

    const customerUser: SessionUser = {
      userId: "demo-customer-id",
      email: "customer.demo@tli.local",
      fullName: "Alpha Health Demo Admin",
      role: "CLIENT_ADMIN",
      tenantId: "alpha-tenant-id",
      tenantName: "Alpha Healthcare Solutions Ltd",
      tenantSlug: "alpha-healthcare",
      tenantType: "CLIENT",
      isSdf: true,
    };

    // Consultant permissions
    assert.equal(canReviewAssessment(consultantUser.role), true, "Consultant must have review authority");
    assert.equal(canFinalizeAssessment(consultantUser.role), true, "Lead Consultant can finalize under DEC-01");
    assert.equal(canUploadEvidence(consultantUser.role), true);

    // Customer permissions
    assert.equal(canReviewAssessment(customerUser.role), false, "Customer must NOT have consultant review rights");
    assert.equal(canFinalizeAssessment(customerUser.role), false, "Customer must NOT finalize reports");
    assert.equal(canAccessAllTenants(customerUser.role), false, "Customer must NOT access other tenants");
    assert.equal(canUploadEvidence(customerUser.role), true, "Client Admin can upload evidence for their assessment");
  });
});

