/**
 * TLI DPDP Compliance Gap Analysis Tool — Platform Hardening Test Suite
 *
 * Verifies:
 * 1. Production requires an explicit SQLite path; missing or unmigrated databases are refused.
 * 2. SQLite runs with foreign keys, WAL journaling and a busy timeout.
 * 3. Client IP resolution ignores client-supplied CF-Connecting-IP on Vercel.
 * 4. Signed sessions are re-verified against live account state (deactivation, role change).
 * 5. Privileged onboarding operations reject sessions of deactivated accounts.
 */

import { describe, it, before, after } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { pool } from "../lib/db/pool.ts";
import {
  DatabaseConfigurationError,
  openDatabase,
  resolveDatabasePath,
} from "../lib/db/sqlite/connection.ts";
import { assertSessionMatchesDatabase, DatabaseAuthorizationError, executeWithRls } from "../lib/db/rls.ts";
import { resolveClientIp } from "../lib/auth/rate_limit.ts";
import { consumePasswordVerificationTime } from "../lib/auth/passwords.ts";
import { createCustomerOrganization, OnboardingError } from "../lib/onboarding/index.ts";
import type { SessionUser } from "../lib/auth/types.ts";
import { LocalStorageAdapter } from "../lib/storage/local_adapter.ts";
import { EvidenceVaultService } from "../lib/storage/service.ts";
import { ValidationError } from "../lib/storage/validation.ts";
import { assertPersistentEvidenceStorage, StorageConfigurationError } from "../lib/storage/object_store.ts";
import { checkConfiguration } from "../lib/ops/readiness.ts";
import { buildContentSecurityPolicy, createNonce } from "../lib/http/csp.ts";

const TLI_TENANT_ID = "018f3a5b-7c8d-7e90-8000-000000000001";
const SUITE_ID = Date.now().toString(36);
// Not a valid bcrypt hash: these fixture accounts can never be used to sign in.
const UNUSABLE_PASSWORD_HASH = "!hardening-fixture-no-login";

function sessionFor(userId: string, role: SessionUser["role"]): SessionUser {
  return {
    userId,
    email: `hardening.${SUITE_ID}@truthlabs.in`,
    fullName: "Hardening Test User",
    role,
    tenantId: TLI_TENANT_ID,
    tenantName: "Truth Labs International",
    tenantSlug: "truth-labs-advisory",
    tenantType: "TLI",
    isSdf: false,
  };
}

