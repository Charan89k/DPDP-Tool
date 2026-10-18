/**
 * CloudE5 — Health and readiness checks.
 *
 * Liveness (/api/health): the process is up and can execute a query on the database.
 * Readiness (/api/ready): the database is reachable with every migration applied, the evidence
 * vault directory is writable, and production configuration is present. Responses name the failing
 * check but never include paths, connection details or secret values.
 */

import fs from "node:fs";
import path from "node:path";
import { pool } from "../db/pool.ts";
import { getDatabase } from "../db/sqlite/connection.ts";
import { getMigrationStatus } from "../db/sqlite/migrate.ts";
import { isSmtpConfigured } from "../email/mailer.ts";
import { resolveEvidenceDirSetting } from "../storage/local_adapter.ts";

export interface CheckResult {
  name: string;
  ok: boolean;
  detail?: string;
}

export async function checkDatabase(): Promise<CheckResult> {
  try {
    await pool.query("SELECT 1 AS ok;");
    return { name: "database", ok: true };
  } catch (err) {
    console.error("Readiness: database check failed:", err instanceof Error ? err.message : err);
    return { name: "database", ok: false, detail: "Database is not reachable or not initialised." };
  }
}

export function checkMigrations(): CheckResult {
  try {
    const status = getMigrationStatus(getDatabase());
    if (status.pending.length > 0 || status.checksumMismatches.length > 0) {
      return { name: "migrations", ok: false, detail: "Database schema is not up to date." };
    }
    return { name: "migrations", ok: true };
  } catch {
    return { name: "migrations", ok: false, detail: "Migration status could not be read." };
  }
}

export function checkEvidenceStorage(env: Record<string, string | undefined> = process.env): CheckResult {
  const dir = path.resolve(resolveEvidenceDirSetting(env) || path.join(/*turbopackIgnore: true*/ process.cwd(), ".local_evidence"));
  try {
    fs.mkdirSync(dir, { recursive: true, mode: 0o750 });
    fs.accessSync(dir, fs.constants.W_OK);
    return { name: "evidence_storage", ok: true };
  } catch {
    return { name: "evidence_storage", ok: false, detail: "Evidence storage directory is not writable." };
  }
}

export function checkConfiguration(env: Record<string, string | undefined> = process.env): CheckResult {
  if (env.NODE_ENV !== "production") return { name: "configuration", ok: true };
  const missing = ["SESSION_SECRET", "CLOUDE5_DATABASE_PATH", "CLOUDE5_PUBLIC_URL"].filter((key) => !env[key]);
  if (missing.length > 0) {
    return { name: "configuration", ok: false, detail: `Missing required settings: ${missing.join(", ")}.` };
  }
  if (!isSmtpConfigured(env)) {
    // Registration, verification, password reset and invitations all depend on email.
    return { name: "configuration", ok: false, detail: "SMTP is not configured: account emails cannot be delivered." };
  }
  return { name: "configuration", ok: true };
}

export async function runReadinessChecks(): Promise<{ ready: boolean; checks: CheckResult[] }> {
  const database = await checkDatabase();
  const checks = [
    database,
    database.ok ? checkMigrations() : { name: "migrations", ok: false, detail: "Skipped: database unavailable." },
    checkEvidenceStorage(),
    checkConfiguration(),
  ];
  return { ready: checks.every((c) => c.ok), checks };
}
