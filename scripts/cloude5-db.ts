/**
 * CloudE5 — Database operations CLI.
 *
 *   npm run db:migrate                  Create (first run) or upgrade the database; backs up before upgrading.
 *   npm run db:status                   Show applied and pending migrations.
 *   npm run db:verify                   Integrity check, foreign key check, migration checksums.
 *   npm run db:backup -- [file]         Online, consistent backup (default: <db dir>/backups/cloude5-<time>.db).
 *   npm run db:restore -- <file> --confirm
 *                                       Replace the database with a verified backup (stop the app first).
 *   npm run db:verify-email -- <email> --confirm
 *                                       Operator override: mark an address verified (when SMTP is unavailable).
 *   npm run db:reset-mfa -- <email> --confirm
 *                                       Operator override: remove two-factor for a locked-out user.
 *
 * The database path comes from CLOUDE5_DATABASE_PATH (required in production). Output never
 * contains secrets.
 */

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { applyPragmas, resolveDatabasePath } from "../lib/db/sqlite/connection.ts";
import {
  backupDatabase,
  checkIntegrity,
  getMigrationStatus,
  migrateDatabase,
  MigrationError,
} from "../lib/db/sqlite/migrate.ts";


function open(databasePath: string, create = false): Database.Database {
  if (!create && !fs.existsSync(databasePath)) {
    throw new Error(`No database found at ${databasePath}. Run "npm run db:migrate" first.`);
  }
  fs.mkdirSync(path.dirname(databasePath), { recursive: true, mode: 0o750 });
  const db = new Database(databasePath);
  applyPragmas(db);
  return db;
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function main(): Promise<number> {
  const [command, ...args] = process.argv.slice(2);
  const databasePath = resolveDatabasePath(process.env);

  switch (command) {
    case "migrate": {
      const isNew = !fs.existsSync(databasePath);
      const db = open(databasePath, true);
      try {
        const result = await migrateDatabase(db, databasePath);
        if (isNew) console.log(`Created new database at ${databasePath}`);
        if (result.backupPath) console.log(`Pre-migration backup: ${result.backupPath}`);
        console.log(
          result.applied.length > 0
            ? `Applied ${result.applied.length} migration(s): ${result.applied.join(", ")}`
            : "Database schema is up to date."
        );
      } finally {
        db.close();
      }
      return 0;
    }

    case "status": {
      const db = open(databasePath);
      try {
        const status = getMigrationStatus(db);
        for (const m of status.applied) console.log(`applied  ${m.name}  ${m.applied_at}`);
        for (const m of status.pending) console.log(`pending  ${m.name}`);
        for (const name of status.checksumMismatches) console.log(`MODIFIED ${name}`);
        for (const name of status.unknownApplied) console.log(`UNKNOWN  ${name}`);
        return status.pending.length === 0 && status.checksumMismatches.length === 0 ? 0 : 1;
      } finally {
        db.close();
      }
    }

    case "verify": {
      const db = open(databasePath);
      try {
        const report = checkIntegrity(db);
        const status = getMigrationStatus(db);
        console.log(
          JSON.stringify(
            {
              ...report,
              pendingMigrations: status.pending.length,
              checksumMismatches: status.checksumMismatches,
            },
            null,
            2
          )
        );
        const healthy =
          report.integrity === "ok" &&
          report.foreignKeyViolations === 0 &&
          status.pending.length === 0 &&
          status.checksumMismatches.length === 0;
        return healthy ? 0 : 1;
      } finally {
        db.close();
      }
    }

    case "backup": {
      const destination = path.resolve(
        args[0] || path.join(path.dirname(databasePath), "backups", `cloude5-${timestamp()}.db`)
      );
      const db = open(databasePath);
      try {
        await backupDatabase(db, destination);
        console.log(`Backup written and verified: ${destination}`);
      } finally {
        db.close();
      }
      return 0;
    }

    case "restore": {
      const source = args.find((a) => !a.startsWith("--"));
      if (!source || !args.includes("--confirm")) {
        console.error("Usage: npm run db:restore -- <backup-file> --confirm   (stop CloudE5 first)");
        return 2;
      }
      const sourcePath = path.resolve(source);
      const check = new Database(sourcePath, { readonly: true, fileMustExist: true });
      try {
        const integrity = String(check.pragma("integrity_check", { simple: true }));
        if (integrity !== "ok") throw new Error(`Backup failed integrity check: ${integrity}`);
      } finally {
        check.close();
      }
      if (fs.existsSync(databasePath)) {
        const safetyCopy = path.join(path.dirname(databasePath), "backups", `pre-restore-${timestamp()}.db`);
        const current = open(databasePath);
        try {
          await backupDatabase(current, safetyCopy);
        } finally {
          current.close();
        }
        console.log(`Current database preserved at ${safetyCopy}`);
      }
      for (const suffix of ["-wal", "-shm"]) fs.rmSync(`${databasePath}${suffix}`, { force: true });
      fs.copyFileSync(sourcePath, databasePath);
      console.log(
        `Restored ${sourcePath} -> ${databasePath}. Run "npm run db:migrate" if the backup predates this release.`
      );
      return 0;
    }

    case "verify-email": {
      // Operator override when email delivery is unavailable: confirm the address out of band first.
      const email = args.find((a) => !a.startsWith("--"))?.trim().toLowerCase();
      if (!email || !args.includes("--confirm")) {
        console.error(
          "Usage: npm run db:verify-email -- <email> --confirm   (confirm the address out of band first)"
        );
        return 2;
      }
      const db = open(databasePath);
      try {
        const user = db.prepare("SELECT id, tenant_id FROM users WHERE LOWER(email) = ?").get(email) as
          | { id: string; tenant_id: string }
          | undefined;
        if (!user) {
          console.error("No account with that email address.");
          return 1;
        }
        db.transaction(() => {
          db.prepare(
            "UPDATE users SET email_verified_at = COALESCE(email_verified_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) WHERE id = ?"
          ).run(user.id);
          db.prepare(
            `INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, new_state)
             VALUES (?, ?, 'EMAIL_VERIFIED_BY_OPERATOR', 'users', ?, '{}')`
          ).run(user.tenant_id, user.id, user.id);
        })();
        console.log(`Marked ${email} as verified.`);
      } finally {
        db.close();
      }
      return 0;
    }

    case "reset-mfa": {
      // Operator override for a user who lost both their authenticator and recovery codes.
      // Confirm the person's identity out of band first. Their sessions are revoked.
      const email = args.find((a) => !a.startsWith("--"))?.trim().toLowerCase();
      if (!email || !args.includes("--confirm")) {
        console.error("Usage: npm run db:reset-mfa -- <email> --confirm   (verify identity out of band first)");
        return 2;
      }
      const db = open(databasePath);
      try {
        const user = db.prepare("SELECT id, tenant_id FROM users WHERE LOWER(email) = ?").get(email) as
          | { id: string; tenant_id: string }
          | undefined;
        if (!user) {
          console.error("No account with that email address.");
          return 1;
        }
        db.transaction(() => {
          db.prepare(
            `UPDATE users SET mfa_enabled = 0, mfa_secret_encrypted = NULL, mfa_last_used_step = NULL,
                              session_version = session_version + 1 WHERE id = ?`
          ).run(user.id);
          db.prepare("DELETE FROM mfa_recovery_codes WHERE user_id = ?").run(user.id);
          db.prepare(
            `INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, new_state)
             VALUES (?, ?, 'MFA_RESET_BY_OPERATOR', 'users', ?, '{}')`
          ).run(user.tenant_id, user.id, user.id);
        })();
        console.log(`Two-factor authentication reset for ${email}; existing sessions were revoked.`);
      } finally {
        db.close();
      }
      return 0;
    }

    default:
      console.error(
        "Commands: migrate | status | verify | backup [file] | restore <file> --confirm | verify-email <email> --confirm | reset-mfa <email> --confirm"
      );
      return 2;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(
      err instanceof MigrationError ? `Migration error: ${err.message}` : `Error: ${err.message}`
    );
    process.exit(1);
  });
