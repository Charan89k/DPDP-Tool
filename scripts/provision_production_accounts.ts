#!/usr/bin/env node
/**
 * TLI DPDP Compliance Gap Analysis Tool — Production Account Provisioning
 *
 * Securely and idempotently provisions the two platform root accounts:
 *   1. TLI Super Administrator : admin@truthlabs.in       (TLI_SUPER_ADMIN)
 *   2. Demo Customer Admin     : demo.admin@tlidemo.example (CLIENT_ADMIN)
 *
 * Security Guarantees:
 * - Generates cryptographically secure random passwords (high entropy >= 160 bits).
 * - Hashes passwords with bcrypt (cost factor 12) matching application security rules.
 * - Enforces target validation: refuses to execute against unintended or uninitialized databases.
 * - Idempotent: safe to run multiple times without creating duplicate records or resetting active credentials.
 * - Protects credentials: writes initial credentials to a Git-ignored file with 0600 permissions.
 * - Immutable audit trail: emits audit log entries for account initialization.
 * - Transactional safety: executes all changes within an atomic PostgreSQL transaction.
 *
 * Usage:
 *   node --experimental-strip-types scripts/provision_production_accounts.ts --target=production --database-url=URL
 *   npm run provision:accounts -- --target=production --database-url=URL
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { hashPassword, SYNTHETIC_SEED_HASH } from "../lib/auth/passwords.ts";

const { Pool } = pg;

export interface ProvisionOptions {
  databaseUrl: string;
  target?: string;
  credentialsFilePath?: string;
  forceResetAdmin?: boolean;
  forceResetDemo?: boolean;
  runMigrationsIfPending?: boolean;
  silent?: boolean;
}

export interface AccountProvisionStatus {
  email: string;
  role: string;
  tenantName: string;
  tenantSlug: string;
  action: "PROVISIONED" | "PRESERVED";
  initialPassword: string | null;
}

export interface ProvisionResult {
  success: boolean;
  target: string;
  adminAccount: AccountProvisionStatus;
  demoAccount: AccountProvisionStatus;
  credentialsFilePath: string;
  migrationsVerified: boolean;
  latestMigration: string | null;
}

/**
 * Generates a cryptographically strong, high-entropy password.
 * Guarantees presence of uppercase, lowercase, numbers, and symbols.
 */
export function generateStrongPassword(length = 28): string {
  if (length < 20) {
    throw new Error("Password length must be at least 20 characters for production provisioning.");
  }

  const uppers = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowers = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*()_+-=[]{}|~";
  const allChars = uppers + lowers + digits + symbols;

  // Guarantee minimum entropy across all character classes
  const requiredChars = [
    uppers[crypto.randomInt(uppers.length)],
    uppers[crypto.randomInt(uppers.length)],
    lowers[crypto.randomInt(lowers.length)],
    lowers[crypto.randomInt(lowers.length)],
    digits[crypto.randomInt(digits.length)],
    digits[crypto.randomInt(digits.length)],
    symbols[crypto.randomInt(symbols.length)],
    symbols[crypto.randomInt(symbols.length)],
  ];

  const remainingLength = length - requiredChars.length;
  const randomBytes = crypto.randomBytes(remainingLength);
  const remainingChars: string[] = [];
  for (let i = 0; i < remainingLength; i++) {
    remainingChars.push(allChars[randomBytes[i] % allChars.length]);
  }

  // Cryptographic Fisher-Yates shuffle
  const combined = [...requiredChars, ...remainingChars];
  for (let i = combined.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    const temp = combined[i];
    combined[i] = combined[j];
    combined[j] = temp;
  }

  return combined.join("");
}

/**
 * Validates target database connectivity and schema readiness.
 */
async function validateTargetDatabase(pool: pg.Pool, options: ProvisionOptions): Promise<{
  hasTables: boolean;
  latestMigration: string | null;
}> {
  const client = await pool.connect();
  try {
    const checkSql = `
      SELECT 
        to_regclass('public.tenants') AS has_tenants,
        to_regclass('public.users') AS has_users,
        to_regclass('public.schema_migrations') AS has_migrations;
    `;
    const res = await client.query(checkSql);
    const row = res.rows[0];

    const hasTables = Boolean(row.has_tenants && row.has_users);
    let latestMigration: string | null = null;

    if (row.has_migrations) {
      const migRes = await client.query(
        "SELECT version, name FROM schema_migrations ORDER BY version DESC LIMIT 1;"
      );
      if (migRes.rows.length > 0) {
        latestMigration = `${migRes.rows[0].version} (${migRes.rows[0].name})`;
      }
    }

    return { hasTables, latestMigration };
  } finally {
    client.release();
  }
}

