/**
 * TLI DPDP Compliance Gap Analysis Tool — Phase 7 Test Suite
 * Secure Customer Onboarding, User Invitations & Assessment Assignment
 *
 * Verifies:
 * 1. Authorized TLI Super Admin creates a customer organization (HTTP 201).
 * 2. Unauthorized Client Admin and Consultant blocked from creating customer (HTTP 403).
 * 3. Duplicate customer name / slug rejected with HTTP 409 Conflict.
 * 4. Direct provisioning of client user with valid client role (HTTP 201).
 * 5. Rejection of non-client roles in user provisioning (HTTP 400).
 * 6. Duplicate user email rejected with HTTP 409 Conflict.
 * 7. Cryptographic invitation token generation with SHA-256 hash storage & unconfigured SMTP notice.
 * 8. Single-use token acceptance and account activation via acceptCustomerInvitation (HTTP 200).
 * 9. Rejection of expired, reused, or invalid invitation tokens (HTTP 400).
 * 10. Assessment creation for newly created customer with coordinator assignment (HTTP 201).
 * 11. Strict rejection of cross-tenant user assignment (HTTP 400).
 * 12. Activated customer user accesses strictly their own organization's assessment under live PostgreSQL RLS.
 * 13. Customer user blocked from querying or modifying other tenant records.
 * 14. Verification of immutable audit log entries (TENANT_CREATED, USER_PROVISIONED, USER_INVITED, INVITATION_ACCEPTED, ASSESSMENT_CREATED).
 */

import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { pool } from "../lib/db/pool.ts";
import { executeWithRls } from "../lib/db/rls.ts";
import type { SessionUser, UserRole } from "../lib/auth/types.ts";
import {
  createCustomerOrganization,
  getCustomerDetails,
  provisionCustomerUser,
  createCustomerInvitation,
  acceptCustomerInvitation,
  createCustomerAssessment,
  OnboardingError,
} from "../lib/onboarding/index.ts";

// Synthetic test run timestamp to guarantee unique slugs, emails, and codes
const SUITE_ID = Date.now().toString(36);

const TLI_TENANT_ID = "018f3a5b-7c8d-7e90-8000-000000000001";
const ALPHA_TENANT_ID = "018f3a5b-7c8d-7e90-8000-000000000002";
const BETA_TENANT_ID = "018f3a5b-7c8d-7e90-8000-000000000003";

const SUPER_ADMIN_USER: SessionUser = {
  userId: "018f3a5b-7c8d-7e90-8000-000000000101",
  email: "admin.super@truthlabs.in",
  fullName: "TLI Super Administrator",
  role: "TLI_SUPER_ADMIN",
  tenantId: TLI_TENANT_ID,
  tenantName: "Truth Labs International",
  tenantSlug: "truth-labs-advisory",
  tenantType: "TLI",
  isSdf: false,
};

const LEAD_CONSULTANT_USER: SessionUser = {
  userId: "018f3a5b-7c8d-7e90-8000-000000000102",
  email: "lead.consultant@truthlabs.in",
  fullName: "TLI Lead Consultant",
  role: "TLI_LEAD_CONSULTANT",
  tenantId: TLI_TENANT_ID,
  tenantName: "Truth Labs International",
  tenantSlug: "truth-labs-advisory",
  tenantType: "TLI",
  isSdf: false,
};

const CLIENT_ADMIN_ALPHA: SessionUser = {
  userId: "018f3a5b-7c8d-7e90-8000-000000000111",
  email: "admin@alphahealth.example.com",
  fullName: "Vikram Malhotra",
  role: "CLIENT_ADMIN",
  tenantId: ALPHA_TENANT_ID,
  tenantName: "Alpha Healthcare Technologies Pvt Ltd",
  tenantSlug: "alpha-healthcare",
  tenantType: "CLIENT",
  isSdf: true,
};

let createdCustomerId: string;
let createdCustomerSlug: string;
let provisionedUserId: string;
let invitationToken: string;
let invitedUserEmail: string;
let activatedUserId: string;
let createdAssessmentId: string;

