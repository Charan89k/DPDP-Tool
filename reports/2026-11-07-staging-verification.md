# Staging verification: TLI rebrand and Razorpay paid report delivery (2026-11-07)

Branch `feat/tli-rebrand-razorpay` (uncommitted). Executed against an isolated **local** staging stack:
Docker project `tli-staging` (own image, ports 3300/8325, own data directory, Mailpit for SMTP). No production
host, database, credential or Razorpay account was touched.

## Summary

| | Count |
|---|---|
| Test cases executed | 42 (28 HTTP staging cases, 7 real-browser cases, 6 Playwright e2e, 1 not runnable) |
| Passed | 37 |
| Failed (final run) | 0 |
| Blocked | 5 |

**Recommendation: READY FOR COMMIT** (code verified; no open failures). **Not ready for Live Mode** until the 5
blocked checks are run with real Razorpay Test Mode keys (see "Blocked").

## Environment

- No Razorpay keys exist on this machine (`.env` and environment have none) and the Razorpay Dashboard is not
  accessible here. Staging therefore used **placeholder Test Mode keys** (`rzp_test_…` prefix) and a locally
  generated webhook secret. Consequences: the app runs in Test Mode, but Razorpay's API rejects order creation,
  checkout rendering and reconciliation (401/404). Webhooks were **simulated**: correctly signed requests with the
  staging webhook secret, in Razorpay's payload format, sent over HTTP to the real endpoint.
- Data: synthetic organisations (Alpha with admin + viewer, Beta), a TLI lead consultant and three assessments
  answered and issued through the real `issueOfficialFinalReport` (real Word reports). Sessions were signed with
  the staging session secret.
- Migrations 0001–0009 applied by the container's `migrate`; `/api/ready` = ready, payments "Razorpay is in test mode".

## Defects found and fixed during staging

1. **Duplicate report email on Resend** (MAIL-4/5 first run). An automatic retry delivered the assessor copy;
   a Resend issued 1.5 s later sent it again (Mailpit showed 2 copies). The resend API allowed re-sending a `SENT`
   delivery without any check, so a stale Payments dashboard could cause duplicates. Fix: resending a `SENT`
   email requires `confirmAlreadySent` (API returns 409 otherwise); the dashboard labels it "Send again" and asks for
   confirmation. Regression test: `tests/report_payments.test.ts` "refuses to resend an already-sent email…".
   Re-verified on staging: MAIL-6 (409, no email) and MAIL-7 (confirmed, exactly one email).
2. **Content Security Policy blocked Razorpay Checkout's API/telemetry calls** (BR-2 first run: 2 violations,
   `lumberjack.razorpay.com` refused by `connect-src 'self'`). Fix: `connect-src` adds `https://api.razorpay.com`
   and `https://lumberjack.razorpay.com`. Regression test in `tests/platform_hardening.test.ts`. Re-verified: 0 violations.
3. **Outdated e2e assertion**: the browser test expected a customer to see readiness scores before payment, which
   the findings lock now forbids. Updated to assert the lock notice and 402 from the scoring and gap APIs.

Harness corrections (not product defects): the first runs selected the lifecycle's `PDF` dataset-record snapshot
instead of the issued `DOCX` snapshot, used JSX comments as report-body markers (never rendered), and stopped
waiting for email retries too early. All were corrected and every case was re-run on a fresh staging database.
Note: the previous milestone's HTTP "report page has no findings" check used the same non-rendered markers; this
run verifies it with rendered headings (LOCK-*, UNL-1, UNL-2, SEC-3).

## Results

