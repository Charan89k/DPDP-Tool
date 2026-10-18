/**
 * CloudE5 — PostgreSQL to SQLite import tests.
 *
 * Value conversion is always tested. The end-to-end import runs only when CLOUDE5_TEST_PG_URL
 * points to a disposable, fully migrated PostgreSQL database (never production).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import Database from "better-sqlite3";
import { convertValue } from "../scripts/import-postgres.ts";

describe("PostgreSQL import", () => {
  it("converts PostgreSQL values to the CloudE5 SQLite representation", () => {
    assert.equal(convertValue(true, "boolean"), 1);
    assert.equal(convertValue(false, "boolean"), 0);
    assert.equal(
      convertValue(new Date("2026-10-18T07:51:05.641Z"), "timestamp with time zone"),
      "2026-10-18T07:51:05.641Z"
    );
    assert.equal(convertValue(new Date(2026, 11, 31), "date"), "2026-12-31");
    assert.equal(convertValue({ a: [1, 2] }, "jsonb"), '{"a":[1,2]}');
    assert.equal(convertValue(["IN", "SG"], "ARRAY"), '["IN","SG"]');
    assert.equal(convertValue("3.50", "numeric"), 3.5);
    assert.equal(convertValue(null, "jsonb"), null);
  });

  it(
    "imports a migrated PostgreSQL database with matching counts and intact relationships",
    { skip: !process.env.CLOUDE5_TEST_PG_URL && "set CLOUDE5_TEST_PG_URL to a disposable database" },
    () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cloude5-import-"));
      const target = path.join(dir, "imported.db");
      const reportPath = path.join(dir, "report.json");
      execFileSync(
        process.execPath,
        ["--experimental-strip-types", "--disable-warning=ExperimentalWarning", "scripts/import-postgres.ts", `--report=${reportPath}`],
        { env: { ...process.env, SOURCE_DATABASE_URL: process.env.CLOUDE5_TEST_PG_URL, CLOUDE5_DATABASE_PATH: target } }
      );
      const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
      assert.equal(report.integrity, "ok");
      assert.equal(report.foreignKeyViolations, 0);
      for (const [table, counts] of Object.entries(report.tables) as [string, { source: number; imported: number }][]) {
        assert.equal(counts.imported, counts.source, `${table} row count`);
      }
      const text = fs.readFileSync(reportPath, "utf8");
      assert.doesNotMatch(text, /postgres(ql)?:\/\/|\$2[aby]\$/, "Report must not contain URLs or password hashes");
      const db = new Database(target, { readonly: true });
      const unverified = db.prepare("SELECT COUNT(*) AS n FROM users WHERE email_verified_at IS NULL").get() as { n: number };
      assert.equal(Number(unverified.n), 0, "Imported administrator-provisioned accounts are verified");
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  );
});
