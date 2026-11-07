/**
 * TLI — Payment-gated release of the final compliance report.
 *
 * Flow: a customer administrator requests the issued report → the server creates (or reuses) a
 * Razorpay order for the configured price → Razorpay Checkout collects the payment → the server
 * marks the order PAID only after it has verified the payment itself (checkout signature plus a
 * Razorpay API lookup, a signed webhook, or reconciliation) → the report unlocks and two email
 * deliveries are queued.
 *
 * Every write to the payment tables runs in the privileged system context after the caller was
 * authorised under the tenant policy layer; tenant sessions cannot write these tables at all.
 * Status changes are conditional updates, so repeated callbacks, webhooks and reconciliation runs
 * settle an order exactly once and queue its emails exactly once.
 */

import crypto from "node:crypto";
import { pool } from "../db/pool.ts";
import { executeWithRls } from "../db/rls.ts";
import type { SessionUser } from "../auth/types.ts";
import { isTliRole } from "../auth/rbac.ts";
import { getPaymentGateway, requireRazorpayConfig, verifyCheckoutSignature, verifyWebhookSignature } from "./razorpay.ts";
import type { GatewayPayment, PaymentMode } from "./razorpay.ts";
import { PaymentError, inSystemTransaction, writePaymentAudit } from "./records.ts";
import type { PaymentRow, PaymentStatus, RequestMeta } from "./records.ts";
import { getReportPricePaise } from "./settings.ts";
import { canAccessReportDocument, isReportUnlocked } from "./access.ts";
import { queueReportDeliveries } from "./delivery.ts";

export const ISSUED_STATUSES = ["FINAL_ISSUED", "REMEDIATION_ACTIVE", "ARCHIVED"];
export const CURRENCY = "INR";

export { PaymentError, canAccessReportDocument, isReportUnlocked };
export type { PaymentRow, PaymentStatus, RequestMeta };

interface IssuedReport {
  assessmentId: string;
  tenantId: string;
  engagementCode: string;
  title: string;
  ready: boolean;
  snapshotId: string | null;
}

/** Loads the assessment through the tenant policy layer: invisible assessments are "not found". */
export async function loadIssuedReport(session: SessionUser, assessmentId: string): Promise<IssuedReport> {
  const row = await executeWithRls(session, async (client) => {
    const res = await client.query<{
      id: string;
      tenant_id: string;
      engagement_code: string;
      title: string;
      status: string;
      issued_at: string | null;
      snapshot_id: string | null;
    }>(
      `SELECT a.id, a.tenant_id, a.engagement_code, a.title, a.status, a.issued_at,
              (SELECT rs.id FROM report_snapshots rs
                WHERE rs.assessment_id = a.id AND rs.is_draft = FALSE AND rs.report_type = 'DOCX'
                ORDER BY rs.created_at DESC LIMIT 1) AS snapshot_id
       FROM assessments a WHERE a.id = $1;`,
      [assessmentId]
    );
    return res.rows[0] ?? null;
  });
  if (!row) throw new PaymentError("Assessment not found.", 404);
  return {
    assessmentId: row.id,
    tenantId: row.tenant_id,
    engagementCode: row.engagement_code,
    title: row.title,
    snapshotId: row.snapshot_id,
    ready: ISSUED_STATUSES.includes(row.status) && Boolean(row.issued_at) && Boolean(row.snapshot_id),
  };
}

export interface CheckoutOrder {
  paymentId: string;
  orderId: string;
  keyId: string;
  amountPaise: number;
  currency: string;
  mode: PaymentMode;
  reused: boolean;
  description: string;
  prefill: { name: string; email: string };
}

/** Only the customer's administrator can buy the report for their organisation. */
function assertCanPay(session: SessionUser, report: IssuedReport): void {
  if (session.role !== "CLIENT_ADMIN" || report.tenantId !== session.tenantId) {
    throw new PaymentError("Only your organisation's administrator can pay for this report.", 403);
  }
}

