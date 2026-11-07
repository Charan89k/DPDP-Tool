/**
 * TLI — Email delivery of the paid final report.
 *
 * Each paid order has exactly two delivery rows (customer and TLI assessor; unique per order), so
 * repeated callbacks or webhooks can never queue a second email. A send is claimed with a
 * conditional update (QUEUED/FAILED → SENDING) before anything is sent, so concurrent dispatchers
 * cannot both send. Every attempt is written to audit_logs as delivery history. Email failures never
 * touch the payment: retrying an email only re-reads the archived report file.
 *
 * "SENT" means the SMTP server accepted the message; it is not proof that it reached the inbox.
 */

import crypto from "node:crypto";
import { pool } from "../db/pool.ts";
import type { PoolClient } from "../db/pool.ts";
import { executeWithRls } from "../db/rls.ts";
import type { SessionUser } from "../auth/types.ts";
import { publicBaseUrl, sendEmail } from "../email/mailer.ts";
import { reportDeliveryAssessorEmail, reportDeliveryClientEmail } from "../email/templates.ts";
import type { ReportDeliveryDetails } from "../email/templates.ts";
import { getLocalStorageAdapter } from "../storage/local_adapter.ts";
import { formatDateTime } from "../format/dates.ts";
import { formatInr } from "./format.ts";
import { PaymentError, inSystemTransaction, writePaymentAudit } from "./records.ts";
import type { PaymentRow, RequestMeta } from "./records.ts";

type Env = Record<string, string | undefined>;

export type RecipientType = "CLIENT" | "ASSESSOR";
export type DeliveryStatus = "QUEUED" | "SENDING" | "SENT" | "FAILED";

/** Automatic attempts per recipient; further attempts are manual resends by TLI staff. */
export const MAX_AUTOMATIC_ATTEMPTS = 3;
const DEFAULT_BACKOFF_MS = [2_000, 10_000];
/** A SENDING row older than this is assumed abandoned (process restarted mid-send). */
const STALE_SENDING_MS = 10 * 60 * 1000;
const DOCX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The central TLI assessor mailbox that receives a copy of every delivered report. */
export function assessorEmailAddress(env: Env = process.env): string | null {
  const value = env.TLI_ASSESSOR_EMAIL?.trim() ?? "";
  return EMAIL_PATTERN.test(value) ? value : null;
}

interface DeliveryRow {
  id: string;
  payment_id: string;
  tenant_id: string;
  assessment_id: string;
  recipient_type: RecipientType;
  recipient_email: string;
  status: DeliveryStatus;
  attempts: number;
}

/** Queues both deliveries inside the transaction that marks the order PAID. */
export async function queueReportDeliveries(client: PoolClient, row: PaymentRow): Promise<void> {
  const payer = await client.query<{ email: string }>("SELECT email FROM users WHERE id = $1;", [row.requested_by_user_id]);
  const recipients: Array<[RecipientType, string]> = [
    ["CLIENT", payer.rows[0]?.email ?? ""],
    ["ASSESSOR", assessorEmailAddress() ?? ""],
  ];
  for (const [type, email] of recipients) {
    await client.query(
      `INSERT INTO report_deliveries (id, payment_id, tenant_id, assessment_id, recipient_type, recipient_email, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'QUEUED') ON CONFLICT (payment_id, recipient_type) DO NOTHING;`,
      [crypto.randomUUID(), row.id, row.tenant_id, row.assessment_id, type, email]
    );
  }
  await writePaymentAudit(client, {
    tenantId: row.tenant_id,
    assessmentId: row.assessment_id,
    userId: null,
    action: "REPORT_EMAIL_QUEUED",
    details: { paymentId: row.id, recipients: ["CLIENT", "ASSESSOR"] },
  });
}

/** Claims a delivery for sending; returns null when another dispatcher owns it or it is done. */
async function claimDelivery(deliveryId: string, manual: boolean): Promise<DeliveryRow | null> {
  const staleBefore = new Date(Date.now() - STALE_SENDING_MS).toISOString();
  const res = await pool.query<DeliveryRow>(
    `UPDATE report_deliveries
     SET status = 'SENDING', attempts = attempts + 1, last_attempt_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP,
         recipient_email = CASE WHEN recipient_type = 'ASSESSOR' THEN $4 ELSE recipient_email END
     WHERE id = $1 AND (
       status = 'QUEUED'
       OR (status = 'FAILED' AND ($2 = 1 OR attempts < $3))
       OR ($2 = 1 AND status = 'SENT')
       OR ($2 = 1 AND status = 'SENDING' AND last_attempt_at < $5)
     )
     RETURNING id, payment_id, tenant_id, assessment_id, recipient_type, recipient_email, status, attempts;`,
    [deliveryId, manual ? 1 : 0, MAX_AUTOMATIC_ATTEMPTS, assessorEmailAddress() ?? "", staleBefore]
  );
  return res.rows[0] ?? null;
}

