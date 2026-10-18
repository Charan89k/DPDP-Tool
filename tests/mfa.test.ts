/**
 * CloudE5 — TOTP multi-factor authentication tests.
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import * as OTPAuth from "otpauth";
import { pool } from "../lib/db/pool.ts";
import { hashPassword } from "../lib/auth/passwords.ts";
import {
  beginMfaEnrolment,
  completeMfaChallenge,
  confirmMfaEnrolment,
  createMfaChallenge,
  decryptSecret,
  disableMfa,
  getMfaStatus,
  isMfaSetupRequired,
  MfaError,
  setOrganizationMfaRequirement,
} from "../lib/auth/mfa.ts";
import { executeWithRls, MfaSetupRequiredError } from "../lib/db/rls.ts";
import type { SessionUser } from "../lib/auth/types.ts";

const ALPHA_TENANT = "018f3a5b-7c8d-7e90-8000-000000000002";
const PASSWORD = "Silver-Compass-Garden-77";

function codeAt(secretBase32: string, offsetSteps = 0): string {
  const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secretBase32), digits: 6, period: 30 });
  return totp.generate({ timestamp: Date.now() + offsetSteps * 30_000 });
}

async function freshUser(): Promise<SessionUser> {
  const id = crypto.randomUUID();
  const email = `mfa.${id.slice(0, 8)}@alphahealth.example.com`;
  await pool.query(
    `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active, email_verified_at)
     VALUES ($1, $2, $3, $4, 'MFA User', 'CLIENT_CONTRIBUTOR', TRUE, CURRENT_TIMESTAMP)`,
    [id, ALPHA_TENANT, email, await hashPassword(PASSWORD)]
  );
  return {
    userId: id,
    email,
    fullName: "MFA User",
    role: "CLIENT_CONTRIBUTOR",
    tenantId: ALPHA_TENANT,
    tenantName: "Alpha Healthcare Technologies Pvt Ltd",
    tenantSlug: "alpha-healthcare",
    tenantType: "CLIENT",
    isSdf: true,
    sessionVersion: 0,
  };
}

async function currentVersion(userId: string): Promise<number> {
  return Number((await pool.query("SELECT session_version FROM users WHERE id = $1", [userId])).rows[0].session_version);
}

async function storedSecret(userId: string): Promise<string> {
  const row = (await pool.query("SELECT mfa_secret_encrypted FROM users WHERE id = $1", [userId])).rows[0];
  return decryptSecret(row.mfa_secret_encrypted);
}

describe("CloudE5 two-factor authentication", () => {
  let user: SessionUser;
  let recoveryCodes: string[] = [];

  before(async () => {
    user = await freshUser();
  });

  it("enrols with an encrypted secret and confirms with a valid code", async () => {
    const setup = await beginMfaEnrolment(user);
    assert.match(setup.otpauthUri, /^otpauth:\/\/totp\/CloudE5:/);
    assert.match(setup.qrCodeDataUrl, /^data:image\/png;base64,/);

    const raw = (await pool.query("SELECT mfa_secret_encrypted, mfa_enabled FROM users WHERE id = $1", [user.userId])).rows[0];
    assert.match(raw.mfa_secret_encrypted, /^v1:/, "Secret is encrypted at rest");
    assert.equal(raw.mfa_enabled, false, "Not active until confirmed");
    const secret = await storedSecret(user.userId);
    assert.equal(setup.manualEntryKey.replace(/ /g, ""), secret);

    await assert.rejects(confirmMfaEnrolment(user, "000000"), MfaError);
    const result = await confirmMfaEnrolment(user, codeAt(secret));
    recoveryCodes = result.recoveryCodes;
    assert.equal(recoveryCodes.length, 10);
    assert.equal(await currentVersion(user.userId), 1, "Enabling MFA revokes existing sessions");
    user = { ...user, sessionVersion: 1 };
    assert.deepEqual(await getMfaStatus(user), { enabled: true, recoveryCodesRemaining: 10, organizationRequiresMfa: false });
    const hashes = (await pool.query("SELECT code_hash FROM mfa_recovery_codes WHERE user_id = $1", [user.userId])).rows;
    assert.ok(hashes.every((h) => /^[0-9a-f]{64}$/.test(h.code_hash) && !recoveryCodes.includes(h.code_hash)));
  });

  it("completes a sign-in challenge once and rejects code replay", async () => {
    const secret = await storedSecret(user.userId);
    const challenge = await createMfaChallenge(user.userId, await currentVersion(user.userId));
    const next = codeAt(secret, 1);
    assert.equal(await completeMfaChallenge(challenge, next), user.userId);
    await assert.rejects(completeMfaChallenge(challenge, next), (err: unknown) =>
      err instanceof MfaError && err.code === "INVALID_CODE"
    );
  });

  it("rejects forged, expired-session and missing challenges", async () => {
    await assert.rejects(completeMfaChallenge(undefined, "123456"), (err: unknown) =>
      err instanceof MfaError && err.code === "CHALLENGE_EXPIRED"
    );
    await assert.rejects(completeMfaChallenge("not.a.jwt", "123456"), MfaError);
    const stale = await createMfaChallenge(user.userId, 99);
    await assert.rejects(completeMfaChallenge(stale, recoveryCodes[0]), MfaError);
  });

  it("accepts each recovery code exactly once", async () => {
    const challenge = await createMfaChallenge(user.userId, await currentVersion(user.userId));
    assert.equal(await completeMfaChallenge(challenge, recoveryCodes[1].toUpperCase()), user.userId);
    await assert.rejects(completeMfaChallenge(challenge, recoveryCodes[1]), MfaError);
    assert.equal((await getMfaStatus(user)).recoveryCodesRemaining, 9);
  });

  it("locks out after repeated wrong codes", async () => {
    const other = await freshUser();
    const setup = await beginMfaEnrolment(other);
    await confirmMfaEnrolment(other, codeAt(setup.manualEntryKey.replace(/ /g, "")));
    const challenge = await createMfaChallenge(other.userId, await currentVersion(other.userId));
    // Concurrent guesses must not bypass the limit: at most 5 are evaluated.
    const outcomes = await Promise.allSettled(
      Array.from({ length: 20 }, () => completeMfaChallenge(challenge, "000000"))
    );
    const codes = outcomes.map((o) => (o.status === "rejected" ? (o.reason as MfaError).code : "OK"));
    assert.equal(codes.filter((c) => c === "INVALID_CODE").length, 5);
    assert.equal(codes.filter((c) => c === "RATE_LIMITED").length, 15);
  });

  it("turns off only with the password and a valid code", async () => {
    await assert.rejects(disableMfa(user, "wrong-password-123", recoveryCodes[2]), MfaError);
    await disableMfa(user, PASSWORD, recoveryCodes[3]);
    assert.equal(await currentVersion(user.userId), 2, "Disabling MFA revokes existing sessions");
    await assert.rejects(getMfaStatus(user), /signed out/, "The pre-change session no longer works");
    user = { ...user, sessionVersion: 2 };
    const row = (await pool.query("SELECT mfa_enabled, mfa_secret_encrypted FROM users WHERE id = $1", [user.userId])).rows[0];
    assert.equal(row.mfa_enabled, false);
    assert.equal(row.mfa_secret_encrypted, null);
    assert.equal((await getMfaStatus(user)).recoveryCodesRemaining, 0);
  });
});

describe("CloudE5 organisation-wide two-factor requirement", () => {
  const tenantId = crypto.randomUUID();

  async function member(role: "CLIENT_ADMIN" | "CLIENT_CONTRIBUTOR"): Promise<SessionUser> {
    const id = crypto.randomUUID();
    const email = `req.${id.slice(0, 8)}@required.example.com`;
    await pool.query(
      `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active, email_verified_at)
       VALUES ($1, $2, $3, $4, 'Req User', $5, TRUE, CURRENT_TIMESTAMP)`,
      [id, tenantId, email, await hashPassword(PASSWORD), role]
    );
    return {
      userId: id, email, fullName: "Req User", role, tenantId, tenantName: "Required MFA Org",
      tenantSlug: "required-mfa-org", tenantType: "CLIENT", isSdf: false, sessionVersion: 0,
    };
  }

  async function enrol(user: SessionUser): Promise<SessionUser> {
    await beginMfaEnrolment(user);
    await confirmMfaEnrolment(user, codeAt(await storedSecret(user.userId)));
    return { ...user, sessionVersion: await currentVersion(user.userId) };
  }

  const readOwnTenant = (user: SessionUser) =>
    executeWithRls(user, async (client) => (await client.query("SELECT id FROM tenants WHERE id = $1", [tenantId])).rows);

  before(async () => {
    await pool.query("INSERT INTO tenants (id, type, name, slug) VALUES ($1, 'CLIENT', 'Required MFA Org', $2)", [
      tenantId,
      `required-mfa-${tenantId.slice(0, 8)}`,
    ]);
  });

  it("only lets an administrator who uses two-factor require it", async () => {
    const contributor = await member("CLIENT_CONTRIBUTOR");
    await assert.rejects(setOrganizationMfaRequirement(contributor, true), (e: unknown) => e instanceof MfaError && e.statusCode === 403);

    const admin = await member("CLIENT_ADMIN");
    await assert.rejects(setOrganizationMfaRequirement(admin, true), (e: unknown) => e instanceof MfaError && e.code === "MFA_NOT_ENABLED");
    await setOrganizationMfaRequirement(await enrol(admin), true);
    const row = (await pool.query("SELECT require_mfa FROM tenants WHERE id = $1", [tenantId])).rows[0];
    assert.equal(Boolean(row.require_mfa), true);
  });

  it("blocks unenrolled members from tenant data but still lets them enrol", async () => {
    const pending = await member("CLIENT_CONTRIBUTOR");
    assert.equal(await isMfaSetupRequired(pending), true);
    await assert.rejects(readOwnTenant(pending), (e: unknown) => e instanceof MfaSetupRequiredError);

    const status = await getMfaStatus(pending);
    assert.equal(status.organizationRequiresMfa, true);
    const enrolled = await enrol(pending);
    assert.equal(await isMfaSetupRequired(enrolled), false);
    assert.equal((await readOwnTenant(enrolled)).length, 1);
  });

  it("refuses to turn two-factor off while the organisation requires it", async () => {
    const enrolled = await enrol(await member("CLIENT_CONTRIBUTOR"));
    const secret = await storedSecret(enrolled.userId);
    await assert.rejects(
      disableMfa(enrolled, PASSWORD, codeAt(secret, 1)),
      (e: unknown) => e instanceof MfaError && e.code === "MFA_REQUIRED_BY_ORGANIZATION"
    );
  });
});