/**
 * Creates a Razorpay order for the issued report, or returns the open order for it so a retry after
 * an abandoned or failed checkout reuses the same order instead of creating another charge.
 */
export async function createReportOrder(session: SessionUser, assessmentId: string, meta: RequestMeta = {}): Promise<CheckoutOrder> {
  const report = await loadIssuedReport(session, assessmentId);
  assertCanPay(session, report);
  if (!report.ready || !report.snapshotId) {
    throw new PaymentError("The final report has not been issued yet.", 409);
  }
  if (await isReportUnlocked(assessmentId)) {
    throw new PaymentError("This report has already been paid for.", 409);
  }
  const config = requireRazorpayConfig();
  const amountPaise = await getReportPricePaise();
  if (!amountPaise) throw new PaymentError("The report price has not been set yet. Please contact TLI.", 503);

  const description = `DPDP compliance report ${report.engagementCode}`;
  const prefill = { name: session.fullName, email: session.email };

  const open = await pool.query<PaymentRow>(
    `SELECT * FROM report_payments
     WHERE assessment_id = $1 AND report_snapshot_id = $2 AND status IN ('PENDING', 'FAILED')
       AND amount_paise = $3 AND mode = $4
     ORDER BY created_at DESC LIMIT 1;`,
    [assessmentId, report.snapshotId, amountPaise, config.mode]
  );
  const existing = open.rows[0];
  if (existing) {
    await inSystemTransaction(async (client) => {
      await client.query(
        "UPDATE report_payments SET status = 'PENDING', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status = 'FAILED';",
        [existing.id]
      );
      await writePaymentAudit(client, {
        tenantId: report.tenantId,
        assessmentId,
        userId: session.userId,
        action: "REPORT_PAYMENT_RETRY",
        details: { paymentId: existing.id, razorpayOrderId: existing.razorpay_order_id, previousStatus: existing.status },
        meta,
      });
    });
    return {
      paymentId: existing.id,
      orderId: existing.razorpay_order_id,
      keyId: config.keyId,
      amountPaise,
      currency: CURRENCY,
      mode: config.mode,
      reused: true,
      description,
      prefill,
    };
  }

  const paymentId = crypto.randomUUID();
  const order = await getPaymentGateway().createOrder({
    amount: amountPaise,
    currency: CURRENCY,
    receipt: `tli_${paymentId.replace(/-/g, "").slice(0, 32)}`,
    notes: { payment_id: paymentId, assessment_id: assessmentId, tenant_id: report.tenantId },
  });
  if (order.amount !== amountPaise || order.currency !== CURRENCY) {
    throw new PaymentError("The payment gateway returned an order that does not match the report price.", 502);
  }

  await inSystemTransaction(async (client) => {
    await client.query(
      `INSERT INTO report_payments (id, tenant_id, assessment_id, report_snapshot_id, requested_by_user_id,
         razorpay_order_id, amount_paise, currency, mode, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING');`,
      [paymentId, report.tenantId, assessmentId, report.snapshotId, session.userId, order.id, amountPaise, CURRENCY, config.mode]
    );
    await writePaymentAudit(client, {
      tenantId: report.tenantId,
      assessmentId,
      userId: session.userId,
      action: "REPORT_PAYMENT_ORDER_CREATED",
      details: { paymentId, razorpayOrderId: order.id, amountPaise, currency: CURRENCY, mode: config.mode },
      meta,
    });
  });

  return { paymentId, orderId: order.id, keyId: config.keyId, amountPaise, currency: CURRENCY, mode: config.mode, reused: false, description, prefill };
}

async function findPaymentByOrderId(orderId: string): Promise<PaymentRow | null> {
  const res = await pool.query<PaymentRow>("SELECT * FROM report_payments WHERE razorpay_order_id = $1;", [orderId]);
  return res.rows[0] ?? null;
}

export type SettlementSource = "CHECKOUT" | "WEBHOOK" | "RECONCILIATION";

