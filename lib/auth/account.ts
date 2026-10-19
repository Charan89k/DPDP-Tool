/**
 * CloudE5 — Self-service account lifecycle.
 *
 * - registerOrganization: creates a CLIENT organisation and its first CLIENT_ADMIN atomically.
 *   Public registration can never create platform (TLI_*) roles.
 * - verifyEmail / resendVerification: email ownership proof with single-use expiring tokens.
 * - requestPasswordReset / resetPassword: single-use 1-hour tokens; a reset revokes every
 *   existing session (users.session_version) and notifies the user.
 *
 * Enumeration resistance: registration, verification resend and reset requests return the same
 * outcome whether or not an account exists. Raw tokens are only ever placed in email links;
 * the database stores SHA-256 hashes.
 */

import crypto from "node:crypto";
import { pool } from "../db/pool.ts";
import type { PoolClient } from "../db/pool.ts";
import {
  consumePasswordVerificationTime,
  describePasswordProblem,
  hashPassword,
} from "./passwords.ts";
import { publicBaseUrl, sendEmail } from "../email/mailer.ts";
import type { EmailDeliveryResult } from "../email/mailer.ts";
import {
  existingAccountEmail,
  passwordChangedEmail,
  passwordResetEmail,
  verificationEmail,
} from "../email/templates.ts";
import { SESSION_MAX_AGE_SECONDS } from "./session.ts";
import type { SessionUser } from "./types.ts";

export type TokenPurpose = "EMAIL_VERIFICATION" | "PASSWORD_RESET";

const TOKEN_TTL_MS: Record<TokenPurpose, number> = {
  EMAIL_VERIFICATION: 24 * 60 * 60 * 1000,
  PASSWORD_RESET: 60 * 60 * 1000,
};

