/**
 * CloudE5 — Versioned SQLite migrations.
 *
 * - Migrations are the files in migrations/sqlite named NNNN_description.sql, applied in order.
 * - Each migration runs in its own transaction and is recorded in schema_migrations with its
 *   SHA-256 checksum. An applied migration whose file has changed is a hard error.
 * - Before migrating a database that already contains applied migrations, an online backup is
 *   written next to the database file so an upgrade can always be rolled back.
 * - Nothing here ever drops or recreates an existing database.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { SqliteDatabase } from "./connection.ts";

export const MIGRATIONS_DIR = path.resolve(
  process.env.CLOUDE5_MIGRATIONS_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "migrations", "sqlite")
);

export interface MigrationFile {
  version: string;
  name: string;
  checksum: string;
  sql: string;
}

export interface AppliedMigration {
  version: string;
  name: string;
  checksum: string;
  applied_at: string;
}

export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MigrationError";
  }
}

export function loadMigrationFiles(dir: string = MIGRATIONS_DIR): MigrationFile[] {
  return fs
    .readdirSync(dir)
    .filter((file) => /^\d{4}_[a-z0-9_]+\.sql$/.test(file))
    .sort()
    .map((file) => {
      const sql = fs.readFileSync(path.join(dir, file), "utf8");
      return {
        version: file.slice(0, 4),
        name: file.replace(/\.sql$/, ""),
        checksum: crypto.createHash("sha256").update(sql).digest("hex"),
        sql,
      };
    });
}

function ensureMigrationTable(db: SqliteDatabase): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    checksum TEXT NOT NULL,
    applied_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`);
}

export function getAppliedMigrations(db: SqliteDatabase): AppliedMigration[] {
  const exists = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
    .get();
  if (!exists) return [];
  return db
    .prepare("SELECT version, name, checksum, applied_at FROM main.schema_migrations ORDER BY version")
    .all() as AppliedMigration[];
}

export interface MigrationStatus {
  applied: AppliedMigration[];
  pending: MigrationFile[];
  checksumMismatches: string[];
  unknownApplied: string[];
}

export function getMigrationStatus(db: SqliteDatabase, files = loadMigrationFiles()): MigrationStatus {
  const applied = getAppliedMigrations(db);
  const appliedByVersion = new Map(applied.map((m) => [m.version, m]));
  const fileVersions = new Set(files.map((f) => f.version));
  return {
    applied,
    pending: files.filter((f) => !appliedByVersion.has(f.version)),
    checksumMismatches: files
      .filter((f) => appliedByVersion.has(f.version) && appliedByVersion.get(f.version)!.checksum !== f.checksum)
      .map((f) => f.name),
    unknownApplied: applied.filter((m) => !fileVersions.has(m.version)).map((m) => m.name),
  };
}

/**
 * Writes a consistent online backup of the database to `destination`, converts it to a single
 * self-contained file (rollback journal instead of WAL), verifies its integrity, and restricts it to
 * the owning OS user because backups contain all customer data.
 */
export async function backupDatabase(db: SqliteDatabase, destination: string): Promise<void> {
  fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o750 });
  // Create the file owner-only before any data is written, so no other local user can open it while
  // the copy is in progress. "wx" refuses an existing file or symlink rather than writing through it.
  try {
    fs.closeSync(fs.openSync(destination, "wx", 0o600));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST") {
      throw new MigrationError(`Backup destination already exists, choose a new file: ${destination}`);
    }
    throw err;
  }
  await db.backup(destination);
  const Database = db.constructor as typeof import("better-sqlite3");
  const copy = new Database(destination, { fileMustExist: true });
  try {
    copy.pragma("journal_mode = DELETE");
    const result = copy.pragma("integrity_check", { simple: true });
    if (result !== "ok") {
      throw new MigrationError(`Backup integrity check failed: ${String(result)}`);
    }
  } finally {
    copy.close();
  }
  for (const suffix of ["-wal", "-shm"]) {
    fs.rmSync(`${destination}${suffix}`, { force: true });
  }
  fs.chmodSync(destination, 0o600);
}

export interface MigrateResult {
  applied: string[];
  backupPath: string | null;
}

/** Applies all pending migrations. Refuses to run if applied history diverges from the files. */
export async function migrateDatabase(
  db: SqliteDatabase,
  databasePath: string,
  files = loadMigrationFiles()
): Promise<MigrateResult> {
  ensureMigrationTable(db);
  const status = getMigrationStatus(db, files);

  if (status.checksumMismatches.length > 0) {
    throw new MigrationError(
      `Applied migrations were modified after being applied: ${status.checksumMismatches.join(", ")}. ` +
        "Restore the original files; never edit an applied migration."
    );
  }
  if (status.unknownApplied.length > 0) {
    throw new MigrationError(
      `The database contains migrations unknown to this release: ${status.unknownApplied.join(", ")}. ` +
        "This database was upgraded by a newer CloudE5 version; do not downgrade."
    );
  }
  if (status.pending.length === 0) {
    return { applied: [], backupPath: null };
  }

  let backupPath: string | null = null;
  if (status.applied.length > 0 && databasePath !== ":memory:") {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    backupPath = path.join(path.dirname(databasePath), "backups", `pre-migration-${stamp}.db`);
    await backupDatabase(db, backupPath);
  }

  const record = db.prepare("INSERT INTO main.schema_migrations (version, name, checksum) VALUES (?, ?, ?)");
  const applied: string[] = [];
  for (const migration of status.pending) {
    const apply = db.transaction(() => {
      db.exec(migration.sql);
      record.run(migration.version, migration.name, migration.checksum);
    });
    try {
      apply();
    } catch (err) {
      throw new MigrationError(
        `Migration ${migration.name} failed and was rolled back: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    applied.push(migration.name);
  }

  const violations = db.pragma("foreign_key_check") as unknown[];
  if (violations.length > 0) {
    throw new MigrationError(`Foreign key check failed after migration (${violations.length} violations).`);
  }
  return { applied, backupPath };
}

export interface IntegrityReport {
  integrity: string;
  foreignKeyViolations: number;
  journalMode: string;
  foreignKeysEnabled: boolean;
}

export function checkIntegrity(db: SqliteDatabase): IntegrityReport {
  return {
    integrity: String(db.pragma("integrity_check", { simple: true })),
    foreignKeyViolations: (db.pragma("foreign_key_check") as unknown[]).length,
    journalMode: String(db.pragma("journal_mode", { simple: true })),
    foreignKeysEnabled: Number(db.pragma("foreign_keys", { simple: true })) === 1,
  };
}
