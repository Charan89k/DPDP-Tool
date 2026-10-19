/**
 * CloudE5 — Session issuance shared by password sign-in and the MFA verification step.
 */

import { pool } from "../db/pool.ts";
import { createSessionToken, setSessionCookie } from "./session.ts";
import type { SessionUser, TenantType, UserRole } from "./types.ts";

/** Loads the session profile for an active user of an active tenant, or null. */
export async function loadSessionUser(userId: string): Promise<SessionUser | null> {
  const row = (
    await pool.query(
      `SELECT u.id, u.tenant_id, u.email, u.full_name, u.role, u.session_version,
              t.name AS tenant_name, t.slug AS tenant_slug, t.type AS tenant_type, t.is_sdf
       FROM users u JOIN tenants t ON t.id = u.tenant_id
       WHERE u.id = $1 AND u.is_active = TRUE AND t.status = 'ACTIVE' AND u.email_verified_at IS NOT NULL;`,
      [userId]
    )
  ).rows[0];
  if (!row) return null;
  return {
    userId: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role as UserRole,
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    tenantSlug: row.tenant_slug,
    tenantType: row.tenant_type as TenantType,
    isSdf: Boolean(row.is_sdf),
    sessionVersion: Number(row.session_version ?? 0),
  };
}

/** Issues the session cookie, records the sign-in and returns the profile sent to the client. */
export async function startSession(
  sessionUser: SessionUser,
  meta: { ip: string; userAgent: string; method: "PASSWORD" | "PASSWORD_AND_MFA" }
): Promise<SessionUser> {
  const token = await createSessionToken(sessionUser);
  try {
    await pool.query("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1;", [sessionUser.userId]);
    await pool.query(
      `INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, ip_address, user_agent, new_state)
       VALUES ($1, $2, 'USER_LOGIN', 'users', $2, $3, $4, $5);`,
      [
        sessionUser.tenantId,
        sessionUser.userId,
        meta.ip,
        meta.userAgent,
        JSON.stringify({ role: sessionUser.role, method: meta.method }),
      ]
    );
  } catch (err) {
    console.warn("Sign-in bookkeeping failed:", err instanceof Error ? err.message : err);
  }
  await setSessionCookie(token);
  return sessionUser;
}