describe("Platform hardening: SQLite database configuration", () => {
  it("requires an explicit database path in production", () => {
    assert.throws(() => resolveDatabasePath({ NODE_ENV: "production" }), DatabaseConfigurationError);
    assert.equal(
      resolveDatabasePath({ NODE_ENV: "production", CLOUDE5_DATABASE_PATH: "/srv/cloude5/cloude5.db" }),
      "/srv/cloude5/cloude5.db"
    );
  });

  it("never silently creates a database when the configured file is missing", () => {
    const missing = path.join(os.tmpdir(), `cloude5-missing-${Date.now()}`, "cloude5.db");
    assert.throws(() => openDatabase(missing), DatabaseConfigurationError);
    assert.equal(fs.existsSync(missing), false, "No empty database file may be created");
  });

  it("refuses to serve requests from an unmigrated database", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cloude5-unmigrated-"));
    const file = path.join(dir, "empty.db");
    openDatabase(file, { create: true, withoutPolicies: true }).close();
    assert.throws(() => openDatabase(file), /not up to date/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("runs with foreign keys, WAL journaling and a busy timeout", async () => {
    const pragmas = await pool.query(
      "SELECT (SELECT foreign_keys FROM pragma_foreign_keys) AS fk, (SELECT journal_mode FROM pragma_journal_mode) AS jm, (SELECT timeout FROM pragma_busy_timeout) AS bt"
    );
    assert.equal(Number(pragmas.rows[0].fk), 1);
    assert.equal(pragmas.rows[0].jm, "wal");
    assert.ok(Number(pragmas.rows[0].bt) >= 1000);
  });
});

describe("Platform hardening: client IP resolution", () => {
  const spoofedRequest = () =>
    new Request("https://tl-assessment-tool.vercel.app/api/auth/login", {
      headers: {
        "cf-connecting-ip": "203.0.113.7",
        "x-real-ip": "198.51.100.10",
        "x-vercel-forwarded-for": "198.51.100.10",
        "x-forwarded-for": "198.51.100.10",
      },
    });

  it("ignores client-supplied CF-Connecting-IP on Vercel", () => {
    assert.equal(resolveClientIp(spoofedRequest(), { VERCEL: "1" }), "198.51.100.10");
  });

  it("honours CF-Connecting-IP on Vercel only when Cloudflare fronting is declared", () => {
    assert.equal(
      resolveClientIp(spoofedRequest(), { VERCEL: "1", TRUST_CLOUDFLARE_IP_HEADER: "true" }),
      "203.0.113.7"
    );
  });

  it("prefers the platform-set X-Vercel-Forwarded-For header on Vercel", () => {
    const req = new Request("https://example.test", {
      headers: { "x-vercel-forwarded-for": "198.51.100.44", "x-real-ip": "198.51.100.45" },
    });
    assert.equal(resolveClientIp(req, { VERCEL: "1" }), "198.51.100.44");
  });
});

describe("Platform hardening: live session re-verification", () => {
  let activeAdminId: string;
  let deactivatedAdminId: string;

  before(async () => {
    const insert = async (email: string, isActive: boolean) => {
      const res = await pool.query(
        `INSERT INTO users (tenant_id, email, password_hash, full_name, role, is_active)
         VALUES ($1, $2, $3, 'Hardening Test Admin', 'TLI_SUPER_ADMIN', $4)
         RETURNING id;`,
        [TLI_TENANT_ID, email, UNUSABLE_PASSWORD_HASH, isActive]
      );
      return res.rows[0].id as string;
    };
    activeAdminId = await insert(`hardening.active.${SUITE_ID}@truthlabs.in`, true);
    deactivatedAdminId = await insert(`hardening.inactive.${SUITE_ID}@truthlabs.in`, false);
  });

  it("accepts a session that matches current account state", async () => {
    const identity = await assertSessionMatchesDatabase(
      pool,
      sessionFor(activeAdminId, "TLI_SUPER_ADMIN")
    );
    assert.equal(identity.id, activeAdminId);
    assert.equal(identity.role, "TLI_SUPER_ADMIN");
  });

  it("rejects a still-valid token for a deactivated account", async () => {
    await assert.rejects(
      assertSessionMatchesDatabase(pool, sessionFor(deactivatedAdminId, "TLI_SUPER_ADMIN")),
      (err: unknown) => err instanceof DatabaseAuthorizationError && /deactivated/.test(err.message)
    );
  });

  it("rejects a token whose role no longer matches the account, without disclosing roles", async () => {
    await assert.rejects(
      assertSessionMatchesDatabase(pool, sessionFor(activeAdminId, "TLI_LEAD_CONSULTANT")),
      (err: unknown) =>
        err instanceof DatabaseAuthorizationError &&
        /no longer matches/.test(err.message) &&
        !err.message.includes("TLI_SUPER_ADMIN")
    );
  });

  it("blocks privileged onboarding for a deactivated super administrator (HTTP 403)", async () => {
    const orgName = `Hardening Blocked Org ${SUITE_ID}`;
    await assert.rejects(
      createCustomerOrganization(sessionFor(deactivatedAdminId, "TLI_SUPER_ADMIN"), {
        name: orgName,
        industry: "Testing",
        isSdf: false,
      }),
      (err: unknown) =>
        err instanceof OnboardingError &&
        err.statusCode === 403 &&
        err.code === "SESSION_NOT_AUTHORIZED"
    );

    const created = await pool.query("SELECT 1 FROM tenants WHERE name = $1;", [orgName]);
    assert.equal(created.rows.length, 0, "No tenant may be created by a deactivated account");
  });

  it("spends bcrypt-equivalent time for unknown accounts without throwing", async () => {
    await consumePasswordVerificationTime("not-a-real-password");
    await consumePasswordVerificationTime("");
  });
});

describe("Platform hardening: evidence vault fails closed", () => {
  const BETA_CUSTOMER: SessionUser = {
    userId: "018f3a5b-7c8d-7e90-8000-000000000121",
    email: "admin@betaexpress.example.com",
    fullName: "Rohan Kapoor",
    role: "CLIENT_ADMIN",
    tenantId: "018f3a5b-7c8d-7e90-8000-000000000003",
    tenantName: "Beta Express Supply Chain Solutions Ltd",
    tenantSlug: "beta-express",
    tenantType: "CLIENT",
    isSdf: false,
  };
  const ASSESSMENT_ALPHA_ID = "018f3a5b-7c8d-7e90-8000-000000000201";
  const pdf = Buffer.from(
    "%PDF-1.4\n1 0 obj\n<< /Title (Hardening) >>\nendobj\n" + "x".repeat(120) + "\n%%EOF\n",
    "utf-8"
  );
  let vaultDir: string;
  let service: EvidenceVaultService;

  const countFiles = (dir: string): number =>
    fs.existsSync(dir)
      ? fs.readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).length
      : 0;

  before(() => {
    vaultDir = fs.mkdtempSync(path.join(os.tmpdir(), "dpdp-hardening-vault-"));
    service = new EvidenceVaultService(new LocalStorageAdapter(vaultDir));
  });

  after(() => {
    fs.rmSync(vaultDir, { recursive: true, force: true });
  });

  it("rejects cross-tenant upload before any payload is written", async () => {
    await assert.rejects(
      service.uploadEvidence({
        sessionUser: BETA_CUSTOMER,
        assessmentId: ASSESSMENT_ALPHA_ID,
        filename: "Cross_Tenant.pdf",
        mimeType: "application/pdf",
        content: pdf,
      }),
      (err: unknown) => err instanceof ValidationError && /Access denied/.test(err.message)
    );
    assert.equal(countFiles(vaultDir), 0, "Rejected uploads must not leave payloads in the vault");
  });

  it("rejects uploads without a valid assessment identifier", async () => {
    await assert.rejects(
      service.uploadEvidence({
        sessionUser: BETA_CUSTOMER,
        assessmentId: "default-assessment",
        filename: "Orphan.pdf",
        mimeType: "application/pdf",
        content: pdf,
      }),
      ValidationError
    );
    assert.equal(countFiles(vaultDir), 0);
  });

  it("propagates database authorization failures instead of serving cached records", async () => {
    const forged: SessionUser = { ...BETA_CUSTOMER, role: "TLI_SUPER_ADMIN", tenantType: "TLI" };
    await assert.rejects(
      service.getEvidenceForDownload(forged, "018f3a5b-7c8d-7e90-8000-00000000ffff"),
      DatabaseAuthorizationError
    );
  });

  it("refuses to store evidence on Vercel's ephemeral filesystem", () => {
    assert.throws(() => assertPersistentEvidenceStorage({ VERCEL: "1" }), StorageConfigurationError);
    assert.doesNotThrow(() => assertPersistentEvidenceStorage({}));
  });
});

describe("Platform hardening: security review regressions", () => {
  const TLI = "018f3a5b-7c8d-7e90-8000-000000000001";
  const BETA = "018f3a5b-7c8d-7e90-8000-000000000003";
  const ALPHA_ADMIN: SessionUser = {
    userId: "018f3a5b-7c8d-7e90-8000-000000000192",
    email: "customer.demo@tli.local",
    fullName: "Alpha Health Demo Admin",
    role: "CLIENT_ADMIN",
    tenantId: "018f3a5b-7c8d-7e90-8000-000000000002",
    tenantName: "Alpha Healthcare Technologies Pvt Ltd",
    tenantSlug: "alpha-healthcare",
    tenantType: "CLIENT",
    isSdf: true,
  };
  const UNASSIGNED_REVIEWER: SessionUser = {
    userId: "018f3a5b-7c8d-7e90-8000-000000000103",
    email: "reviewer.privacy@truthlabs.in",
    fullName: "Privacy Reviewer",
    role: "TLI_REVIEWER",
    tenantId: TLI,
    tenantName: "Truth Labs International",
    tenantSlug: "truth-labs-advisory",
    tenantType: "TLI",
    isSdf: false,
  };

  it("refuses database work that outlives its unit of work", async () => {
    let escaped: Promise<unknown> | null = null;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await executeWithRls(ALPHA_ADMIN, async () => {
      escaped = gate.then(() => pool.query("SELECT COUNT(*) AS n FROM assessments"));
    });
    release();
    await assert.rejects(escaped!, /after its unit of work finished/);
  });

  it("does not let an invitation take over an existing account", async () => {
    const { createCustomerInvitation, acceptCustomerInvitation } = await import("../lib/onboarding/index.ts");
    const victimEmail = `victim.${SUITE_ID}@alphahealth.example.com`;
    const invite = await createCustomerInvitation(ALPHA_ADMIN, ALPHA_ADMIN.tenantId, {
      email: victimEmail,
      fullName: "Victim",
      role: "CLIENT_CONTRIBUTOR",
    });
    await pool.query(
      `INSERT INTO users (tenant_id, email, password_hash, full_name, role, is_active)
       VALUES ($1, $2, 'victim-hash', 'Victim', 'CLIENT_ADMIN', TRUE)`,
      [BETA, victimEmail]
    );
    await assert.rejects(
      acceptCustomerInvitation({ token: invite.token, password: "Takeover-Attempt-2026", fullName: "Attacker" }),
      (err: unknown) => err instanceof OnboardingError && err.statusCode === 409
    );
    const victim = (await pool.query("SELECT password_hash, tenant_id FROM users WHERE email = $1", [victimEmail])).rows[0];
    assert.equal(victim.password_hash, "victim-hash");
    assert.equal(victim.tenant_id, BETA);
  });

  it("does not show an unassigned reviewer another customer's details", async () => {
    const { getCustomerDetails } = await import("../lib/onboarding/index.ts");
    await assert.rejects(getCustomerDetails(UNASSIGNED_REVIEWER, BETA), (err: unknown) =>
      err instanceof OnboardingError && err.statusCode === 404
    );
  });
});

describe("Platform hardening: persistent rate limiting", () => {
  it("stores hashed buckets in the database so limits survive restarts", async () => {
    const { PersistentRateLimiter } = await import("../lib/auth/rate_limit.ts");
    const key = `email:persist.${SUITE_ID}@example.test`;
    const first = new PersistentRateLimiter("login-test", 3, 900);
    for (let i = 0; i < 3; i++) await first.recordFailedAttempt(key);

    // A new limiter instance (as after a restart) sees the same state.
    const afterRestart = new PersistentRateLimiter("login-test", 3, 900);
    assert.equal((await afterRestart.isRateLimited(key)).limited, true);

    const rows = (await pool.query("SELECT key_hash FROM rate_limit_buckets")).rows;
    assert.ok(rows.every((r) => /^[0-9a-f]{64}$/.test(r.key_hash)), "Only hashes are stored");
    assert.ok(!JSON.stringify(rows).includes("persist."), "No raw identifiers are stored");

    await afterRestart.resetAttempts(key);
    assert.equal((await afterRestart.isRateLimited(key)).limited, false);
  });
});

describe("Platform hardening: credential columns", () => {
  it("never returns password hashes, MFA secrets or invitation token hashes to tenant-scoped reads", async () => {
    const admin: SessionUser = {
      userId: "018f3a5b-7c8d-7e90-8000-000000000192",
      email: "customer.demo@tli.local",
      fullName: "Alpha Health Demo Admin",
      role: "CLIENT_ADMIN",
      tenantId: "018f3a5b-7c8d-7e90-8000-000000000002",
      tenantName: "Alpha Healthcare Technologies Pvt Ltd",
      tenantSlug: "alpha-healthcare",
      tenantType: "CLIENT",
      isSdf: true,
    };
    const rows = await executeWithRls(admin, async (client) => ({
      users: (await client.query("SELECT * FROM users")).rows,
      invitations: (await client.query("SELECT * FROM user_invitations")).rows,
    }));
    assert.ok(rows.users.length > 0);
    for (const user of rows.users) {
      assert.equal(user.password_hash, null);
      assert.equal(user.mfa_secret_encrypted, null);
    }
    for (const invitation of rows.invitations) assert.equal(invitation.token_hash, null);

    // Naming the base table or the policy context explicitly is refused in a tenant context.
    for (const sql of [
      "SELECT password_hash FROM main.users",
      "SELECT * FROM temp._ctx",
      "UPDATE temp._ctx SET bypass = 1",
      "PRAGMA table_info(users)",
    ]) {
      await assert.rejects(executeWithRls(admin, (client) => client.query(sql)), /permission denied/, sql);
    }

    // Privileged authentication paths still see them.
    const privileged = (await pool.query("SELECT password_hash FROM users WHERE id = $1", [admin.userId])).rows[0];
    assert.ok(privileged.password_hash);
  });
});

describe("Platform hardening: readiness configuration", () => {
  const baseEnv = {
    NODE_ENV: "production",
    SESSION_SECRET: "x".repeat(48),
    CLOUDE5_DATABASE_PATH: "/data/cloude5.db",
    CLOUDE5_PUBLIC_URL: "https://cloude5.example.com",
    SMTP_HOST: "smtp.example.com",
    SMTP_FROM: "CloudE5 <no-reply@example.com>",
  };

  it("rejects a malformed CLOUDE5_ENCRYPTION_KEY before MFA enrolment can fail", () => {
    const result = checkConfiguration({ ...baseEnv, CLOUDE5_ENCRYPTION_KEY: "too-short" });
    assert.equal(result.ok, false);
    assert.match(result.detail ?? "", /CLOUDE5_ENCRYPTION_KEY/);
  });

  it("accepts a 32-byte base64 key and an absent key (derived from SESSION_SECRET)", () => {
    const key = Buffer.alloc(32, 7).toString("base64");
    assert.equal(checkConfiguration({ ...baseEnv, CLOUDE5_ENCRYPTION_KEY: key }).ok, true);
    assert.equal(checkConfiguration(baseEnv).ok, true);
  });
});

describe("Platform hardening: content security policy", () => {
  it("allows only nonce-bearing scripts in production, with a fresh nonce per request", () => {
    const first = createNonce();
    assert.notEqual(first, createNonce());
    assert.match(first, /^[A-Za-z0-9+/]{22}==$/, "128-bit base64 nonce");

    const policy = buildContentSecurityPolicy(first, true);
    const scriptSrc = policy.split("; ").find((d) => d.startsWith("script-src")) ?? "";
    assert.equal(scriptSrc, `script-src 'self' 'nonce-${first}' 'strict-dynamic'`);
    assert.doesNotMatch(scriptSrc, /unsafe-inline|unsafe-eval/);
    assert.match(policy, /frame-ancestors 'none'/);
    assert.match(policy, /object-src 'none'/);
  });

  it("adds only what the development server needs outside production", () => {
    const policy = buildContentSecurityPolicy("n", false);
    assert.match(policy, /script-src [^;]*'unsafe-eval'/);
    assert.match(policy, /connect-src 'self' ws: wss:/);
  });
});