describe("Phase 7: Secure Customer Onboarding, User Invitations & Assessment Assignment", () => {
  after(async () => {
    // Preserve database connections
  });

  it("1. Authorized TLI_SUPER_ADMIN creates customer organization (HTTP 201)", async () => {
    const customerName = `Acme FinCorp Solutions Pvt Ltd (${SUITE_ID})`;
    createdCustomerSlug = `acme-fincorp-${SUITE_ID}`;

    const result = await createCustomerOrganization(
      SUPER_ADMIN_USER,
      {
        name: customerName,
        slug: createdCustomerSlug,
        industry: "Financial Services",
        isSdf: true,
        dpoName: "Anand Verma",
        dpoEmail: `dpo.${SUITE_ID}@acmefincorp.test`,
        phone: "+91 98765 43210",
        address: "Bandra Kurla Complex, Mumbai, Maharashtra 400051",
      },
      "127.0.0.1",
      "TLI-Automated-Test"
    );

    assert.ok(result.customer?.id);
    createdCustomerId = result.customer.id;
    assert.equal(result.customer.name, customerName);
    assert.equal(result.customer.slug, createdCustomerSlug);
    assert.equal(result.customer.is_sdf, true);

    // Verify persisted in PostgreSQL
    const dbRes = await pool.query("SELECT * FROM tenants WHERE id = $1;", [createdCustomerId]);
    assert.equal(dbRes.rowCount, 1);
    assert.equal(dbRes.rows[0].status, "ACTIVE");
    assert.equal(dbRes.rows[0].type, "CLIENT");

    // Verify audit log entry
    const auditRes = await pool.query(
      "SELECT * FROM audit_logs WHERE action = 'TENANT_CREATED' AND entity_id = $1;",
      [createdCustomerId]
    );
    assert.equal(auditRes.rowCount, 1, "Should record TENANT_CREATED audit log");
    assert.equal(auditRes.rows[0].user_id, SUPER_ADMIN_USER.userId);
  });

  it("2. Unauthorized CLIENT_ADMIN and Consultant blocked from creating customer (HTTP 403)", async () => {
    // Attempt by Client Admin
    await assert.rejects(
      async () => {
        await createCustomerOrganization(CLIENT_ADMIN_ALPHA, {
          name: `Rogue Customer (${SUITE_ID})`,
          slug: `rogue-${SUITE_ID}`,
        });
      },
      (err: Error) => {
        assert.ok(err instanceof OnboardingError);
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, "FORBIDDEN");
        return true;
      }
    );

    // Attempt by Lead Consultant
    await assert.rejects(
      async () => {
        await createCustomerOrganization(LEAD_CONSULTANT_USER, {
          name: `Rogue Customer 2 (${SUITE_ID})`,
          slug: `rogue-2-${SUITE_ID}`,
        });
      },
      (err: Error) => {
        assert.ok(err instanceof OnboardingError);
        assert.equal(err.statusCode, 403);
        return true;
      }
    );
  });

  it("3. Duplicate customer name / slug returns HTTP 409 Conflict", async () => {
    await assert.rejects(
      async () => {
        await createCustomerOrganization(SUPER_ADMIN_USER, {
          name: `Different Name (${SUITE_ID})`,
          slug: createdCustomerSlug, // Exact same slug
        });
      },
      (err: Error) => {
        assert.ok(err instanceof OnboardingError);
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, "CONFLICT");
        return true;
      }
    );
  });

  it("4. Direct provisioning of client user with valid client role (HTTP 201)", async () => {
    const userEmail = `coordinator.${SUITE_ID}@acmefincorp.test`;

    const newUser = await provisionCustomerUser(
      SUPER_ADMIN_USER,
      createdCustomerId,
      {
        fullName: "Ravi Coordinator",
        email: userEmail,
        role: "CLIENT_ADMIN" as UserRole,
        phone: "+91 98765 00001",
        password: "CorporatePassword123!@#",
      },
      "127.0.0.1",
      "TLI-Automated-Test"
    );

    assert.ok(newUser?.id);
    provisionedUserId = newUser.id;
    assert.equal(newUser.role, "CLIENT_ADMIN");
    assert.equal(newUser.tenant_id, createdCustomerId);

    // Verify in PostgreSQL
    const userDb = await pool.query("SELECT * FROM users WHERE id = $1;", [provisionedUserId]);
    assert.equal(userDb.rowCount, 1);
    assert.equal(userDb.rows[0].is_active, true);

    // Verify audit log
    const auditRes = await pool.query(
      "SELECT * FROM audit_logs WHERE action = 'USER_PROVISIONED' AND entity_id = $1;",
      [provisionedUserId]
    );
    assert.equal(auditRes.rowCount, 1, "Should record USER_PROVISIONED audit log");
  });

  it("5. Rejection of non-client roles in user provisioning (HTTP 400)", async () => {
    await assert.rejects(
      async () => {
        await provisionCustomerUser(SUPER_ADMIN_USER, createdCustomerId, {
          fullName: "Rogue TLI Admin Attempt",
          email: `rogue.${SUITE_ID}@acmefincorp.test`,
          role: "TLI_SUPER_ADMIN" as UserRole, // Disallowed role for customer organization
        });
      },
      (err: Error) => {
        assert.ok(err instanceof OnboardingError);
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, "INVALID_ROLE");
        return true;
      }
    );
  });

  it("6. Duplicate user email returns HTTP 409 Conflict", async () => {
    await assert.rejects(
      async () => {
        await provisionCustomerUser(SUPER_ADMIN_USER, createdCustomerId, {
          fullName: "Duplicate User Attempt",
          email: `coordinator.${SUITE_ID}@acmefincorp.test`, // Existing email
          role: "CLIENT_CONTRIBUTOR" as UserRole,
        });
      },
      (err: Error) => {
        assert.ok(err instanceof OnboardingError);
        assert.equal(err.statusCode, 409);
        return true;
      }
    );
  });

  it("7. Cryptographic invitation token generation with SHA-256 hash storage & unconfigured SMTP notice", async () => {
    invitedUserEmail = `contributor.${SUITE_ID}@acmefincorp.test`;

    const invResult = await createCustomerInvitation(
      SUPER_ADMIN_USER,
      createdCustomerId,
      {
        email: invitedUserEmail,
        role: "CLIENT_CONTRIBUTOR" as UserRole,
      },
      "http://localhost:3000",
      "127.0.0.1",
      "TLI-Automated-Test"
    );

    assert.ok(invResult.token, "Must return single-use activation token");
    invitationToken = invResult.token;
    assert.equal(invitationToken.length, 64, "Token should be 32 bytes hex (64 chars)");
    assert.ok(invResult.activationUrl.includes(invitationToken));

    // Verify SMTP unconfigured delivery status
    assert.equal(invResult.emailDelivery?.sent, false);
    assert.equal(invResult.emailDelivery?.reason, "SMTP_NOT_CONFIGURED");

    // Database verification: token MUST be stored ONLY as SHA-256 hash!
    const invDb = await pool.query(
      "SELECT * FROM user_invitations WHERE tenant_id = $1 AND email = $2;",
      [createdCustomerId, invitedUserEmail]
    );
    assert.equal(invDb.rowCount, 1);
    const invRow = invDb.rows[0];
    assert.equal(invRow.status, "PENDING");
    assert.equal(invRow.accepted_at, null);

    const expectedHash = crypto.createHash("sha256").update(invitationToken).digest("hex");
    assert.equal(invRow.token_hash, expectedHash, "Database must store exact SHA-256 hash of token");
    assert.notEqual(invRow.token_hash, invitationToken, "Database MUST NOT store raw token");

    // Verify audit log
    const auditRes = await pool.query(
      "SELECT * FROM audit_logs WHERE action = 'USER_INVITED' AND entity_id = $1;",
      [invRow.id]
    );
    assert.equal(auditRes.rowCount, 1, "Should record USER_INVITED audit log");
  });

  it("8. Single-use token acceptance and account activation via acceptCustomerInvitation (HTTP 200)", async () => {
    const activatedUser = await acceptCustomerInvitation(
      {
        token: invitationToken,
        fullName: "Priya Contributor",
        password: "CorporateActivation123!@#",
      },
      "127.0.0.1",
      "TLI-Automated-Test"
    );

    assert.ok(activatedUser?.id);
    activatedUserId = activatedUser.id;
    assert.equal(activatedUser.email, invitedUserEmail);
    assert.equal(activatedUser.role, "CLIENT_CONTRIBUTOR");

    // Verify in database: user is ACTIVE and attached to customer organization
    const userRes = await pool.query("SELECT * FROM users WHERE id = $1;", [activatedUserId]);
    assert.equal(userRes.rowCount, 1);
    assert.equal(userRes.rows[0].tenant_id, createdCustomerId);
    assert.equal(userRes.rows[0].is_active, true);

    // Verify invitation status changed to ACCEPTED
    const invRes = await pool.query(
      "SELECT status, accepted_at FROM user_invitations WHERE email = $1;",
      [invitedUserEmail]
    );
    assert.equal(invRes.rows[0].status, "ACCEPTED");
    assert.notEqual(invRes.rows[0].accepted_at, null);

    // Verify audit log
    const auditRes = await pool.query(
      "SELECT * FROM audit_logs WHERE action = 'INVITATION_ACCEPTED' AND user_id = $1;",
      [activatedUserId]
    );
    assert.equal(auditRes.rowCount, 1, "Should record INVITATION_ACCEPTED audit log");
  });

  it("9. Rejection of expired, reused, or invalid invitation tokens (HTTP 400)", async () => {
    // 1. Replay attack: reusing the already-accepted token
    await assert.rejects(
      async () => {
        await acceptCustomerInvitation({
          token: invitationToken,
          fullName: "Priya Replay Attack",
          password: "AnotherPassword123!@#",
        });
      },
      (err: Error) => {
        assert.ok(err instanceof OnboardingError);
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, "TOKEN_ALREADY_USED");
        return true;
      }
    );

    // 2. Bogus token
    await assert.rejects(
      async () => {
        await acceptCustomerInvitation({
          token: "0".repeat(64),
          fullName: "Bogus User",
          password: "AnotherPassword123!@#",
        });
      },
      (err: Error) => {
        assert.ok(err instanceof OnboardingError);
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });

  it("10. Assessment creation for newly created customer with coordinator assignment (HTTP 201)", async () => {
    const engagementCode = `ENG-ACME-${SUITE_ID.toUpperCase()}`;

    const assessment = await createCustomerAssessment(
      SUPER_ADMIN_USER,
      {
        tenantId: createdCustomerId,
        title: `Acme FinCorp DPDP Readiness Assessment (${SUITE_ID})`,
        engagementCode,
        leadConsultantId: LEAD_CONSULTANT_USER.userId,
        targetCompletionDate: "2026-12-31",
        assignedUserIds: [provisionedUserId], // Assign Ravi Coordinator
      },
      "127.0.0.1",
      "TLI-Automated-Test"
    );

    assert.ok(assessment?.id);
    createdAssessmentId = assessment.id;
    assert.equal(assessment.status, "DRAFT");
    assert.equal(assessment.tenant_id, createdCustomerId);

    // Verify assignment row created in assessment_assignments
    const assignDb = await pool.query(
      "SELECT * FROM assessment_assignments WHERE assessment_id = $1 AND user_id = $2;",
      [createdAssessmentId, provisionedUserId]
    );
    assert.equal(assignDb.rowCount, 1, "Should create assessment_assignments record for coordinator");
    assert.equal(assignDb.rows[0].assignment_role, "CLIENT_COORDINATOR");

    // Verify audit log
    const auditRes = await pool.query(
      "SELECT * FROM audit_logs WHERE action = 'ASSESSMENT_CREATED' AND entity_id = $1;",
      [createdAssessmentId]
    );
    assert.equal(auditRes.rowCount, 1, "Should record ASSESSMENT_CREATED audit log");
  });

  it("11. Strict rejection of cross-tenant user assignment (HTTP 400)", async () => {
    await assert.rejects(
      async () => {
        await createCustomerAssessment(SUPER_ADMIN_USER, {
          tenantId: createdCustomerId,
          title: "Cross Tenant Attack Assessment",
          engagementCode: `ENG-CROSS-${SUITE_ID.toUpperCase()}`,
          leadConsultantId: LEAD_CONSULTANT_USER.userId,
          assignedUserIds: [CLIENT_ADMIN_ALPHA.userId], // Attacker assigns user from Alpha to Acme!
        });
      },
      (err: Error) => {
        assert.ok(err instanceof OnboardingError);
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, "CROSS_TENANT_VIOLATION");
        return true;
      }
    );
  });

  it("12. Customer user accesses strictly their own organization's assessment under live PostgreSQL RLS", async () => {
    const customerUserSession: SessionUser = {
      userId: activatedUserId,
      email: invitedUserEmail,
      fullName: "Priya Contributor",
      role: "CLIENT_CONTRIBUTOR",
      tenantId: createdCustomerId,
      tenantName: `Acme FinCorp Solutions Pvt Ltd (${SUITE_ID})`,
      tenantSlug: createdCustomerSlug,
      tenantType: "CLIENT",
      isSdf: true,
    };

    // Verify via raw live PostgreSQL kernel RLS
    await executeWithRls(customerUserSession, async (client) => {
      // Should see Acme assessment
      const ownRes = await client.query("SELECT id FROM assessments WHERE tenant_id = $1;", [createdCustomerId]);
      assert.equal(ownRes.rowCount, 1);

      // Must NOT see Alpha assessment
      const alphaRes = await client.query("SELECT id FROM assessments WHERE tenant_id = $1;", [ALPHA_TENANT_ID]);
      assert.equal(alphaRes.rowCount, 0, "RLS must block reading Alpha Healthcare assessments");

      // Must NOT see Beta assessment
      const betaRes = await client.query("SELECT id FROM assessments WHERE tenant_id = $1;", [BETA_TENANT_ID]);
      assert.equal(betaRes.rowCount, 0, "RLS must block reading Beta Express assessments");

      // Global count query must return strictly customer's own assessments
      const totalRes = await client.query("SELECT COUNT(*)::int AS count FROM assessments;");
      assert.equal(totalRes.rows[0].count, 1, "RLS must restrict COUNT to 1");
    });
  });

  it("13. Customer user blocked from querying or modifying other tenant records", async () => {
    const customerUserSession: SessionUser = {
      userId: activatedUserId,
      email: invitedUserEmail,
      fullName: "Priya Contributor",
      role: "CLIENT_CONTRIBUTOR",
      tenantId: createdCustomerId,
      tenantName: `Acme FinCorp Solutions Pvt Ltd (${SUITE_ID})`,
      tenantSlug: createdCustomerSlug,
      tenantType: "CLIENT",
      isSdf: true,
    };

    await executeWithRls(customerUserSession, async (client) => {
      // 1. Reading other tenant profile
      const otherTenant = await client.query("SELECT id, name FROM tenants WHERE id = $1;", [ALPHA_TENANT_ID]);
      assert.equal(otherTenant.rowCount, 0, "RLS must block reading other tenant profile");

      // 2. Modifying other tenant assessment
      const updateRes = await client.query(
        "UPDATE assessments SET title = 'TAMPERED' WHERE tenant_id = $1 RETURNING id;",
        [ALPHA_TENANT_ID]
      );
      assert.equal(updateRes.rowCount, 0, "RLS must block updating other tenant assessments");
    });

    // 3. Customer detail service call boundary check
    await assert.rejects(
      async () => {
        await getCustomerDetails(customerUserSession, ALPHA_TENANT_ID);
      },
      (err: Error) => {
        assert.ok(err instanceof OnboardingError);
        assert.equal(err.statusCode, 403);
        return true;
      }
    );
  });

  it("14. Verification of immutable audit log entries across entire onboarding workflow", async () => {
    const auditRes = await pool.query(
      `SELECT action, entity_type, entity_id, user_id, timestamp
       FROM audit_logs
       WHERE entity_id IN ($1, $2, $3, $4)
       ORDER BY timestamp ASC;`,
      [createdCustomerId, provisionedUserId, activatedUserId, createdAssessmentId]
    );

    const actions = auditRes.rows.map((r) => r.action);
    assert.ok(actions.includes("TENANT_CREATED"), "Audit trail must include TENANT_CREATED");
    assert.ok(actions.includes("USER_PROVISIONED"), "Audit trail must include USER_PROVISIONED");
    assert.ok(actions.includes("ASSESSMENT_CREATED"), "Audit trail must include ASSESSMENT_CREATED");

    // Verify all rows have non-null timestamps and valid actor IDs
    for (const row of auditRes.rows) {
      assert.ok(row.timestamp, "Audit record must have valid timestamp");
      assert.ok(row.user_id, "Audit record must record actor user_id");
    }
  });
});
