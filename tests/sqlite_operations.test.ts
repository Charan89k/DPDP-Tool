/**
 * CloudE5 — SQLite installation, upgrade and backup tests.
 *
 * Fresh install, upgrade of an existing database (with automatic pre-migration backup and data
 * preserved), refusal of modified or unknown migrations, backup integrity and permissions, and the
 * operations CLI restore path.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import Database from "better-sqlite3";
import { applyPragmas } from "../lib/db/sqlite/connection.ts";
import {
  backupDatabase,
  checkIntegrity,
  getMigrationStatus,
  loadMigrationFiles,
  migrateDatabase,
  MigrationError,
} from "../lib/db/sqlite/migrate.ts";

const ALL = loadMigrationFiles();
let workDir: string;

function freshDb(name: string) {
  const file = path.join(workDir, name);
  const db = new Database(file);
  applyPragmas(db);
  return { file, db };
}

describe("CloudE5 SQLite installation and upgrades", () => {
  before(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), "cloude5-ops-"));
  });
  after(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it("initialises a fresh installation with every migration and the canonical library", async () => {
    const { file, db } = freshDb("fresh.db");
    const result = await migrateDatabase(db, file);
    assert.deepEqual(result.applied, ALL.map((m) => m.name));
    assert.equal(result.backupPath, null, "Nothing to back up on a fresh install");
    assert.equal(Number((db.prepare("SELECT COUNT(*) AS n FROM controls").get() as { n: number }).n), 30);
    assert.equal(Number((db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n), 0, "No accounts are seeded");
    const report = checkIntegrity(db);
    assert.equal(report.integrity, "ok");
    assert.equal(report.foreignKeyViolations, 0);
    assert.equal(report.foreignKeysEnabled, true);
    assert.equal(report.journalMode, "wal");

    const again = await migrateDatabase(db, file);
    assert.deepEqual(again.applied, [], "Re-running migrations is a no-op");
    db.close();
  });

  it("upgrades an existing database, backs it up first, and preserves data", async () => {
    const { file, db } = freshDb("upgrade.db");
    await migrateDatabase(db, file, ALL.slice(0, 2));
    db.prepare(
      "INSERT INTO tenants (id, type, name, slug) VALUES ('00000000-0000-4000-8000-000000000001', 'CLIENT', 'Existing Org', 'existing-org')"
    ).run();

    const result = await migrateDatabase(db, file);
    assert.deepEqual(result.applied, ALL.slice(2).map((m) => m.name));
    assert.ok(result.backupPath && fs.existsSync(result.backupPath), "Pre-migration backup must exist");

    const tenant = db.prepare("SELECT name, onboarding_completed_at FROM tenants WHERE slug = 'existing-org'").get() as {
      name: string;
      onboarding_completed_at: string | null;
    };
    assert.equal(tenant.name, "Existing Org");
    assert.ok(tenant.onboarding_completed_at, "Existing organisations are treated as already onboarded");

    const backup = new Database(result.backupPath!, { readonly: true });
    assert.equal(getMigrationStatus(backup).applied.length, 2, "Backup reflects the pre-upgrade state");
    backup.close();
    db.close();
  });

  it("refuses to run when an applied migration file was modified", async () => {
    const { file, db } = freshDb("tampered.db");
    await migrateDatabase(db, file);
    const tampered = ALL.map((m, i) => (i === 0 ? { ...m, checksum: "0".repeat(64) } : m));
    await assert.rejects(migrateDatabase(db, file, tampered), (err: unknown) =>
      err instanceof MigrationError && /modified after being applied/.test(err.message)
    );
    db.close();
  });

  it("refuses to downgrade a database migrated by a newer release", async () => {
    const { file, db } = freshDb("newer.db");
    await migrateDatabase(db, file);
    await assert.rejects(migrateDatabase(db, file, ALL.slice(0, 2)), (err: unknown) =>
      err instanceof MigrationError && /newer CloudE5 version/.test(err.message)
    );
    db.close();
  });

  it("writes self-contained, owner-only, verified backups", async () => {
    const { file, db } = freshDb("source.db");
    await migrateDatabase(db, file);
    const target = path.join(workDir, "backups", "copy.db");
    await backupDatabase(db, target);
    assert.equal(fs.existsSync(`${target}-wal`), false);
    assert.equal(fs.statSync(target).mode & 0o777, 0o600);
    const copy = new Database(target, { readonly: true });
    assert.equal(copy.pragma("journal_mode", { simple: true }), "delete");
    assert.equal(copy.pragma("integrity_check", { simple: true }), "ok");
    copy.close();
    db.close();
  });

  it("restores a backup through the operations CLI and keeps a safety copy", () => {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      CLOUDE5_DATABASE_PATH: path.join(workDir, "cli", "cloude5.db"),
      NODE_ENV: "production",
    };
    const cli = (...args: string[]) =>
      execFileSync(process.execPath, ["--experimental-strip-types", "--disable-warning=ExperimentalWarning", "scripts/cloude5-db.ts", ...args], {
        env,
        encoding: "utf8",
      });

    cli("migrate");
    const backupFile = path.join(workDir, "cli-backup.db");
    cli("backup", backupFile);

    const live = new Database(env.CLOUDE5_DATABASE_PATH);
    live.prepare("INSERT INTO tenants (id, type, name, slug) VALUES ('00000000-0000-4000-8000-000000000002', 'CLIENT', 'After Backup', 'after-backup')").run();
    live.close();

    assert.throws(() => cli("restore", backupFile), "Restore requires --confirm");
    const output = cli("restore", backupFile, "--confirm");
    assert.match(output, /preserved at/);

    const restored = new Database(env.CLOUDE5_DATABASE_PATH, { readonly: true });
    const row = restored.prepare("SELECT 1 FROM tenants WHERE slug = 'after-backup'").get();
    restored.close();
    assert.equal(row, undefined, "Restored database reflects the backup");
    assert.ok(fs.readdirSync(path.join(workDir, "cli", "backups")).some((f) => f.startsWith("pre-restore-")));
  });
});