class PermanentDeliveryError extends Error {}

interface DeliveryContext {
  payment: PaymentRow & { paid_at: string | Date | null };
  organisation: string;
  engagementCode: string;
  reportTitle: string;
  payerName: string;
  payerEmail: string;
  attachment: ReportDeliveryDetails["attachment"];
  clientStatus: DeliveryStatus | null;
}

/** Loads the paid order and the archived customer copy of the report it paid for. */
async function loadDeliveryContext(paymentId: string): Promise<DeliveryContext> {
  const res = await pool.query(
    `SELECT p.*, a.engagement_code, a.title, t.name AS organisation, u.full_name AS payer_name, u.email AS payer_email,
            rs.summary_metadata,
            (SELECT d.status FROM report_deliveries d WHERE d.payment_id = p.id AND d.recipient_type = 'CLIENT') AS client_status
     FROM report_payments p
     JOIN assessments a ON a.id = p.assessment_id
     JOIN tenants t ON t.id = p.tenant_id
     JOIN users u ON u.id = p.requested_by_user_id
     JOIN report_snapshots rs ON rs.id = p.report_snapshot_id
     WHERE p.id = $1;`,
    [paymentId]
  );
  const row = res.rows[0];
  if (!row) throw new PermanentDeliveryError("Payment record not found.");
  if (row.status !== "PAID") throw new PermanentDeliveryError(`The payment is ${row.status}; the report is not sent.`);

  const meta = typeof row.summary_metadata === "string" ? JSON.parse(row.summary_metadata) : row.summary_metadata || {};
  if (typeof meta.clientS3Key !== "string" || typeof meta.clientFileSha256 !== "string") {
    throw new PermanentDeliveryError("The issued report has no archived customer copy; re-issue is required.");
  }
  const content = await getLocalStorageAdapter().readFile(meta.clientS3Key);
  if (crypto.createHash("sha256").update(content).digest("hex") !== meta.clientFileSha256) {
    throw new PermanentDeliveryError("The archived report failed its integrity check.");
  }
  const filename = typeof meta.fileName === "string" ? meta.fileName : `TLI_DPDP_Report_${row.engagement_code}.docx`;
  return {
    payment: row,
    organisation: row.organisation,
    engagementCode: row.engagement_code,
    reportTitle: row.title,
    payerName: row.payer_name,
    payerEmail: row.payer_email,
    attachment: { filename, content, contentType: DOCX_CONTENT_TYPE },
    clientStatus: row.client_status,
  };
}

export interface AttemptResult {
  deliveryId: string;
  outcome: "SENT" | "FAILED" | "SKIPPED";
  permanent: boolean;
}

