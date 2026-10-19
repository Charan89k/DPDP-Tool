/**
 * CloudE5 — Self-service account lifecycle tests.
 *
 * Registration (atomic organisation + first admin, never a platform role), email verification,
 * enumeration-resistant responses, single-use expiring tokens, password reset with session
 * revocation, and password policy. Emails are captured from the development outbox.
 */

import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const OUTBOX = fs.mkdtempSync(path.join(os.tmpdir(), "cloude5-outbox-"));
process.env.CLOUDE5_DEV_OUTBOX_DIR = OUTBOX;

const { pool } = await import("../lib/db/pool.ts");
const { executeWithRls } = await import("../lib/db/rls.ts");
const { verifyPassword, describePasswordProblem } = await import("../lib/auth/passwords.ts");
const account = await import("../lib/auth/account.ts");

const SUITE = Date.now().toString(36);
const EMAIL = `founder.${SUITE}@acme-${SUITE}.example`;
const PASSWORD = "Correct-Horse-Battery-42";

function outboxMessages(): string[] {
  return fs
    .readdirSync(OUTBOX)
    .sort()
    .map((f) => fs.readFileSync(path.join(OUTBOX, f), "utf8"));
}

function latestTokenFor(email: string, route: "verify-email" | "reset-password"): string {
  const message = outboxMessages()
    .reverse()
    .find((m) => m.includes(`To: ${email}`) && m.includes(`/${route}?token=`));
  assert.ok(message, `Expected a ${route} email for ${email}`);
  return decodeURIComponent(/token=([^\s]+)/.exec(message!)![1]);
}

async function sessionFor(email: string, sessionVersionOffset = 0) {
  const row = (
    await pool.query(
      `SELECT u.id, u.tenant_id, u.session_version, t.name, t.slug FROM users u
       JOIN tenants t ON t.id = u.tenant_id WHERE u.email = $1`,
      [email]
    )
  ).rows[0];
  return {
    userId: row.id as string,
    email,
    fullName: "Asha Founder",
    role: "CLIENT_ADMIN" as const,
    tenantId: row.tenant_id as string,
    tenantName: row.name as string,
    tenantSlug: row.slug as string,
    tenantType: "CLIENT" as const,
    isSdf: false,
    sessionVersion: Number(row.session_version) + sessionVersionOffset,
  };
}

