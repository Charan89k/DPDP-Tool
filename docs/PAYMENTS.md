# Paid report delivery (Razorpay)

Customers receive their final DPDP compliance report after paying for it through Razorpay. The report
unlocks only when the server has verified the payment itself, and is then emailed to the customer and to a
central TLI assessor mailbox.

## Workflow

1. The customer completes the assessment; TLI reviews it, and a lead consultant issues the final report
   (`FINAL_ISSUED`). Issuing archives a customer copy of the report (without internal assessor notes).
2. The customer opens **Results → the report**. Until payment is confirmed they see the report status,
   the amount payable and their payment history, never the report itself.
3. The customer's **organisation administrator** (`CLIENT_ADMIN`) clicks **Pay and get the report**. The
   server creates a Razorpay order for the configured price (the browser never chooses the amount), or
   reuses the open order for that report after an abandoned or failed checkout.
4. Razorpay Checkout collects the payment.
5. The server marks the order **PAID** only after one of:
   - **Checkout callback**: the `razorpay_signature` is verified (HMAC-SHA256 of `order_id|payment_id`
     with the key secret) *and* the payment is fetched from the Razorpay API and is `captured` for this
     order, amount and currency;
   - **Webhook** `payment.captured` / `order.paid`, verified with the webhook secret over the raw body;
   - **Reconciliation** ("Check payment status" for the customer, "Reconcile with Razorpay" for TLI),
     which asks Razorpay for the order's payments.
6. The status change is a conditional update (`PENDING/FAILED → PAID`), so whichever of these arrives
   first settles the order and the others are no-ops. Only that first settlement queues the two emails.
7. The report unlocks for the organisation's users; both emails are sent in the background with the
   archived customer copy attached.

Returning to the site, a query parameter or the browser callback alone never unlocks anything.

## States

| Payment (`report_payments.status`) | Meaning |
|---|---|
| `PENDING` | Order created; not paid yet (also: checkout abandoned, or payment authorised but not captured) |
| `PAID` | Verified captured payment. The report is unlocked |
| `FAILED` | Razorpay reported the last attempt as failed. Retrying reuses the same order |
| `REFUNDED` | Fully refunded (webhook `refund.processed` or reconciliation). The report locks again |

| Email (`report_deliveries.status`) | Meaning |
|---|---|
| `QUEUED` | Created when the order was paid |
| `SENDING` | Claimed by a sender (prevents two processes sending the same email) |
| `SENT` | Accepted by the SMTP server. This is **not** proof of inbox delivery |
| `FAILED` | Last attempt failed; `last_error` says why. Retried automatically up to 3 attempts for transient SMTP errors, then by **Resend** |

Each order has exactly one customer delivery and one assessor delivery (unique key), so repeated
webhooks or callbacks can never send duplicate emails. Every attempt is recorded in `audit_logs`.

## Access control

- Customers can open the report page body and download the report only while a `PAID` order exists for
  that assessment; the download API returns `402` otherwise. Drafts are never served to customers.
- The same gate covers every detailed result, enforced inside the services (`lib/payments/access.ts`):
  gap analysis (`/api/assessments/<id>/gaps`, the gaps page), scores (`/scoring`, the readiness gauge and
  statutory deficits on the summary page), remediation tasks (list, create, update; the remediation page)
  and assessor notes on evidence (`verificationNotes` is `null`). Locked APIs return `402`; locked pages
  redirect to the report page, which shows the status, price and payment. Before payment customers still
  see their assessment status, their own answers and evidence, clarification threads, report readiness and
  the price. Assessor review data (`/reviews`) remains staff-only as before.
- Visibility still goes through the tenant policy layer first: another organisation's assessment is
  "not found", so one organisation's payment can never unlock another organisation's report.
- Downloads are authenticated (session cookie) and streamed by the API; there are no public or
  predictable file URLs. Each download of the issued report is audited (`REPORT_DOWNLOADED`).
- TLI staff keep access to reports regardless of payment (within their normal assignment scope).
- Payment never changes scores, findings or the assessment status.
- `report_payments`, `report_deliveries` and `payment_events` can be read by sessions only for
  assessments they can see, and written only by the privileged payment service; payment rows cannot be
  deleted and their amount, currency, order and assessment cannot be changed (database triggers).

## Audit trail

`audit_logs` (entity `assessments`, the assessment id) records `REPORT_PAYMENT_ORDER_CREATED`,
`REPORT_PAYMENT_RETRY`, `REPORT_PAYMENT_SIGNATURE_REJECTED`, `REPORT_PAYMENT_VERIFIED`,
`REPORT_PAYMENT_FAILED`, `REPORT_PAYMENT_REFUNDED`, `REPORT_UNLOCKED`, `REPORT_EMAIL_QUEUED`,
`REPORT_EMAIL_SENT`, `REPORT_EMAIL_FAILED`, `REPORT_EMAIL_RESEND_REQUESTED` and `REPORT_DOWNLOADED`;
`REPORT_PRICE_CHANGED` is recorded against `platform_settings`. Assessment approval and issuance are
recorded by the existing lifecycle transitions (`ASSESSMENT_STATE_TRANSITION`).

## Configuration

