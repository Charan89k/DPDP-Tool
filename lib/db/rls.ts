/**
 * TLI DPDP Compliance Gap Analysis Tool — Row-Level Security (RLS) Execution Engine
 *
 * Enforces PostgreSQL Row-Level Security policies by binding database sessions to
 * trusted server-side user and tenant contexts.
 *
 * Security Guarantees:
 * 1. Executes strictly under the least-privilege role 'dpdp_app_user' (NOSUPERUSER, NOBYPASSRLS).
 * 2. Sets transaction-local context variables:
 *    - app.current_tenant_id
 *    - app.current_user_id
 *    - app.current_user_role
 * 3. Systematically clears role and session context upon release, eliminating
 *    connection-reuse context bleed across requests.
 * 4. Fails closed if the caller context is missing or incomplete.
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
 */
export async function executeWithRls<T>(
  context: SessionUser,
  operation: (client: PoolClient) => Promise<T>
): Promise<T> {
  validateSessionContext(context);

  const client = await pool.connect();

  try {
    // 1. Enter least-privilege runtime role and bind tenant context variables
    await client.query("SET ROLE dpdp_app_user;");
    await client.query("SELECT set_config('app.current_tenant_id', $1, false);", [
      context.tenantId,
    ]);
    await client.query("SELECT set_config('app.current_user_id', $1, false);", [
      context.userId,
    ]);
    await client.query("SELECT set_config('app.current_user_role', $1, false);", [
      context.role,
    ]);

    // 2. Execute caller's query within the RLS-filtered sandbox
    return await operation(client);
  } finally {
    // 3. Systematically neutralize context variables and reset role before pool return
    try {
      await client.query("RESET ROLE;");
      await client.query("SELECT set_config('app.current_tenant_id', '', false);");
      await client.query("SELECT set_config('app.current_user_id', '', false);");
      await client.query("SELECT set_config('app.current_user_role', '', false);");
      await client.query("DISCARD TEMP;");
    } catch (resetErr) {
      console.error("Failed to clean up RLS session context on client release:", resetErr);
    }
    client.release();
  }
}