| ID | Test case | Expected | Actual | Result | Evidence |
|---|---|---|---|---|---|
| ENV-1 | Staging ready; isolated DB; Razorpay Test Mode | ready, payments ok, test mode | ready; payments true "Razorpay is in test mode." | **PASS** | GET /api/ready |
| ENV-2 | Super admin sets report price; others cannot | admin 200 (₹10); lead 403 | admin 200; lead 403 | **PASS** | {"ok":true,"amountPaise":1000} |
| LOCK-alphaAdmin | Before payment (alphaAdmin): findings locked, status/price visible | gaps/scoring/remediations/download 402; gaps & remediation pages redirect to report; report page no body; ready=true price=1000 | 402/402/402/402; pages 307->reports/cd5f3f15-894d-4703-b2da-653b0c4fad20,307->reports/cd5f3f15-894d-4703-b2da-653b0c4fad20; body=false; ready=true price=1000 unlocked=false | **PASS** |  |
| LOCK-alphaViewer | Before payment (alphaViewer): findings locked, status/price visible | gaps/scoring/remediations/download 402; gaps & remediation pages redirect to report; report page no body; ready=true price=1000 | 402/402/402/402; pages 307->reports/cd5f3f15-894d-4703-b2da-653b0c4fad20,307->reports/cd5f3f15-894d-4703-b2da-653b0c4fad20; body=false; ready=true price=1000 unlocked=false | **PASS** |  |
| LOCK-staff | TLI staff unrestricted before payment | gaps 200, report body shown | gaps 200; body=true | **PASS** |  |
| PAY-0a | Only customer administrator may start a payment | viewer 403 | viewer 403 | **PASS** | {"error":"Only your organisation's administrator can pay for this report."} |
| PAY-0b | Server-side Razorpay order creation (Test Mode) | 200 with order_… id from Razorpay | admin 500: {"error":"Starting the payment failed. Please try again."} | **BLOCKED** | Placeholder keys: Razorpay API rejects them. Needs real rzp_test_ keys. |
| SEC-1 | Invalid webhook signature rejected | 400, order stays PENDING | bad sig 400 {"outcome":"INVALID_SIGNATURE"}; no sig 400; order PENDING | **PASS** |  |
| PAY-2 | Failed payment (signed payment.failed webhook, simulated) | order FAILED with reason; report locked | 200 MARKED_FAILED; order FAILED "Payment declined by bank (staging simulation)"; gaps 402 | **PASS** | Simulated: Razorpay not involved |
| SEC-2 | Captured webhook with wrong amount does not unlock | AMOUNT_OR_ORDER_MISMATCH; locked | AMOUNT_OR_ORDER_MISMATCH; order FAILED | **PASS** |  |
| SEC-3 | Success query parameters do not unlock | report body absent | body=false | **PASS** |  |
| SEC-4 | Forged checkout callback rejected | 400 and locked | 400 {"error":"The payment could not be verified."} | **PASS** |  |
| PAY-1 | Successful payment settles once (signed payment.captured, simulated) | SETTLED_PAID; order PAID | 200 SETTLED_PAID; order PAID pay_STGPAID00001 | **PASS** | Simulated: Razorpay not involved |
| UNL-1 | Verified payment unlocks report and findings for the organisation | gaps 200 + report body for admin and viewer; download = issued customer copy | alphaAdmin: gaps 200 body=true; alphaViewer: gaps 200 body=true; download 200 application/vnd.openxmlformats-officedoc sha matches customer copy=true | **PASS** |  |
| UNL-2 | Other organisation cannot access the paid report | 404s; no report body | 404/404/404; body=false | **PASS** |  |
| UNL-3 | Payment unlocks only its own assessment | other unpaid assessment of same org still 402 | 402 | **PASS** |  |
| MAIL-1 | Customer receives the report email with attachment | 1 email to payer with .docx attached | 1 email(s): "Your DPDP compliance report STG-PAY-001 from Truth Labs International"; attachment TLI_DPDP_Report_FINAL_STG-PAY-001_2026-11-07.docx (24388 B); delivery SENT | **PASS** | Mailpit |
| MAIL-2 | TLI assessor receives identical report copy | 1 email to TLI_ASSESSOR_EMAIL with same attachment, txn id, amount | 1 email(s): "[TLI] Paid report delivered: Alpha Staging Health Pvt Ltd STG-PAY-001"; attachment TLI_DPDP_Report_FINAL_STG-PAY-001_2026-11-07.docx (24388 B); mentions pay id=true amount=true | **PASS** | Mailpit |
| MAIL-3 | Branding in emails | Truth Labs International, no CloudE5 | customer has TLI=true CloudE5=false | **PASS** |  |
| DUP-1 | Duplicate webhook (same event id) ignored | 200 DUPLICATE_EVENT | 200 DUPLICATE_EVENT | **PASS** |  |
| DUP-2 | Second event for the paid order causes no new unlock or email | ALREADY_PAID; 1 PAID order; 2 deliveries; no new emails | ALREADY_PAID; paid orders 1; deliveries 2; new emails 0; REPORT_PAYMENT_VERIFIED x1 | **PASS** |  |
| MAIL-4 | Email provider outage: deliveries fail after automatic retries, payment unaffected | both FAILED after 3 attempts; order PAID; customer has access | ASSESSOR FAILED attempts=3 "SMTP_ERROR"; CLIENT FAILED attempts=3 "SMTP_ERROR"; order PAID; gaps 200 | **PASS** | Mailpit container stopped |
| MAIL-5 | Manual resend after recovery; no new charge | customer resend 403; lead resend SENT (attempt 4); 2 emails arrive; still 1 order | customer 403; lead 200/200; ASSESSOR SENT attempts=4; CLIENT SENT attempts=4; emails 2; orders 1 | **PASS** |  |
| MAIL-6 | Resend on an already-sent email without confirmation is refused (no duplicate) | 409; no new email; attempts unchanged | 409 {"error":"This report email has already been sent. Refresh the page, or confirm ; new emails 0; attempts 4/4 | **PASS** |  |
| MAIL-7 | Deliberate resend of a sent email with confirmation | 200 SENT; exactly 1 new email | 200 {"deliveryId":"50f842e7-0dfc-4cd8-95de-f8d15db8b4bd","outcome":"SENT","permanent":false}; new emails 1 | **PASS** |  |
| REF-1 | Full refund (signed refund.processed, simulated) re-locks report | REFUNDED; customer 402; staff 200 | MARKED_REFUNDED; order REFUNDED; customer gaps 402 download 402; lead 200 | **PASS** | Simulated: Razorpay not involved |
| REC-1 | Reconciliation against Razorpay API | orders checked against Razorpay | 500: {"error":"Reconciling payments failed. Please try again."} | **BLOCKED** | Needs real Test Mode keys; unit tests cover the logic with a stub |
| AUD-1 | Audit trail for payment, unlock, email, download, refund | all actions present | missing: none; A2 has EMAIL_FAILED=true RESEND=true | **PASS** |  |
| BR-1 | Locked report page in browser shows readiness, price and Pay | heading 'ready', ₹10.00, test-mode badge, Pay button, no report body | heading "Your final report is ready"; ₹10.00 x1; badge x1; pay button x1; body=0 | **PASS** | shot-1-locked-panel.png |
| BR-2 | App loads Razorpay Checkout in a real browser under its CSP | checkout.js loads, Razorpay iframe opens, no CSP violations, no page errors | requests https://checkout.razorpay.com/v1/checkout.js, https://api.razorpay.com/v1/checkout/public, https://lumberjack.razorpay.com/v1/track, https://checkout-static-next.razorpay.com/build/57804717575cfbaa28f42f7afcb17d2967384cf2/v2-entry.modern.js; iframe=true; frames 1; CSP violations 0; page errors 0 | **PASS** | shot-2-checkout.png; console: none |
| BR-2b | Razorpay Checkout modal renders the payment form | visible payment form | iframe visible=false; Razorpay /checkout/public answered 401 for the placeholder key | **BLOCKED** | Razorpay renders the form only for a valid Test Mode key |
| BR-3 | Abandoned checkout (modal closed) leaves report locked | 'Payment was not completed' notice; report locked | notice x0; report body x0 | **BLOCKED** | Could not close the Razorpay modal opened with placeholder key; server-side abandoned/retry verified in unit tests |
| BR-4 | TLI Payments dashboard shows payment and email delivery history | price, statuses, txn ids, both deliveries Sent incl. attempt counts, awaiting list, resend controls | price=true testBadge=true refunded=true paid=true txn=true sent=true attempts=true awaiting=true resendButtons=true | **PASS** | shot-4-payments-dashboard.png |
| BR-5 | Payments dashboard status filter | REFUNDED filter shows only the refunded order | rows 1; PAID order shown x0 | **PASS** |  |
| BR-6 | Customer cannot open the TLI Payments dashboard | redirected away | landed on /dashboard/assessments/9c39a2f8-b257-4f38-83a4-62556929203b/questionnaire | **PASS** |  |
| E2E-1..6 | Playwright suite (registration, email verification via Mailpit, onboarding, questionnaire, findings lock, 2FA, phone/tablet layouts) | 6 passed | 6 passed (desktop, mobile, tablet) on the final staging build | **PASS** (6) | `E2E_BASE_URL=http://localhost:3300 npm run test:e2e` |
| BLK-1 | Checkout popups and bank 3-D Secure pages | Bank page opens and completes | Not runnable: needs a real Test Mode order and Razorpay test card | **BLOCKED** | Requires real `rzp_test_` keys |

## Coverage of the requested checks

| # | Requirement | Result |
|---|---|---|
| 1 | Staging environment and database | PASS (ENV-1; isolated project, migrations 0001–0009) |
| 2 | Razorpay Test Mode | PASS for configuration (ENV-1, BR-1 badge); real Test Mode account BLOCKED |
| 3 | Checkout loads in a real browser | PASS for script/iframe under the CSP after fix (BR-2); visible form BLOCKED (BR-2b) |
| 4 | Successful payment with official test methods | BLOCKED (PAY-0b); server settlement verified with a signed simulated webhook (PAY-1) |
| 5 | Failed and abandoned payments | Failed: PASS simulated (PAY-2). Abandoned in browser: BLOCKED (BR-3); order reuse covered by unit tests |
| 6 | Checkout and bank verification popups | BLOCKED (BLK-1) |
| 7 | Duplicate webhooks | PASS (DUP-1, DUP-2) with locally signed events; Razorpay Dashboard "Resend" not exercised |
| 8 | Invalid webhook signatures | PASS (SEC-1) |
| 9 | Reconciliation | BLOCKED (REC-1); logic covered by unit tests with a gateway stub |
| 10 | Locked before payment | PASS (LOCK-alphaAdmin, LOCK-alphaViewer, SEC-3, SEC-4, BR-1) |
| 11 | Payment unlocks the correct report and findings | PASS (UNL-1, UNL-3) |
| 12 | Other organisation blocked | PASS (UNL-2) |
| 13 | Full refund re-locks | PASS (REF-1, simulated refund webhook) |
| 14 | Email to customer and TLI assessor | PASS (MAIL-1..3, Mailpit; real inbox delivery not tested) |
| 15 | Email provider failure and retry | PASS after fix (MAIL-4..7) |
| 16 | Playwright with Docker + Mailpit | PASS 6/6 |
| 17 | Payments dashboard history | PASS (BR-4, BR-5, BR-6) |

## Security verification

Passed: forged and missing webhook signatures (400), wrong-amount capture ignored, forged checkout callback (400),
success query parameters do not unlock, findings/scores/remediation/download locked (402) for every customer role,
cross-organisation access 404, staff-only dashboard and price setting, customers cannot resend, audit trail complete
(AUD-1), 0 CSP violations after the fix, `npm audit --omit=dev`: 0 vulnerabilities.

## Remaining issues and observations

- **Blocked (5)**: real Test Mode order creation, visible checkout form, browser abandon, 3-D Secure/popups,
  reconciliation. Run docs/STAGING_VERIFICATION.md sections 2–6 and 9 with real `rzp_test_` keys and a public
  HTTPS staging URL registered as the webhook before enabling Live Mode.
- If Razorpay Checkout cannot open at all (invalid key, network), the Pay button stays disabled until the page is
  reloaded, because Razorpay never calls `ondismiss`. Minor; not changed.
- With the mail server unreachable, each attempt takes about 35 s (nodemailer default timeouts), so a delivery is
  marked failed about 2 minutes after payment. Acceptable; not changed.
- Order creation with rejected keys returns a generic "Starting the payment failed" (details in the server log).

## Final checks after the fixes

`npx tsc --noEmit`, `npm run lint`: clean. `npm test`: 279/279. `npm run build`: passes. Playwright: 6/6 on staging.
