# Changelog

Notable changes to CloudE5, newest first. Each entry links to the pull request that introduced it.

## Unreleased — Consultations and remediation management

- **Consultations:** customers book TLI assessors from real availability (each assessor's hours in their
  own timezone, buffers, notice, blocked dates); double booking is refused by the database. Calendar
  invitations (RFC 5545 REQUEST/CANCEL, stable UID and SEQUENCE) go to the customer and the assessor;
  rescheduling and cancellation update the same event; 24-hour and 1-hour reminders (configurable).
- **Remediation requests:** after a paid report, customers select gaps and request help; TLI reviews,
  asks questions and sends versioned proposals (frozen once sent); accepted proposals start an
  engagement with one corrective action per gap. Gaps close only on TLI verification. No charges.
- **Dashboards:** customer Consultations and Remediation pages; TLI Appointments (week calendar,
  filters, failed-email retry), Availability and Remediation (verification queue) pages; "Continue Your
  Compliance Journey" section on paid reports.
- Migration **0010**. See [docs/CONSULTATIONS_AND_REMEDIATION.md](docs/CONSULTATIONS_AND_REMEDIATION.md).

## Unreleased — Truth Labs International and paid report delivery

- **Rebrand:** the product is now Truth Labs International (TLI): logo (shield with TLI monogram),
  browser icon, page titles, sign-in and registration screens, dashboards, emails, the Word report
  (template `TLI-REP-V1.1`) and documentation. Technical identifiers keep their names so existing
  installations keep working: `CLOUDE5_*` settings, the `.cloude5/` data directory, the `cloude5`
  container and the two-factor key-derivation labels. Reports issued before this change keep their
  original branding (they are immutable).
- **Paid report delivery (Razorpay):** customers' administrators pay for the issued final report; the
  server verifies every payment (checkout signature plus Razorpay API lookup, signed webhooks,
  reconciliation) before the report unlocks, then emails it to the customer and the TLI assessor mailbox
  with tracked, retryable deliveries. New **Payments** page for TLI staff (filters, failed-email alerts,
  resend, reconciliation, report price). Migration **0009**. See [docs/PAYMENTS.md](docs/PAYMENTS.md).
- **Behaviour change:** customers no longer download draft reports; they get the issued report after
  payment. Detailed findings (gap analysis, scores and deficits, remediation tasks, assessor notes on
  evidence) are also released to customers only after payment; before that they see status, readiness
  and price. TLI staff are unaffected.
- README screenshots retaken with the new branding (synthetic test data).

## 2026-10-28 — Live at cloude5.tech

- **Hosting:** moved from a laptop trial to a VPS behind Caddy (automatic HTTPS) at
  [cloude5.tech](https://cloude5.tech); transactional email through Brevo; nightly backups.
- **Customer experience** ([#9](https://github.com/Charan89k/DPDP-Tool/pull/9)): customers see only
  Questionnaire, Evidence, Results, Team and Settings; customer accounts must use a work email address;
  onboarding records the organisation type (list or "Other"), team size and company contact details
  (migration 0008).
- **Questionnaire table** ([#8](https://github.com/Charan89k/DPDP-Tool/pull/8)): one table per area with a
  tick column per answer, area tabs on top and a details panel for comments and evidence; company logo and
  browser icon.
- **Documentation** ([#10](https://github.com/Charan89k/DPDP-Tool/pull/10)): production deployment, update
  procedure and email setup in the README.

## 2026-10-20 — Audit and self-service

- **Self-assessments** ([#7](https://github.com/Charan89k/DPDP-Tool/pull/7)): customer-started assessments
  open ready for answers and can be submitted for review without a consultant.
- **Full audit fixes** ([#6](https://github.com/Charan89k/DPDP-Tool/pull/6)): transaction safety, report
  scoping, submission workflow, clarification and review scoping, upload limits, accessibility and more
  ([report](reports/2026-10-20-coderabbit-audit.md)).
- **Repository tidy** ([#4](https://github.com/Charan89k/DPDP-Tool/pull/4)) and
  **stopped Vercel deployments** ([#3](https://github.com/Charan89k/DPDP-Tool/pull/3)).
- **Phone and tablet layouts** ([#2](https://github.com/Charan89k/DPDP-Tool/pull/2)).

## 2026-10-18 — CloudE5

- **CloudE5** ([#1](https://github.com/Charan89k/DPDP-Tool/pull/1)): SQLite-only, self-hosted platform with
  self-service sign-up, two-factor sign-in, tenant isolation, evidence vault with virus scanning, scoring,
  gap analysis, reports and remediation tracking, packaged with Docker.