| Variable | Required | Purpose |
|---|---|---|
| `RAZORPAY_KEY_ID` | yes | `rzp_test_…` (Test Mode) or `rzp_live_…` (Live Mode). The mode follows the prefix |
| `RAZORPAY_KEY_SECRET` | yes | Server only. Signs checkout callbacks and authenticates API calls |
| `RAZORPAY_WEBHOOK_SECRET` | yes | The secret you set on the Razorpay webhook. `/api/ready` fails without it |
| `TLI_ASSESSOR_EMAIL` | yes | Central TLI mailbox that receives a copy of every delivered report |
| `TLI_SUPPORT_EMAIL` | no | Contact address shown in the customer's report email |

Without the Razorpay keys the feature is off: customers see "Online payment is not available yet".
The price is set by the platform super administrator under **Payments → Final report price** (stored
in `platform_settings`, audited). A new price applies to new orders; open orders keep their amount.

The Razorpay key secret and webhook secret never reach the browser; only the key id is sent to
Checkout. Keep them in the server's `.env` (never in Git).

## Razorpay setup

### Test Mode

1. In the Razorpay Dashboard switch to **Test Mode** and generate API keys (**Account & Settings → API
   Keys**). Put them in `.env` as `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`.
2. **Account & Settings → Webhooks → Add New Webhook**:
   - URL: `https://<your-domain>/api/payments/razorpay/webhook`
   - Secret: a long random value (`openssl rand -hex 32`), also stored as `RAZORPAY_WEBHOOK_SECRET`
   - Events: `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`
3. Set `TLI_ASSESSOR_EMAIL`, restart the app (`docker compose up -d`) and apply the migration
   (`docker compose run --rm cloude5 migrate`, which takes a backup first).
4. Sign in as the super administrator → **Payments** → set the report price.
5. Issue a report for a test organisation, sign in as its administrator, and pay with a Razorpay
   [test card or UPI id](https://razorpay.com/docs/payments/payments/test-card-details/).
   The page shows a "Razorpay test mode" badge.
6. Check: the report unlocks; both emails appear as `SENT` on **Payments**; Razorpay's webhook log shows
   `200` responses.

The webhook URL must be reachable from the internet (a local laptop needs the Cloudflare tunnel).

### Live Mode activation checklist

- [ ] Razorpay account activated (KYC complete) and the website/business details approved for Live Mode
- [ ] Payment capture is **automatic** (Account & Settings → Payment capture). Payments left
      `authorized` never unlock a report
- [ ] Live API keys generated; `.env` updated with `rzp_live_…` key id and the live key secret
- [ ] A **live** webhook created with the same URL and events and a **new** secret; `.env` updated
- [ ] `CLOUDE5_PUBLIC_URL` is the HTTPS production address
- [ ] `TLI_ASSESSOR_EMAIL` and real SMTP (`SMTP_*`) configured; `SMTP_FROM` domain has SPF/DKIM/DMARC
- [ ] Report price confirmed by the super administrator (amount includes any taxes you charge)
- [ ] App restarted; `curl -fsS https://<domain>/api/ready` shows `"payments"` ok with no test-mode note
- [ ] One real low-value end-to-end purchase, then refund it from the Razorpay Dashboard and confirm the
      order shows `REFUNDED` (via webhook or **Reconcile with Razorpay**)
- [ ] Terms, refund and privacy policy pages published as Razorpay requires
- [ ] Old test keys removed from the server

## Operations

- **Customer paid but the report is still locked** (e.g. the browser closed): the customer clicks
  **Check payment status**, or TLI clicks **Reconcile with Razorpay**. Missed webhooks are retried by
  Razorpay automatically for 24 hours.
- **Email failed**: the Payments page lists it with the error. Fix the cause (SMTP settings,
  `TLI_ASSESSOR_EMAIL`), then click **Resend**. Resending re-reads the archived report and never charges
  the customer again. Lead consultants and the super administrator may resend.
- **Refund**: issue it in the Razorpay Dashboard. A full refund locks the report again.
- **Two orders for one report** can exist only if the price changed between attempts; if both are paid,
  refund one from the Razorpay Dashboard.

## Testing

Staging sign-off steps (Test Mode payments, failures, duplicates, emails, refunds, browser checkout):
[STAGING_VERIFICATION.md](STAGING_VERIFICATION.md).

`npm test` includes `tests/report_payments.test.ts`, which runs the real service, database policies and
email outbox against an in-memory stand-in for the Razorpay API: successful, failed, authorised-only and
abandoned payments, retries, forged signatures, invalid and duplicate webhooks, duplicate callbacks,
cross-organisation attempts, refunds, reconciliation, email delivery to both recipients, failure and
resend, and forged writes from a tenant session. `tests/findings_access.test.ts` covers the findings
lock for every customer role, staff access, cross-tenant isolation and re-locking after a refund.

## Design limits

- Reports are Word documents (`.docx`); there is no PDF export.
- "Sent" is SMTP acceptance. Inbox delivery and bounces are visible only in the SMTP provider (Brevo).
- The report email goes to the administrator who paid (a verified account address); a separate
  "report recipient" address is not supported.
- Email retries run in the app process after the response. If the process restarts mid-send, the
  delivery stays `SENDING`; after 10 minutes **Resend** can pick it up.