/**
 * Marks an order PAID after the payment was verified with Razorpay. Returns true only for the call
 * that changed the status, which is also the only call that queues the report emails.
 */
export async function settlePaidOrder(
  row: PaymentRow,
  gatewayPayment: GatewayPayment,
  source: SettlementSource,
  actorUserId: string | null,
  meta: RequestMeta = {}
): Promise<boolean> {
  if (
    gatewayPayment.order_id !== row.razorpay_order_id ||
    gatewayPayment.amount !== row.amount_paise ||
    gatewayPayment.currency !== row.currency ||
    gatewayPayment.status !== "captured"
  ) {
    return false;
  }
  return inSystemTransaction(async (client) => {
    const updated = await client.query(
      `UPDATE report_payments
       SET status = 'PAID', razorpay_payment_id = $2, paid_at = CURRENT_TIMESTAMP, failure_reason = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status IN ('PENDING', 'FAILED');`,
      [row.id, gatewayPayment.id]
    );
    if (updated.rowCount === 0) return false;

    const base = { tenantId: row.tenant_id, assessmentId: row.assessment_id, userId: actorUserId, meta };
    const details = {
      paymentId: row.id,
      razorpayOrderId: row.razorpay_order_id,
      razorpayPaymentId: gatewayPayment.id,
      amountPaise: row.amount_paise,
      source,
    };
    await writePaymentAudit(client, { ...base, action: "REPORT_PAYMENT_VERIFIED", details });
    await writePaymentAudit(client, { ...base, action: "REPORT_UNLOCKED", details: { paymentId: row.id, reportSnapshotId: row.report_snapshot_id } });
    await queueReportDeliveries(client, row);
    return true;
  });
}

async function markOrderFailed(row: PaymentRow, reason: string, actorUserId: string | null, meta: RequestMeta = {}): Promise<void> {
  await inSystemTransaction(async (client) => {
    const updated = await client.query(
      `UPDATE report_payments SET status = 'FAILED', failure_reason = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'PENDING';`,
      [row.id, reason.slice(0, 500)]
    );
    if (updated.rowCount === 0) return;
    await writePaymentAudit(client, {
      tenantId: row.tenant_id,
      assessmentId: row.assessment_id,
      userId: actorUserId,
      action: "REPORT_PAYMENT_FAILED",
      details: { paymentId: row.id, razorpayOrderId: row.razorpay_order_id, reason: reason.slice(0, 500) },
      meta,
    });
  });
}

async function markOrderRefunded(row: PaymentRow, razorpayPaymentId: string, source: SettlementSource): Promise<boolean> {
  return inSystemTransaction(async (client) => {
    const updated = await client.query(
      `UPDATE report_payments SET status = 'REFUNDED', refunded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'PAID' AND razorpay_payment_id = $2;`,
      [row.id, razorpayPaymentId]
    );
    if (updated.rowCount === 0) return false;
    const stillPaid = await client.query(
      "SELECT 1 AS ok FROM report_payments WHERE assessment_id = $1 AND status = 'PAID' LIMIT 1;",
      [row.assessment_id]
    );
    await writePaymentAudit(client, {
      tenantId: row.tenant_id,
      assessmentId: row.assessment_id,
      userId: null,
      action: "REPORT_PAYMENT_REFUNDED",
      details: { paymentId: row.id, razorpayPaymentId, source, reportLocked: stillPaid.rowCount === 0 },
    });
    return true;
  });
}

export interface VerificationResult {
  status: PaymentStatus;
  newlyPaid: boolean;
  paymentId: string;
  message: string;
}

/**
 * Handles the Razorpay Checkout success callback. The signature proves the ids came from Razorpay,
 * and the payment is then looked up through the Razorpay API: only a captured payment for this
 * order and amount unlocks the report.
 */
