/**
 * TLI DPDP Compliance Gap Analysis Tool — Row-Level Security (RLS) Execution Engine
 *
 * Enforces PostgreSQL Row-Level Security policies by binding database sessions to
 * trusted server-side user and tenant contexts.
 *
 * Security Guarantees:
 * 1. Executes strictly under the least-privilege role 'dpdp_app_user' (NOSUPERUSER, NOBYPASSRLS).
 * 2. Operates within an isolated transaction boundary (BEGIN / COMMIT / ROLLBACK).
 * 3. Sets transaction-local context variables (is_local = true):
 *    - app.current_tenant_id
 *    - app.current_user_id
 *    - app.current_user_role
 * 4. Validates caller identity against current database records (users & tenants)
 *    to prevent client-side or JWT role/tenant forgery, and rejects deactivated accounts.
 * 5. Guarantees transaction rollback on error and systematically neutralizes session GUCs
 *    (RESET ALL, RESET ROLE, DISCARD TEMP) before pool release.
 * 6. Discards corrupted connections on cleanup failure to eliminate connection reuse context bleed.
 */

import type { PoolClient } from "pg";
import { pool } from "./pool.ts";
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

/**
 * Executes a database operation within an RLS-hardened session bound to the trusted SessionUser.
 * Strictly verifies identity against current database records within an isolated transaction.
 */
export async function executeWithRls<T>(
  context: SessionUser,
  operation: (client: PoolClient) => Promise<T>
): Promise<T> {
  validateSessionContext(context);

  const client = await pool.connect();
  let transactionActive = false;
  let connectionTainted = false;

  try {
    // 1. Begin isolated transaction
    await client.query("BEGIN;");
    transactionActive = true;

    // 2. Switch to least-privilege runtime role strictly within this transaction
    await client.query("SET LOCAL ROLE dpdp_app_user;");

    // 3. Set transaction-local tenant context variables (is_local = true)
    await client.query("SELECT set_config('app.current_tenant_id', $1, true);", [
      context.tenantId,
    ]);
    await client.query("SELECT set_config('app.current_user_id', $1, true);", [
      context.userId,
    ]);

    // 4. Verify identity against current database records to prevent role or tenant forgery
    const verifySql = `
      SELECT u.id, u.role, u.is_active, t.status AS tenant_status, t.type AS tenant_type
      FROM users u
      JOIN tenants t ON t.id = u.tenant_id
      WHERE u.id = $1 AND u.tenant_id = $2;
    `;
    const userCheck = await client.query(verifySql, [
      context.userId,
      context.tenantId,
    ]);

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
        `Database identity verification failed: role mismatch. Claimed '${context.role}', actual '${dbUser.role}'.`
      );
    }

    if (context.role === "TLI_SUPER_ADMIN" && dbUser.tenant_type !== "TLI") {
      throw new DatabaseAuthorizationError(
        "Database identity verification failed: TLI_SUPER_ADMIN must belong to a TLI advisory tenant."
      );
    }

    // 5. Bind transaction-local verified user role (is_local = true)
    await client.query("SELECT set_config('app.current_user_role', $1, true);", [
      dbUser.role,
    ]);

    // 6. Execute caller's query within the RLS-filtered sandbox
    const result = await operation(client);

    // 7. Commit transaction
    await client.query("COMMIT;");
    transactionActive = false;

    return result;
  } catch (err) {
    if (transactionActive) {
      try {
        await client.query("ROLLBACK;");
        transactionActive = false;
      } catch (rollbackErr) {
        console.error("Failed to rollback transaction after error:", rollbackErr);
        connectionTainted = true;
      }
    }
    throw err;
  } finally {
    // 8. Systematically neutralize context variables and reset role before pool return.
    // Ordering: RESET ROLE first (restores pool session authority), then RESET ALL (clears GUCs), then DISCARD TEMP.
    if (connectionTainted) {
      client.release(new Error("Connection released in tainted state due to rollback failure"));
    } else {
      try {
        await client.query("RESET ROLE;");
        await client.query("RESET ALL;");
        await client.query("DISCARD TEMP;");
        client.release();
      } catch (cleanErr) {
        console.error("Failed to clean up RLS session context on client release:", cleanErr);
        // Discard contaminated connection from the pool
        client.release(cleanErr instanceof Error ? cleanErr : new Error(String(cleanErr)));
      }
    }
  }
}
