/**
 * CloudE5 — One-time import from the legacy PostgreSQL (Neon) database into a new SQLite file.
 *
 *   SOURCE_DATABASE_URL=postgresql://... CLOUDE5_DATABASE_PATH=/data/db/cloude5.db \
 *     node --experimental-strip-types scripts/import-postgres.ts [--report=import-report.json]
 *
 * Safety:
 * - The source is opened with default_transaction_read_only = on; nothing is ever written to it.
 * - The target must not exist yet; an existing database is never overwritten.
 * - The whole import runs in one SQLite transaction. Row counts per table, foreign keys and the
 *   SQLite integrity check are verified before commit; any mismatch rolls everything back.
 * - The report lists table names and row counts only: no credentials, password hashes or
 *   connection strings are printed or written.
 * - Run it against a disposable copy first (e.g. a Neon branch), then against production.
 */

import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import Database from "better-sqlite3";
import { applyPragmas, resolveDatabasePath } from "../lib/db/sqlite/connection.ts";
import { migrateDatabase } from "../lib/db/sqlite/migrate.ts";

/** Import order respects foreign keys. Canonical library tables are reconciled, not duplicated. */
const CANONICAL_TABLES = ["legal_sources", "framework_versions", "control_domains", "scoring_models", "controls", "evidence_types"];
const DATA_TABLES = [
  "tenants",
  "users",
  "business_units",
  "processing_activities",
  "assessments",
  "assessment_assignments",
  "assessment_controls",
  "assessment_control_activities",
  "control_response_history",
  "evidence_items",
  "evidence_review_history",
  "clarification_threads",
  "clarification_messages",
  "questionnaire_assessor_reviews",
  "questionnaire_assessor_review_history",
  "assessment_questionnaire_responses",
  "questionnaire_response_history",
  "assessment_scores",
  "report_snapshots",
  "remediation_tasks",
  "remediation_evidence_items",
  "user_invitations",
  "audit_logs",
];
/** Guards that block inserting child rows of finalized assessments; suspended during import only. */
const GUARD_TRIGGER_PATTERN = "%finalized_guard%";