/** One claimed send attempt, with its result stored on the row and in the audit trail. */
export async function attemptDelivery(deliveryId: string, options: { manual?: boolean; actorUserId?: string | null } = {}): Promise<AttemptResult> {
  const delivery = await claimDelivery(deliveryId, Boolean(options.manual));
  if (!delivery) return { deliveryId, outcome: "SKIPPED", permanent: false };

  let error: string | null = null;
  let permanent = false;
  let channel: string | null = null;
  try {
    if (!delivery.recipient_email) {
      throw new PermanentDeliveryError(
        delivery.recipient_type === "ASSESSOR" ? "TLI_ASSESSOR_EMAIL is not configured." : "The customer has no email address."
      );
    }
    const ctx = await loadDeliveryContext(delivery.payment_id);
    const base = publicBaseUrl();
    const details: ReportDeliveryDetails = {
      organisation: ctx.organisation,
      engagementCode: ctx.engagementCode,
      reportTitle: ctx.reportTitle,
      razorpayPaymentId: ctx.payment.razorpay_payment_id ?? "",
      razorpayOrderId: ctx.payment.razorpay_order_id,
      amountLabel: formatInr(ctx.payment.amount_paise),
      paidAt: ctx.payment.paid_at ? formatDateTime(ctx.payment.paid_at) : "",
      reportUrl: `${base}/dashboard/reports/${delivery.assessment_id}`,
      supportEmail: process.env.TLI_SUPPORT_EMAIL?.trim() || null,
      attachment: ctx.attachment,
    };
    const message =
      delivery.recipient_type === "CLIENT"
        ? reportDeliveryClientEmail(delivery.recipient_email, ctx.payerName, details)
        : reportDeliveryAssessorEmail(delivery.recipient_email, {
            ...details,
            reportUrl: `${base}/dashboard/payments`,
            clientContact: `${ctx.payerName} <${ctx.payerEmail}>`,
            clientDeliveryStatus: ctx.clientStatus === "SENT" ? "sent (accepted by mail server)" : (ctx.clientStatus ?? "unknown").toLowerCase(),
          });
    const result = await sendEmail(message);
    if (result.sent) {
      channel = result.channel;
    } else {
      error = result.reason;
      permanent = result.reason === "SMTP_NOT_CONFIGURED";
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Unexpected delivery error";
    permanent = err instanceof PermanentDeliveryError;
  }

  const sent = error === null;
  await inSystemTransaction(async (client) => {
    await client.query(
      `UPDATE report_deliveries
       SET status = $2, last_error = $3, sent_at = CASE WHEN $2 = 'SENT' THEN CURRENT_TIMESTAMP ELSE sent_at END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1;`,
      [delivery.id, sent ? "SENT" : "FAILED", error ? error.slice(0, 500) : null]
    );
    await writePaymentAudit(client, {
      tenantId: delivery.tenant_id,
      assessmentId: delivery.assessment_id,
      userId: options.actorUserId ?? null,
      action: sent ? "REPORT_EMAIL_SENT" : "REPORT_EMAIL_FAILED",
      details: {
        deliveryId: delivery.id,
        paymentId: delivery.payment_id,
        recipientType: delivery.recipient_type,
        attempt: delivery.attempts,
        manual: Boolean(options.manual),
        channel,
        error: error ? error.slice(0, 200) : null,
      },
    });
  });
  return { deliveryId, outcome: sent ? "SENT" : "FAILED", permanent };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends every pending delivery of a paid order, retrying transient failures with a short backoff.
 * Safe to call repeatedly: finished or claimed deliveries are skipped.
 */
export async function dispatchReportDeliveries(paymentId: string, backoffMs: number[] = DEFAULT_BACKOFF_MS): Promise<AttemptResult[]> {
  // CLIENT sorts before ASSESSOR, so the assessor copy can report the customer's delivery status.
  const ids = await pool.query<{ id: string }>(
    "SELECT id FROM report_deliveries WHERE payment_id = $1 ORDER BY recipient_type DESC;",
    [paymentId]
  );
  const results: AttemptResult[] = [];
  for (const { id } of ids.rows) {
    let result = await attemptDelivery(id);
    for (let retry = 0; result.outcome === "FAILED" && !result.permanent && retry < backoffMs.length; retry += 1) {
      await sleep(backoffMs[retry]);
      result = await attemptDelivery(id);
    }
    results.push(result);
  }
  return results;
}

/** Background dispatch that never throws into the caller; failures stay visible as FAILED rows. */
export function dispatchReportDeliveriesInBackground(paymentId: string): Promise<void> {
  return dispatchReportDeliveries(paymentId).then(
    () => undefined,
    (err) => console.error("Report email dispatch failed:", err instanceof Error ? err.message : err)
  );
}

/**
 * Manual resend by TLI staff. Sends the archived report again; the payment is never touched.
 * Re-sending an email that was already sent needs `confirmAlreadySent`, so a stale dashboard (an
 * automatic retry succeeded after the page loaded) cannot cause an accidental duplicate.
 */
export async function resendReportDelivery(
  session: SessionUser,
  deliveryId: string,
  meta: RequestMeta = {},
  options: { confirmAlreadySent?: boolean } = {}
): Promise<AttemptResult> {
  if (session.role !== "TLI_SUPER_ADMIN" && session.role !== "TLI_LEAD_CONSULTANT") {
    throw new PaymentError("Only TLI lead consultants and administrators can resend reports.", 403);
  }
  const visible = await executeWithRls(session, async (client) => {
    const res = await client.query<{ id: string; tenant_id: string; assessment_id: string; recipient_type: string; status: DeliveryStatus }>(
      "SELECT id, tenant_id, assessment_id, recipient_type, status FROM report_deliveries WHERE id = $1;",
      [deliveryId]
    );
    return res.rows[0] ?? null;
  });
  if (!visible) throw new PaymentError("Delivery not found.", 404);
  if (visible.status === "SENT" && !options.confirmAlreadySent) {
    throw new PaymentError("This report email has already been sent. Refresh the page, or confirm to send it again.", 409);
  }
  await inSystemTransaction((client) =>
    writePaymentAudit(client, {
      tenantId: visible.tenant_id,
      assessmentId: visible.assessment_id,
      userId: session.userId,
      action: "REPORT_EMAIL_RESEND_REQUESTED",
      details: { deliveryId, recipientType: visible.recipient_type },
      meta,
    })
  );
  const result = await attemptDelivery(deliveryId, { manual: true, actorUserId: session.userId });
  if (result.outcome === "SKIPPED") throw new PaymentError("This email is being sent right now. Try again in a few minutes.", 409);
  return result;
}
