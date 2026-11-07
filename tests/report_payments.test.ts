/**
 * TLI — Payment-gated report delivery tests (Razorpay).
 *
 * The Razorpay network API is replaced by an in-memory gateway; everything else (signatures,
 * database, tenant policy layer, email outbox) is the real implementation.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { pool } from "../lib/db/pool.ts";
import { executeWithRls } from "../lib/db/rls.ts";
import type { SessionUser } from "../lib/auth/types.ts";
import { getLocalStorageAdapter } from "../lib/storage/local_adapter.ts";
import { devOutboxDir } from "../lib/email/mailer.ts";
import { setPaymentGatewayForTests, verifyCheckoutSignature, verifyWebhookSignature } from "../lib/payments/razorpay.ts";
import type { GatewayPayment, PaymentGateway } from "../lib/payments/razorpay.ts";
import {
  canAccessReportDocument,
  createReportOrder,
  isReportUnlocked,
  processRazorpayWebhook,
  reconcilePayments,
  verifyCheckoutPayment,
  PaymentError,
} from "../lib/payments/service.ts";
import { dispatchReportDeliveries, resendReportDelivery } from "../lib/payments/delivery.ts";
import { setReportPricePaise, getReportPricePaise } from "../lib/payments/settings.ts";
import { getReportAccessView, listPaymentsForStaff } from "../lib/payments/queries.ts";

const KEY_SECRET = "unit_test_key_secret";
const WEBHOOK_SECRET = "unit_test_webhook_secret";
const PRICE_PAISE = 1_500_000; // ₹15,000
/** The email outbox persists between runs, so each run uses its own engagement codes. */
const RUN = crypto.randomBytes(3).toString("hex").toUpperCase();

const TLI_TENANT = "018f3a5b-7c8d-7e90-8000-000000000001";
const ALPHA_TENANT = "018f3a5b-7c8d-7e90-8000-000000000002";
const BETA_TENANT = "018f3a5b-7c8d-7e90-8000-000000000003";
const FRAMEWORK = "ab68a890-9932-5775-bd04-d18bffdb0415";
const SCORING = "c9ddba7f-8954-5d37-a92f-cf5a1f27e68b";

const session = (userId: string, tenantId: string, role: SessionUser["role"], email: string): SessionUser => ({
  userId,
  tenantId,
  email,
  fullName: email.split("@")[0],
  role,
  tenantType: tenantId === TLI_TENANT ? "TLI" : "CLIENT",
  tenantName: "Test",
  tenantSlug: "test",
  isSdf: false,
});

const SUPER_ADMIN = session("018f3a5b-7c8d-7e90-8000-000000000101", TLI_TENANT, "TLI_SUPER_ADMIN", "admin@truthlabs.in");
const LEAD = session("018f3a5b-7c8d-7e90-8000-000000000102", TLI_TENANT, "TLI_LEAD_CONSULTANT", "lead.consultant@truthlabs.in");
const REVIEWER = session("018f3a5b-7c8d-7e90-8000-000000000103", TLI_TENANT, "TLI_REVIEWER", "reviewer.privacy@truthlabs.in");
const ALPHA_ADMIN = session("018f3a5b-7c8d-7e90-8000-000000000111", ALPHA_TENANT, "CLIENT_ADMIN", "admin@alphahealth.example.com");
const ALPHA_BU_LEAD = session("018f3a5b-7c8d-7e90-8000-000000000112", ALPHA_TENANT, "CLIENT_BU_LEAD", "clinical.lead@alphahealth.example.com");
const BETA_ADMIN = session("018f3a5b-7c8d-7e90-8000-000000000121", BETA_TENANT, "CLIENT_ADMIN", "admin@betaexpress.example.com");