export class AccountError extends Error {
  code: string;
  statusCode: number;
  constructor(message: string, code: string, statusCode = 400) {
    super(message);
    this.name = "AccountError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/** Issues a new single-use token, invalidating any earlier unused token for the same purpose. */
export async function issueToken(
  client: PoolClient,
  userId: string,
  purpose: TokenPurpose
): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  await client.query(
    `UPDATE auth_tokens SET consumed_at = CURRENT_TIMESTAMP
     WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL;`,
    [userId, purpose]
  );
  await client.query(
    `INSERT INTO auth_tokens (id, user_id, purpose, token_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5);`,
    [
      crypto.randomUUID(),
      userId,
      purpose,
      hashToken(rawToken),
      new Date(Date.now() + TOKEN_TTL_MS[purpose]),
    ]
  );
  return rawToken;
}

/** Atomically consumes a valid token and returns its user id, or null if invalid/expired/used. */
export async function consumeToken(
  client: PoolClient,
  rawToken: string,
  purpose: TokenPurpose
): Promise<string | null> {
  if (!rawToken || rawToken.length < 20 || rawToken.length > 200) return null;
  const res = await client.query(
    `UPDATE auth_tokens SET consumed_at = CURRENT_TIMESTAMP
     WHERE token_hash = $1 AND purpose = $2 AND consumed_at IS NULL AND expires_at > CURRENT_TIMESTAMP
     RETURNING user_id;`,
    [hashToken(rawToken), purpose]
  );
  return (res.rows[0]?.user_id as string | undefined) ?? null;
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "organisation";
}

async function audit(
  client: PoolClient,
  entry: {
    tenantId: string;
    userId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    details?: Record<string, unknown>;
  },
  meta: RequestMeta
): Promise<void> {
  await client.query(
    `INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, ip_address, user_agent, new_state)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
    [
      entry.tenantId,
      entry.userId,
      entry.action,
      entry.entityType,
      entry.entityId,
      meta.ip ?? null,
      meta.userAgent ?? null,
      JSON.stringify(entry.details ?? {}),
    ]
  );
}

/** Runs `work` in a privileged transaction on a checked-out client. */
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

/** Sends an email without delaying the caller; delivery failures are logged by the mailer. */
function deliverInBackground(message: Parameters<typeof sendEmail>[0]): void {
  void sendEmail(message).catch((err) => {
    console.error("Background email delivery failed:", err instanceof Error ? err.message : err);
  });
}

function existingAccountNotice(email: string) {
  const base = publicBaseUrl();
  return existingAccountEmail(email, `${base}/login`, `${base}/forgot-password`);
}

export interface RegisterOrganizationInput {
  fullName: string;
  email: string;
  password: string;
  organizationName: string;
  industry?: string | null;
}

export interface RegistrationOutcome {
  emailDelivery: EmailDeliveryResult;
}

export async function registerOrganization(
  input: RegisterOrganizationInput,
  meta: RequestMeta = {}
): Promise<RegistrationOutcome> {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  const organizationName = input.organizationName.trim();

  const problem = describePasswordProblem(input.password, { email });
  if (problem) {
    throw new AccountError(`Password does not meet requirements: ${problem}`, "WEAK_PASSWORD", 400);
  }

  const existing = (
    await pool.query("SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1;", [email])
  ).rows[0];
  if (existing) {
    // Same outward behaviour as a new registration; the account owner is told by email instead.
    await consumePasswordVerificationTime(input.password);
    return { emailDelivery: await sendEmail(existingAccountNotice(email)) };
  }

  const passwordHash = await hashPassword(input.password);
  const tenantId = crypto.randomUUID();
  const userId = crypto.randomUUID();

  let rawToken: string;
  try {
    rawToken = await inTransaction(async (client) => {
      let slug = slugify(organizationName);
      const taken = await client.query("SELECT 1 FROM tenants WHERE slug = $1 LIMIT 1;", [slug]);
      if (taken.rows.length > 0) {
        slug = `${slug}-${crypto.randomBytes(3).toString("hex")}`;
      }

      await client.query(
        `INSERT INTO tenants (id, type, name, slug, industry, is_sdf, status, onboarding_completed_at)
         VALUES ($1, 'CLIENT', $2, $3, $4, FALSE, 'ACTIVE', NULL);`,
        [tenantId, organizationName, slug, input.industry?.trim() || null]
      );
      await client.query(
        `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active, email_verified_at)
         VALUES ($1, $2, $3, $4, $5, 'CLIENT_ADMIN', TRUE, NULL);`,
        [userId, tenantId, email, passwordHash, fullName]
      );
      const token = await issueToken(client, userId, "EMAIL_VERIFICATION");
      await audit(
        client,
        {
          tenantId,
          userId,
          action: "ORGANIZATION_REGISTERED",
          entityType: "tenants",
          entityId: tenantId,
          details: { slug, email },
        },
        meta
      );
      return token;
    });
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      // A concurrent registration claimed the email first; behave as for an existing account.
      return { emailDelivery: await sendEmail(existingAccountNotice(email)) };
    }
    throw err;
  }

  const url = `${publicBaseUrl()}/verify-email?token=${encodeURIComponent(rawToken)}`;
  return { emailDelivery: await sendEmail(verificationEmail(email, fullName, url)) };
}

export async function verifyEmail(rawToken: string, meta: RequestMeta = {}): Promise<{ email: string }> {
  const result = await inTransaction(async (client) => {
    const userId = await consumeToken(client, rawToken, "EMAIL_VERIFICATION");
    if (!userId) return null;
    const user = (
      await client.query(
        `UPDATE users SET email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP),
                          updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 RETURNING email, tenant_id;`,
        [userId]
      )
    ).rows[0];
    await audit(
      client,
      { tenantId: user.tenant_id, userId, action: "EMAIL_VERIFIED", entityType: "users", entityId: userId },
      meta
    );
    return { email: user.email as string };
  });
  if (!result) {
    throw new AccountError(
      "This verification link is invalid, expired or already used. Request a new one from the sign-in page.",
      "INVALID_TOKEN",
      400
    );
  }
  return result;
}

export async function resendVerification(emailInput: string): Promise<void> {
  const email = emailInput.trim().toLowerCase();
  const user = (
    await pool.query(
      `SELECT id, full_name FROM users
       WHERE LOWER(email) = $1 AND email_verified_at IS NULL AND is_active = TRUE LIMIT 1;`,
      [email]
    )
  ).rows[0];
  if (!user) return;

  const rawToken = await inTransaction((client) => issueToken(client, user.id, "EMAIL_VERIFICATION"));
  // Not awaited: the response time must not reveal whether an account exists.
  deliverInBackground(
    verificationEmail(
      email,
      user.full_name,
      `${publicBaseUrl()}/verify-email?token=${encodeURIComponent(rawToken)}`
    )
  );
}

export async function requestPasswordReset(emailInput: string, meta: RequestMeta = {}): Promise<void> {
  const email = emailInput.trim().toLowerCase();
  const user = (
    await pool.query(
      `SELECT u.id, u.full_name, u.tenant_id FROM users u JOIN tenants t ON t.id = u.tenant_id
       WHERE LOWER(u.email) = $1 AND u.is_active = TRUE AND t.status = 'ACTIVE' LIMIT 1;`,
      [email]
    )
  ).rows[0];
  if (!user) return;

  const rawToken = await inTransaction(async (client) => {
    const token = await issueToken(client, user.id, "PASSWORD_RESET");
    await audit(
      client,
      {
        tenantId: user.tenant_id,
        userId: user.id,
        action: "PASSWORD_RESET_REQUESTED",
        entityType: "users",
        entityId: user.id,
      },
      meta
    );
    return token;
  });
  // Not awaited: the response time must not reveal whether an account exists.
  deliverInBackground(
    passwordResetEmail(
      email,
      user.full_name,
      `${publicBaseUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`
    )
  );
}

export async function resetPassword(
  rawToken: string,
  newPassword: string,
  meta: RequestMeta = {}
): Promise<void> {
  const outcome = await inTransaction(async (client) => {
    const userId = await consumeToken(client, rawToken, "PASSWORD_RESET");
    if (!userId) {
      return { error: new AccountError("This password reset link is invalid, expired or already used.", "INVALID_TOKEN") };
    }
    const user = (
      await client.query(
        `SELECT u.email, u.full_name, u.tenant_id FROM users u JOIN tenants t ON t.id = u.tenant_id
         WHERE u.id = $1 AND u.is_active = TRUE AND t.status = 'ACTIVE';`,
        [userId]
      )
    ).rows[0];
    if (!user) {
      return { error: new AccountError("This password reset link is invalid, expired or already used.", "INVALID_TOKEN") };
    }
    const problem = describePasswordProblem(newPassword, { email: user.email });
    if (problem) {
      // Keep the token usable: throw so the transaction (including consumption) rolls back.
      throw new AccountError(`Password does not meet requirements: ${problem}`, "WEAK_PASSWORD");
    }
    await client.query(
      `UPDATE users
       SET password_hash = $1, session_version = session_version + 1,
           email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2;`,
      [await hashPassword(newPassword), userId]
    );
    await audit(
      client,
      {
        tenantId: user.tenant_id,
        userId,
        action: "PASSWORD_RESET_COMPLETED",
        entityType: "users",
        entityId: userId,
      },
      meta
    );
    return { email: user.email as string, fullName: user.full_name as string };
  });

  if ("error" in outcome) throw outcome.error;
  await sendEmail(passwordChangedEmail(outcome.email, outcome.fullName));
}

/** Revokes every session of a user (sign out everywhere). */
/**
 * Signs out one session: its id is recorded until the token would have expired, so a replayed
 * cookie is refused. Expired records are pruned on the way.
 */
export async function revokeSession(sessionUser: SessionUser): Promise<void> {
  if (!sessionUser.sessionId) return;
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();
  await inTransaction(async (client) => {
    await client.query("DELETE FROM revoked_sessions WHERE expires_at < $1;", [new Date().toISOString()]);
    await client.query(
      "INSERT INTO revoked_sessions (session_id, user_id, expires_at) VALUES ($1, $2, $3) ON CONFLICT (session_id) DO NOTHING;",
      [sessionUser.sessionId, sessionUser.userId, expiresAt]
    );
  });
}

export async function revokeAllSessions(userId: string, tenantId: string, meta: RequestMeta = {}): Promise<void> {
  await inTransaction(async (client) => {
    await client.query("UPDATE users SET session_version = session_version + 1 WHERE id = $1;", [userId]);
    await audit(
      client,
      { tenantId, userId, action: "SESSIONS_REVOKED", entityType: "users", entityId: userId },
      meta
    );
  });
}
