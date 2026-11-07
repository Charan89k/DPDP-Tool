/**
 * TLI — Customer access to findings, scores and recommendations is locked until the final report
 * has a verified payment; TLI staff are never locked; organisations never see each other's data.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { SessionUser } from "../lib/auth/types.ts";
import { pool } from "../lib/db/pool.ts";
import { getAssessmentGapAnalysis } from "../lib/gaps/index.ts";
import { getAssessmentScores } from "../lib/scoring/index.ts";
import { createRemediationTask, getAssessmentRemediations, updateRemediationProgress } from "../lib/remediation/index.ts";
import { ReportLockedError, assertFindingsAccess, customerFindingsLocked } from "../lib/payments/access.ts";
import { getReportAccessView } from "../lib/payments/queries.ts";
import { markReportPaidForTests } from "./helpers/paid_report.ts";

const TLI_TENANT = "018f3a5b-7c8d-7e90-8000-000000000001";
const ALPHA_TENANT = "018f3a5b-7c8d-7e90-8000-000000000002";
const BETA_TENANT = "018f3a5b-7c8d-7e90-8000-000000000003";
const ALPHA_ASSESSMENT = "018f3a5b-7c8d-7e90-8000-000000000201";
const BETA_ASSESSMENT = "018f3a5b-7c8d-7e90-8000-000000000202";

const session = (userId: string, tenantId: string, role: SessionUser["role"]): SessionUser => ({
  userId,
  tenantId,
  email: `${userId}@example.com`,
  fullName: role,
  role,
  tenantType: tenantId === TLI_TENANT ? "TLI" : "CLIENT",
  tenantName: "Test",
  tenantSlug: "test",
  isSdf: false,
});

const SUPER_ADMIN = session("018f3a5b-7c8d-7e90-8000-000000000101", TLI_TENANT, "TLI_SUPER_ADMIN");
const LEAD = session("018f3a5b-7c8d-7e90-8000-000000000102", TLI_TENANT, "TLI_LEAD_CONSULTANT");
const REVIEWER = session("018f3a5b-7c8d-7e90-8000-000000000103", TLI_TENANT, "TLI_REVIEWER");
const ALPHA_ADMIN = session("018f3a5b-7c8d-7e90-8000-000000000111", ALPHA_TENANT, "CLIENT_ADMIN");
const ALPHA_CONTRIBUTOR = session("018f3a5b-7c8d-7e90-8000-000000000113", ALPHA_TENANT, "CLIENT_CONTRIBUTOR");
const ALPHA_VIEWER = session("018f3a5b-7c8d-7e90-8000-000000000114", ALPHA_TENANT, "CLIENT_VIEWER");
const BETA_ADMIN = session("018f3a5b-7c8d-7e90-8000-000000000121", BETA_TENANT, "CLIENT_ADMIN");

const isLocked = (err: unknown) => err instanceof ReportLockedError && err.status === 402;
const ALPHA_CUSTOMERS = [ALPHA_ADMIN, ALPHA_CONTRIBUTOR, ALPHA_VIEWER];

describe("Findings are locked for customers until the report is paid for", () => {
  let taskId = "";

  it("before payment: every customer role is refused gap findings, scores and remediation", async () => {
    for (const customer of ALPHA_CUSTOMERS) {
      await assert.rejects(() => getAssessmentGapAnalysis(customer, ALPHA_ASSESSMENT), isLocked, `${customer.role} gaps`);
      await assert.rejects(() => getAssessmentScores(customer, ALPHA_ASSESSMENT), isLocked, `${customer.role} scores`);
      await assert.rejects(() => getAssessmentRemediations(customer, ALPHA_ASSESSMENT), isLocked, `${customer.role} remediation`);
    }
    await assert.rejects(
      () =>
        createRemediationTask(ALPHA_ADMIN, {
          assessmentId: ALPHA_ASSESSMENT,
          questionCode: "SEC-001",
          title: "Locked task",
          description: "Should not be created before payment",
          priority: "HIGH",
          targetDate: "2027-01-31",
        }),
      isLocked
    );
    assert.equal(await customerFindingsLocked(ALPHA_ADMIN, ALPHA_ASSESSMENT), true, "evidence notes masked");
  });

  it("before payment: customers still see the assessment status, readiness and price, but no findings", async () => {
    await pool.query(
      "INSERT INTO platform_settings (key, value) VALUES ('report_price_paise', '250000') ON CONFLICT (key) DO UPDATE SET value = excluded.value;"
    );
    const view = await getReportAccessView(ALPHA_ADMIN, ALPHA_ASSESSMENT);
    assert.equal(view.unlocked, false);
    assert.equal(view.pricePaise, 250000);
    assert.equal(typeof view.reportReady, "boolean");
    const payload = JSON.stringify(view);
    for (const field of ["gaps", "statutoryDeficits", "indicativeReadinessPercentage", "remediationRecommendation", "reviewFindings"]) {
      assert.ok(!payload.includes(field), `access view carries no ${field}`);
    }
  });

  it("TLI staff keep unrestricted access before payment", async () => {
    for (const staff of [SUPER_ADMIN, LEAD, REVIEWER]) {
      await assertFindingsAccess(staff, ALPHA_ASSESSMENT);
      assert.equal(await customerFindingsLocked(staff, ALPHA_ASSESSMENT), false);
      const gaps = await getAssessmentGapAnalysis(staff, ALPHA_ASSESSMENT);
      assert.ok(Array.isArray(gaps.gaps), `${staff.role} sees gaps`);
      const scores = await getAssessmentScores(staff, ALPHA_ASSESSMENT);
      assert.ok(scores.metrics, `${staff.role} sees scores`);
    }
    const task = await createRemediationTask(LEAD, {
      assessmentId: ALPHA_ASSESSMENT,
      questionCode: "SEC-001",
      title: "Consultant task before payment",
      description: "TLI staff can prepare remediation before the customer pays",
      priority: "MEDIUM",
      targetDate: "2027-02-28",
    });
    taskId = task.id;
    assert.ok((await getAssessmentRemediations(LEAD, ALPHA_ASSESSMENT)).some((t) => t.id === taskId));
  });

  it("before payment: a customer cannot change a remediation task, even through its id", async () => {
    await assert.rejects(() => updateRemediationProgress(ALPHA_ADMIN, taskId, { status: "IN_REMEDIATION" }), isLocked);
    await assert.rejects(
      () => updateRemediationProgress(ALPHA_ADMIN, taskId, { status: "IN_REMEDIATION", assessmentId: ALPHA_ASSESSMENT }),
      isLocked
    );
  });

  it("another organisation never gets findings and the lock does not reveal the assessment exists", async () => {
    // Beta's view of Alpha's assessment is "not visible", never "locked": no existence oracle.
    await assertFindingsAccess(BETA_ADMIN, ALPHA_ASSESSMENT);
    await assert.rejects(() => getAssessmentGapAnalysis(BETA_ADMIN, ALPHA_ASSESSMENT), (e: unknown) => !isLocked(e));
    const remediation = await getAssessmentRemediations(BETA_ADMIN, ALPHA_ASSESSMENT).catch((e: unknown) => e);
    assert.ok(Array.isArray(remediation) ? remediation.length === 0 : !isLocked(remediation));
  });

  it("after verified payment: the paying organisation's users get findings, scores and remediation", async () => {
    await markReportPaidForTests(ALPHA_ASSESSMENT);
    for (const customer of ALPHA_CUSTOMERS) {
      const gaps = await getAssessmentGapAnalysis(customer, ALPHA_ASSESSMENT);
      assert.ok(Array.isArray(gaps.gaps));
      assert.ok((await getAssessmentScores(customer, ALPHA_ASSESSMENT)).metrics);
      assert.ok((await getAssessmentRemediations(customer, ALPHA_ASSESSMENT)).some((t) => t.id === taskId));
    }
    assert.equal(await customerFindingsLocked(ALPHA_ADMIN, ALPHA_ASSESSMENT), false);
    await updateRemediationProgress(ALPHA_ADMIN, taskId, { status: "IN_REMEDIATION", assessmentId: ALPHA_ASSESSMENT });
  });

  it("one organisation's payment unlocks nothing for another organisation", async () => {
    // Alpha is paid; Beta's own unpaid assessment stays locked for Beta, and Alpha stays invisible to Beta.
    await assert.rejects(() => getAssessmentGapAnalysis(BETA_ADMIN, BETA_ASSESSMENT), isLocked);
    await assert.rejects(() => getAssessmentScores(BETA_ADMIN, BETA_ASSESSMENT), isLocked);
    await assert.rejects(() => getAssessmentGapAnalysis(BETA_ADMIN, ALPHA_ASSESSMENT), (e: unknown) => !isLocked(e));
    assert.equal(await customerFindingsLocked(BETA_ADMIN, BETA_ASSESSMENT), true);
  });

  it("a full refund locks the findings again", async () => {
    await pool.query("UPDATE report_payments SET status = 'REFUNDED', refunded_at = CURRENT_TIMESTAMP WHERE assessment_id = $1;", [ALPHA_ASSESSMENT]);
    await assert.rejects(() => getAssessmentGapAnalysis(ALPHA_ADMIN, ALPHA_ASSESSMENT), isLocked);
    await assert.rejects(() => getAssessmentScores(ALPHA_VIEWER, ALPHA_ASSESSMENT), isLocked);
    // TLI staff are unaffected by the refund.
    assert.ok((await getAssessmentScores(LEAD, ALPHA_ASSESSMENT)).metrics);
  });
});
