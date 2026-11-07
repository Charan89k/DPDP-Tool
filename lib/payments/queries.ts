/**
 * TLI — Read models for the customer report panel and the TLI payments dashboard.
 * Every read goes through the tenant policy layer.
 */

import { executeWithRls } from "../db/rls.ts";
import type { SessionUser } from "../auth/types.ts";
import { isTliRole } from "../auth/rbac.ts";
import { getRazorpayConfig } from "./razorpay.ts";
import type { PaymentMode } from "./razorpay.ts";
import { getReportPricePaise } from "./settings.ts";
import { isReportUnlocked, loadIssuedReport } from "./service.ts";
import type { PaymentStatus } from "./records.ts";
import type { DeliveryStatus, RecipientType } from "./delivery.ts";

export interface DeliveryView {
  id: string;
  paymentId: string;
  recipientType: RecipientType;
  /** Shown to TLI staff only; the assessor mailbox is never shown to customers. */
  recipientEmail: string | null;
  status: DeliveryStatus;
  attempts: number;
  lastError: string | null;
  lastAttemptAt: string | null;
  sentAt: string | null;
}

export interface PaymentView {
  id: string;
  assessmentId: string;
  tenantName: string;
  engagementCode: string;
  assessmentTitle: string;
  assessmentStatus: string;
  requestedByName: string;
  requestedByEmail: string;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  amountPaise: number;
  mode: PaymentMode;
  status: PaymentStatus;
  failureReason: string | null;
  createdAt: string;
  paidAt: string | null;
  deliveries: DeliveryView[];
}

const iso = (value: unknown): string | null => (value ? new Date(value as string).toISOString() : null);

async function loadPayments(session: SessionUser, where: string, params: unknown[]): Promise<PaymentView[]> {
  const staff = isTliRole(session.role);
  return executeWithRls(session, async (client) => {
    const payments = await client.query(
      `SELECT p.*, a.engagement_code, a.title, a.status AS assessment_status, t.name AS tenant_name,
              u.full_name AS requested_by_name, u.email AS requested_by_email
       FROM report_payments p
       JOIN assessments a ON a.id = p.assessment_id
       LEFT JOIN tenants t ON t.id = p.tenant_id
       LEFT JOIN users u ON u.id = p.requested_by_user_id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT 500;`,
      params
    );
    if (payments.rowCount === 0) return [];
    const deliveries = await client.query(
      "SELECT * FROM report_deliveries WHERE payment_id = ANY($1) ORDER BY recipient_type DESC;",
      [payments.rows.map((p) => p.id)]
    );
    return payments.rows.map((p) => ({
      id: p.id,
      assessmentId: p.assessment_id,
      tenantName: p.tenant_name ?? "",
      engagementCode: p.engagement_code,
      assessmentTitle: p.title,
      assessmentStatus: p.assessment_status,
      requestedByName: p.requested_by_name ?? "",
      requestedByEmail: p.requested_by_email ?? "",
      razorpayOrderId: p.razorpay_order_id,
      razorpayPaymentId: p.razorpay_payment_id,
      amountPaise: p.amount_paise,
      mode: p.mode,
      status: p.status,
      failureReason: p.failure_reason,
      createdAt: iso(p.created_at) ?? "",
      paidAt: iso(p.paid_at),
      deliveries: deliveries.rows
        .filter((d) => d.payment_id === p.id)
        .map((d) => ({
          id: d.id,
          paymentId: d.payment_id,
          recipientType: d.recipient_type,
          recipientEmail: staff || d.recipient_type === "CLIENT" ? d.recipient_email : null,
          status: d.status,
          attempts: d.attempts,
          lastError: staff ? d.last_error : null,
          lastAttemptAt: iso(d.last_attempt_at),
          sentAt: iso(d.sent_at),
        })),
    }));
  });
}

export interface ReportAccessView {
  paymentsConfigured: boolean;
  mode: PaymentMode | null;
  pricePaise: number | null;
  reportReady: boolean;
  unlocked: boolean;
  canPay: boolean;
  payments: PaymentView[];
}

/** Everything the report page needs to show the paywall, payment history and delivery status. */
export async function getReportAccessView(session: SessionUser, assessmentId: string): Promise<ReportAccessView> {
  const report = await loadIssuedReport(session, assessmentId);
  let config = null;
  try {
    config = getRazorpayConfig();
  } catch {
    config = null;
  }
  return {
    paymentsConfigured: Boolean(config),
    mode: config?.mode ?? null,
    pricePaise: await getReportPricePaise(),
    reportReady: report.ready,
    unlocked: await isReportUnlocked(assessmentId),
    canPay: session.role === "CLIENT_ADMIN" && report.tenantId === session.tenantId,
    payments: await loadPayments(session, "WHERE p.assessment_id = $1", [assessmentId]),
  };
}

export const PAYMENT_STATUS_FILTERS = ["ALL", "PENDING", "PAID", "FAILED", "REFUNDED", "DELIVERY_FAILED"] as const;
export type PaymentStatusFilter = (typeof PAYMENT_STATUS_FILTERS)[number];

/** Payments the TLI user can see, optionally filtered by payment status or failed deliveries. */
export async function listPaymentsForStaff(session: SessionUser, filter: PaymentStatusFilter = "ALL"): Promise<PaymentView[]> {
  if (!isTliRole(session.role)) return [];
  if (filter === "DELIVERY_FAILED") {
    return loadPayments(
      session,
      "WHERE p.id IN (SELECT d.payment_id FROM report_deliveries d WHERE d.status = 'FAILED')",
      []
    );
  }
  return filter === "ALL" ? loadPayments(session, "", []) : loadPayments(session, "WHERE p.status = $1", [filter]);
}
