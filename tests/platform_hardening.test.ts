/**
 * TLI DPDP Compliance Gap Analysis Tool — Platform Hardening Test Suite
 *
 * Verifies:
 * 1. Database TLS always verifies certificates for cloud targets unless explicitly overridden.
 * 2. Production never falls back to the local disposable test database URL.
 * 3. Client IP resolution ignores client-supplied CF-Connecting-IP on Vercel.
 * 4. Signed sessions are re-verified against live account state (deactivation, role change).
 * 5. Privileged onboarding operations reject sessions of deactivated accounts.
 */

import { describe, it, before, after } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { pool, resolveConnectionString, resolveSslConfig, LOCAL_TEST_DATABASE_URL } from "../lib/db/pool.ts";
import { assertSessionMatchesDatabase, DatabaseAuthorizationError } from "../lib/db/rls.ts";
import { resolveClientIp } from "../lib/auth/rate_limit.ts";
import { consumePasswordVerificationTime } from "../lib/auth/passwords.ts";
import { createCustomerOrganization, OnboardingError } from "../lib/onboarding/index.ts";
import type { SessionUser } from "../lib/auth/types.ts";
import { LocalStorageAdapter } from "../lib/storage/local_adapter.ts";
import { EvidenceVaultService } from "../lib/storage/service.ts";
import { ValidationError } from "../lib/storage/validation.ts";
import { assertPersistentEvidenceStorage, StorageConfigurationError } from "../lib/storage/object_store.ts";

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

describe("Platform hardening: database connection configuration", () => {
  it("verifies TLS certificates for Neon and sslmode=require targets by default", () => {
    const neonUrl = "postgresql://user:secret@ep-example.neon.tech/neondb";
    assert.deepEqual(resolveSslConfig(neonUrl, {}), { rejectUnauthorized: true });
    assert.deepEqual(
      resolveSslConfig("postgresql://user:secret@db.example.com/app?sslmode=require", {}),
      { rejectUnauthorized: true }
    );
  });

  it("only disables certificate verification through the explicit escape hatch", () => {
    const url = "postgresql://user:secret@db.example.com/app?sslmode=require";
    assert.deepEqual(resolveSslConfig(url, { DATABASE_SSL_ALLOW_UNVERIFIED: "true" }), {
      rejectUnauthorized: false,
    });
    assert.deepEqual(resolveSslConfig(url, { DATABASE_SSL_ALLOW_UNVERIFIED: "1" }), {
      rejectUnauthorized: true,
    });
  });

  it("does not enable TLS for the local disposable test cluster", () => {
    assert.equal(resolveSslConfig(LOCAL_TEST_DATABASE_URL, {}), undefined);
  });

  it("never falls back to the local test database in production", () => {
    assert.equal(resolveConnectionString({ NODE_ENV: "production" }), undefined);
    assert.equal(resolveConnectionString({ NODE_ENV: "development" }), LOCAL_TEST_DATABASE_URL);
    assert.equal(
      resolveConnectionString({ NODE_ENV: "production", DATABASE_URL: "postgresql://x@y/z" }),
      "postgresql://x@y/z"
    );
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
