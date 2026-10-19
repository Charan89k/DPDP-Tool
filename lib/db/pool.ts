/**
 * CloudE5 — Database access entry point.
 *
 * CloudE5 stores all data in a local SQLite database (see lib/db/sqlite). This module keeps the
 * `pool` facade that application code imports; it mirrors the node-postgres API so queries,
 * transactions and results behave as before.
 *
 * Queries issued through `pool` directly run in the privileged system context (no tenant
 * policy filtering). Tenant-facing data access must go through executeWithRls() in rls.ts.
 */

export { pool, DatabaseBusyError } from "./sqlite/client.ts";
export type { PoolClient, QueryResult, Queryable } from "./sqlite/client.ts";
export { resolveDatabasePath, DatabaseConfigurationError } from "./sqlite/connection.ts";