export async function verifyCheckoutPayment(
  session: SessionUser,
  input: { orderId: string; paymentId: string; signature: string },
  meta: RequestMeta = {}
): Promise<VerificationResult> {
  const config = requireRazorpayConfig();
  const row = await findPaymentByOrderId(input.orderId);
  // Same answer for unknown and foreign orders: nothing about other organisations' orders leaks.
  if (!row || row.tenant_id !== session.tenantId || isTliRole(session.role)) {
    throw new PaymentError("Payment order not found.", 404);
  }
  if (!verifyCheckoutSignature(input.orderId, input.paymentId, input.signature, config.keySecret)) {
    await inSystemTransaction((client) =>
      writePaymentAudit(client, {
        tenantId: row.tenant_id,
        assessmentId: row.assessment_id,
        userId: session.userId,
        action: "REPORT_PAYMENT_SIGNATURE_REJECTED",
        details: { paymentId: row.id, razorpayOrderId: row.razorpay_order_id },
        meta,
      })
    );
    throw new PaymentError("The payment could not be verified.", 400);
  }
  if (row.status === "PAID") {
    return { status: "PAID", newlyPaid: false, paymentId: row.id, message: "Payment already confirmed." };
  }

  const gatewayPayment = await getPaymentGateway().fetchPayment(input.paymentId);
  if (gatewayPayment.order_id !== row.razorpay_order_id) {
    throw new PaymentError("The payment could not be verified.", 400);
  }
  if (gatewayPayment.status === "captured") {
    const newlyPaid = await settlePaidOrder(row, gatewayPayment, "CHECKOUT", session.userId, meta);
    const current = await findPaymentByOrderId(input.orderId);
    if (current?.status === "PAID") {
      return { status: "PAID", newlyPaid, paymentId: row.id, message: "Payment confirmed. Your report is unlocked." };
    }
    throw new PaymentError("The payment amount does not match this order.", 400);
  }
  if (gatewayPayment.status === "failed") {
    await markOrderFailed(row, gatewayPayment.error_description || "Payment failed", session.userId, meta);
    return { status: "FAILED", newlyPaid: false, paymentId: row.id, message: "The payment failed. You can try again." };
  }
  // authorized / created: money not captured yet; the webhook or reconciliation will settle it.
  return {
    status: "PENDING",
    newlyPaid: false,
    paymentId: row.id,
    message: "Payment received by Razorpay and awaiting confirmation. The report unlocks once it is confirmed.",
  };
}

interface WebhookEntity {
  id?: string;
  order_id?: string;
  amount?: number;
  currency?: string;
  status?: string;
  amount_refunded?: number;
  refund_status?: string | null;
  error_description?: string | null;
}

export interface WebhookResult {
  httpStatus: number;
  outcome: string;
  newlyPaidPaymentId: string | null;
}

/**
 * Processes a Razorpay webhook. The signature is checked against the exact raw body; events are
 * recorded by id after processing, so a redelivered event is skipped and a failed attempt is
 * retried by Razorpay. Processing itself is idempotent, which also covers concurrent duplicates.
 */
