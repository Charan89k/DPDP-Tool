# Staging verification: paid report delivery

Run this on a staging copy (never production data) with Razorpay **Test Mode** keys before the release
is merged and deployed. Record the date, tester and result of each step.

## Setup

- [ ] Staging runs this branch; `docker compose run --rm cloude5 migrate` applied migration 0009 (backup taken)
- [ ] `.env`: `RAZORPAY_KEY_ID=rzp_test_…`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`,
      `TLI_ASSESSOR_EMAIL` (a mailbox you can read), real or Mailpit SMTP, `CLOUDE5_PUBLIC_URL` = staging HTTPS URL
- [ ] Razorpay Dashboard (Test Mode) webhook → `https://<staging>/api/payments/razorpay/webhook`,
      events `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`, same secret
- [ ] `curl -fsS https://<staging>/api/ready` → `"payments"` ok with the note "Razorpay is in test mode"
- [ ] Super administrator → **Payments** → set the report price (e.g. ₹10). The change appears in the audit log
- [ ] One test organisation (customer administrator + a viewer) with a completed assessment that a lead
      consultant has reviewed and **issued** (status `FINAL_ISSUED`)
- [ ] A second test organisation for cross-tenant checks

## 1. Before payment: findings are locked

As the customer administrator and as the viewer:

- [ ] **Results → report** shows "Your final report is ready", the price and **Pay and get the report**
      (viewer: "Ask your organisation's administrator"). No report sections are visible
- [ ] Summary page: answer counts visible; readiness score and statutory deficits show the lock notice
- [ ] Opening `/dashboard/assessments/<id>/gaps` or `/remediation` directly redirects to the report page
- [ ] In the browser devtools Network tab, `GET /api/assessments/<id>/gaps`, `/scoring`, `/remediations`
      and `/reports/download` return **402**; `/evidence` items have `verificationNotes: null`
- [ ] As the lead consultant the same pages and APIs show full findings (staff are never locked)
- [ ] As the second organisation's administrator, the first organisation's report URL shows "not found"

## 2. Browser checkout

- [ ] Clicking **Pay and get the report** opens Razorpay Checkout (no console CSP errors for
      `checkout.razorpay.com` / `api.razorpay.com`); the "Razorpay test mode" badge is shown
- [ ] Checkout shows Truth Labs International, the correct amount and the assessment reference
- [ ] Works on a phone-sized screen and in a second browser (e.g. Firefox and Chrome)
- [ ] A card payment that requires 3-D Secure opens and completes its bank page (popup or redirect)

## 3. Abandoned payment

- [ ] Open Checkout and close it: the page says the payment was not completed; report still locked
- [ ] **Payments** shows one `PENDING` order; Razorpay shows one order
- [ ] Click **Retry payment**: the same order id is reused (no second order in Razorpay)

## 4. Failed payment

- [ ] Pay with a Razorpay test card/UPI id that fails: the page shows the failure; report still locked
- [ ] **Payments** shows the order `FAILED` with the reason; webhook log shows `payment.failed` → `200`
- [ ] Retry with a succeeding test method on the same order succeeds (next section)

## 5. Successful payment and report unlocking

- [ ] Pay with a succeeding test card: the page says "Payment confirmed. Your report is unlocked."
- [ ] The report page now shows the full report and **Download final report**; the download is the
      issued customer copy (no internal assessor notes)
- [ ] Gaps, summary scores, remediation and evidence notes are visible to the customer and the viewer
- [ ] The second organisation still cannot open this report or its findings
- [ ] Audit log has `REPORT_PAYMENT_ORDER_CREATED`, `REPORT_PAYMENT_VERIFIED`, `REPORT_UNLOCKED`,
      `REPORT_EMAIL_QUEUED`, `REPORT_DOWNLOADED`
- [ ] Closing the browser right after paying (before the callback) still unlocks via the webhook, or via
      **Check payment status** / **Reconcile with Razorpay**

## 6. Duplicate webhook handling

- [ ] In Razorpay Dashboard → Webhooks → the `payment.captured` delivery → **Resend**: response `200`
      with outcome `DUPLICATE_EVENT` or `ALREADY_PAID`
- [ ] Still exactly one `PAID` order, two delivery rows, and no additional emails received
- [ ] Repeat the checkout callback by reloading/re-posting: no second unlock audit entry, no extra email

## 7. Email delivery to both recipients

- [ ] The customer administrator receives "Your DPDP compliance report …" with the `.docx` attached,
      payment reference, amount and a sign-in link to the report
- [ ] `TLI_ASSESSOR_EMAIL` receives "[TLI] Paid report delivered …" with the identical attachment,
      client contact, transaction id, amount, paid time and the customer's delivery status
- [ ] **Payments** shows both deliveries `Sent` with timestamps (accepted by the mail server)
- [ ] Check the SMTP provider (Brevo) log for actual delivery and bounces

## 8. Email failure and retry

- [ ] Temporarily set `TLI_ASSESSOR_EMAIL` to empty (or break SMTP credentials), restart, complete a
      payment for another issued assessment: the delivery shows `Failed` with the reason and a red alert
      appears on **Payments**; the payment stays `PAID` and the customer keeps access
- [ ] Restore the setting, restart, click **Resend**: status `Sent (attempt 2)`; the email arrives;
      Razorpay shows no new charge; audit has `REPORT_EMAIL_FAILED`, `REPORT_EMAIL_RESEND_REQUESTED`, `REPORT_EMAIL_SENT`
- [ ] A reviewer (`TLI_REVIEWER`) and a customer cannot resend (no button; API returns 403)

## 9. Refund handling

- [ ] Refund the payment in full from the Razorpay Dashboard
- [ ] Webhook `refund.processed` → `200`; **Payments** shows `REFUNDED`
      (or click **Reconcile with Razorpay** if the webhook is delayed)
- [ ] The customer's report and findings are locked again; TLI staff still see them
- [ ] A partial refund leaves the order `PAID` (by design)

## 10. Sign-off

- [ ] `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` pass on the release commit
- [ ] Playwright suite run against staging: `E2E_BASE_URL=https://<staging> npm run test:e2e`
- [ ] No secrets in Git (`git grep -n "rzp_live_"` returns nothing)
- [ ] Results recorded; then follow the Live Mode checklist in [PAYMENTS.md](PAYMENTS.md)
