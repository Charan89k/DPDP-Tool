/**
 * TLI DPDP Compliance Gap Analysis Tool — Assessment Lifecycle Test Suite
 *
 * Verifies:
 * 1. Canonical 14-state lifecycle machine and role transition authority.
 * 2. Precondition guards (100% canonical questions answered vs rapid diagnostic partial assessment).
 * 3. Mandatory justification on N/A exclusions and cancellation transitions.
 * 4. Submission withdrawal guard (blocked once reviewer evaluation commences).
 * 5. Clarification thread gating (open threads block review completion and return to review).
 * 6. Assessor review completion gating (all applicable evaluated, exclusions verified).
 * 7. Lead Consultant sign-off (DEC-01) and final issuance.
 * 8. Kernel-enforced forensic immutability (responses, reviews, evidence, metadata locked post-issuance).
 * 9. Periodic re-audit cycle via parent_assessment_id cloning.
 * 10. Immutable audit logs and tamper-resistance triggers.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../lib/db/pool.ts";
import type { SessionUser } from "../lib/auth/types.ts";
import {
  CANONICAL_ASSESSMENT_STATUSES,
  isAssessmentImmutable,
  findTransitionRule,
  getAssessmentTransitionHistory,
  executeAssessmentTransition,
  cloneAssessmentForReaudit,
  LifecycleError,
} from "../lib/lifecycle/index.ts";

// Dedicated Test Tenant & Users (Isolated from Alpha and Beta to preserve other test suites)
const TEST_TENANT_ID = "018f3a5b-7c8d-7e90-8000-000000000088";
const TEST_CLIENT_ADMIN_ID = "018f3a5b-7c8d-7e90-8000-000000000188";
const TEST_CONSULTANT_ID = "018f3a5b-7c8d-7e90-8000-000000000189"; // Dedicated Gamma Lead Consultant
const TEST_REVIEWER_ID = "018f3a5b-7c8d-7e90-8000-000000000187"; // Dedicated Gamma Reviewer
const TLI_TENANT_ID = "018f3a5b-7c8d-7e90-8000-000000000001"; // Truth Labs Advisory

const testClientAdminSession: SessionUser = {
  userId: TEST_CLIENT_ADMIN_ID,
  tenantId: TEST_TENANT_ID,
  email: "admin@gammatest.local",
  fullName: "Gamma Test Admin",
  role: "CLIENT_ADMIN",
  tenantType: "CLIENT",
  tenantName: "Test Organisation",
  tenantSlug: "test-organisation",
  isSdf: false,
};

const testLeadConsultantSession: SessionUser = {
  userId: TEST_CONSULTANT_ID,
  tenantId: TLI_TENANT_ID,
  email: "gamma.lead@truthlabs.in",
  fullName: "Gamma Lead Consultant",
  role: "TLI_LEAD_CONSULTANT",
  tenantType: "TLI",
  tenantName: "Test Organisation",
  tenantSlug: "test-organisation",
  isSdf: false,
};

const testReviewerSession: SessionUser = {
  userId: TEST_REVIEWER_ID,
  tenantId: TLI_TENANT_ID,
  email: "gamma.reviewer@truthlabs.in",
  fullName: "Gamma Reviewer",
  role: "TLI_REVIEWER",
  tenantType: "TLI",
  tenantName: "Test Organisation",
  tenantSlug: "test-organisation",
  isSdf: false,
};


let testAssessmentId = "";
let frameworkVersionId = "";
let scoringModelId = "";

describe("Phase 3D.5: Assessment Lifecycle & Approval Controls Verification", () => {
  before(async () => {
    // 1. Resolve framework version and scoring model
    const fwRes = await pool.query("SELECT id FROM framework_versions LIMIT 1;");
    frameworkVersionId = fwRes.rows[0].id;

    const smRes = await pool.query("SELECT id FROM scoring_models LIMIT 1;");
    scoringModelId = smRes.rows[0].id;

    // 2. Setup isolated test tenant and users in database
    await pool.query(
      `INSERT INTO tenants (id, type, name, slug, industry, status)
       VALUES ($1, 'CLIENT', 'Gamma Health Test Systems', 'gamma-health-test', 'HealthTech', 'ACTIVE')
       ON CONFLICT (id) DO NOTHING;`,
      [TEST_TENANT_ID]
    );

    await pool.query(
      `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active)
       VALUES 
         ($1, $2, 'admin@gammatest.local', 'synthetic_hash', 'Gamma Admin', 'CLIENT_ADMIN', TRUE),
         ($3, $4, 'gamma.lead@truthlabs.in', 'synthetic_hash', 'Gamma Lead Consultant', 'TLI_LEAD_CONSULTANT', TRUE),
         ($5, $4, 'gamma.reviewer@truthlabs.in', 'synthetic_hash', 'Gamma Reviewer', 'TLI_REVIEWER', TRUE)
       ON CONFLICT (id) DO NOTHING;`,
      [TEST_CLIENT_ADMIN_ID, TEST_TENANT_ID, TEST_CONSULTANT_ID, TLI_TENANT_ID, TEST_REVIEWER_ID]
    );

    // 3. Create test assessment in DRAFT
    const engCode = `ENG-GAMMA-LIFECYCLE-${Date.now()}`;
    const assessRes = await pool.query(
      `INSERT INTO assessments (
        tenant_id, framework_version_id, scoring_model_id, engagement_code,
        title, status, lead_consultant_id, is_partial_assessment
      ) VALUES ($1, $2, $3, $4, 'Gamma Lifecycle Audit', 'DRAFT', $5, FALSE)
      RETURNING id;`,
      [TEST_TENANT_ID, frameworkVersionId, scoringModelId, engCode, TEST_CONSULTANT_ID]
    );
    testAssessmentId = assessRes.rows[0].id;

    // 4. Assign Lead Consultant & Reviewer
    await pool.query(
      `INSERT INTO assessment_assignments (assessment_id, user_id, assignment_role)
       VALUES ($1, $2, 'ENGAGEMENT_LEAD'), ($1, $3, 'REVIEWER')
       ON CONFLICT DO NOTHING;`,
      [testAssessmentId, TEST_CONSULTANT_ID, TEST_REVIEWER_ID]
    );
  });

  after(async () => {
    await pool.end();
  });

  // =========================================================================
  // TEST 1: Canonical State Machine Specifications
  // =========================================================================
  it("1. should define exactly the 14 canonical lifecycle states without renaming or invention", () => {
    assert.equal(CANONICAL_ASSESSMENT_STATUSES.length, 14);
    assert.deepEqual([...CANONICAL_ASSESSMENT_STATUSES], [
      "DRAFT",
      "SCOPING",
      "SCOPE_LOCKED",
      "DATA_GATHERING",
      "SUBMITTED_FOR_REVIEW",
      "UNDER_REVIEW",
      "CLARIFICATION_PENDING",
      "REVIEW_COMPLETED",
      "DRAFT_REPORT_GENERATED",
      "LEAD_APPROVED",
      "FINAL_ISSUED",
      "REMEDIATION_ACTIVE",
      "CANCELLED",
      "ARCHIVED",
    ]);

    assert.equal(isAssessmentImmutable("FINAL_ISSUED"), true);
    assert.equal(isAssessmentImmutable("ARCHIVED"), true);
    assert.equal(isAssessmentImmutable("LEAD_APPROVED"), true);
    assert.equal(isAssessmentImmutable("DATA_GATHERING"), false);
    assert.equal(isAssessmentImmutable("UNDER_REVIEW"), false);
  });

  // =========================================================================
  // TEST 2: Role Authorization Checks on Transitions
  // =========================================================================
  it("2. should reject unauthorized transition attempts across different personas", async () => {
    // Client Admin cannot transition DRAFT -> SCOPING (Consultant only)
    await assert.rejects(
      async () => {
        await executeAssessmentTransition(testClientAdminSession, testAssessmentId, {
          targetStatus: "SCOPING",
        });
      },
      (err: Error) => err instanceof LifecycleError && err.statusCode === 422
    );

    // Reviewer cannot approve report (Lead Consultant ONLY)
    const approveRule = findTransitionRule("DRAFT_REPORT_GENERATED", "LEAD_APPROVED");
    assert.ok(approveRule);
    assert.equal(approveRule.authorizedRoles.includes("TLI_REVIEWER"), false);
    assert.equal(approveRule.authorizedRoles.includes("CLIENT_ADMIN"), false);
    assert.equal(approveRule.authorizedRoles.includes("TLI_LEAD_CONSULTANT"), true);
  });

  // =========================================================================
  // TEST 3: DRAFT -> SCOPING -> SCOPE_LOCKED -> DATA_GATHERING
  // =========================================================================
  it("3. should execute initial scoping and dispatch transitions under live PostgreSQL RLS", async () => {
    // DRAFT -> SCOPING
    const scopingState = await executeAssessmentTransition(
      testLeadConsultantSession,
      testAssessmentId,
      { targetStatus: "SCOPING" }
    );
    assert.equal(scopingState.currentStatus, "SCOPING");

    // SCOPING -> SCOPE_LOCKED
    const lockedState = await executeAssessmentTransition(
      testLeadConsultantSession,
      testAssessmentId,
      { targetStatus: "SCOPE_LOCKED" }
    );
    assert.equal(lockedState.currentStatus, "SCOPE_LOCKED");

    // SCOPE_LOCKED -> DATA_GATHERING (Dispatched to Client)
    const gatheringState = await executeAssessmentTransition(
      testClientAdminSession,
      testAssessmentId,
      { targetStatus: "DATA_GATHERING" }
    );
    assert.equal(gatheringState.currentStatus, "DATA_GATHERING");
  });

  // =========================================================================
  // TEST 4: DATA_GATHERING -> SUBMITTED_FOR_REVIEW Incomplete Data Guard
  // =========================================================================
  it("4. should block SUBMITTED_FOR_REVIEW when questionnaire is incomplete (< 60 questions)", async () => {
    // Attempt standard submission with 0 questions answered
    await assert.rejects(
      async () => {
        await executeAssessmentTransition(testClientAdminSession, testAssessmentId, {
          targetStatus: "SUBMITTED_FOR_REVIEW",
        });
      },
      (err: Error) =>
        err instanceof LifecycleError &&
        err.validationErrors?.some((v) => v.includes("Submission blocked: Only 0 of 60 canonical questions answered"))
    );
  });

  // =========================================================================
  // TEST 5: Approved Partial Assessment Submission Exception
  // =========================================================================
  it("5. should allow SUBMITTED_FOR_REVIEW for incomplete questionnaire only when is_partial_assessment is approved", async () => {
    // Enable partial assessment exception
    await pool.query(
      "UPDATE assessments SET is_partial_assessment = TRUE WHERE id = $1;",
      [testAssessmentId]
    );

    // Attempt partial submission without rationale (fails)
    await assert.rejects(
      async () => {
        await executeAssessmentTransition(testClientAdminSession, testAssessmentId, {
          targetStatus: "SUBMITTED_FOR_REVIEW",
        });
      },
      (err: Error) =>
        err instanceof LifecycleError &&
        err.validationErrors?.some((v) => v.includes("Approved Partial Assessment submission requires a documented business rationale"))
    );

    // Partial submission with documented rationale (succeeds)
    const submittedState = await executeAssessmentTransition(
      testClientAdminSession,
      testAssessmentId,
      {
        targetStatus: "SUBMITTED_FOR_REVIEW",
        reason: "Rapid Diagnostic Review requested by Board prior to M&A due diligence gate.",
      }
    );
    assert.equal(submittedState.currentStatus, "SUBMITTED_FOR_REVIEW");
    assert.ok(submittedState.submittedAt);
  });

  // =========================================================================
  // TEST 6: Submission Withdrawal Guard
  // =========================================================================
  it("6. should allow submission withdrawal before review commences, but block withdrawal once review starts", async () => {
    // 1. Withdraw submission when 0 reviews exist (succeeds)
    const withdrawnState = await executeAssessmentTransition(
      testClientAdminSession,
      testAssessmentId,
      {
        targetStatus: "DATA_GATHERING",
        reason: "Discovered additional mobile app consent policy to attach.",
      }
    );
    assert.equal(withdrawnState.currentStatus, "DATA_GATHERING");

    // Resubmit
    await executeAssessmentTransition(testClientAdminSession, testAssessmentId, {
      targetStatus: "SUBMITTED_FOR_REVIEW",
      reason: "Supplementary consent policy attached. Ready for review.",
    });

    // 2. Reviewer commences review: SUBMITTED_FOR_REVIEW -> UNDER_REVIEW
    const underReviewState = await executeAssessmentTransition(
      testReviewerSession,
      testAssessmentId,
      { targetStatus: "UNDER_REVIEW" }
    );
    assert.equal(underReviewState.currentStatus, "UNDER_REVIEW");
    assert.ok(underReviewState.reviewedAt);

    // 3. Assessor records finding for GOV-001
    await pool.query(
      `INSERT INTO questionnaire_assessor_reviews (
        assessment_id, question_code, review_status, review_findings, reviewed_by_user_id
      ) VALUES ($1, 'GOV-001', 'VERIFIED_COMPLIANT', 'Board minutes verified.', $2)
      ON CONFLICT (assessment_id, question_code) 
      DO UPDATE SET review_status = 'VERIFIED_COMPLIANT';`,
      [testAssessmentId, TEST_REVIEWER_ID]
    );

    // 4. Client Admin attempts withdrawal now that review has commenced (blocked by guard)
    // Note: In state machine, SUBMITTED_FOR_REVIEW -> DATA_GATHERING is defined, but from UNDER_REVIEW,
    // only TLI Lead can return for rework. If someone forged an API call from UNDER_REVIEW, it's blocked:
    await assert.rejects(
      async () => {
        await executeAssessmentTransition(testClientAdminSession, testAssessmentId, {
          targetStatus: "DATA_GATHERING",
          reason: "Attempting withdrawal during active audit.",
        });
      },
      (err: Error) => err instanceof LifecycleError
    );
  });

  // =========================================================================
  // TEST 7: Clarification Thread Gating
  // =========================================================================
  it("7. should enforce clarification thread gating (blocks UNDER_REVIEW -> CLARIFICATION_PENDING when 0 threads, and blocks return when threads unresolved)", async () => {
    // Attempt UNDER_REVIEW -> CLARIFICATION_PENDING with 0 active threads (blocked)
    await assert.rejects(
      async () => {
        await executeAssessmentTransition(testReviewerSession, testAssessmentId, {
          targetStatus: "CLARIFICATION_PENDING",
        });
      },
      (err: Error) =>
        err instanceof LifecycleError &&
        err.validationErrors?.some((v) => v.includes("No active or open clarification threads exist"))
    );

    // Create an active clarification thread
    const threadRes = await pool.query(
      `INSERT INTO clarification_threads (assessment_id, question_code, title, status, raised_by_user_id)
       VALUES ($1, 'GOV-002', 'Missing DPO charter documentation', 'OPEN', $2)
       RETURNING id;`,
      [testAssessmentId, TEST_REVIEWER_ID]
    );
    const threadId = threadRes.rows[0].id;

    // Now UNDER_REVIEW -> CLARIFICATION_PENDING succeeds
    const clarPendingState = await executeAssessmentTransition(
      testReviewerSession,
      testAssessmentId,
      { targetStatus: "CLARIFICATION_PENDING" }
    );
    assert.equal(clarPendingState.currentStatus, "CLARIFICATION_PENDING");

    // Client attempts to return to UNDER_REVIEW while thread is still OPEN (blocked)
    await assert.rejects(
      async () => {
        await executeAssessmentTransition(testClientAdminSession, testAssessmentId, {
          targetStatus: "UNDER_REVIEW",
        });
      },
      (err: Error) =>
        err instanceof LifecycleError &&
        err.validationErrors?.some((v) => v.includes("clarification thread(s) remain unresolved"))
    );

    // Client resolves thread
    await pool.query("UPDATE clarification_threads SET status = 'RESOLVED' WHERE id = $1;", [threadId]);

    // Now CLARIFICATION_PENDING -> UNDER_REVIEW succeeds
    const backToReviewState = await executeAssessmentTransition(
      testClientAdminSession,
      testAssessmentId,
      { targetStatus: "UNDER_REVIEW" }
    );
    assert.equal(backToReviewState.currentStatus, "UNDER_REVIEW");
  });

  // =========================================================================
  // TEST 8: Review Completion Guard (Unverified N/A Exclusion)
  // =========================================================================
  it("8. should block REVIEW_COMPLETED when an N/A exclusion has not been verified by assessor", async () => {
    // Add client response with N/A
    await pool.query(
      `INSERT INTO assessment_questionnaire_responses (
        assessment_id, tenant_id, question_code, selected_option, comments_and_justification
      ) VALUES ($1, $2, 'NOT-003', 'Not applicable — justification required', 'Multilingual notice not required as entity operates exclusively in English under exemption.')
      ON CONFLICT (assessment_id, question_code) DO UPDATE 
      SET selected_option = EXCLUDED.selected_option, comments_and_justification = EXCLUDED.comments_and_justification;`,
      [testAssessmentId, TEST_TENANT_ID]
    );

    // Attempt UNDER_REVIEW -> REVIEW_COMPLETED (fails because NOT-003 exclusion is not yet EXCLUSION_VERIFIED)
    await assert.rejects(
      async () => {
        await executeAssessmentTransition(testReviewerSession, testAssessmentId, {
          targetStatus: "REVIEW_COMPLETED",
        });
      },
      (err: Error) =>
        err instanceof LifecycleError &&
        err.validationErrors?.some((v) => v.includes("Proposed N/A exclusion for question(s) [NOT-003] has not been verified"))
    );

    // Assessor verifies exclusion
    await pool.query(
      `INSERT INTO questionnaire_assessor_reviews (
        assessment_id, question_code, review_status, review_findings, reviewed_by_user_id
      ) VALUES ($1, 'NOT-003', 'EXCLUSION_VERIFIED', 'Exclusion justified under statutory grounds.', $2)
      ON CONFLICT (assessment_id, question_code) DO UPDATE 
      SET review_status = 'EXCLUSION_VERIFIED';`,
      [testAssessmentId, TEST_REVIEWER_ID]
    );

    // Now REVIEW_COMPLETED succeeds (is_partial_assessment = true)
    const reviewCompState = await executeAssessmentTransition(
      testReviewerSession,
      testAssessmentId,
      { targetStatus: "REVIEW_COMPLETED" }
    );
    assert.equal(reviewCompState.currentStatus, "REVIEW_COMPLETED");
  });

  // =========================================================================
  // TEST 9: Draft Report Generation & Lead Consultant Sign-off (DEC-01)
  // =========================================================================
  it("9. should advance to DRAFT_REPORT_GENERATED and require Lead Consultant sign-off for LEAD_APPROVED", async () => {
    // REVIEW_COMPLETED -> DRAFT_REPORT_GENERATED
    const draftRepState = await executeAssessmentTransition(
      testReviewerSession,
      testAssessmentId,
      { targetStatus: "DRAFT_REPORT_GENERATED" }
    );
    assert.equal(draftRepState.currentStatus, "DRAFT_REPORT_GENERATED");

    // Reviewer attempts to approve (fails: DEC-01 strictly mandates Lead Consultant)
    await assert.rejects(
      async () => {
        await executeAssessmentTransition(testReviewerSession, testAssessmentId, {
          targetStatus: "LEAD_APPROVED",
        });
      },
      (err: Error) => err instanceof LifecycleError && err.statusCode === 422
    );

    // Lead Consultant approves (succeeds)
    const approvedState = await executeAssessmentTransition(
      testLeadConsultantSession,
      testAssessmentId,
      { targetStatus: "LEAD_APPROVED" }
    );
    assert.equal(approvedState.currentStatus, "LEAD_APPROVED");
    assert.ok(approvedState.approvedAt);
  });

  // =========================================================================
  // TEST 10: Final Issuance & Cryptographic Snapshot
  // =========================================================================
  it("10. should issue final report, compute SHA-256 snapshot, and lock dataset into FINAL_ISSUED", async () => {
    const issuedState = await executeAssessmentTransition(
      testLeadConsultantSession,
      testAssessmentId,
      { targetStatus: "FINAL_ISSUED" }
    );
    assert.equal(issuedState.currentStatus, "FINAL_ISSUED");
    assert.ok(issuedState.issuedAt);
    assert.equal(issuedState.isImmutable, true);

    // Verify report_snapshots row exists with SHA-256 hash
    const snapshotRes = await pool.query(
      "SELECT version_label, dataset_sha256_hash FROM report_snapshots WHERE assessment_id = $1;",
      [testAssessmentId]
    );
    assert.equal(snapshotRes.rowCount, 1);
    assert.equal(snapshotRes.rows[0].version_label, "FINAL-V1.0");
    assert.equal(snapshotRes.rows[0].dataset_sha256_hash.length, 64);
  });

  // =========================================================================
  // TEST 11: Kernel-Level Forensic Immutability
  // =========================================================================
  it("11. should block any database mutation on responses, reviews, and metadata once FINAL_ISSUED", async () => {
    // 1. Attempt UPDATE on questionnaire responses (Trigger blocks it)
    await assert.rejects(
      async () => {
        await pool.query(
          `UPDATE assessment_questionnaire_responses 
           SET comments_and_justification = 'Tampered comments' 
           WHERE assessment_id = $1;`,
          [testAssessmentId]
        );
      },
      (err: Error) =>
        err.message.includes("FORENSIC_INTEGRITY_VIOLATION") &&
        err.message.includes("cannot be modified for assessment in status FINAL_ISSUED")
    );

    // 2. Attempt UPDATE on assessor reviews (Trigger blocks it)
    await assert.rejects(
      async () => {
        await pool.query(
          `UPDATE questionnaire_assessor_reviews 
           SET review_findings = 'Tampered findings' 
           WHERE assessment_id = $1;`,
          [testAssessmentId]
        );
      },
      (err: Error) =>
        err.message.includes("FORENSIC_INTEGRITY_VIOLATION") &&
        err.message.includes("cannot be modified for assessment in status FINAL_ISSUED")
    );

    // 3. Attempt UPDATE on assessment core metadata (Trigger blocks it)
    await assert.rejects(
      async () => {
        await pool.query(
          `UPDATE assessments SET title = 'Forged Title' WHERE id = $1;`,
          [testAssessmentId]
        );
      },
      (err: Error) =>
        err.message.includes("FORENSIC_INTEGRITY_VIOLATION") &&
        err.message.includes("Core assessment metadata is immutable")
    );
  });

  // =========================================================================
  // TEST 12: Re-audit Cycle Cloning (parent_assessment_id)
  // =========================================================================
  it("12. should clone finalized assessment forward into a new versioned engagement linked via parent_assessment_id", async () => {
    const reauditEngCode = `ENG-GAMMA-REAUDIT-${Date.now()}`;
    const cloned = await cloneAssessmentForReaudit(
      testLeadConsultantSession,
      testAssessmentId,
      {
        engagementCode: reauditEngCode,
        title: "Gamma Healthcare Year 2 Follow-up Audit",
        copyResponses: true,
      }
    );

    assert.ok(cloned.id);
    assert.equal(cloned.currentStatus, "DRAFT");
    assert.equal(cloned.engagementCode, reauditEngCode);

    // Verify parent relationship in DB
    const dbRes = await pool.query(
      "SELECT parent_assessment_id FROM assessments WHERE id = $1;",
      [cloned.id]
    );
    assert.equal(dbRes.rows[0].parent_assessment_id, testAssessmentId);
  });

  // =========================================================================
  // TEST 13: Transition History & Audit Log Tamper Resistance
  // =========================================================================
  it("13. should record complete transition history and enforce immutable append-only audit trail", async () => {
    const history = await getAssessmentTransitionHistory(
      testLeadConsultantSession,
      testAssessmentId
    );

    assert.ok(history.length >= 7, "Must record at least 7 lifecycle transitions");
    const statuses = history.map((h) => h.newStatus);
    assert.ok(statuses.includes("SCOPING"));
    assert.ok(statuses.includes("SCOPE_LOCKED"));
    assert.ok(statuses.includes("DATA_GATHERING"));
    assert.ok(statuses.includes("SUBMITTED_FOR_REVIEW"));
    assert.ok(statuses.includes("UNDER_REVIEW"));
    assert.ok(statuses.includes("LEAD_APPROVED"));
    assert.ok(statuses.includes("FINAL_ISSUED"));

    // Verify audit_logs table itself is immutable (trigger blocks UPDATE/DELETE)
    await assert.rejects(
      async () => {
        await pool.query(
          "UPDATE audit_logs SET action = 'FORGED' WHERE entity_id = $1;",
          [testAssessmentId]
        );
      },
      (err: Error) => err.message.includes("FORENSIC_INTEGRITY_VIOLATION")
    );

    await assert.rejects(
      async () => {
        await pool.query(
          "DELETE FROM audit_logs WHERE entity_id = $1;",
          [testAssessmentId]
        );
      },
      (err: Error) => err.message.includes("FORENSIC_INTEGRITY_VIOLATION")
    );
  });
});

