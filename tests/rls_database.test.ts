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

  it("should reject forged role in session context against database records", async () => {
    // Client contributor attempts to forge identity as TLI_SUPER_ADMIN
    const forgedRoleUser: SessionUser = {
      ...ALPHA_USER,
      role: "TLI_SUPER_ADMIN",
    };

    await assert.rejects(
      async () => {
        await executeWithRls(forgedRoleUser, async (client) => {
          return await client.query("SELECT count(*) FROM assessments;");
        });
      },
      DatabaseAuthorizationError,
      "executeWithRls must verify role against DB and reject forged role"
    );
  });

  it("should reject cross-tenant identity forgery against database records", async () => {
    // Alpha user attempts to forge membership in Beta tenant
    const forgedTenantUser: SessionUser = {
      ...ALPHA_USER,
      tenantId: BETA_USER.tenantId,
    };

    await assert.rejects(
      async () => {
        await executeWithRls(forgedTenantUser, async (client) => {
          return await client.query("SELECT count(*) FROM assessments;");
        });
      },
      DatabaseAuthorizationError,
      "executeWithRls must verify tenant membership against DB and reject forgery"
    );
  });

  it("should reject non-existent or inactive user accounts", async () => {
    const nonExistentUser: SessionUser = {
      userId: "018f3a5b-7c8d-7e90-8000-999999999999",
      email: "ghost@alphahealth.example.com",
      fullName: "Ghost User",
      role: "CLIENT_CONTRIBUTOR",
      tenantId: ALPHA_USER.tenantId,
      tenantName: ALPHA_USER.tenantName,
      tenantSlug: ALPHA_USER.tenantSlug,
      tenantType: "CLIENT",
      isSdf: true,
    };

    await assert.rejects(
      async () => {
        await executeWithRls(nonExistentUser, async (client) => {
          return await client.query("SELECT count(*) FROM assessments;");
        });
      },
      DatabaseAuthorizationError,
      "executeWithRls must fail closed if user is not in database"
    );
  });

  it("should safely rollback transaction and prevent context bleed on operation exception", async () => {
    // Deliberately throw an exception inside the transaction
    await assert.rejects(
      async () => {
        await executeWithRls(ALPHA_USER, async (client) => {
          await client.query("SELECT 1;");
          throw new Error("Intentional application error inside transaction");
        });
      },
      /Intentional application error/
    );

    // Direct query on a pooled client must verify no leftover context or open transactions
    const client = await pool.connect();
    try {
      const res = await client.query(
        "SELECT current_setting('app.current_tenant_id', true) AS tid, current_setting('app.current_user_role', true) AS role;"
      );
      assert.equal(res.rows[0].tid, "", "Tenant setting must be cleared after exception");
      assert.equal(res.rows[0].role, "", "Role setting must be cleared after exception");
    } finally {
      client.release();
    }
  });

  it("should safely reuse pool connection across sequential multi-tenant queries without bleed", async () => {
    // 1. Query as Alpha user
    const alphaCount = await executeWithRls(ALPHA_USER, async (client) => {
      const res = await client.query("SELECT count(*) FROM assessments;");
      return Number(res.rows[0].count);
    });
    assert.equal(alphaCount, 1, "Alpha should see exactly 1 assessment");

    // 2. Query as Beta user on same pool
    const betaCount = await executeWithRls(BETA_USER, async (client) => {
      const res = await client.query("SELECT count(*) FROM assessments;");
      return Number(res.rows[0].count);
    });
    assert.equal(betaCount, 1, "Beta should see exactly 1 assessment");

    // 3. Query as Super Admin on same pool
    const superCount = await executeWithRls(SUPER_ADMIN, async (client) => {
      const res = await client.query("SELECT count(*) FROM assessments;");
      return Number(res.rows[0].count);
    });
    assert.ok(superCount >= 2, "Super Admin sees all assessments across tenants");

    // 4. Unauthenticated raw connection check
    const client = await pool.connect();
    try {
      await client.query("SET ROLE dpdp_app_user;");
      const unauthCount = await client.query("SELECT count(*) FROM assessments;");
      assert.equal(
        Number(unauthCount.rows[0].count),
        0,
        "Connection reused without RLS context must see 0 rows (fail-closed)"
      );
      await client.query("RESET ROLE;");
    } finally {
      client.release();
    }
  });

  it("should maintain tenant isolation across sequential switching after failed and successful transactions", async () => {
    // 1. Successful query on Alpha
    const alphaRes = await executeWithRls(ALPHA_USER, async (client) => {
      const res = await client.query("SELECT id FROM assessments;");
      return res.rows.map((r) => r.id);
    });
    assert.deepEqual(alphaRes, ["018f3a5b-7c8d-7e90-8000-000000000201"]);

    // 2. Failed query on Alpha causing rollback
    await assert.rejects(
      async () => {
        await executeWithRls(ALPHA_USER, async (client) => {
          await client.query("UPDATE assessments SET title = 'Corrupted' WHERE false;");
          throw new Error("Simulated business logic failure mid-transaction");
        });
      },
      /Simulated business logic failure/
    );

    // 3. Immediate query on Beta over the same connection pool
    const betaRes = await executeWithRls(BETA_USER, async (client) => {
      const res = await client.query("SELECT id FROM assessments;");
      return res.rows.map((r) => r.id);
    });
    // Beta must see strictly Beta assessment and zero Alpha assessments
    assert.deepEqual(betaRes, ["018f3a5b-7c8d-7e90-8000-000000000202"]);
    assert.ok(!betaRes.includes("018f3a5b-7c8d-7e90-8000-000000000201"));

    // 4. Verify context on Beta query is strictly Beta's role and tenant
    await executeWithRls(BETA_USER, async (client) => {
      const roleCheck = await client.query(
        "SELECT current_setting('app.current_user_role', true) AS role, current_setting('app.current_tenant_id', true) AS tid;"
      );
      assert.equal(roleCheck.rows[0].role, "CLIENT_ADMIN");
      assert.equal(roleCheck.rows[0].tid, BETA_USER.tenantId);
    });
  });
});
