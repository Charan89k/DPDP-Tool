/**
 * CloudE5 — TOTP multi-factor authentication.
 *
 * - Authenticator-app codes (RFC 6238: SHA-1, 6 digits, 30-second steps, ±1 step tolerance).
 * - Secrets are encrypted at rest with AES-256-GCM. The key is CLOUDE5_ENCRYPTION_KEY (32 bytes,
 *   base64) when set, otherwise derived from SESSION_SECRET with HKDF. Changing the key source
 *   makes existing enrolments unreadable, so users would need to enrol again.
 * - Each accepted code's time step is recorded; a code (or an older one) can never be reused.
 * - Ten single-use recovery codes are issued at enrolment; only keyed HMAC-SHA-256 hashes are stored.
 * - Sign-in with MFA is two steps: the password step returns a short-lived signed challenge
 *   (HttpOnly cookie); the session is issued only after a valid code.
 */

import crypto from "node:crypto";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { SignJWT, jwtVerify } from "jose";
import { pool } from "../db/pool.ts";
import type { PoolClient } from "../db/pool.ts";
import { assertSessionMatchesDatabase, executeWithRls } from "../db/rls.ts";
import { getSigningKey } from "./session.ts";
import { verifyPassword } from "./passwords.ts";
import { PersistentRateLimiter } from "./rate_limit.ts";
import type { SessionUser } from "./types.ts";

const ISSUER = "CloudE5";
const RECOVERY_CODE_COUNT = 10;
const CHALLENGE_TTL_SECONDS = 5 * 60;
const CHALLENGE_AUDIENCE = "cloude5-mfa-challenge";
export const MFA_CHALLENGE_COOKIE = "cloude5_mfa_challenge";
export const MFA_CHALLENGE_MAX_AGE_SECONDS = CHALLENGE_TTL_SECONDS;

/** At most 5 code attempts per user per 15 minutes (counted before verification; reset on success). */
export const mfaRateLimiter = new PersistentRateLimiter("mfa", 5, 15 * 60);