/** In-memory stand-in for the Razorpay API. */
class FakeGateway implements PaymentGateway {
  orders = new Map<string, { amount: number; currency: string }>();
  payments = new Map<string, GatewayPayment>();
  createdOrders = 0;
  async createOrder(input: { amount: number; currency: string }) {
    this.createdOrders += 1;
    const id = `order_test${String(this.createdOrders).padStart(10, "0")}`;
    this.orders.set(id, { amount: input.amount, currency: input.currency });
    return { id, amount: input.amount, currency: input.currency, status: "created" };
  }
  async fetchPayment(paymentId: string) {
    const payment = this.payments.get(paymentId);
    if (!payment) throw new Error("payment not found");
    return payment;
  }
  async fetchOrderPayments(orderId: string) {
    return [...this.payments.values()].filter((p) => p.order_id === orderId);
  }
  pay(orderId: string, status: GatewayPayment["status"], amount?: number): string {
    const order = this.orders.get(orderId)!;
    const id = `pay_test${crypto.randomBytes(6).toString("hex")}`;
    this.payments.set(id, { id, order_id: orderId, amount: amount ?? order.amount, currency: order.currency, status });
    return id;
  }
}

const checkoutSignature = (orderId: string, paymentId: string) =>
  crypto.createHmac("sha256", KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");

function webhook(event: string, entity: Record<string, unknown>, eventId = `evt_${crypto.randomUUID()}`) {
  const body = JSON.stringify({ event, payload: { payment: { entity } } });
  return { body, signature: crypto.createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex"), eventId };
}

/** Creates an issued assessment with an archived customer copy, as issueOfficialFinalReport does. */
async function createIssuedAssessment(code: string): Promise<string> {
  const assessmentId = crypto.randomUUID();
  const content = Buffer.from(`final report ${code}`);
  const key = `reports/${ALPHA_TENANT}/${assessmentId}/FINAL-V1.0-client.docx`;
  await getLocalStorageAdapter().saveFile(key, content);
  await pool.query(
    `INSERT INTO assessments (id, tenant_id, framework_version_id, scoring_model_id, engagement_code, title, status,
       lead_consultant_id, is_partial_assessment, issued_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'FINAL_ISSUED', $7, 0, CURRENT_TIMESTAMP);`,
    [assessmentId, ALPHA_TENANT, FRAMEWORK, SCORING, code, `Payment test ${code}`, LEAD.userId]
  );
  await pool.query(
    "INSERT INTO assessment_assignments (id, assessment_id, user_id, assignment_role) VALUES ($1, $2, $3, 'ENGAGEMENT_LEAD');",
    [crypto.randomUUID(), assessmentId, LEAD.userId]
  );
  await pool.query(
    `INSERT INTO report_snapshots (assessment_id, tenant_id, report_type, version_label, s3_key, file_sha256_hash,
       dataset_sha256_hash, generated_by_user_id, lead_approver_id, approved_at, is_draft, summary_metadata)
     VALUES ($1, $2, 'DOCX', 'FINAL-V1.0', $3, $4, $4, $5, $5, CURRENT_TIMESTAMP, FALSE, $6);`,
    [
      assessmentId,
      ALPHA_TENANT,
      key.replace("-client", ""),
      "0".repeat(64),
      LEAD.userId,
      JSON.stringify({
        clientS3Key: key,
        clientFileSha256: crypto.createHash("sha256").update(content).digest("hex"),
        fileName: `TLI_DPDP_Report_FINAL_${code}.docx`,
      }),
    ]
  );
  return assessmentId;
}

async function paymentRows(assessmentId: string) {
  return (await pool.query("SELECT * FROM report_payments WHERE assessment_id = $1 ORDER BY created_at;", [assessmentId])).rows;
}

async function deliveryRows(assessmentId: string) {
  return (await pool.query("SELECT * FROM report_deliveries WHERE assessment_id = $1 ORDER BY recipient_type;", [assessmentId])).rows;
}

async function auditActions(assessmentId: string): Promise<string[]> {
  const res = await pool.query("SELECT action FROM audit_logs WHERE entity_id = $1 ORDER BY timestamp;", [assessmentId]);
  return res.rows.map((r) => r.action);
}

const gateway = new FakeGateway();
const savedEnv = { ...process.env };

describe("TLI payment-gated report delivery", () => {
  let checkoutAssessment: string;
  let webhookAssessment: string;

  before(async () => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_unittest";
    process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
    process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.TLI_ASSESSOR_EMAIL = "assessor@tli.example.com";
    setPaymentGatewayForTests(gateway);
    checkoutAssessment = await createIssuedAssessment(`PAY-CHECKOUT-${RUN}`);
    webhookAssessment = await createIssuedAssessment(`PAY-WEBHOOK-${RUN}`);
  });

  after(() => {
    setPaymentGatewayForTests(null);
    process.env = savedEnv;
  });

  it("signature helpers accept only the exact HMAC", () => {
    const sig = checkoutSignature("order_abc", "pay_xyz");
    assert.equal(verifyCheckoutSignature("order_abc", "pay_xyz", sig, KEY_SECRET), true);
    assert.equal(verifyCheckoutSignature("order_abc", "pay_other", sig, KEY_SECRET), false);
    assert.equal(verifyCheckoutSignature("order_abc", "pay_xyz", "not-hex", KEY_SECRET), false);
    assert.equal(verifyWebhookSignature("{}", sig, WEBHOOK_SECRET), false);
  });

  it("only the super administrator can set the report price", async () => {
    await assert.rejects(() => setReportPricePaise(LEAD, PRICE_PAISE), /super administrator/);
    await assert.rejects(() => setReportPricePaise(SUPER_ADMIN, 50), /between/);
    await setReportPricePaise(SUPER_ADMIN, PRICE_PAISE);
    assert.equal(await getReportPricePaise(), PRICE_PAISE);
  });

  it("keeps the report locked for customers before payment while TLI staff keep access", async () => {
    assert.equal(await isReportUnlocked(checkoutAssessment), false);
    assert.equal(await canAccessReportDocument(ALPHA_ADMIN, checkoutAssessment), false);
    assert.equal(await canAccessReportDocument(LEAD, checkoutAssessment), true);
    const view = await getReportAccessView(ALPHA_ADMIN, checkoutAssessment);
    assert.equal(view.reportReady, true);
    assert.equal(view.unlocked, false);
    assert.equal(view.canPay, true);
    assert.equal(view.pricePaise, PRICE_PAISE);
    assert.equal(view.mode, "test");
  });

  it("lets only the customer's own administrator start a payment", async () => {
    await assert.rejects(() => createReportOrder(ALPHA_BU_LEAD, checkoutAssessment), (e: unknown) => e instanceof PaymentError && e.status === 403);
    await assert.rejects(() => createReportOrder(LEAD, checkoutAssessment), (e: unknown) => e instanceof PaymentError && e.status === 403);
    // Another organisation cannot even see the assessment.
    await assert.rejects(() => createReportOrder(BETA_ADMIN, checkoutAssessment), (e: unknown) => e instanceof PaymentError && e.status === 404);
  });

  it("reuses the open order after an abandoned checkout instead of creating a second charge", async () => {
    const first = await createReportOrder(ALPHA_ADMIN, checkoutAssessment);
    assert.equal(first.amountPaise, PRICE_PAISE);
    assert.equal(first.reused, false);
    const again = await createReportOrder(ALPHA_ADMIN, checkoutAssessment);
    assert.equal(again.reused, true);
    assert.equal(again.orderId, first.orderId);
    assert.equal((await paymentRows(checkoutAssessment)).length, 1);
    assert.equal(gateway.createdOrders, 1);
  });

  it("rejects a forged checkout signature and keeps the report locked", async () => {
    const [row] = await paymentRows(checkoutAssessment);
    const paymentId = gateway.pay(row.razorpay_order_id, "captured");
    await assert.rejects(
      () => verifyCheckoutPayment(ALPHA_ADMIN, { orderId: row.razorpay_order_id, paymentId, signature: "f".repeat(64) }),
      (e: unknown) => e instanceof PaymentError && e.status === 400
    );
    assert.equal(await isReportUnlocked(checkoutAssessment), false);
    assert.ok((await auditActions(checkoutAssessment)).includes("REPORT_PAYMENT_SIGNATURE_REJECTED"));
    gateway.payments.delete(paymentId);
  });

  it("refuses another organisation's callback even with a valid signature", async () => {
    const [row] = await paymentRows(checkoutAssessment);
    const paymentId = gateway.pay(row.razorpay_order_id, "captured");
    await assert.rejects(
      () => verifyCheckoutPayment(BETA_ADMIN, { orderId: row.razorpay_order_id, paymentId, signature: checkoutSignature(row.razorpay_order_id, paymentId) }),
      (e: unknown) => e instanceof PaymentError && e.status === 404
    );
    assert.equal(await isReportUnlocked(checkoutAssessment), false);
    gateway.payments.delete(paymentId);
  });

  it("records a failed payment, keeps the report locked and allows a retry on the same order", async () => {
    const [row] = await paymentRows(checkoutAssessment);
    const failedId = gateway.pay(row.razorpay_order_id, "failed");
    const result = await verifyCheckoutPayment(ALPHA_ADMIN, {
      orderId: row.razorpay_order_id,
      paymentId: failedId,
      signature: checkoutSignature(row.razorpay_order_id, failedId),
    });
    assert.equal(result.status, "FAILED");
    assert.equal(await isReportUnlocked(checkoutAssessment), false);
    const retry = await createReportOrder(ALPHA_ADMIN, checkoutAssessment);
    assert.equal(retry.reused, true);
    assert.equal((await paymentRows(checkoutAssessment))[0].status, "PENDING");
    gateway.payments.delete(failedId);
  });

  it("does not unlock a payment that is only authorised, not captured", async () => {
    const [row] = await paymentRows(checkoutAssessment);
    const authorisedId = gateway.pay(row.razorpay_order_id, "authorized");
    const result = await verifyCheckoutPayment(ALPHA_ADMIN, {
      orderId: row.razorpay_order_id,
      paymentId: authorisedId,
      signature: checkoutSignature(row.razorpay_order_id, authorisedId),
    });
    assert.equal(result.status, "PENDING");
    assert.equal(await isReportUnlocked(checkoutAssessment), false);
    gateway.payments.delete(authorisedId);
  });

  it("unlocks the report after a verified captured payment, exactly once", async () => {
    const [row] = await paymentRows(checkoutAssessment);
    const paymentId = gateway.pay(row.razorpay_order_id, "captured");
    const input = { orderId: row.razorpay_order_id, paymentId, signature: checkoutSignature(row.razorpay_order_id, paymentId) };

    const first = await verifyCheckoutPayment(ALPHA_ADMIN, input);
    assert.equal(first.status, "PAID");
    assert.equal(first.newlyPaid, true);
    const duplicate = await verifyCheckoutPayment(ALPHA_ADMIN, input);
    assert.equal(duplicate.newlyPaid, false);

    assert.equal(await canAccessReportDocument(ALPHA_ADMIN, checkoutAssessment), true);
    assert.equal(await isReportUnlocked(webhookAssessment), false, "one payment unlocks only its own assessment");

    const deliveries = await deliveryRows(checkoutAssessment);
    assert.deepEqual(deliveries.map((d) => [d.recipient_type, d.status]), [["ASSESSOR", "QUEUED"], ["CLIENT", "QUEUED"]]);
    assert.equal(deliveries.find((d) => d.recipient_type === "CLIENT").recipient_email, ALPHA_ADMIN.email);

    const actions = await auditActions(checkoutAssessment);
    for (const action of ["REPORT_PAYMENT_ORDER_CREATED", "REPORT_PAYMENT_FAILED", "REPORT_PAYMENT_RETRY", "REPORT_PAYMENT_VERIFIED", "REPORT_UNLOCKED", "REPORT_EMAIL_QUEUED"]) {
      assert.ok(actions.includes(action), `audit trail has ${action}`);
    }
    assert.equal(actions.filter((a) => a === "REPORT_PAYMENT_VERIFIED").length, 1);
  });

  it("emails the report to the customer and the TLI assessor once, with the report attached", async () => {
    const [row] = await paymentRows(checkoutAssessment);
    const results = await dispatchReportDeliveries(row.id, []);
    assert.deepEqual(results.map((r) => r.outcome), ["SENT", "SENT"]);
    const again = await dispatchReportDeliveries(row.id, []);
    assert.deepEqual(again.map((r) => r.outcome), ["SKIPPED", "SKIPPED"], "no duplicate emails");

    const deliveries = await deliveryRows(checkoutAssessment);
    assert.ok(deliveries.every((d) => d.status === "SENT" && d.attempts === 1 && d.sent_at));

    const outbox = fs.readdirSync(devOutboxDir()).map((f) => fs.readFileSync(`${devOutboxDir()}/${f}`, "utf8"));
    const forClient = outbox.filter((m) => m.includes(`To: ${ALPHA_ADMIN.email}`) && m.includes(`PAY-CHECKOUT-${RUN}`));
    const forAssessor = outbox.filter((m) => m.includes("To: assessor@tli.example.com") && m.includes(`PAY-CHECKOUT-${RUN}`));
    assert.equal(forClient.length, 1);
    assert.equal(forAssessor.length, 1);
    assert.match(forClient[0], new RegExp(`X-Attachment: TLI_DPDP_Report_FINAL_PAY-CHECKOUT-${RUN}\\.docx`));
    assert.match(forClient[0], /Truth Labs International/);
    assert.match(forAssessor[0], new RegExp(`X-Attachment: TLI_DPDP_Report_FINAL_PAY-CHECKOUT-${RUN}\\.docx`));
    assert.match(forAssessor[0], new RegExp(row.razorpay_order_id));
    assert.match(forAssessor[0], /₹15,000\.00/);
  });

  it("rejects webhooks with an invalid signature", async () => {
    const w = webhook("payment.captured", { id: "pay_x", order_id: "order_x", amount: PRICE_PAISE, currency: "INR" });
    const result = await processRazorpayWebhook(w.body, "0".repeat(64), w.eventId);
    assert.equal(result.httpStatus, 400);
    const tampered = await processRazorpayWebhook(w.body.replace(String(PRICE_PAISE), "100"), w.signature, w.eventId);
    assert.equal(tampered.httpStatus, 400);
  });

  it("settles from a signed webhook, ignores duplicates and never queues a second email", async () => {
    const order = await createReportOrder(ALPHA_ADMIN, webhookAssessment);
    // An amount that does not match the order never unlocks.
    const wrong = webhook("payment.captured", { id: "pay_wrongamount1", order_id: order.orderId, amount: 100, currency: "INR" });
    assert.equal((await processRazorpayWebhook(wrong.body, wrong.signature, wrong.eventId)).outcome, "AMOUNT_OR_ORDER_MISMATCH");
    assert.equal(await isReportUnlocked(webhookAssessment), false);

    const entity = { id: "pay_webhookpaid01", order_id: order.orderId, amount: PRICE_PAISE, currency: "INR", status: "captured" };
    const w = webhook("payment.captured", entity);
    const first = await processRazorpayWebhook(w.body, w.signature, w.eventId);
    assert.equal(first.outcome, "SETTLED_PAID");
    assert.ok(first.newlyPaidPaymentId);
    const redelivered = await processRazorpayWebhook(w.body, w.signature, w.eventId);
    assert.equal(redelivered.outcome, "DUPLICATE_EVENT");
    const orderPaid = webhook("order.paid", entity);
    const second = await processRazorpayWebhook(orderPaid.body, orderPaid.signature, orderPaid.eventId);
    assert.equal(second.outcome, "ALREADY_PAID");
    assert.equal(second.newlyPaidPaymentId, null);

    assert.equal(await isReportUnlocked(webhookAssessment), true);
    assert.equal((await deliveryRows(webhookAssessment)).length, 2);
  });

  it("retries a failed email without touching the payment, and only TLI staff may resend", async () => {
    const [row] = await paymentRows(webhookAssessment);
    delete process.env.TLI_ASSESSOR_EMAIL;
    const results = await dispatchReportDeliveries(row.id, []);
    const byType = Object.fromEntries((await deliveryRows(webhookAssessment)).map((d) => [d.recipient_type, d]));
    assert.equal(byType.CLIENT.status, "SENT");
    assert.equal(byType.ASSESSOR.status, "FAILED");
    assert.match(byType.ASSESSOR.last_error, /TLI_ASSESSOR_EMAIL/);
    assert.ok(results.some((r) => r.outcome === "FAILED" && r.permanent));

    const failedView = await listPaymentsForStaff(LEAD, "DELIVERY_FAILED");
    assert.ok(failedView.some((p) => p.id === row.id), "failed deliveries are listed for TLI staff");

    process.env.TLI_ASSESSOR_EMAIL = "assessor@tli.example.com";
    await assert.rejects(() => resendReportDelivery(ALPHA_ADMIN, byType.ASSESSOR.id), (e: unknown) => e instanceof PaymentError && e.status === 403);
    await assert.rejects(() => resendReportDelivery(REVIEWER, byType.ASSESSOR.id), (e: unknown) => e instanceof PaymentError && e.status === 403);
    const resent = await resendReportDelivery(LEAD, byType.ASSESSOR.id);
    assert.equal(resent.outcome, "SENT");

    const afterResend = await deliveryRows(webhookAssessment);
    assert.equal(afterResend.find((d) => d.recipient_type === "ASSESSOR").attempts, 2);
    const payments = await paymentRows(webhookAssessment);
    assert.equal(payments.length, 1, "no new payment for a resend");
    assert.equal(payments[0].status, "PAID");
    const actions = await auditActions(webhookAssessment);
    assert.ok(actions.includes("REPORT_EMAIL_FAILED"));
    assert.ok(actions.includes("REPORT_EMAIL_RESEND_REQUESTED"));
    assert.equal(actions.filter((a) => a === "REPORT_EMAIL_SENT").length, 2);
  });

  it("refuses to resend an already-sent email unless the operator confirms (no accidental duplicates)", async () => {
    // Staging found this: an automatic retry delivered the email while the dashboard still showed it
    // failed, and a Resend click then sent the assessor a second copy.
    const assessor = (await deliveryRows(webhookAssessment)).find((d) => d.recipient_type === "ASSESSOR");
    assert.equal(assessor.status, "SENT");
    const outboxBefore = fs.readdirSync(devOutboxDir()).length;
    await assert.rejects(
      () => resendReportDelivery(LEAD, assessor.id),
      (e: unknown) => e instanceof PaymentError && e.status === 409
    );
    const unchanged = (await deliveryRows(webhookAssessment)).find((d) => d.recipient_type === "ASSESSOR");
    assert.equal(unchanged.attempts, assessor.attempts, "no attempt recorded");
    assert.equal(fs.readdirSync(devOutboxDir()).length, outboxBefore, "no email sent");

    const confirmed = await resendReportDelivery(LEAD, assessor.id, {}, { confirmAlreadySent: true });
    assert.equal(confirmed.outcome, "SENT");
    assert.equal((await deliveryRows(webhookAssessment)).find((d) => d.recipient_type === "ASSESSOR").attempts, assessor.attempts + 1);
    assert.equal(fs.readdirSync(devOutboxDir()).length, outboxBefore + 1, "exactly one email when confirmed");
  });

  it("hides the TLI assessor mailbox and internal errors from customers", async () => {
    const view = await getReportAccessView(ALPHA_ADMIN, webhookAssessment);
    const assessor = view.payments[0].deliveries.find((d) => d.recipientType === "ASSESSOR");
    assert.equal(assessor?.recipientEmail, null);
    assert.equal(assessor?.lastError, null);
  });

  it("locks the report again after a full refund", async () => {
    const [row] = await paymentRows(webhookAssessment);
    const w = webhook("refund.processed", {
      id: row.razorpay_payment_id,
      order_id: row.razorpay_order_id,
      amount: PRICE_PAISE,
      currency: "INR",
      amount_refunded: PRICE_PAISE,
      refund_status: "full",
    });
    assert.equal((await processRazorpayWebhook(w.body, w.signature, w.eventId)).outcome, "MARKED_REFUNDED");
    assert.equal(await isReportUnlocked(webhookAssessment), false);
    assert.ok((await auditActions(webhookAssessment)).includes("REPORT_PAYMENT_REFUNDED"));
  });

  it("reconciles a payment whose callback and webhook were both missed", async () => {
    const assessmentId = await createIssuedAssessment(`PAY-RECONCILE-${RUN}`);
    const order = await createReportOrder(ALPHA_ADMIN, assessmentId);
    gateway.pay(order.orderId, "captured");
    await assert.rejects(() => reconcilePayments(ALPHA_ADMIN), (e: unknown) => e instanceof PaymentError && e.status === 403);
    const beta = await reconcilePayments(BETA_ADMIN, assessmentId);
    assert.equal(beta.checked, 0, "other organisations cannot reconcile this order");
    const result = await reconcilePayments(ALPHA_ADMIN, assessmentId);
    assert.equal(result.settledPaymentIds.length, 1);
    assert.equal(await isReportUnlocked(assessmentId), true);
  });

  it("tenant sessions can neither forge nor read other organisations' payment records", async () => {
    await assert.rejects(
      () =>
        executeWithRls(ALPHA_ADMIN, (client) =>
          client.query(
            `INSERT INTO report_payments (id, tenant_id, assessment_id, report_snapshot_id, requested_by_user_id, razorpay_order_id, amount_paise, mode, status)
             SELECT $1, tenant_id, assessment_id, report_snapshot_id, requested_by_user_id, 'order_forged0001', amount_paise, mode, 'PAID'
             FROM report_payments LIMIT 1;`,
            [crypto.randomUUID()]
          )
        ),
      /permission denied/
    );
    await assert.rejects(
      () => executeWithRls(ALPHA_ADMIN, (client) => client.query("UPDATE report_payments SET status = 'PAID';")),
      /permission denied/
    );
    const visibleToBeta = await executeWithRls(BETA_ADMIN, (client) => client.query("SELECT id FROM report_payments;"));
    assert.equal(visibleToBeta.rowCount, 0);
    const events = await executeWithRls(SUPER_ADMIN, (client) => client.query("SELECT event_id FROM payment_events;"));
    assert.equal(events.rowCount, 0, "webhook bookkeeping is never exposed to sessions");
  });

  it("protects payment records from deletion and amount changes", async () => {
    const [row] = await paymentRows(checkoutAssessment);
    await assert.rejects(() => pool.query("DELETE FROM report_payments WHERE id = $1;", [row.id]), /FORENSIC_INTEGRITY_VIOLATION/);
    await assert.rejects(() => pool.query("UPDATE report_payments SET amount_paise = 100 WHERE id = $1;", [row.id]), /FORENSIC_INTEGRITY_VIOLATION/);
  });
});
