/**
 * Builds the template database used by the automated test suite:
 * all SQLite migrations plus the synthetic fixture tenants, users and assessments.
 * Each test process works on its own copy (see CLOUDE5_TEST_DATABASE_TEMPLATE in connection.ts).
 */

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { applyPragmas } from "../lib/db/sqlite/connection.ts";
import { migrateDatabase } from "../lib/db/sqlite/migrate.ts";

const TEMPLATE = path.resolve(process.cwd(), ".test-db", "template.db");

fs.mkdirSync(path.dirname(TEMPLATE), { recursive: true });
for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(`${TEMPLATE}${suffix}`, { force: true });

const db = new Database(TEMPLATE);
applyPragmas(db);
await migrateDatabase(db, TEMPLATE);
db.transaction(() => {
  db.exec(fs.readFileSync(path.resolve(process.cwd(), "tests", "fixtures", "synthetic_seed.sql"), "utf8"));
  // Fixture accounts represent administrator-provisioned users, which are verified on creation.
  db.exec("UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL");
})();
db.pragma("wal_checkpoint(TRUNCATE)");
db.pragma("journal_mode = DELETE");
db.close();
console.log(`Test template database ready: ${TEMPLATE}`);