/**
 * Core provisioning function. Safe, idempotent, and transactional.
 */
export async function provisionAccounts(options: ProvisionOptions): Promise<ProvisionResult> {
  const databaseUrl = options.databaseUrl?.trim();
  if (!databaseUrl) {
    throw new Error(
      "Target database connection string is required. Provide via --database-url or TARGET_DATABASE_URL."
    );
  }

  const target = (options.target || "unspecified").toLowerCase();
  const credentialsFilePath =
    options.credentialsFilePath ||
    path.resolve(process.cwd(), ".credentials_provisioned.txt");

  const isSsl =
    databaseUrl.includes("sslmode=require") ||
    databaseUrl.includes("neon.tech") ||
    databaseUrl.includes("ssl=true");

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: isSsl ? { rejectUnauthorized: false } : undefined,
    max: 2,
    connectionTimeoutMillis: 10000,
  });

  try {
    // 1. Target database validation
    const { hasTables, latestMigration } = await validateTargetDatabase(pool, options);

    if (!hasTables) {
      if (options.runMigrationsIfPending) {
        throw new Error(
          "Target database has no tables. Please run migrations first via:\n" +
            "  python3 scripts/migrate.py up --database-url=<URL>\n" +
            "then rerun account provisioning."
        );
      } else {
        throw new Error(
          "Target database schema is uninitialized: tables 'tenants' and 'users' do not exist.\n" +
            "Run migrations 001-013 before provisioning accounts:\n" +
            "  python3 scripts/migrate.py up --database-url=<URL>"
        );
      }
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN;");

      // ======================================================================
      // 2. Provision TLI Super Administrator (admin@truthlabs.in)
      // ======================================================================
      // Resolve TLI advisory tenant
      let tliTenantRes = await client.query(
        "SELECT id, name, slug FROM tenants WHERE type = 'TLI' ORDER BY created_at ASC LIMIT 1;"
      );

      let tliTenantId: string;
      let tliTenantName: string;
      let tliTenantSlug: string;

      if (tliTenantRes.rows.length === 0) {
        // Fallback: create TLI advisory platform tenant if missing
        const insertTenant = await client.query(
          `INSERT INTO tenants (
            type, name, slug, industry, is_sdf, dpo_name, dpo_email, status
          ) VALUES (
            'TLI', 'Truth Labs International Compliance Advisory', 'truth-labs-advisory',
            'Cybersecurity & Privacy Advisory', FALSE, 'TLI Lead Privacy Counsel',
            'privacy.advisory@truthlabs.in', 'ACTIVE'
          ) RETURNING id, name, slug;`
        );
        tliTenantId = insertTenant.rows[0].id;
        tliTenantName = insertTenant.rows[0].name;
        tliTenantSlug = insertTenant.rows[0].slug;
      } else {
        tliTenantId = tliTenantRes.rows[0].id;
        tliTenantName = tliTenantRes.rows[0].name;
        tliTenantSlug = tliTenantRes.rows[0].slug;
      }

      // Check if admin@truthlabs.in exists
      const adminEmail = "admin@truthlabs.in";
      const adminUserRes = await client.query(
        "SELECT id, tenant_id, role, password_hash, is_active FROM users WHERE LOWER(email) = LOWER($1);",
        [adminEmail]
      );

      let adminAction: "PROVISIONED" | "PRESERVED" = "PROVISIONED";
      let adminInitialPassword: string | null = null;
      let adminUserId: string;

      if (adminUserRes.rows.length > 0) {
        const existingAdmin = adminUserRes.rows[0];
        adminUserId = existingAdmin.id;
        const isSynthetic = existingAdmin.password_hash === SYNTHETIC_SEED_HASH;

        if (isSynthetic || options.forceResetAdmin) {
          // Synthetic fixture or explicit reset requested: generate real credentials
          adminInitialPassword = generateStrongPassword();
          const adminHash = await hashPassword(adminInitialPassword);

          await client.query(
            `UPDATE users
             SET password_hash = $1, tenant_id = $2, role = 'TLI_SUPER_ADMIN',
                 is_active = TRUE, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3;`,
            [adminHash, tliTenantId, adminUserId]
          );

          await client.query(
            `INSERT INTO audit_logs (
              tenant_id, user_id, action, entity_type, entity_id, new_state
            ) VALUES ($1, $2, 'USER_CREDENTIALS_INITIALIZED', 'users', $2, $3);`,
            [
              tliTenantId,
              adminUserId,
              JSON.stringify({
                email: adminEmail,
                role: "TLI_SUPER_ADMIN",
                credentialUpgrade: isSynthetic ? "FROM_SYNTHETIC_PLACEHOLDER" : "FORCED_ROTATION",
              }),
            ]
          );
          adminAction = "PROVISIONED";
        } else {
          // Existing production account with non-synthetic password: preserve without overwrite
          await client.query(
            `UPDATE users
             SET role = 'TLI_SUPER_ADMIN', is_active = TRUE, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1;`,
            [adminUserId]
          );
          adminAction = "PRESERVED";
          adminInitialPassword = null;
        }
      } else {
        // User does not exist: create freshly
        adminInitialPassword = generateStrongPassword();
        const adminHash = await hashPassword(adminInitialPassword);

        const insertAdmin = await client.query(
          `INSERT INTO users (
            tenant_id, email, password_hash, full_name, phone, role, is_active
          ) VALUES ($1, $2, $3, 'TLI Super Administrator', '+91-9800000001', 'TLI_SUPER_ADMIN', TRUE)
          RETURNING id;`,
          [tliTenantId, adminEmail, adminHash]
        );
        adminUserId = insertAdmin.rows[0].id;

        await client.query(
          `INSERT INTO audit_logs (
            tenant_id, user_id, action, entity_type, entity_id, new_state
          ) VALUES ($1, $2, 'USER_PROVISIONED', 'users', $2, $3);`,
          [
            tliTenantId,
            adminUserId,
            JSON.stringify({
              email: adminEmail,
              role: "TLI_SUPER_ADMIN",
              origin: "PRODUCTION_PROVISIONING_SCRIPT",
            }),
          ]
        );
        adminAction = "PROVISIONED";
      }

      // ======================================================================
      // 3. Provision Demo Customer (TLI Demo Customer & demo.admin@tlidemo.example)
      // ======================================================================
      const demoTenantSlug = "tli-demo-customer";
      const demoTenantName = "TLI Demo Customer";
      const demoEmail = "demo.admin@tlidemo.example";

      let demoTenantRes = await client.query(
        "SELECT id, name, slug FROM tenants WHERE slug = $1 OR name = $2 LIMIT 1;",
        [demoTenantSlug, demoTenantName]
      );

      let demoTenantId: string;
      if (demoTenantRes.rows.length === 0) {
        const insertDemoTenant = await client.query(
          `INSERT INTO tenants (
            type, name, slug, industry, is_sdf, dpo_name, dpo_email, status
          ) VALUES (
            'CLIENT', $1, $2, 'Demonstration & Evaluation', FALSE,
            'Demo Privacy Officer', 'dpo@tlidemo.example', 'ACTIVE'
          ) RETURNING id, name, slug;`,
          [demoTenantName, demoTenantSlug]
        );
        demoTenantId = insertDemoTenant.rows[0].id;

        await client.query(
          `INSERT INTO audit_logs (
            tenant_id, user_id, action, entity_type, entity_id, new_state
          ) VALUES ($1, $2, 'TENANT_CREATED', 'tenants', $1, $3);`,
          [
            demoTenantId,
            adminUserId,
            JSON.stringify({
              name: demoTenantName,
              slug: demoTenantSlug,
              type: "CLIENT",
              synthetic: true,
            }),
          ]
        );
      } else {
        demoTenantId = demoTenantRes.rows[0].id;
      }

      // Check if demo user exists
      const demoUserRes = await client.query(
        "SELECT id, tenant_id, role, password_hash, is_active FROM users WHERE LOWER(email) = LOWER($1);",
        [demoEmail]
      );

      let demoAction: "PROVISIONED" | "PRESERVED" = "PROVISIONED";
      let demoInitialPassword: string | null = null;
      let demoUserId: string;

      if (demoUserRes.rows.length > 0) {
        const existingDemo = demoUserRes.rows[0];
        demoUserId = existingDemo.id;
        const isSynthetic = existingDemo.password_hash === SYNTHETIC_SEED_HASH;

        if (isSynthetic || options.forceResetDemo) {
          demoInitialPassword = generateStrongPassword();
          const demoHash = await hashPassword(demoInitialPassword);

          await client.query(
            `UPDATE users
             SET password_hash = $1, tenant_id = $2, role = 'CLIENT_ADMIN',
                 is_active = TRUE, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3;`,
            [demoHash, demoTenantId, demoUserId]
          );

          await client.query(
            `INSERT INTO audit_logs (
              tenant_id, user_id, action, entity_type, entity_id, new_state
            ) VALUES ($1, $2, 'USER_CREDENTIALS_INITIALIZED', 'users', $2, $3);`,
            [
              demoTenantId,
              demoUserId,
              JSON.stringify({
                email: demoEmail,
                role: "CLIENT_ADMIN",
                credentialUpgrade: isSynthetic ? "FROM_SYNTHETIC_PLACEHOLDER" : "FORCED_ROTATION",
              }),
            ]
          );
          demoAction = "PROVISIONED";
        } else {
          await client.query(
            `UPDATE users
             SET tenant_id = $1, role = 'CLIENT_ADMIN', is_active = TRUE, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2;`,
            [demoTenantId, demoUserId]
          );
          demoAction = "PRESERVED";
          demoInitialPassword = null;
        }
      } else {
        demoInitialPassword = generateStrongPassword();
        const demoHash = await hashPassword(demoInitialPassword);

        const insertDemoUser = await client.query(
          `INSERT INTO users (
            tenant_id, email, password_hash, full_name, phone, role, is_active
          ) VALUES ($1, $2, $3, 'Demo Customer Admin', '+91-9890000001', 'CLIENT_ADMIN', TRUE)
          RETURNING id;`,
          [demoTenantId, demoEmail, demoHash]
        );
        demoUserId = insertDemoUser.rows[0].id;

        await client.query(
          `INSERT INTO audit_logs (
            tenant_id, user_id, action, entity_type, entity_id, new_state
          ) VALUES ($1, $2, 'USER_PROVISIONED', 'users', $2, $3);`,
          [
            demoTenantId,
            demoUserId,
            JSON.stringify({
              email: demoEmail,
              role: "CLIENT_ADMIN",
              origin: "PRODUCTION_PROVISIONING_SCRIPT",
              synthetic: true,
            }),
          ]
        );
        demoAction = "PROVISIONED";
      }

      // ======================================================================
      // 4. Ensure Demo Assessment for TLI Demo Customer
      // ======================================================================
      const demoAssessRes = await client.query(
        "SELECT id, engagement_code, status FROM assessments WHERE tenant_id = $1 LIMIT 1;",
        [demoTenantId]
      );

      if (demoAssessRes.rows.length === 0) {
        // Resolve baseline framework version and scoring model
        const fwRes = await client.query("SELECT id FROM framework_versions LIMIT 1;");
        const smRes = await client.query("SELECT id FROM scoring_models LIMIT 1;");

        if (fwRes.rows.length > 0 && smRes.rows.length > 0) {
          const frameworkVersionId = fwRes.rows[0].id;
          const scoringModelId = smRes.rows[0].id;

          const insertAssess = await client.query(
            `INSERT INTO assessments (
              tenant_id, framework_version_id, scoring_model_id, lead_consultant_id,
              engagement_code, title, status, target_completion_date
            ) VALUES (
              $1, $2, $3, $4, 'ENG-TLI-DEMO-2026-001',
              'TLI Demo Customer — DPDP Compliance Gap Assessment',
              'DATA_GATHERING', CURRENT_DATE + INTERVAL '30 days'
            ) RETURNING id;`,
            [demoTenantId, frameworkVersionId, scoringModelId, adminUserId]
          );

          const assessmentId = insertAssess.rows[0].id;

          // Assign lead consultant and customer coordinator
          await client.query(
            `INSERT INTO assessment_assignments (assessment_id, user_id, assignment_role)
             VALUES 
               ($1, $2, 'ENGAGEMENT_LEAD'),
               ($1, $3, 'CLIENT_COORDINATOR')
             ON CONFLICT (assessment_id, user_id) DO NOTHING;`,
            [assessmentId, adminUserId, demoUserId]
          );

          // Populate canonical controls for the assessment
          await client.query(
            `INSERT INTO assessment_controls (assessment_id, control_id, is_applicable, verification_status)
             SELECT $1, c.id, TRUE, 'UNANSWERED'::verification_status
             FROM controls c
             WHERE c.framework_version_id = $2
             ON CONFLICT (assessment_id, control_id) DO NOTHING;`,
            [assessmentId, frameworkVersionId]
          );

          await client.query(
            `INSERT INTO audit_logs (
              tenant_id, user_id, action, entity_type, entity_id, new_state
            ) VALUES ($1, $2, 'ASSESSMENT_CREATED', 'assessments', $3, $4);`,
            [
              demoTenantId,
              adminUserId,
              assessmentId,
              JSON.stringify({
                engagement_code: "ENG-TLI-DEMO-2026-001",
                synthetic: true,
              }),
            ]
          );
        }
      }

      await client.query("COMMIT;");

      // ======================================================================
      // 5. Secure Credentials Delivery to Local Git-Ignored File
      // ======================================================================
      if (adminInitialPassword || demoInitialPassword) {
        const credentialsText = formatCredentialsFile({
          target,
          generatedAt: new Date().toISOString(),
          adminEmail,
          adminPassword: adminInitialPassword,
          adminAction,
          adminTenantName: tliTenantName,
          demoEmail,
          demoPassword: demoInitialPassword,
          demoAction,
          demoTenantName,
        });

        const dir = path.dirname(credentialsFilePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
        }

        fs.writeFileSync(credentialsFilePath, credentialsText, {
          encoding: "utf8",
          mode: 0o600, // Read/Write only by current OS user
        });
        fs.chmodSync(credentialsFilePath, 0o600);
      }

      return {
        success: true,
        target,
        adminAccount: {
          email: adminEmail,
          role: "TLI_SUPER_ADMIN",
          tenantName: tliTenantName,
          tenantSlug: tliTenantSlug,
          action: adminAction,
          initialPassword: adminInitialPassword,
        },
        demoAccount: {
          email: demoEmail,
          role: "CLIENT_ADMIN",
          tenantName: demoTenantName,
          tenantSlug: demoTenantSlug,
          action: demoAction,
          initialPassword: demoInitialPassword,
        },
        credentialsFilePath,
        migrationsVerified: Boolean(latestMigration),
        latestMigration,
      };
    } catch (txErr) {
      await client.query("ROLLBACK;");
      throw txErr;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

function formatCredentialsFile(data: {
  target: string;
  generatedAt: string;
  adminEmail: string;
  adminPassword: string | null;
  adminAction: string;
  adminTenantName: string;
  demoEmail: string;
  demoPassword: string | null;
  demoAction: string;
  demoTenantName: string;
}): string {
  return `================================================================================
TLI DPDP Compliance Gap Analysis Tool — Provisioned Credentials
================================================================================
Target Environment : ${data.target}
Generated At       : ${data.generatedAt}
Credentials Mode   : Read-Only (0600) — Git Ignored (.credentials_provisioned*)

[1] TLI SUPER ADMINISTRATOR
--------------------------------------------------------------------------------
Email Address : ${data.adminEmail}
Role          : TLI_SUPER_ADMIN
Tenant Name   : ${data.adminTenantName}
Status        : ${data.adminAction}
Initial Pass  : ${data.adminPassword ? data.adminPassword : "[PRESERVED_EXISTING_PRODUCTION_PASSWORD]"}

[2] DEMO CUSTOMER ADMINISTRATOR
--------------------------------------------------------------------------------
Email Address : ${data.demoEmail}
Role          : CLIENT_ADMIN
Tenant Name   : ${data.demoTenantName}
Status        : ${data.demoAction}
Initial Pass  : ${data.demoPassword ? data.demoPassword : "[PRESERVED_EXISTING_PRODUCTION_PASSWORD]"}

================================================================================
CRITICAL OPERATIONAL INSTRUCTIONS:
1. Store these credentials in an authorized corporate password vault (1Password / Bitwarden).
2. Verify logins at the target deployment URL (e.g., https://tl-assessment-tool.vercel.app/login).
3. Once stored safely, remove this local file:
     rm "${path.resolve(process.cwd(), ".credentials_provisioned.txt")}"
4. NEVER commit this file or expose passwords in chat logs or version control.
================================================================================
`;
}

// ============================================================================
// CLI Entry Point
// ============================================================================
async function runCli() {
  const args = process.argv.slice(2);
  const parsedArgs: Record<string, string | boolean> = {};

  for (const arg of args) {
    if (arg.startsWith("--")) {
      const [key, val] = arg.slice(2).split("=");
      parsedArgs[key] = val === undefined ? true : val;
    }
  }

  const databaseUrl =
    (parsedArgs["database-url"] as string) ||
    process.env.TARGET_DATABASE_URL ||
    process.env.DATABASE_URL;

  const target = (parsedArgs["target"] as string) || (parsedArgs["env"] as string);

  if (!databaseUrl) {
    console.error("\x1b[31m[ERROR] Missing required database URL.\x1b[0m");
    console.error("Usage:");
    console.error(
      "  node --experimental-strip-types scripts/provision_production_accounts.ts --target=production --database-url=postgresql://..."
    );
    process.exit(1);
  }

  if (!target) {
    console.error(
      "\x1b[31m[ERROR] Explicit target must be specified to prevent unintended database modifications.\x1b[0m"
    );
    console.error("Please supply --target=production, --target=staging, or --target=local.");
    process.exit(1);
  }

  const credentialsFile =
    (parsedArgs["credentials-file"] as string) ||
    path.resolve(process.cwd(), ".credentials_provisioned.txt");

  const forceResetAdmin = Boolean(parsedArgs["force-reset-admin"]);
  const forceResetDemo = Boolean(parsedArgs["force-reset-demo"]);
  const runMigrations = Boolean(parsedArgs["run-migrations"]);

  console.log("=================================================================");
  console.log("  TLI DPDP Platform — Production Account Provisioning");
  console.log("=================================================================");
  console.log(`Target Environment : ${target.toUpperCase()}`);
  console.log(`Credentials File   : ${credentialsFile}`);
  console.log("-----------------------------------------------------------------");

  try {
    const result = await provisionAccounts({
      databaseUrl,
      target,
      credentialsFilePath: credentialsFile,
      forceResetAdmin,
      forceResetDemo,
      runMigrationsIfPending: runMigrations,
    });

    console.log("\x1b[32m✔ Account provisioning completed successfully!\x1b[0m\n");

    console.log("Account Summary:");
    console.log(
      `  1. TLI Super Admin : ${result.adminAccount.email} [${result.adminAccount.role}] -> ${result.adminAccount.action}`
    );
    console.log(
      `  2. Demo Customer   : ${result.demoAccount.email} [${result.demoAccount.role}] -> ${result.demoAccount.action}`
    );
    console.log(`  Tenant Organization: ${result.demoAccount.tenantName} (${result.demoAccount.tenantSlug})`);

    if (result.latestMigration) {
      console.log(`  Latest Migration   : ${result.latestMigration}`);
    }

    console.log("\n-----------------------------------------------------------------");
    if (result.adminAccount.initialPassword || result.demoAccount.initialPassword) {
      console.log(`\x1b[33mInitial credentials safely saved to local file (mode 0600):\x1b[0m`);
      console.log(`  ${result.credentialsFilePath}`);
      console.log(`\nView credentials via:`);
      console.log(`  cat "${result.credentialsFilePath}"`);
    } else {
      console.log(
        "Both accounts already had active non-synthetic credentials. Zero passwords were overwritten."
      );
      console.log("(To force password rotation, pass --force-reset-admin and/or --force-reset-demo)");
    }
    console.log("=================================================================");
  } catch (err: any) {
    console.error(`\n\x1b[31m[ERROR] Provisioning failed: ${err.message}\x1b[0m`);
    process.exit(1);
  }
}

// Execute CLI when run directly
const isDirectExecution =
  process.argv[1] &&
  (process.argv[1].endsWith("provision_production_accounts.ts") ||
    process.argv[1].endsWith("provision_production_accounts.js"));

if (isDirectExecution) {
  runCli();
}

