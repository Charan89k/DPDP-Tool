/**
 * CloudE5 — Platform administrator bootstrap tests (replaces the Phase 8 provisioning suite).
 *
 * Verifies strong password generation, idempotent creation, explicit password reset with session
 * revocation, bcrypt storage, refusal to hijack non-admin accounts, and that the bootstrap admin
 * has platform-wide visibility through the tenant policy layer.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../lib/db/pool.ts";
import { executeWithRls } from "../lib/db/rls.ts";
import { verifyPassword } from "../lib/auth/passwords.ts";
import {
  BootstrapError,
  createPlatformAdmin,
  generateStrongPassword,
  PLATFORM_TENANT_SLUG,
} from "../lib/admin/bootstrap.ts";
import type { SessionUser } from "../lib/auth/types.ts";

const ADMIN_EMAIL = `platform.admin.${Date.now()}@cloude5.test`;

describe("CloudE5 platform administrator bootstrap", () => {
  let generatedPassword = "";
  let adminId = "";

  it("generates high-entropy passwords containing every character class", () => {
    const samples = new Set(Array.from({ length: 20 }, () => generateStrongPassword()));
    assert.equal(samples.size, 20, "Passwords must not repeat");
    for (const password of samples) {
      assert.equal(password.length, 24);
      assert.match(password, /[a-z]/);
      assert.match(password, /[A-Z]/);
      assert.match(password, /[0-9]/);
      assert.match(password, /[^A-Za-z0-9]/);
    }
  });

  it("creates the platform tenant and an administrator with a generated password", async () => {
    const result = await createPlatformAdmin({ email: ADMIN_EMAIL, fullName: "Platform Admin" });
    assert.equal(result.status, "CREATED");
    assert.ok(result.generatedPassword);
    generatedPassword = result.generatedPassword!;
    adminId = result.userId;

    const row = (
      await pool.query(
        `SELECT u.role, u.password_hash, u.email_verified_at, t.slug, t.type
         FROM users u JOIN tenants t ON t.id = u.tenant_id WHERE u.id = $1`,
        [adminId]
      )
    ).rows[0];
    assert.equal(row.role, "TLI_SUPER_ADMIN");
    assert.equal(row.slug, PLATFORM_TENANT_SLUG);
    assert.equal(row.type, "TLI");
    assert.ok(row.email_verified_at, "Bootstrap administrators are verified by the operator");
    assert.match(row.password_hash, /^\$2[aby]\$12\$/, "bcrypt with cost factor 12");
    assert.notEqual(row.password_hash, generatedPassword);
    assert.equal(await verifyPassword(generatedPassword, row.password_hash), true);
  });

  it("is idempotent: re-running does not change the existing administrator", async () => {
    const before = (await pool.query("SELECT password_hash FROM users WHERE id = $1", [adminId])).rows[0];
    const result = await createPlatformAdmin({ email: ADMIN_EMAIL, fullName: "Platform Admin" });
    assert.equal(result.status, "EXISTING");
    assert.equal(result.generatedPassword, undefined);
    const after = (await pool.query("SELECT password_hash FROM users WHERE id = $1", [adminId])).rows[0];
    assert.equal(after.password_hash, before.password_hash);
    const tenants = await pool.query("SELECT COUNT(*) AS n FROM tenants WHERE slug = $1", [PLATFORM_TENANT_SLUG]);
    assert.equal(Number(tenants.rows[0].n), 1);
  });

  it("resets the password only when asked and revokes existing sessions", async () => {
    const before = (await pool.query("SELECT session_version FROM users WHERE id = $1", [adminId])).rows[0];
    const result = await createPlatformAdmin({
      email: ADMIN_EMAIL,
      fullName: "Platform Admin",
      password: "Operator-Chosen-Passphrase-42",
      resetPassword: true,
    });
    assert.equal(result.status, "PASSWORD_RESET");
    const row = (await pool.query("SELECT password_hash, session_version FROM users WHERE id = $1", [adminId])).rows[0];
    assert.equal(await verifyPassword("Operator-Chosen-Passphrase-42", row.password_hash), true);
    assert.equal(await verifyPassword(generatedPassword, row.password_hash), false);
    assert.equal(Number(row.session_version), Number(before.session_version) + 1);
  });

  it("refuses short operator passwords and existing non-admin accounts", async () => {
    await assert.rejects(
      createPlatformAdmin({ email: `short.${Date.now()}@cloude5.test`, fullName: "X Admin", password: "short" }),
      BootstrapError
    );
    await assert.rejects(
      createPlatformAdmin({ email: "customer.demo@tli.local", fullName: "Hijack Attempt" }),
      BootstrapError
    );
    const customer = (await pool.query("SELECT role FROM users WHERE email = 'customer.demo@tli.local'")).rows[0];
    assert.equal(customer.role, "CLIENT_ADMIN", "Customer account must be untouched");
  });

  it("gives the bootstrap administrator platform-wide visibility", async () => {
    const row = (
      await pool.query(
        `SELECT u.id, u.tenant_id, u.session_version, t.name, t.slug FROM users u
         JOIN tenants t ON t.id = u.tenant_id WHERE u.id = $1`,
        [adminId]
      )
    ).rows[0];
    const session: SessionUser = {
      userId: adminId,
      email: ADMIN_EMAIL,
      fullName: "Platform Admin",
      role: "TLI_SUPER_ADMIN",
      tenantId: row.tenant_id,
      tenantName: row.name,
      tenantSlug: row.slug,
      tenantType: "TLI",
      isSdf: false,
      sessionVersion: Number(row.session_version),
    };
    const visibleTenants = await executeWithRls(session, async (client) =>
      Number((await client.query("SELECT COUNT(*) AS n FROM tenants")).rows[0].n)
    );
    const allTenants = Number((await pool.query("SELECT COUNT(*) AS n FROM tenants")).rows[0].n);
    assert.equal(visibleTenants, allTenants);
  });
});
