/**
 * TLI DPDP Compliance Gap Analysis Tool — Database Connection Pool
 *
 * Configures the PostgreSQL connection pool using 'pg'.
 * Uses parameterized queries and guarantees session cleanup to avoid context bleed.
 *
 * TLS:
 * - Cloud targets (sslmode=require, ssl=true, or *.neon.tech hosts) use TLS with full
 *   certificate verification. Neon and other managed providers present publicly trusted
 *   certificates, so verification never needs to be disabled for them.
 * - DATABASE_SSL_ALLOW_UNVERIFIED=true is an explicit, logged escape hatch for providers
 *   with self-signed certificates. It must never be set for Neon.
 *
 * Production never falls back to the local disposable test database URL.
 */

import { Pool } from "pg";
import type { PoolConfig } from "pg";

export const LOCAL_TEST_DATABASE_URL = "postgresql://postgres@127.0.0.1:54329/dpdp_test";

type PoolEnv = Record<string, string | undefined>;

export function resolveConnectionString(env: PoolEnv): string | undefined {
  if (env.DATABASE_URL) {
    return env.DATABASE_URL;
  }
  return env.NODE_ENV === "production" ? undefined : LOCAL_TEST_DATABASE_URL;
}

export function resolveSslConfig(
  connectionString: string | undefined,
  env: PoolEnv
): PoolConfig["ssl"] {
  if (!connectionString) {
    return undefined;
  }
  const requiresTls =
    connectionString.includes("sslmode=require") ||
    connectionString.includes("sslmode=verify-full") ||
    connectionString.includes("neon.tech") ||
    connectionString.includes("ssl=true");

  if (!requiresTls) {
    return undefined;
  }
  return { rejectUnauthorized: env.DATABASE_SSL_ALLOW_UNVERIFIED !== "true" };
}

const connectionString = resolveConnectionString(process.env);
const ssl = resolveSslConfig(connectionString, process.env);

if (!connectionString) {
  console.error(
    "DATABASE_URL is not configured in production. Database operations will fail until it is set."
  );
}
if (ssl && typeof ssl === "object" && ssl.rejectUnauthorized === false) {
  console.warn(
    "DATABASE_SSL_ALLOW_UNVERIFIED=true: database TLS certificate verification is disabled."
  );
}

const poolConfig: PoolConfig = {
  connectionString,
  ssl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

// Singleton pool instance for Next.js hot-reload safety
declare global {
  // eslint-disable-next-line no-var
  var __dpdp_db_pool: Pool | undefined;
}

export const pool = globalThis.__dpdp_db_pool || new Pool(poolConfig);

if (process.env.NODE_ENV !== "production") {
  globalThis.__dpdp_db_pool = pool;
}

pool.on("error", (err) => {
  console.error("Unexpected error on idle PostgreSQL client:", err.message);
});
