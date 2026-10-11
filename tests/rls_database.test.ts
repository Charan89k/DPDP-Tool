import { describe, it, after } from "node:test";
import assert from "node:assert/strict";

import {
  executeWithRls,
  validateSessionContext,
  DatabaseAuthorizationError,
} from "../lib/db/rls.ts";
import { pool } from "../lib/db/pool.ts";
import type { SessionUser } from "../lib/auth/types.ts";

const ALPHA_USER: SessionUser = {
  userId: "018f3a5b-7c8d-7e90-8000-000000000113",
  email: "eng.contributor@alphahealth.example.com",
  fullName: "Amitabh Roy",
  role: "CLIENT_CONTRIBUTOR",
  tenantId: "018f3a5b-7c8d-7e90-8000-000000000002",
  tenantName: "Alpha Healthcare Technologies Pvt Ltd",
  tenantSlug: "alpha-healthcare",
  tenantType: "CLIENT",
  isSdf: true,
};

const BETA_USER: SessionUser = {
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

const SUPER_ADMIN: SessionUser = {
  userId: "018f3a5b-7c8d-7e90-8000-000000000101",
  email: "admin@truthlabs.in",
  fullName: "TLI Super Administrator",
  role: "TLI_SUPER_ADMIN",
  tenantId: "018f3a5b-7c8d-7e90-8000-000000000001",
  tenantName: "Truth Labs International",
  tenantSlug: "truth-labs-advisory",
  tenantType: "TLI",
  isSdf: false,
};

describe("Phase 3C: Database RLS & Multi-Tenant Kernel Isolation", () => {
  after(async () => {
    await pool.end();
  });

  it("should fail closed if session context is missing or incomplete", () => {
    // @ts-expect-error invalid context test
    assert.throws(() => validateSessionContext(null), DatabaseAuthorizationError);
    // @ts-expect-error invalid context test
    assert.throws(() => validateSessionContext({}), DatabaseAuthorizationError);
    assert.throws(
      // @ts-expect-error invalid context test
      () => validateSessionContext({ userId: "1", tenantId: "", role: "CLIENT_ADMIN" }),
      DatabaseAuthorizationError
    );
  });

  it("should enforce tenant isolation for Client Alpha under live PostgreSQL RLS", async () => {
    const assessments = await executeWithRls(ALPHA_USER, async (client) => {
      const res = await client.query("SELECT id, title, tenant_id FROM assessments;");
      return res.rows;
    });

    assert.ok(assessments.length >= 1, "Alpha user should see at least 1 assessment");
    for (const a of assessments) {
      assert.equal(
        a.tenant_id,
        ALPHA_USER.tenantId,
        "Every returned assessment must belong strictly to Alpha tenant"
      );
    }
  });

  it("should block Client Alpha from reading Client Beta assessment records", async () => {
    const betaAssessmentId = "018f3a5b-7c8d-7e90-8000-000000000202";

    const rows = await executeWithRls(ALPHA_USER, async (client) => {
      const res = await client.query("SELECT id FROM assessments WHERE id = $1;", [
        betaAssessmentId,
      ]);
      return res.rows;
    });

    assert.equal(
      rows.length,
      0,
      "RLS kernel must return 0 rows when Alpha queries Beta assessment ID"
    );
  });

  it("should block Client Alpha from updating Client Beta assessment records", async () => {
    const betaAssessmentId = "018f3a5b-7c8d-7e90-8000-000000000202";

    const updatedCount = await executeWithRls(ALPHA_USER, async (client) => {
      const res = await client.query(
        "UPDATE assessments SET title = 'Hacked' WHERE id = $1 RETURNING id;",
        [betaAssessmentId]
      );
      return res.rowCount || 0;
    });

    assert.equal(updatedCount, 0, "RLS must block Alpha from updating Beta records");
  });

  it("should grant cross-tenant global visibility to TLI_SUPER_ADMIN", async () => {
    const assessments = await executeWithRls(SUPER_ADMIN, async (client) => {
      const res = await client.query("SELECT id, tenant_id FROM assessments;");
      return res.rows;
    });

    const tenantIds = new Set(assessments.map((a) => a.tenant_id));
    assert.ok(
      tenantIds.has(ALPHA_USER.tenantId),
      "Super admin must see Alpha assessments"
    );
    assert.ok(
      tenantIds.has(BETA_USER.tenantId),
      "Super admin must see Beta assessments"
    );
  });

  it("should prevent connection context bleed on connection reuse", async () => {
    // 1. First execution as Alpha user
    await executeWithRls(ALPHA_USER, async (client) => {
      const res = await client.query("SELECT current_setting('app.current_tenant_id', true) AS tid;");
      assert.equal(res.rows[0].tid, ALPHA_USER.tenantId);
    });

    // 2. Direct query on a pooled client without RLS context must find context unset
    const client = await pool.connect();
    try {
      const res = await client.query("SELECT current_setting('app.current_tenant_id', true) AS tid;");
      const tid = res.rows[0].tid;
      assert.ok(
        !tid || tid === "",
        "app.current_tenant_id must be cleared on client release to prevent context bleed"
      );
    } finally {
      client.release();
    }
  });
});

