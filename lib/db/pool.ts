/**
 * TLI DPDP Compliance Gap Analysis Tool — Database Connection Pool
 *
 * Configures the PostgreSQL connection pool using 'pg'.
 * Uses parameterized queries and guarantees session cleanup to avoid context bleed.
 */

import { Pool } from "pg";
import type { PoolConfig } from "pg";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres@127.0.0.1:54329/dpdp_test";

const isSsl =
  connectionString.includes("sslmode=require") ||
  connectionString.includes("neon.tech") ||
  connectionString.includes("ssl=true");

const poolConfig: PoolConfig = {
  connectionString,
  ssl: isSsl ? { rejectUnauthorized: false } : undefined,
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
