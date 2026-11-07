/**
 * Test helper: records a verified Razorpay payment for an assessment so suites that exercise
 * post-payment customer behaviour (findings, remediation) run against an unlocked report.
 * Writes in the privileged system context, exactly like the payment service does after verification.
 */

import crypto from "node:crypto";
import { pool } from "../../lib/db/pool.ts";

export async function markReportPaidForTests(assessmentId: string): Promise<void> {
  const assessment = (
    await pool.query<{ tenant_id: string; lead_consultant_id: string | null }>(
      "SELECT tenant_id, lead_consultant_id FROM assessments WHERE id = $1;",
      [assessmentId]
    )
  ).rows[0];
  if (!assessment) throw new Error(`markReportPaidForTests: assessment ${assessmentId} not found`);
  const staff = (await pool.query<{ id: string }>("SELECT id FROM users WHERE role = 'TLI_SUPER_ADMIN' LIMIT 1;")).rows[0];
  const signer = assessment.lead_consultant_id ?? staff.id;
  const customer = (
    await pool.query<{ id: string }>("SELECT id FROM users WHERE tenant_id = $1 ORDER BY created_at LIMIT 1;", [assessment.tenant_id])
  ).rows[0];

  const snapshotId = crypto.randomUUID();
  await pool.query(
    `INSERT INTO report_snapshots (id, assessment_id, tenant_id, report_type, version_label, s3_key, file_sha256_hash,
       dataset_sha256_hash, generated_by_user_id, lead_approver_id, approved_at, is_draft)
     VALUES ($1, $2, $3, 'DOCX', 'TEST-PAID', 'reports/test-paid.docx', $4, $4, $5, $5, CURRENT_TIMESTAMP, TRUE);`,
    [snapshotId, assessmentId, assessment.tenant_id, "0".repeat(64), signer]
  );
  await pool.query(
    `INSERT INTO report_payments (id, tenant_id, assessment_id, report_snapshot_id, requested_by_user_id,
       razorpay_order_id, razorpay_payment_id, amount_paise, mode, status, paid_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 100000, 'test', 'PAID', CURRENT_TIMESTAMP);`,
    [
      crypto.randomUUID(),
      assessment.tenant_id,
      assessmentId,
      snapshotId,
      customer?.id ?? signer,
      `order_fixture${crypto.randomBytes(6).toString("hex")}`,
      `pay_fixture${crypto.randomBytes(6).toString("hex")}`,
    ]
  );
}
