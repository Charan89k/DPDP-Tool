# Changelog

Notable changes to CloudE5, newest first. Each entry links to the pull request that introduced it.

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