export class MfaError extends Error {
  code: string;
  statusCode: number;
  constructor(message: string, code: string, statusCode = 400) {
    super(message);
    this.name = "MfaError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

function encryptionKey(): Buffer {
  const configured = process.env.CLOUDE5_ENCRYPTION_KEY?.trim();
  if (configured) {
    const key = Buffer.from(configured, "base64");
    if (key.length !== 32) {
      throw new Error("CLOUDE5_ENCRYPTION_KEY must be 32 bytes, base64-encoded.");
    }
    return key;
  }
  return Buffer.from(
    crypto.hkdfSync("sha256", getSigningKey(), "cloude5", "cloude5:mfa-secret-encryption:v1", 32)
  );
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1:${Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64")}`;
}

export function decryptSecret(stored: string): string {
  if (!stored.startsWith("v1:")) throw new Error("Unsupported MFA secret format.");
  const raw = Buffer.from(stored.slice(3), "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

function totpFor(secretBase32: string, label: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
}

/**
 * Recovery codes are stored as HMAC-SHA256 under a server-held key, so a copy of the database
 * alone is not enough to brute-force them offline.
 */
const hashCode = (code: string) =>
  crypto
    .createHmac(
      "sha256",
      Buffer.from(crypto.hkdfSync("sha256", encryptionKey(), "cloude5", "cloude5:mfa-recovery-codes:v1", 32))
    )
    .update(code.replace(/[\s-]/g, "").toLowerCase())
    .digest("hex");

function generateRecoveryCodes(): string[] {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const chars = Array.from({ length: 10 }, () => alphabet[crypto.randomInt(alphabet.length)]).join("");
    return `${chars.slice(0, 5)}-${chars.slice(5)}`;
  });
}

async function audit(client: PoolClient, user: { tenantId: string; userId: string }, action: string) {
  await client.query(
    `INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, new_state)
     VALUES ($1, $2, $3, 'users', $2, '{}');`,
    [user.tenantId, user.userId, action]
  );
}

async function inTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN;");
    const result = await work(client);
    await client.query("COMMIT;");
    return result;
  } catch (err) {
    await client.query("ROLLBACK;");
    throw err;
  } finally {
    client.release();
  }
}

async function enforceAttemptLimit(userId: string): Promise<void> {
  const status = await mfaRateLimiter.hit(userId);
  if (status.limited) {
    throw new MfaError(
      "Too many incorrect codes. Please wait a few minutes and try again.",
      "RATE_LIMITED",
      429
    );
  }
}

export async function getMfaStatus(
  sessionUser: SessionUser
): Promise<{ enabled: boolean; recoveryCodesRemaining: number; organizationRequiresMfa: boolean }> {
  return inTransaction(async (client) => {
    await assertSessionMatchesDatabase(client, sessionUser, { allowPendingMfaSetup: true });
    const user = (
      await client.query(
        "SELECT u.mfa_enabled, t.require_mfa FROM users u JOIN tenants t ON t.id = u.tenant_id WHERE u.id = $1;",
        [sessionUser.userId]
      )
    ).rows[0];
    const codes = (
      await client.query(
        "SELECT COUNT(*) AS n FROM mfa_recovery_codes WHERE user_id = $1 AND used_at IS NULL;",
        [sessionUser.userId]
      )
    ).rows[0];
    return {
      enabled: Boolean(user?.mfa_enabled),
      recoveryCodesRemaining: Number(codes?.n ?? 0),
      organizationRequiresMfa: Boolean(user?.require_mfa),
    };
  });
}

/** Starts enrolment: stores a new (not yet active) secret and returns what the user scans. */
export async function beginMfaEnrolment(
  sessionUser: SessionUser
): Promise<{ otpauthUri: string; qrCodeDataUrl: string; manualEntryKey: string }> {
  const secret = new OTPAuth.Secret({ size: 20 });
  await inTransaction(async (client) => {
    await assertSessionMatchesDatabase(client, sessionUser, { allowPendingMfaSetup: true });
    const res = await client.query(
      `UPDATE users SET mfa_secret_encrypted = $1, mfa_last_used_step = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND mfa_enabled = FALSE;`,
      [encryptSecret(secret.base32), sessionUser.userId]
    );
    if (res.rowCount === 0) {
      throw new MfaError("Two-factor authentication is already enabled.", "MFA_ALREADY_ENABLED", 409);
    }
  });
  const otpauthUri = totpFor(secret.base32, sessionUser.email).toString();
  return {
    otpauthUri,
    qrCodeDataUrl: await QRCode.toDataURL(otpauthUri, { margin: 1, width: 220 }),
    manualEntryKey: secret.base32.match(/.{1,4}/g)!.join(" "),
  };
}

/** Checks a TOTP code with replay protection; records the accepted step. */
async function acceptTotp(client: PoolClient, userId: string, email: string, code: string): Promise<boolean> {
  const user = (
    await client.query("SELECT mfa_secret_encrypted, mfa_last_used_step FROM users WHERE id = $1;", [userId])
  ).rows[0];
  if (!user?.mfa_secret_encrypted || !/^\d{6}$/.test(code)) return false;
  let secret: string;
  try {
    secret = decryptSecret(user.mfa_secret_encrypted);
  } catch {
    // Encryption key changed: the authenticator can no longer be verified, but recovery codes
    // still work so the user is not locked out. Operators can also run db:reset-mfa.
    console.error("MFA secret could not be decrypted (encryption key changed?) for a user.");
    return false;
  }
  const delta = totpFor(secret, email).validate({ token: code, window: 1 });
  if (delta === null) return false;
  const step = Math.floor(Date.now() / 1000 / 30) + delta;
  if (user.mfa_last_used_step !== null && step <= Number(user.mfa_last_used_step)) return false;
  await client.query("UPDATE users SET mfa_last_used_step = $1 WHERE id = $2;", [step, userId]);
  return true;
}

async function acceptRecoveryCode(client: PoolClient, userId: string, code: string): Promise<boolean> {
  const res = await client.query(
    `UPDATE mfa_recovery_codes SET used_at = CURRENT_TIMESTAMP
     WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL;`,
    [userId, hashCode(code)]
  );
  return res.rowCount === 1;
}

/** Confirms enrolment with a first code and returns the one-time recovery codes. */
export async function confirmMfaEnrolment(
  sessionUser: SessionUser,
  code: string
): Promise<{ recoveryCodes: string[] }> {
  await enforceAttemptLimit(sessionUser.userId);
  const recoveryCodes = generateRecoveryCodes();
  const ok = await inTransaction(async (client) => {
    await assertSessionMatchesDatabase(client, sessionUser, { allowPendingMfaSetup: true });
    const current = (await client.query("SELECT mfa_enabled FROM users WHERE id = $1;", [sessionUser.userId]))
      .rows[0];
    if (current?.mfa_enabled) {
      throw new MfaError("Two-factor authentication is already enabled.", "MFA_ALREADY_ENABLED", 409);
    }
    if (!(await acceptTotp(client, sessionUser.userId, sessionUser.email, code.trim()))) return false;
    // Enabling MFA revokes every existing session; the caller re-issues the current one.
    await client.query(
      `UPDATE users SET mfa_enabled = TRUE, session_version = session_version + 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1;`,
      [sessionUser.userId]
    );
    await client.query("DELETE FROM mfa_recovery_codes WHERE user_id = $1;", [sessionUser.userId]);
    for (const recovery of recoveryCodes) {
      await client.query("INSERT INTO mfa_recovery_codes (id, user_id, code_hash) VALUES ($1, $2, $3);", [
        crypto.randomUUID(),
        sessionUser.userId,
        hashCode(recovery),
      ]);
    }
    await audit(client, sessionUser, "MFA_ENABLED");
    return true;
  });
  if (!ok) {
    throw new MfaError(
      "That code is not valid. Check your authenticator app's time and try again.",
      "INVALID_CODE"
    );
  }
  await mfaRateLimiter.resetAttempts(sessionUser.userId);
  return { recoveryCodes };
}

/** Turns MFA off after re-checking the password and a current code (or a recovery code). */
export async function disableMfa(sessionUser: SessionUser, password: string, code: string): Promise<void> {
  await enforceAttemptLimit(sessionUser.userId);
  const ok = await inTransaction(async (client) => {
    await assertSessionMatchesDatabase(client, sessionUser);
    const user = (
      await client.query("SELECT password_hash, mfa_enabled FROM users WHERE id = $1;", [sessionUser.userId])
    ).rows[0];
    if (!user?.mfa_enabled) {
      throw new MfaError("Two-factor authentication is not enabled.", "MFA_NOT_ENABLED", 409);
    }
    const tenant = (await client.query("SELECT require_mfa FROM tenants WHERE id = $1;", [sessionUser.tenantId])).rows[0];
    if (tenant?.require_mfa) {
      throw new MfaError(
        "Your organisation requires two-factor authentication, so it cannot be turned off.",
        "MFA_REQUIRED_BY_ORGANIZATION",
        409
      );
    }
    if (!(await verifyPassword(password, user.password_hash))) return false;
    const trimmed = code.trim();
    const valid =
      (await acceptTotp(client, sessionUser.userId, sessionUser.email, trimmed)) ||
      (await acceptRecoveryCode(client, sessionUser.userId, trimmed));
    if (!valid) return false;
    await client.query(
      `UPDATE users SET mfa_enabled = FALSE, mfa_secret_encrypted = NULL, mfa_last_used_step = NULL,
                        session_version = session_version + 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1;`,
      [sessionUser.userId]
    );
    await client.query("DELETE FROM mfa_recovery_codes WHERE user_id = $1;", [sessionUser.userId]);
    await audit(client, sessionUser, "MFA_DISABLED");
    return true;
  });
  if (!ok) {
    throw new MfaError("Password or code is not valid.", "INVALID_CODE");
  }
  await mfaRateLimiter.resetAttempts(sessionUser.userId);
}

// ---------------------------------------------------------------------------------------------
// Organisation-wide requirement
// ---------------------------------------------------------------------------------------------

/** True when the user's organisation requires two-factor and the user has not enrolled yet. */
export async function isMfaSetupRequired(sessionUser: SessionUser): Promise<boolean> {
  return inTransaction(async (client) => {
    const row = (
      await client.query(
        `SELECT t.require_mfa, u.mfa_enabled FROM users u JOIN tenants t ON t.id = u.tenant_id
         WHERE u.id = $1 AND u.tenant_id = $2;`,
        [sessionUser.userId, sessionUser.tenantId]
      )
    ).rows[0];
    return Boolean(row?.require_mfa) && !row?.mfa_enabled;
  });
}

/**
 * Lets an organisation administrator require two-factor for every member. Administrators must have
 * two-factor themselves before requiring it, so they cannot lock themselves out of the setting.
 */
export async function setOrganizationMfaRequirement(sessionUser: SessionUser, required: boolean): Promise<void> {
  if (sessionUser.role !== "CLIENT_ADMIN" && sessionUser.role !== "TLI_SUPER_ADMIN") {
    throw new MfaError("Only organisation administrators can change this setting.", "FORBIDDEN", 403);
  }
  await executeWithRls(sessionUser, async (client) => {
    const me = (await client.query("SELECT mfa_enabled FROM users WHERE id = $1;", [sessionUser.userId])).rows[0];
    if (required && !me?.mfa_enabled) {
      throw new MfaError("Turn on two-factor for your own account before requiring it.", "MFA_NOT_ENABLED", 409);
    }
    const res = await client.query(
      "UPDATE tenants SET require_mfa = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id;",
      [required, sessionUser.tenantId]
    );
    if (res.rows.length === 0) {
      throw new MfaError("Organisation not found.", "NOT_FOUND", 404);
    }
    await client.query(
      `INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, new_state)
       VALUES ($1, $2, 'ORGANIZATION_MFA_REQUIREMENT_CHANGED', 'tenants', $1, $3);`,
      [sessionUser.tenantId, sessionUser.userId, JSON.stringify({ requireMfa: required })]
    );
  });
}

// ---------------------------------------------------------------------------------------------
// Sign-in challenge
// ---------------------------------------------------------------------------------------------

export async function createMfaChallenge(userId: string, sessionVersion: number): Promise<string> {
  return new SignJWT({ sv: sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setAudience(CHALLENGE_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${CHALLENGE_TTL_SECONDS}s`)
    .sign(getSigningKey());
}

/**
 * Completes a two-step sign-in. Returns the user id when the challenge is valid and the code
 * (TOTP or recovery) is accepted.
 */
export async function completeMfaChallenge(challenge: string | undefined, code: string): Promise<string> {
  let userId: string;
  let sessionVersion: number;
  try {
    const { payload } = await jwtVerify(challenge ?? "", getSigningKey(), {
      algorithms: ["HS256"],
      audience: CHALLENGE_AUDIENCE,
    });
    userId = String(payload.sub);
    sessionVersion = Number(payload.sv ?? 0);
  } catch {
    throw new MfaError("Your sign-in attempt expired. Please sign in again.", "CHALLENGE_EXPIRED", 401);
  }

  await enforceAttemptLimit(userId);
  const ok = await inTransaction(async (client) => {
    const user = (
      await client.query(
        `SELECT u.email, u.tenant_id, u.mfa_enabled, u.session_version, u.is_active, t.status AS tenant_status
         FROM users u JOIN tenants t ON t.id = u.tenant_id WHERE u.id = $1;`,
        [userId]
      )
    ).rows[0];
    if (!user || !user.mfa_enabled || !user.is_active || user.tenant_status !== "ACTIVE") return false;
    if (Number(user.session_version) !== sessionVersion) return false;
    const trimmed = code.trim();
    const viaTotp = await acceptTotp(client, userId, user.email, trimmed);
    const valid = viaTotp || (await acceptRecoveryCode(client, userId, trimmed));
    if (valid) {
      await audit(
        client,
        { tenantId: user.tenant_id, userId },
        viaTotp ? "MFA_VERIFIED" : "MFA_RECOVERY_CODE_USED"
      );
    }
    return valid;
  });
  if (!ok) {
    throw new MfaError("That code is not valid.", "INVALID_CODE", 401);
  }
  await mfaRateLimiter.resetAttempts(userId);
  return userId;
}
