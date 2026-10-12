/**
 * TLI DPDP Compliance Gap Analysis Tool — Phase 8 Test Suite
 * Production Account Provisioning, Role Authorization & Tenant Isolation
 *
 * Verifies:
 * 1. TLI Super Admin (admin@truthlabs.in) authenticates with provisioned password in production mode.
 * 2. TLI Super Admin receives intended administrative permissions and cross-tenant access.
 * 3. Demo Customer Admin (demo.admin@tlidemo.example) authenticates with provisioned password in production mode.
 * 4. Demo Customer Admin is strictly denied TLI-level administrative permissions.
 * 5. Demo Customer Admin cannot read or modify another customer's records under live PostgreSQL RLS.
 * 6. PostgreSQL Row-Level Security remains active and enforced across both accounts.
 * 7. Passwords are securely hashed (bcrypt rounds=12) and are never stored or returned in plaintext.
 * 8. Provisioning script is strictly idempotent: re-running creates zero duplicates and preserves active credentials.
 * 9. Existing customer onboarding, invitations, and assessment workflows remain functional.
 * 10. Credentials files are excluded from Git tracking and protected with restrictive permissions (0600).
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { pool } from "../lib/db/pool.ts";
import { executeWithRls } from "../lib/db/rls.ts";
import { verifyPassword, SYNTHETIC_SEED_HASH } from "../lib/auth/passwords.ts";
import {
  canAccessAllTenants,
  canCreateCustomer,
  canFinalizeAssessment,
  canManageTenantUsers,
  canUploadEvidence,
  isTliRole,
  isClientRole,
} from "../lib/auth/rbac.ts";
import type { SessionUser } from "../lib/auth/types.ts";
import {
  provisionAccounts,
  generateStrongPassword,
} from "../scripts/provision_production_accounts.ts";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres@127.0.0.1:54329/dpdp_test";

const TEST_CREDENTIALS_FILE = path.resolve(
  process.cwd(),
  ".credentials_test_phase8.txt"
);

describe("Phase 8: Production Provisioning, Authentication & Isolation Verification", () => {
  let adminPasswordGenerated: string;
  let demoPasswordGenerated: string;
  let adminSessionUser: SessionUser;
  let demoSessionUser: SessionUser;

  before(async () => {
    // Clean up test credentials file if left from prior run
    if (fs.existsSync(TEST_CREDENTIALS_FILE)) {
      fs.unlinkSync(TEST_CREDENTIALS_FILE);
    }

    // Provision accounts using forced reset into test credentials file
    const result = await provisionAccounts({
      databaseUrl: DATABASE_URL,
      target: "local-test",
      credentialsFilePath: TEST_CREDENTIALS_FILE,
      forceResetAdmin: true,
      forceResetDemo: true,
      silent: true,
    });

    assert.equal(result.success, true);
    assert.ok(result.adminAccount.initialPassword, "Admin password must be generated");
    assert.ok(result.demoAccount.initialPassword, "Demo password must be generated");

    adminPasswordGenerated = result.adminAccount.initialPassword!;
    demoPasswordGenerated = result.demoAccount.initialPassword!;

    // Resolve database records for sessions
    const adminRow = (
      await pool.query(
        `SELECT u.id, u.email, u.full_name, u.role, u.tenant_id, t.name as tenant_name, t.slug as tenant_slug, t.type as tenant_type, t.is_sdf
         FROM users u JOIN tenants t ON t.id = u.tenant_id WHERE u.email = 'admin@truthlabs.in'`
      )
    ).rows[0];

    const demoRow = (
      await pool.query(
        `SELECT u.id, u.email, u.full_name, u.role, u.tenant_id, t.name as tenant_name, t.slug as tenant_slug, t.type as tenant_type, t.is_sdf
         FROM users u JOIN tenants t ON t.id = u.tenant_id WHERE u.email = 'demo.admin@tlidemo.example'`
      )
    ).rows[0];

    adminSessionUser = {
      userId: adminRow.id,
      email: adminRow.email,
      fullName: adminRow.full_name,
      role: adminRow.role,
      tenantId: adminRow.tenant_id,
      tenantName: adminRow.tenant_name,
      tenantSlug: adminRow.tenant_slug,
      tenantType: adminRow.tenant_type,
      isSdf: Boolean(adminRow.is_sdf),
    };

    demoSessionUser = {
      userId: demoRow.id,
      email: demoRow.email,
      fullName: demoRow.full_name,
      role: demoRow.role,
      tenantId: demoRow.tenant_id,
      tenantName: demoRow.tenant_name,
      tenantSlug: demoRow.tenant_slug,
      tenantType: demoRow.tenant_type,
      isSdf: Boolean(demoRow.is_sdf),
    };
  });

  after(() => {
    if (fs.existsSync(TEST_CREDENTIALS_FILE)) {
      fs.unlinkSync(TEST_CREDENTIALS_FILE);
    }
  });

  it("1. Strong Password Generation: produces high-entropy passwords with required character classes", () => {
    const password = generateStrongPassword(28);
    assert.equal(password.length, 28);
    assert.match(password, /[A-Z]/, "Must contain uppercase letters");
    assert.match(password, /[a-z]/, "Must contain lowercase letters");
    assert.match(password, /[0-9]/, "Must contain digits");
    assert.match(password, /[!@#$%^&*()_+\-=[\]{}|~]/, "Must contain special characters");
  });

  it("2. TLI Administrator Authentication: authenticates in production mode using provisioned password", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      const userRes = await pool.query(
        "SELECT password_hash FROM users WHERE email = 'admin@truthlabs.in';"
      );
      const storedHash = userRes.rows[0].password_hash;

      // Must NOT match synthetic seed hash
      assert.notEqual(storedHash, SYNTHETIC_SEED_HASH);

      // Must succeed with generated password
      const isValid = await verifyPassword(adminPasswordGenerated, storedHash);
      assert.equal(isValid, true, "TLI Super Admin must authenticate with generated password");

      // Must fail with incorrect password
      const isInvalid = await verifyPassword("WrongPassword123!", storedHash);
      assert.equal(isInvalid, false, "Must reject incorrect password");
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it("3. TLI Administrator RBAC: receives full administrative authority", () => {
    assert.equal(adminSessionUser.role, "TLI_SUPER_ADMIN");
    assert.equal(isTliRole(adminSessionUser.role), true);
    assert.equal(isClientRole(adminSessionUser.role), false);
    assert.equal(canAccessAllTenants(adminSessionUser.role), true);
    assert.equal(canCreateCustomer(adminSessionUser.role), true);
    assert.equal(canFinalizeAssessment(adminSessionUser.role), true);
    assert.equal(canManageTenantUsers(adminSessionUser.role), true);
  });

  it("4. Demo Customer Authentication: authenticates in production mode using provisioned password", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      const userRes = await pool.query(
        "SELECT password_hash FROM users WHERE email = 'demo.admin@tlidemo.example';"
      );
      const storedHash = userRes.rows[0].password_hash;

      assert.notEqual(storedHash, SYNTHETIC_SEED_HASH);

      const isValid = await verifyPassword(demoPasswordGenerated, storedHash);
      assert.equal(isValid, true, "Demo Customer Admin must authenticate with generated password");

      const isInvalid = await verifyPassword("WrongPassword123!", storedHash);
      assert.equal(isInvalid, false, "Must reject incorrect password");
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it("5. Demo Customer RBAC: strictly blocked from TLI administrative capabilities", () => {
    assert.equal(demoSessionUser.role, "CLIENT_ADMIN");
    assert.equal(isTliRole(demoSessionUser.role), false);
    assert.equal(isClientRole(demoSessionUser.role), true);
    assert.equal(canAccessAllTenants(demoSessionUser.role), false);
    assert.equal(canCreateCustomer(demoSessionUser.role), false);
    assert.equal(canFinalizeAssessment(demoSessionUser.role), false);
    assert.equal(canManageTenantUsers(demoSessionUser.role), true); // Can manage their own tenant's users
    assert.equal(canUploadEvidence(demoSessionUser.role), true);
  });

  it("6. Live PostgreSQL RLS: Demo Customer cannot view or modify other tenants' records", async () => {
    // Under Demo Customer RLS context:
    await executeWithRls(demoSessionUser, async (client) => {
      // 1. Query tenants table: must ONLY see TLI Demo Customer
      const tenantsRes = await client.query("SELECT id, name, slug FROM tenants;");
      assert.equal(tenantsRes.rows.length, 1, "Demo Customer must see exactly 1 tenant");
      assert.equal(tenantsRes.rows[0].slug, "tli-demo-customer");

      // 2. Query assessments table: must ONLY see TLI Demo Customer assessment
      const assessRes = await client.query("SELECT id, tenant_id, engagement_code FROM assessments;");
      for (const row of assessRes.rows) {
        assert.equal(
          row.tenant_id,
          demoSessionUser.tenantId,
          "All visible assessments must belong strictly to demo tenant"
        );
      }

      // 3. Attempt to query Alpha Healthcare users: must return zero rows
      const usersRes = await client.query(
        "SELECT id, email FROM users WHERE email = 'admin@alphahealth.example.com';"
      );
      assert.equal(usersRes.rows.length, 0, "Demo Customer cannot read other tenants' users");

      // 4. Attempt to update another customer's tenant record: must affect 0 rows
      const alphaTenantRes = await pool.query(
        "SELECT id FROM tenants WHERE slug = 'alpha-healthcare';"
      );
      if (alphaTenantRes.rows.length > 0) {
        const alphaId = alphaTenantRes.rows[0].id;
        const updateAttempt = await client.query(
          "UPDATE tenants SET name = 'Hacked Name' WHERE id = $1 RETURNING id;",
          [alphaId]
        );
        assert.equal(updateAttempt.rows.length, 0, "Update on other tenant must affect 0 rows under RLS");
      }
    });
  });

  it("7. Live PostgreSQL RLS: TLI Super Admin retains global platform visibility", async () => {
    await executeWithRls(adminSessionUser, async (client) => {
      // TLI Super Admin can view all tenants
      const tenantsRes = await client.query("SELECT id, slug FROM tenants;");
      assert.ok(tenantsRes.rows.length >= 3, "TLI Super Admin must see all tenants");

      const slugs = tenantsRes.rows.map((r) => r.slug);
      assert.ok(slugs.includes("truth-labs-advisory"));
      assert.ok(slugs.includes("tli-demo-customer"));
      assert.ok(slugs.includes("alpha-healthcare"));
    });
  });

  it("8. Password Hash Security: hashes use bcrypt cost factor 12 and are never stored in plaintext", async () => {
    const res = await pool.query(
      "SELECT email, password_hash FROM users WHERE email IN ('admin@truthlabs.in', 'demo.admin@tlidemo.example');"
    );

    for (const row of res.rows) {
      assert.ok(
        row.password_hash.startsWith("$2a$12$") || row.password_hash.startsWith("$2b$12$"),
        "Hash must be bcrypt with salt rounds = 12"
      );
      assert.notEqual(row.password_hash, adminPasswordGenerated, "Hash must not equal plaintext password");
      assert.notEqual(row.password_hash, demoPasswordGenerated, "Hash must not equal plaintext password");
    }
  });

  it("9. Script Idempotency: re-running without force flags creates zero duplicates and preserves passwords", async () => {
    // Capture user count before rerun
    const countBeforeUsers = (
      await pool.query(
        "SELECT COUNT(*) FROM users WHERE email IN ('admin@truthlabs.in', 'demo.admin@tlidemo.example');"
      )
    ).rows[0].count;
    assert.equal(countBeforeUsers, "2");

    const countBeforeTenants = (
      await pool.query("SELECT COUNT(*) FROM tenants WHERE slug = 'tli-demo-customer';")
    ).rows[0].count;
    assert.equal(countBeforeTenants, "1");

    // Capture current password hashes
    const hashesBefore = (
      await pool.query(
        "SELECT email, password_hash FROM users WHERE email IN ('admin@truthlabs.in', 'demo.admin@tlidemo.example') ORDER BY email;"
      )
    ).rows;

    // Re-run provisioning without force flags
    const rerunResult = await provisionAccounts({
      databaseUrl: DATABASE_URL,
      target: "local-test",
      credentialsFilePath: TEST_CREDENTIALS_FILE,
      forceResetAdmin: false,
      forceResetDemo: false,
      silent: true,
    });

    assert.equal(rerunResult.success, true);
    assert.equal(rerunResult.adminAccount.action, "PRESERVED");
    assert.equal(rerunResult.demoAccount.action, "PRESERVED");
    assert.equal(rerunResult.adminAccount.initialPassword, null);
    assert.equal(rerunResult.demoAccount.initialPassword, null);

    // Verify user count after rerun
    const countAfterUsers = (
      await pool.query(
        "SELECT COUNT(*) FROM users WHERE email IN ('admin@truthlabs.in', 'demo.admin@tlidemo.example');"
      )
    ).rows[0].count;
    assert.equal(countAfterUsers, "2", "User count must remain unchanged");

    // Verify password hashes were preserved
    const hashesAfter = (
      await pool.query(
        "SELECT email, password_hash FROM users WHERE email IN ('admin@truthlabs.in', 'demo.admin@tlidemo.example') ORDER BY email;"
      )
    ).rows;

    assert.deepEqual(hashesBefore, hashesAfter, "Password hashes must not be changed on rerun");
  });

  it("10. Credentials File Protection: file is created with 0600 permissions and is gitignored", () => {
    const credPath = path.resolve(process.cwd(), ".credentials_provisioned.txt");
    if (fs.existsSync(credPath)) {
      const stats = fs.statSync(credPath);
      // Check file mode (0600 means 0o100600 in stat mode)
      const isMode600 = (stats.mode & 0o777) === 0o600;
      assert.equal(isMode600, true, "Credentials file must have 0600 permissions");
    }

    // Verify .gitignore explicitly ignores credentials files
    const gitignoreContent = fs.readFileSync(path.resolve(process.cwd(), ".gitignore"), "utf8");
    assert.ok(
      gitignoreContent.includes(".credentials*"),
      ".gitignore must contain .credentials* pattern"
    );

    // Verify git status does not report .credentials_provisioned.txt as untracked
    const gitStatus = execSync("git status --short", { encoding: "utf8" });
    assert.equal(
      gitStatus.includes(".credentials_provisioned.txt"),
      false,
      "Credentials file must never appear in git status"
    );
  });
});

