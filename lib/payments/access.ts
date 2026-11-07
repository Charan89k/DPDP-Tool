/**
 * TLI — Payment gate for customer access to the report and its detailed findings.
 *
 * Customers (CLIENT_* roles) see findings, scores, risk classifications, recommendations and
 * remediation work only after a verified payment for the assessment's final report. TLI staff are
 * never gated (their visibility is still limited by the tenant policy layer).
 *
 * The gate is applied inside the services that produce findings (gaps, scoring, remediation) so
 * every API route, server-rendered page and report generator gets the same rule.
 */

import { pool } from "../db/pool.ts";
import { executeWithRls } from "../db/rls.ts";
import type { SessionUser } from "../auth/types.ts";
import { isTliRole } from "../auth/rbac.ts";
import { PaymentError } from "./records.ts";

export const FINDINGS_LOCKED_MESSAGE =
  "Detailed findings, scores and recommendations are released with your final report once payment is confirmed.";

export class ReportLockedError extends PaymentError {
  readonly code = "REPORT_PAYMENT_REQUIRED";
  constructor() {
    super(FINDINGS_LOCKED_MESSAGE, 402);
    this.name = "ReportLockedError";
  }
}

/** True once a verified, unrefunded payment exists for the assessment. */
export async function isReportUnlocked(assessmentId: string): Promise<boolean> {
  const res = await pool.query(
    "SELECT 1 AS ok FROM report_payments WHERE assessment_id = $1 AND status = 'PAID' LIMIT 1;",
    [assessmentId]
  );
  return res.rowCount > 0;
}

/**
 * Whether this user may open the report document. Platform staff keep access regardless of payment
 * (their visibility is still limited by the tenant policy layer); customers need a verified payment.
 */
export async function canAccessReportDocument(session: SessionUser, assessmentId: string): Promise<boolean> {
  if (isTliRole(session.role)) return true;
  return isReportUnlocked(assessmentId);
}

/** True when a customer must not yet see assessor findings for this assessment (e.g. evidence notes). */
export async function customerFindingsLocked(session: SessionUser, assessmentId: string | null): Promise<boolean> {
  if (isTliRole(session.role)) return false;
  return !assessmentId || !(await isReportUnlocked(assessmentId));
}

/**
 * Throws ReportLockedError when a customer asks for findings of an unpaid assessment. Assessments
 * the customer cannot see are left to the caller's normal "not found" handling, so the gate never
 * reveals whether another organisation's assessment exists.
 */
export async function assertFindingsAccess(session: SessionUser, assessmentId: string): Promise<void> {
  if (isTliRole(session.role)) return;
  const visible = await executeWithRls(session, async (client) =>
    (await client.query("SELECT 1 AS ok FROM assessments WHERE id = $1;", [assessmentId])).rowCount > 0
  );
  if (visible && !(await isReportUnlocked(assessmentId))) throw new ReportLockedError();
}
