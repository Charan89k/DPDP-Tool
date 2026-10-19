import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { executeWithRls, DatabaseAuthorizationError } from "../lib/db/rls.ts";
import { pool } from "../lib/db/pool.ts";
import type { SessionUser } from "../lib/auth/types.ts";

const DEMO_CONSULTANT: SessionUser = {
  userId: "018f3a5b-7c8d-7e90-8000-000000000191",
  email: "consultant.demo@tli.local",
  fullName: "TLI Consultant Demo",
  role: "TLI_LEAD_CONSULTANT",
  tenantId: "018f3a5b-7c8d-7e90-8000-000000000001",
  tenantName: "Truth Labs International",
  tenantSlug: "truth-labs-advisory",
  tenantType: "TLI",
  isSdf: false,
};

const DEMO_CUSTOMER: SessionUser = {
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

// TLI Reviewer assigned to Alpha Healthcare (201) but NOT assigned to Beta Express (202)
const TLI_REVIEWER_PARTIAL: SessionUser = {
  userId: "018f3a5b-7c8d-7e90-8000-000000000103",
  email: "reviewer.privacy@truthlabs.in",
  fullName: "Priya Sharma (Privacy Reviewer)",
  role: "TLI_REVIEWER",
  tenantId: "018f3a5b-7c8d-7e90-8000-000000000001",
  tenantName: "Truth Labs International",
  tenantSlug: "truth-labs-advisory",
  tenantType: "TLI",
  isSdf: false,
};

describe("Phase 3D: Post-Login Workspace Flow & Live RLS Enforcement", () => {
  after(async () => {
    await pool.end();
  });

  it("should successfully execute /dashboard metric and sample queries for DEMO_CUSTOMER", async () => {
    const data = await executeWithRls(DEMO_CUSTOMER, async (client) => {
      const assessmentsRes = await client.query(
        "SELECT COUNT(*)::int AS count FROM assessments;"
      );
      const buRes = await client.query(
        "SELECT COUNT(*)::int AS count FROM business_units;"
      );
      const ropaRes = await client.query(
        "SELECT COUNT(*)::int AS count FROM processing_activities;"
      );
      const recentRes = await client.query(`
        SELECT 
          a.id, 
          a.title, 
          a.status, 
          fv.name AS target_framework, 
          a.created_at AS start_date 
        FROM assessments a
        JOIN framework_versions fv ON fv.id = a.framework_version_id
        ORDER BY a.created_at DESC 
        LIMIT 1;
      `);

      return {
        assessmentCount: assessmentsRes.rows[0]?.count,
        buCount: buRes.rows[0]?.count,
        ropaCount: ropaRes.rows[0]?.count,
        latestAssessment: recentRes.rows[0],
      };
    });

    assert.equal(data.assessmentCount, 1, "Customer should see exactly 1 assessment");
    assert.equal(data.buCount, 3, "Customer should see 3 business units for Alpha Healthcare");
    assert.ok(data.latestAssessment, "Customer should receive latest assessment record");
    assert.equal(data.latestAssessment.id, "018f3a5b-7c8d-7e90-8000-000000000201");
    assert.ok(data.latestAssessment.target_framework.includes("Digital Personal Data Protection Act"));
    assert.ok(data.latestAssessment.start_date, "Commenced start_date must be populated");
  });

  it("should successfully execute /dashboard metric and sample queries for DEMO_CONSULTANT", async () => {
    const data = await executeWithRls(DEMO_CONSULTANT, async (client) => {
      const assessmentsRes = await client.query(
        "SELECT COUNT(*)::int AS count FROM assessments;"
      );
      const recentRes = await client.query(`
        SELECT 
          a.id, 
          a.title, 
          a.status, 
          fv.name AS target_framework, 
          a.created_at AS start_date 
        FROM assessments a
        JOIN framework_versions fv ON fv.id = a.framework_version_id
        ORDER BY a.created_at DESC 
        LIMIT 1;
      `);

      return {
        assessmentCount: assessmentsRes.rows[0]?.count,
        latestAssessment: recentRes.rows[0],
      };
    });

    assert.equal(data.assessmentCount, 2, "Consultant should see 2 assigned assessments across clients");
    assert.ok(data.latestAssessment, "Consultant should receive latest assessment");
    assert.ok(data.latestAssessment.target_framework.includes("Digital Personal Data Protection Act"));
  });

  it("should execute /dashboard/assessments query and enforce strict tenant boundaries", async () => {
    // 1. Customer query
    const customerAssessments = await executeWithRls(DEMO_CUSTOMER, async (client) => {
      const res = await client.query(`
        SELECT 
          a.id,
          a.tenant_id,
          a.title,
          'ENTERPRISE_GAP_ASSESSMENT' AS assessment_type,
          a.status,
          fv.name AS target_framework,
          a.created_at AS start_date,
          a.target_completion_date,
          u.full_name AS lead_consultant_name,
          t.dpo_name AS dpo_contact_name,
          a.created_at,
          t.name AS tenant_name,
          t.slug AS tenant_slug,
          t.is_sdf
        FROM assessments a
        JOIN framework_versions fv ON fv.id = a.framework_version_id
        LEFT JOIN users u ON u.id = a.lead_consultant_id
        LEFT JOIN tenants t ON t.id = a.tenant_id
        ORDER BY a.created_at DESC;
      `);
      return res.rows;
    });

    assert.equal(customerAssessments.length, 1, "Customer must see only 1 assessment");
    assert.equal(customerAssessments[0].tenant_id, DEMO_CUSTOMER.tenantId);
    assert.equal(customerAssessments[0].tenant_slug, "alpha-healthcare");
    assert.equal(customerAssessments[0].is_sdf, true);
    assert.ok(customerAssessments[0].lead_consultant_name, "Lead consultant name resolved via RLS");

    // 2. Consultant query
    const consultantAssessments = await executeWithRls(DEMO_CONSULTANT, async (client) => {
      const res = await client.query(`
        SELECT 
          a.id,
          a.tenant_id,
          a.title,
          'ENTERPRISE_GAP_ASSESSMENT' AS assessment_type,
          a.status,
          fv.name AS target_framework,
          a.created_at AS start_date,
          a.target_completion_date,
          u.full_name AS lead_consultant_name,
          t.dpo_name AS dpo_contact_name,
          a.created_at,
          t.name AS tenant_name,
          t.slug AS tenant_slug,
          t.is_sdf
        FROM assessments a
        JOIN framework_versions fv ON fv.id = a.framework_version_id
        LEFT JOIN users u ON u.id = a.lead_consultant_id
        LEFT JOIN tenants t ON t.id = a.tenant_id
        ORDER BY a.created_at DESC;
      `);
      return res.rows;
    });

    assert.equal(consultantAssessments.length, 2, "Consultant must see 2 assigned assessments");
    const tenantSlugs = consultantAssessments.map((a) => a.tenant_slug);
    assert.ok(tenantSlugs.includes("alpha-healthcare"), "Includes Alpha Healthcare");
    assert.ok(tenantSlugs.includes("beta-express"), "Includes Beta Express");
  });

  it("should enforce RLS isolation preventing customer from querying Beta Express assessment and tenant data", async () => {
    const betaAssessmentId = "018f3a5b-7c8d-7e90-8000-000000000202";
    const betaTenantId = "018f3a5b-7c8d-7e90-8000-000000000003";

    await executeWithRls(DEMO_CUSTOMER, async (client) => {
      // 1. Beta Assessment
      const aRes = await client.query("SELECT id FROM assessments WHERE id = $1;", [betaAssessmentId]);
      assert.equal(aRes.rows.length, 0, "Customer must see 0 rows for Beta Express assessment");

      // 2. Beta Tenant
      const tRes = await client.query("SELECT id FROM tenants WHERE id = $1;", [betaTenantId]);
      assert.equal(tRes.rows.length, 0, "Customer must see 0 rows for Beta Express tenant");

      // 3. Beta Users
      const uRes = await client.query("SELECT id FROM users WHERE tenant_id = $1;", [betaTenantId]);
      assert.equal(uRes.rows.length, 0, "Customer must see 0 rows for Beta Express users");
    });
  });

  it("should enforce assignment boundary for consultant (reviewer assigned to Alpha cannot see Beta)", async () => {
    const betaAssessmentId = "018f3a5b-7c8d-7e90-8000-000000000202";
    const betaTenantId = "018f3a5b-7c8d-7e90-8000-000000000003";

    await executeWithRls(TLI_REVIEWER_PARTIAL, async (client) => {
      // Assigned to Alpha: should see Alpha assessment
      const alphaRes = await client.query("SELECT id FROM assessments WHERE tenant_id = '018f3a5b-7c8d-7e90-8000-000000000002';");
      assert.equal(alphaRes.rows.length, 1, "Reviewer must see Alpha assessment where assigned");

      // NOT assigned to Beta: should see 0 Beta assessments
      const betaRes = await client.query("SELECT id FROM assessments WHERE id = $1;", [betaAssessmentId]);
      assert.equal(betaRes.rows.length, 0, "Reviewer must see 0 rows for unassigned Beta assessment");

      // Should NOT see Beta tenant
      const betaTenantRes = await client.query("SELECT id FROM tenants WHERE id = $1;", [betaTenantId]);
      assert.equal(betaTenantRes.rows.length, 0, "Reviewer must see 0 rows for unassigned Beta tenant");

      // Should NOT see Beta users
      const betaUsersRes = await client.query("SELECT id FROM users WHERE tenant_id = $1;", [betaTenantId]);
      assert.equal(betaUsersRes.rows.length, 0, "Reviewer must see 0 rows for unassigned Beta users");
    });
  });

  it("should revoke consultant access immediately upon assignment removal in database", async () => {
    const betaAssessmentId = "018f3a5b-7c8d-7e90-8000-000000000202";
    const betaTenantId = "018f3a5b-7c8d-7e90-8000-000000000003";

    // Perform verification inside a raw transaction with ROLLBACK to protect persistent state
    const rawClient = await pool.connect();
    try {
      await rawClient.query("BEGIN;");

      // Remove consultant assignment from Beta
      await rawClient.query(
        "DELETE FROM assessment_assignments WHERE assessment_id = $1 AND user_id = $2;",
        [betaAssessmentId, DEMO_CONSULTANT.userId]
      );

      // Now query as consultant under RLS
      // Bind the consultant's policy context inside this transaction (rolled back below)
      await rawClient.query(
        "UPDATE temp._ctx SET tenant_id = $1, user_id = $2, role = $3, bypass = 0;",
        [DEMO_CONSULTANT.tenantId, DEMO_CONSULTANT.userId, DEMO_CONSULTANT.role]
      );

      const res = await rawClient.query("SELECT id FROM assessments WHERE id = $1;", [betaAssessmentId]);
      assert.equal(res.rows.length, 0, "Removing assignment must immediately revoke assessment visibility");

      const tRes = await rawClient.query("SELECT id FROM tenants WHERE id = $1;", [betaTenantId]);
      assert.equal(tRes.rows.length, 0, "Removing assignment must immediately revoke client tenant visibility");

      const uRes = await rawClient.query("SELECT id FROM users WHERE tenant_id = $1;", [betaTenantId]);
      assert.equal(uRes.rows.length, 0, "Removing assignment must immediately revoke client users visibility");

      await rawClient.query("ROLLBACK;");
    } finally {
      rawClient.release();
    }
  });

  it("should block consultant from modifying or deleting client tenant and user records", async () => {
    const alphaTenantId = "018f3a5b-7c8d-7e90-8000-000000000002";

    await executeWithRls(DEMO_CONSULTANT, async (client) => {
      // 1. Attempt UPDATE on client tenant
      const updateTenantRes = await client.query(
        "UPDATE tenants SET name = 'Hacked Tenant Name' WHERE id = $1 RETURNING id;",
        [alphaTenantId]
      );
      assert.equal(updateTenantRes.rowCount, 0, "Consultant cannot UPDATE client tenant records");

      // 2. Attempt DELETE on client tenant
      const deleteTenantRes = await client.query(
        "DELETE FROM tenants WHERE id = $1 RETURNING id;",
        [alphaTenantId]
      );
      assert.equal(deleteTenantRes.rowCount, 0, "Consultant cannot DELETE client tenant records");

      // 3. Attempt UPDATE on client user
      const updateUserRes = await client.query(
        "UPDATE users SET full_name = 'Hacked Name' WHERE email = 'admin@alphahealth.example.com' RETURNING id;"
      );
      assert.equal(updateUserRes.rowCount, 0, "Consultant cannot UPDATE client user records");

      // 4. Attempt DELETE on client user
      const deleteUserRes = await client.query(
        "DELETE FROM users WHERE email = 'admin@alphahealth.example.com' RETURNING id;"
      );
      assert.equal(deleteUserRes.rowCount, 0, "Consultant cannot DELETE client user records");

      // 5. Attempt tenant hijacking on client user
      const hijackRes = await client.query(
        "UPDATE users SET tenant_id = $1 WHERE email = 'admin@alphahealth.example.com' RETURNING id;",
        [DEMO_CONSULTANT.tenantId]
      );
      assert.equal(hijackRes.rowCount, 0, "Consultant cannot hijack client users into consultant tenant");
    });
  });

  it("should block client user from modifying or inserting records across tenant boundaries", async () => {
    const betaTenantId = "018f3a5b-7c8d-7e90-8000-000000000003";

    await executeWithRls(DEMO_CUSTOMER, async (client) => {
      // 1. Attempt UPDATE on Beta tenant
      const updateRes = await client.query(
        "UPDATE tenants SET name = 'Alpha Owns Beta' WHERE id = $1 RETURNING id;",
        [betaTenantId]
      );
      assert.equal(updateRes.rowCount, 0, "Customer cannot UPDATE other tenant records");

      // 2. Attempt DELETE on Beta tenant
      const deleteRes = await client.query(
        "DELETE FROM tenants WHERE id = $1 RETURNING id;",
        [betaTenantId]
      );
      assert.equal(deleteRes.rowCount, 0, "Customer cannot DELETE other tenant records");

      // 3. Attempt cross-tenant INSERT into users
      await assert.rejects(
        async () => {
          await client.query(`
            INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active)
            VALUES ('018f3a5b-7c8d-7e90-8000-000000000998', $1, 'trojan@beta.com', 'hash', 'Trojan', 'CLIENT_ADMIN', TRUE);
          `, [betaTenantId]);
        },
        /violates row-level security policy/,
        "Customer cannot INSERT users into another tenant"
      );
    });
  });

  it("should fail closed if session context is missing, invalid, or forged", async () => {
    await assert.rejects(
      async () => executeWithRls(null as unknown as SessionUser, async () => {}),
      DatabaseAuthorizationError
    );

    // Context with non-existent tenant
    const forgedContext: SessionUser = {
      ...DEMO_CUSTOMER,
      tenantId: "018f3a5b-7c8d-7e90-8000-999999999999",
    };
    await assert.rejects(
      async () => executeWithRls(forgedContext, async (c) => c.query("SELECT 1;")),
      DatabaseAuthorizationError
    );
  });

  it("should allow consultant to view report detail for assigned assessment", async () => {
    const alphaId = "018f3a5b-7c8d-7e90-8000-000000000201";

    const report = await executeWithRls(DEMO_CONSULTANT, async (client) => {
      const res = await client.query(`
        SELECT 
          a.id,
          a.tenant_id,
          a.title,
          a.status,
          fv.name AS target_framework,
          a.created_at AS start_date,
          a.target_completion_date,
          u.full_name AS lead_consultant_name,
          t.dpo_name AS dpo_contact_name,
          a.created_at,
          t.name AS tenant_name,
          t.slug AS tenant_slug,
          t.industry,
          t.is_sdf
        FROM assessments a
        JOIN framework_versions fv ON fv.id = a.framework_version_id
        LEFT JOIN users u ON u.id = a.lead_consultant_id
        LEFT JOIN tenants t ON t.id = a.tenant_id
        WHERE a.id = $1
        LIMIT 1;
      `, [alphaId]);
      return res.rows[0];
    });

    assert.ok(report, "Consultant must retrieve assigned assessment report");
    assert.equal(report.tenant_name, "Alpha Healthcare Technologies Pvt Ltd");
    assert.equal(report.target_framework, "India Digital Personal Data Protection Act, 2023 Framework (v1.0)");
  });
});
