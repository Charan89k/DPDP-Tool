/**
 * CloudE5 — SQLite connection management.
 *
 * One process-wide connection is used for all requests. SQLite serializes writers anyway, and a
 * single connection lets the tenant policy context (temp._ctx, see policies.ts) live on the
 * connection itself. Concurrency is handled by the async lock in client.ts.
 *
 * Safety rules:
 * - The database location comes from CLOUDE5_DATABASE_PATH. In production it is required and the
 *   file must already exist (created by `npm run db:migrate`), so a missing or mis-mounted
 *   volume never silently produces a fresh empty database.
 * - Opening never creates or alters schema. Migrations are an explicit, separate step.
 * - Pragmas: WAL journaling, foreign keys ON, busy timeout, synchronous=NORMAL (durable in WAL
 *   mode across application crashes; the last commits can be lost only on power failure).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { buildPolicySql } from "./policies.ts";
import { getMigrationStatus } from "./migrate.ts";

export type SqliteDatabase = Database.Database;

export class DatabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConfigurationError";
  }
}

export const DEFAULT_DEV_DATABASE_PATH = path.resolve(/*turbopackIgnore: true*/ process.cwd(), ".cloude5", "cloude5.db");
const BUSY_TIMEOUT_MS = 5000;

type Env = Record<string, string | undefined>;

/** Resolves the configured database file path. */
export function resolveDatabasePath(env: Env = process.env): string {
  const configured = env.CLOUDE5_DATABASE_PATH?.trim();
  if (configured) {
    return path.resolve(configured);
  }
  if (env.NODE_ENV === "production") {
    throw new DatabaseConfigurationError(
      "CLOUDE5_DATABASE_PATH is not set. Production requires an explicit database file on persistent storage."
    );
  }
  return DEFAULT_DEV_DATABASE_PATH;
}

/**
 * Test isolation: when CLOUDE5_TEST_DATABASE_TEMPLATE is set, each process works on its own copy
 * of the prepared template database so parallel test files never share mutable state.
 */
function resolveTestCopy(env: Env): string | null {
  const template = env.CLOUDE5_TEST_DATABASE_TEMPLATE?.trim();
  if (!template) return null;
  const target = path.join(os.tmpdir(), `cloude5-test-${process.pid}-${Date.now()}.db`);
  fs.copyFileSync(template, target);
  process.on("exit", () => {
    for (const suffix of ["", "-wal", "-shm"]) {
      fs.rmSync(`${target}${suffix}`, { force: true });
    }
  });
  return target;
}

export interface OpenOptions {
  /** Allow creating a new database file (migration CLI only). */
  create?: boolean;
  /** Skip creation of per-connection tenant policy objects (migration CLI only). */
  withoutPolicies?: boolean;
}

/** Applies connection pragmas required for durability and integrity. */
export function applyPragmas(db: SqliteDatabase): void {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma(`busy_timeout = ${BUSY_TIMEOUT_MS}`);
  db.pragma("synchronous = NORMAL");
  db.pragma("temp_store = MEMORY");
}

export function openDatabase(filePath: string, options: OpenOptions = {}): SqliteDatabase {
  const exists = fs.existsSync(filePath);
  if (!exists && !options.create) {
    throw new DatabaseConfigurationError(
      `Database file not found at the configured path. Run "npm run db:migrate" to initialise a new installation, ` +
        `or check that the persistent volume is mounted.`
    );
  }
  if (!exists) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o750 });
  }

  const db = new Database(filePath, { fileMustExist: !options.create });
  applyPragmas(db);
  if (!options.withoutPolicies) {
    const status = getMigrationStatus(db);
    if (status.pending.length > 0 || status.checksumMismatches.length > 0) {
      db.close();
      throw new DatabaseConfigurationError(
        status.checksumMismatches.length > 0
          ? `Applied migrations differ from this release's files (${status.checksumMismatches.join(", ")}). ` +
              'Run "npm run db:verify" and restore the original migration files.'
          : `Database schema is not up to date (${status.pending.length} pending migration(s)). ` +
              'Run "npm run db:migrate" before starting CloudE5.'
      );
    }
    db.exec(buildPolicySql());
  }
  return db;
}

let sharedDatabase: SqliteDatabase | null = null;

/** Returns the process-wide application connection, opening it on first use. */
export function getDatabase(): SqliteDatabase {
  if (!sharedDatabase) {
    const filePath = resolveTestCopy(process.env) ?? resolveDatabasePath(process.env);
    sharedDatabase = openDatabase(filePath);
  }
  return sharedDatabase;
}

/** Closes the shared connection (tests and graceful shutdown). */
export function closeDatabase(): void {
  if (sharedDatabase) {
    sharedDatabase.close();
    sharedDatabase = null;
  }
}