export async function processRazorpayWebhook(rawBody: string, signature: string | null, eventIdHeader: string | null): Promise<WebhookResult> {
  const config = requireRazorpayConfig();
  if (!config.webhookSecret) {
    return { httpStatus: 503, outcome: "WEBHOOK_SECRET_NOT_CONFIGURED", newlyPaidPaymentId: null };
  }
  if (!signature || !verifyWebhookSignature(rawBody, signature, config.webhookSecret)) {
    return { httpStatus: 400, outcome: "INVALID_SIGNATURE", newlyPaidPaymentId: null };
  }

  const payloadSha256 = crypto.createHash("sha256").update(rawBody).digest("hex");
  const eventId = (eventIdHeader || "").trim().slice(0, 100) || `sha256:${payloadSha256}`;
  const seen = await pool.query("SELECT 1 AS ok FROM payment_events WHERE event_id = $1;", [eventId]);
  if (seen.rowCount > 0) return { httpStatus: 200, outcome: "DUPLICATE_EVENT", newlyPaidPaymentId: null };

  let body: { event?: string; payload?: { payment?: { entity?: WebhookEntity }; order?: { entity?: WebhookEntity } } };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { httpStatus: 400, outcome: "INVALID_JSON", newlyPaidPaymentId: null };
  }
  const eventType = String(body.event || "unknown").slice(0, 100);
  const payment = body.payload?.payment?.entity ?? {};
  const orderId = payment.order_id || body.payload?.order?.entity?.id || null;

  let outcome = "IGNORED_EVENT_TYPE";
  let newlyPaidPaymentId: string | null = null;
  const row = orderId ? await findPaymentByOrderId(orderId) : null;

  if (!row) {
    outcome = "IGNORED_UNKNOWN_ORDER";
  } else if (eventType === "payment.captured" || eventType === "order.paid") {
    const settled = await settlePaidOrder(
      row,
      {
        id: String(payment.id || ""),
        order_id: String(payment.order_id || ""),
        amount: Number(payment.amount),
        currency: String(payment.currency || ""),
        status: "captured",
      },
      "WEBHOOK",
      null
    );
    if (settled) newlyPaidPaymentId = row.id;
    outcome = settled ? "SETTLED_PAID" : row.status === "PAID" ? "ALREADY_PAID" : "AMOUNT_OR_ORDER_MISMATCH";
  } else if (eventType === "payment.failed") {
    await markOrderFailed(row, payment.error_description || "Payment failed", null);
    outcome = "MARKED_FAILED";
  } else if (eventType === "refund.processed" || eventType === "payment.refunded") {
    const fullyRefunded = payment.refund_status === "full" || Number(payment.amount_refunded) >= row.amount_paise;
    outcome = fullyRefunded && payment.id && (await markOrderRefunded(row, payment.id, "WEBHOOK")) ? "MARKED_REFUNDED" : "PARTIAL_REFUND_IGNORED";
  }

  await pool.query(
    `INSERT INTO payment_events (event_id, event_type, razorpay_order_id, razorpay_payment_id, payload_sha256, outcome)
     VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (event_id) DO NOTHING;`,
    [eventId, eventType, orderId, payment.id ?? null, payloadSha256, outcome]
  );
  return { httpStatus: 200, outcome, newlyPaidPaymentId };
}

export interface ReconciliationResult {
  checked: number;
  settledPaymentIds: string[];
  refunded: number;
}

/**
 * Re-checks open and paid orders against Razorpay: settles payments whose callback and webhook were
 * both missed (e.g. the browser closed after paying) and records full refunds made in the dashboard.
 * Scoped to orders the caller can see; customers may reconcile only their own assessment.
 */
export async function reconcilePayments(session: SessionUser, assessmentId?: string): Promise<ReconciliationResult> {
  if (!isTliRole(session.role) && !assessmentId) throw new PaymentError("Forbidden.", 403);
  const rows = await executeWithRls(session, async (client) => {
    const res = await client.query<PaymentRow>(
      `SELECT * FROM report_payments
       WHERE status IN ('PENDING', 'FAILED', 'PAID') ${assessmentId ? "AND assessment_id = $1" : ""}
       ORDER BY created_at DESC LIMIT 200;`,
      assessmentId ? [assessmentId] : []
    );
    return res.rows;
  });

  const gateway = getPaymentGateway();
  const result: ReconciliationResult = { checked: rows.length, settledPaymentIds: [], refunded: 0 };
  for (const row of rows) {
    const payments = await gateway.fetchOrderPayments(row.razorpay_order_id);
    if (row.status === "PAID") {
      const paid = payments.find((p) => p.id === row.razorpay_payment_id);
      if (paid && paid.status === "refunded" && Number(paid.amount_refunded) >= row.amount_paise) {
        if (await markOrderRefunded(row, paid.id, "RECONCILIATION")) result.refunded += 1;
      }
      continue;
    }
    const captured = payments.find((p) => p.status === "captured");
    if (captured && (await settlePaidOrder(row, captured, "RECONCILIATION", session.userId))) {
      result.settledPaymentIds.push(row.id);
    }
  }
  return result;
}
