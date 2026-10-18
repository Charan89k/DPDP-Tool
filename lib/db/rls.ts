/**
 * CloudE5 — Tenant-scoped execution engine.
 *
 * Binds a unit of database work to a verified identity so the SQLite tenant policy layer
 * (lib/db/sqlite/policies.ts — the CloudE5 equivalent of PostgreSQL row-level security)
 * filters every read and checks every write.
 *
 * Guarantees:
 * 1. Runs inside one transaction with exclusive use of the connection (BEGIN / COMMIT / ROLLBACK).
 * 2. Re-verifies the session against current database records (account active, tenant active,
 *    role unchanged) before any tenant data is touched, defeating forged or stale tokens.
 * 3. Sets the policy context (tenant, user, role) only for the duration of the operation and always
 *    restores the previous context afterwards, including on error, so no request can inherit
 *    another request's identity.
 */

import { executeStatement, withConnection, withDefinerRights } from "./sqlite/client.ts";
import type { PoolClient, Queryable } from "./sqlite/client.ts";
import { GET_CONTEXT_SQL, SET_CONTEXT_SQL } from "./sqlite/policies.ts";
import type { SessionUser } from "../auth/types.ts";

export class DatabaseAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseAuthorizationError";
  }
}

/**
 * Validates that the provided session context contains mandatory identity fields.
 * Fails closed if any attribute is missing or empty.
 */
export function validateSessionContext(context: SessionUser): void {
  if (!context) {
    throw new DatabaseAuthorizationError("Authentication context is required for database access.");
  }
  if (!context.userId || typeof context.userId !== "string") {
    throw new DatabaseAuthorizationError("Invalid or missing userId in session context.");
  }
  if (!context.tenantId || typeof context.tenantId !== "string") {
    throw new DatabaseAuthorizationError("Invalid or missing tenantId in session context.");
  }
  if (!context.role || typeof context.role !== "string") {
    throw new DatabaseAuthorizationError("Invalid or missing role in session context.");
  }
}

export interface VerifiedDatabaseIdentity {
  id: string;
  role: string;
  tenantType: string;
}

/**
 * Re-verifies a signed session against current database records: the user must exist in the
 * claimed tenant, be active, belong to an ACTIVE tenant, and hold exactly the claimed role.
 *
 * Signed session tokens remain valid for up to 8 hours, so every privileged operation must call
 * this (directly or through executeWithRls) to honour deactivations and role changes immediately.
 * Safe to call on a privileged pool client or inside an RLS-scoped transaction.
 */
export async function assertSessionMatchesDatabase(
  client: Queryable,
  context: SessionUser
): Promise<VerifiedDatabaseIdentity> {
  validateSessionContext(context);

  const userCheck = await client.query(
    `SELECT u.id, u.role, u.is_active, u.session_version, t.status AS tenant_status, t.type AS tenant_type
     FROM users u
     JOIN tenants t ON t.id = u.tenant_id
     WHERE u.id = $1 AND u.tenant_id = $2;`,
    [context.userId, context.tenantId]
  );

  if (userCheck.rows.length === 0) {
    throw new DatabaseAuthorizationError(
      "Database identity verification failed: user account or tenant not found."
    );
  }

  const dbUser = userCheck.rows[0];

  if (!dbUser.is_active) {
    throw new DatabaseAuthorizationError(
      "Database identity verification failed: user account is deactivated."
    );
  }

  if (dbUser.tenant_status !== "ACTIVE") {
    throw new DatabaseAuthorizationError(
      "Database identity verification failed: organization account is inactive."
    );
  }

  if (dbUser.role !== context.role) {
    throw new DatabaseAuthorizationError(
      "Database identity verification failed: session role no longer matches the account role."
    );
  }

  if (Number(dbUser.session_version ?? 0) !== (context.sessionVersion ?? 0)) {
    throw new DatabaseAuthorizationError(
      "Database identity verification failed: this session has been signed out. Please sign in again."
    );
  }

  if (context.role === "TLI_SUPER_ADMIN" && dbUser.tenant_type !== "TLI") {
    throw new DatabaseAuthorizationError(
      "Database identity verification failed: TLI_SUPER_ADMIN must belong to the platform operator tenant."
    );
  }

  return { id: dbUser.id, role: dbUser.role, tenantType: dbUser.tenant_type };
}

/**
 * Executes a database operation within a tenant-scoped session bound to the trusted SessionUser.
 * Strictly verifies identity against current database records within an isolated transaction.
 */
export async function executeWithRls<T>(
  context: SessionUser,
  operation: (client: PoolClient) => Promise<T>
): Promise<T> {
  validateSessionContext(context);

  return withConnection(async (db, unit) => {
    const run = (sql: string, params?: readonly unknown[]) => executeStatement(db, unit, sql, params);
    const previous = db.prepare(GET_CONTEXT_SQL).get() as {
      tenant_id: string | null;
      user_id: string | null;
      role: string;
      bypass: number;
    };
    const restoreContext = () =>
      db
        .prepare("UPDATE temp._ctx SET tenant_id = ?, user_id = ?, role = ?, bypass = ?")
        .run(previous.tenant_id, previous.user_id, previous.role, previous.bypass);

    run("BEGIN;");
    try {
      // 1. Bind tenant and user (role stays empty until verified), then verify identity
      db.prepare(SET_CONTEXT_SQL).run(context.tenantId, context.userId, "");
      const dbUser = await assertSessionMatchesDatabase({ query: async (sql, params) => run(sql, params) }, context);

      // 2. Bind the verified role
      db.prepare(SET_CONTEXT_SQL).run(context.tenantId, context.userId, dbUser.role);

      // 3. Execute the caller's work inside the policy-filtered sandbox
      const client: PoolClient = {
        query: async (sql, params) => run(sql, params),
        release: () => undefined,
      };
      const result = await operation(client);

      run("COMMIT;");
      return result;
    } catch (err) {
      run("ROLLBACK;");
      throw err;
    } finally {
      restoreContext();
    }
  });
}

/**
 * Runs `work` with policy enforcement suspended inside the current tenant-scoped transaction,
 * then restores the caller's context. This is the SQLite equivalent of a PostgreSQL
 * SECURITY DEFINER function and must only wrap operations the calling service has already
 * authorized (currently: copying questionnaire responses into an authorized re-audit).
 */
export async function runWithDefinerRights<T>(_client: PoolClient, work: () => Promise<T>): Promise<T> {
  return withDefinerRights(work);
}