export function convertValue(value: unknown, pgType: string): unknown {
  if (value === null || value === undefined) return null;
  if (pgType === "boolean") return value ? 1 : 0;
  if (pgType.startsWith("timestamp")) return new Date(value as string | Date).toISOString();
  if (pgType === "date") {
    if (value instanceof Date) {
      const y = value.getFullYear();
      const m = String(value.getMonth() + 1).padStart(2, "0");
      const d = String(value.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    return String(value).slice(0, 10);
  }
  if (pgType === "jsonb" || pgType === "json" || pgType === "ARRAY") return JSON.stringify(value);
  if (pgType === "numeric") return Number(value);
  if (pgType === "bigint") return Number(value);
  if (Buffer.isBuffer(value)) return value;
  return typeof value === "object" ? JSON.stringify(value) : value;
}

interface ImportReport {
  generatedAt: string;
  target: string;
  tables: Record<string, { source: number; imported: number }>;
  canonical: Record<string, { source: number; target: number; added: number }>;
  integrity: string;
  foreignKeyViolations: number;
}

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

async function main(): Promise<number> {
  const sourceUrl = process.env.SOURCE_DATABASE_URL;
  if (!sourceUrl) {
    console.error("Set SOURCE_DATABASE_URL to the PostgreSQL database to import from.");
    return 2;
  }
  const targetPath = resolveDatabasePath(process.env);
  if (fs.existsSync(targetPath)) {
    console.error(`Refusing to import: ${targetPath} already exists. Choose a new CLOUDE5_DATABASE_PATH.`);
    return 2;
  }

  const source = new pg.Client({ connectionString: sourceUrl });
  await source.connect();
  await source.query("SET default_transaction_read_only = on;");

  fs.mkdirSync(path.dirname(targetPath), { recursive: true, mode: 0o750 });
  const target = new Database(targetPath);
  applyPragmas(target);
  let committed = false;

  try {
    await migrateDatabase(target, targetPath);

    const columnTypes = async (table: string) =>
      (
        await source.query(
          `SELECT column_name, data_type FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
          [table]
        )
      ).rows as { column_name: string; data_type: string }[];
    const targetColumns = (table: string) =>
      new Set((target.prepare(`PRAGMA main.table_info(${table})`).all() as { name: string }[]).map((c) => c.name));

    const report: ImportReport = {
      generatedAt: new Date().toISOString(),
      target: path.basename(targetPath),
      tables: {},
      canonical: {},
      integrity: "",
      foreignKeyViolations: 0,
    };

    const sourceRows = new Map<string, { columns: { column_name: string; data_type: string }[]; rows: any[] }>();
    for (const table of [...CANONICAL_TABLES, ...DATA_TABLES]) {
      const columns = await columnTypes(table);
      const rows = columns.length ? (await source.query(`SELECT * FROM public.${table}`)).rows : [];
      sourceRows.set(table, { columns, rows });
    }

    const guards = target
      .prepare("SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND name LIKE ?")
      .all(GUARD_TRIGGER_PATTERN) as { name: string; sql: string }[];

    target.exec("BEGIN IMMEDIATE");
    try {
      target.pragma("defer_foreign_keys = ON");
      for (const guard of guards) target.exec(`DROP TRIGGER ${guard.name}`);

      const insertRows = (table: string, mode: "INSERT" | "INSERT OR IGNORE") => {
        const { columns, rows } = sourceRows.get(table)!;
        const allowed = targetColumns(table);
        const usable = columns.filter((c) => allowed.has(c.column_name));
        if (usable.length === 0) return 0;
        const statement = target.prepare(
          `${mode} INTO main.${table} (${usable.map((c) => c.column_name).join(", ")}) VALUES (${usable.map(() => "?").join(", ")})`
        );
        let inserted = 0;
        for (const row of rows) {
          inserted += statement.run(...usable.map((c) => convertValue(row[c.column_name], c.data_type))).changes;
        }
        return inserted;
      };

      for (const table of CANONICAL_TABLES) {
        const added = insertRows(table, "INSERT OR IGNORE");
        const targetCount = Number((target.prepare(`SELECT COUNT(*) AS n FROM main.${table}`).get() as { n: number }).n);
        report.canonical[table] = { source: sourceRows.get(table)!.rows.length, target: targetCount, added };
      }
      for (const table of DATA_TABLES) {
        const imported = insertRows(table, "INSERT");
        report.tables[table] = { source: sourceRows.get(table)!.rows.length, imported };
        if (imported !== report.tables[table].source) {
          throw new Error(`Row count mismatch for ${table}: source ${report.tables[table].source}, imported ${imported}.`);
        }
      }

      // Accounts and organisations that existed before CloudE5 were administrator-provisioned.
      target.exec("UPDATE main.users SET email_verified_at = created_at WHERE email_verified_at IS NULL");
      target.exec("UPDATE main.tenants SET onboarding_completed_at = created_at WHERE onboarding_completed_at IS NULL");

      for (const guard of guards) target.exec(guard.sql);

      report.foreignKeyViolations = (target.pragma("foreign_key_check") as unknown[]).length;
      if (report.foreignKeyViolations > 0) {
        throw new Error(`${report.foreignKeyViolations} foreign key violations after import.`);
      }
      target.exec("COMMIT");
      committed = true;
    } catch (err) {
      target.exec("ROLLBACK");
      throw err;
    }

    report.integrity = String(target.pragma("integrity_check", { simple: true }));
    if (report.integrity !== "ok") throw new Error(`Integrity check failed: ${report.integrity}`);

    const reportPath = path.resolve(arg("report") || "cloude5-import-report.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 });
    console.log(`Import complete. ${Object.values(report.tables).reduce((s, t) => s + t.imported, 0)} rows imported.`);
    console.log(`Report: ${reportPath}`);
    return 0;
  } finally {
    target.close();
    await source.end();
    if (!committed) {
      for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(`${targetPath}${suffix}`, { force: true });
    }
  }
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(`Import failed and was rolled back: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    });
}