describe("CloudE5 self-service account lifecycle", () => {
  after(() => {
    fs.rmSync(OUTBOX, { recursive: true, force: true });
  });

  it("enforces the password policy", () => {
    assert.ok(describePasswordProblem("short1"));
    assert.ok(describePasswordProblem("onlylettersandmore"));
    assert.ok(describePasswordProblem("1".repeat(14)));
    assert.ok(describePasswordProblem("founder-secret-123", { email: "founder@acme.example" }));
    assert.ok(describePasswordProblem("x".repeat(60) + "ä".repeat(10) + "1"), "over 72 bytes");
    assert.equal(describePasswordProblem(PASSWORD, { email: EMAIL }), null);
  });

  it("registers an organisation with its first CLIENT_ADMIN atomically and sends verification", async () => {
    const outcome = await account.registerOrganization({
      fullName: "Asha Founder",
      email: EMAIL.toUpperCase(),
      password: PASSWORD,
      organizationName: `Acme Health ${SUITE}`,
      industry: "Healthcare",
    });
    assert.equal(outcome.emailDelivery.sent, true);

    const row = (
      await pool.query(
        `SELECT u.role, u.email_verified_at, u.password_hash, t.type, t.status, t.onboarding_completed_at
         FROM users u JOIN tenants t ON t.id = u.tenant_id WHERE u.email = $1`,
        [EMAIL]
      )
    ).rows[0];
    assert.equal(row.role, "CLIENT_ADMIN", "Public registration creates a customer administrator");
    assert.equal(row.type, "CLIENT", "Public registration can never create a platform tenant");
    assert.equal(row.status, "ACTIVE");
    assert.equal(row.email_verified_at, null);
    assert.equal(row.onboarding_completed_at, null);
    assert.notEqual(row.password_hash, PASSWORD);

    const stored = (
      await pool.query(
        "SELECT token_hash FROM auth_tokens t JOIN users u ON u.id = t.user_id WHERE u.email = $1",
        [EMAIL]
      )
    ).rows;
    const raw = latestTokenFor(EMAIL, "verify-email");
    assert.equal(stored.length, 1);
    assert.notEqual(stored[0].token_hash, raw, "Only token hashes are stored");
    assert.equal(stored[0].token_hash, account.hashToken(raw));
  });

  it("responds identically for an already registered email and notifies the owner instead", async () => {
    const tenantsBefore = Number((await pool.query("SELECT COUNT(*) AS n FROM tenants")).rows[0].n);
    const outcome = await account.registerOrganization({
      fullName: "Impostor",
      email: EMAIL,
      password: "Another-Valid-Pass-99",
      organizationName: "Impostor Org",
    });
    assert.equal(outcome.emailDelivery.sent, true);
    const tenantsAfter = Number((await pool.query("SELECT COUNT(*) AS n FROM tenants")).rows[0].n);
    assert.equal(tenantsAfter, tenantsBefore, "No organisation may be created for an existing email");
    assert.ok(outboxMessages().some((m) => m.includes(`To: ${EMAIL}`) && m.includes("already has an account")));
  });

  it("rejects weak passwords without creating anything", async () => {
    const weakEmail = `weak.${SUITE}@example.test`;
    await assert.rejects(
      account.registerOrganization({
        fullName: "Weak",
        email: weakEmail,
        password: "password",
        organizationName: "Weak Org",
      }),
      (err: unknown) => err instanceof account.AccountError && err.code === "WEAK_PASSWORD"
    );
    const exists = await pool.query("SELECT 1 FROM users WHERE email = $1", [weakEmail]);
    assert.equal(exists.rows.length, 0);
  });

  it("verifies email with a single-use token", async () => {
    const token = latestTokenFor(EMAIL, "verify-email");
    const result = await account.verifyEmail(token);
    assert.equal(result.email, EMAIL);
    const row = (await pool.query("SELECT email_verified_at FROM users WHERE email = $1", [EMAIL])).rows[0];
    assert.ok(row.email_verified_at instanceof Date);

    await assert.rejects(
      account.verifyEmail(token),
      (err: unknown) => err instanceof account.AccountError && err.code === "INVALID_TOKEN"
    );
    await assert.rejects(account.verifyEmail("not-a-real-token-but-long-enough"), account.AccountError);
  });

  it("rejects expired tokens", async () => {
    const userId = (await pool.query("SELECT id FROM users WHERE email = $1", [EMAIL])).rows[0].id;
    const client = await pool.connect();
    let raw = "";
    try {
      raw = await account.issueToken(client, userId, "PASSWORD_RESET");
      await client.query("UPDATE auth_tokens SET expires_at = $1 WHERE token_hash = $2", [
        new Date(Date.now() - 1000),
        account.hashToken(raw),
      ]);
    } finally {
      client.release();
    }
    await assert.rejects(
      account.resetPassword(raw, "Brand-New-Passphrase-77"),
      (err: unknown) => err instanceof account.AccountError && err.code === "INVALID_TOKEN"
    );
  });

  it("does not reveal whether an email exists when requesting a reset", async () => {
    const before = outboxMessages().length;
    await account.requestPasswordReset(`nobody.${SUITE}@example.test`);
    assert.equal(outboxMessages().length, before, "No email for unknown accounts");
    await account.requestPasswordReset(EMAIL);
    assert.equal(outboxMessages().length, before + 1);
  });

  it("resets the password, revokes sessions, and keeps the token usable after a policy failure", async () => {
    const before = (await pool.query("SELECT session_version FROM users WHERE email = $1", [EMAIL])).rows[0];
    const token = latestTokenFor(EMAIL, "reset-password");

    await assert.rejects(
      account.resetPassword(token, "weak"),
      (err: unknown) => err instanceof account.AccountError && err.code === "WEAK_PASSWORD"
    );

    await account.resetPassword(token, "Brand-New-Passphrase-77");
    const row = (
      await pool.query("SELECT password_hash, session_version FROM users WHERE email = $1", [EMAIL])
    ).rows[0];
    assert.equal(await verifyPassword("Brand-New-Passphrase-77", row.password_hash), true);
    assert.equal(await verifyPassword(PASSWORD, row.password_hash), false);
    assert.equal(Number(row.session_version), Number(before.session_version) + 1);
    await assert.rejects(account.resetPassword(token, "Yet-Another-Pass-88"), account.AccountError);
    assert.ok(
      outboxMessages().some((m) => m.includes(`To: ${EMAIL}`) && m.includes("password was just changed"))
    );
  });

  it("rejects sessions issued before a password reset", async () => {
    await assert.rejects(
      executeWithRls(await sessionFor(EMAIL, -1), async () => true),
      /signed out/
    );
    assert.equal(await executeWithRls(await sessionFor(EMAIL), async () => true), true);
  });

  it("rejects a signed-out session even if its cookie is replayed, without signing out other sessions", async () => {
    const signedOut = { ...(await sessionFor(EMAIL)), sessionId: crypto.randomUUID() };
    const otherDevice = { ...(await sessionFor(EMAIL)), sessionId: crypto.randomUUID() };
    assert.equal(await executeWithRls(signedOut, async () => true), true);

    await account.revokeSession(signedOut);

    await assert.rejects(executeWithRls(signedOut, async () => true), /signed out/);
    assert.equal(await executeWithRls(otherDevice, async () => true), true);
  });

  it("scopes a self-registered organisation to its own data only", async () => {
    const session = await sessionFor(EMAIL);
    const visible = await executeWithRls(session, async (client) => ({
      tenants: (await client.query("SELECT id FROM tenants")).rows.map((r) => r.id),
      assessments: Number((await client.query("SELECT COUNT(*) AS n FROM assessments")).rows[0].n),
      users: Number((await client.query("SELECT COUNT(*) AS n FROM users")).rows[0].n),
      tokens: Number((await client.query("SELECT COUNT(*) AS n FROM auth_tokens")).rows[0].n),
    }));
    assert.deepEqual(visible.tenants, [session.tenantId]);
    assert.equal(visible.assessments, 0);
    assert.equal(visible.users, 1);
    assert.equal(visible.tokens, 0, "Authentication tokens are never readable in a user context");
  });
});
