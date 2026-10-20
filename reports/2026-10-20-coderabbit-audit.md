# CloudE5 audit — 20 October 2026

Full-repository audit with CodeRabbit CLI 0.9.0 as an independent reviewer, plus a manual review and static checks.
Audited code: branch `fix/security-findings` with the earlier CodeRabbit deep-scan fixes (commit `e00f8e4`, later rebased
by the owner to `4e30944` on `main`). All changes below are **uncommitted**: the audit itself committed, pushed and
deployed nothing.

## Method

- CodeRabbit reviews diffs, so the whole codebase was reviewed in throwaway scratch clones with an empty base commit,
  split into five areas: `lib/`, `app/`, `components/` + `proxy.ts`, `tests/` + `e2e/`, and the rest (scripts,
  migrations, deploy, configuration, operating docs). `coderabbit review --agent` throughout; no paid credits used.
- After the fixes, `coderabbit review --agent --uncommitted` was re-run on this repository until it reported no findings
  (rounds 2–5 below).
- Manual review: every API route for authentication, role checks and validation; file handling; Docker and proxy
  configuration; accessibility of form controls.
- Static checks: `npm audit`, secret patterns over tracked files and full Git history, client bundle scan, ESLint,
  TypeScript, production build. Gitleaks, Semgrep, Trivy and OSV-Scanner are not installed, so they were not run.

## Results by severity

Severity: High = wrong official output or a wedged service; Medium = authorization, data-loss or significant
functional defect; Low = hardening, validation, accessibility, misleading text.

| Source | Findings | Fixed | Not changed |
|---|---|---|---|
| CodeRabbit initial review (5 areas) | 36 (lib 6, app 18, components 9, rest 3, tests 0) | 34 | 2 (1 accepted, 1 false positive) |
| Manual review and static checks | 9 (2 also found by CodeRabbit) | 7 | 2 documented risks |
| CodeRabbit re-reviews of the fixes | 2, 2, 1, 0 | 5 | — |

### High (all fixed)

| # | Area | Defect | Fix | Regression test |
|---|---|---|---|---|
| H1 | `lib/db/sqlite/client.ts` | A failed `COMMIT` (e.g. `SQLITE_BUSY`) lowered the transaction depth first, so the caller's `ROLLBACK` and the cleanup skipped it and the shared connection stayed inside a transaction until restart | Depth changes only after the statement succeeds; cleanup rolls back whenever `db.inTransaction` | `security_findings`: COMMIT failure via a deferred foreign key |
| H2 | `lib/reports/generator.ts` | Reports listed every remediation task of the customer (`OR tenant_id`), so another assessment's tasks entered the archived official report | Tasks of this assessment or its controls only | `security_findings`: report excludes another engagement's task |
| H3 | `components/questionnaire/QuestionnaireClient.tsx` | "Submit for Validation" only saved answers, then showed "Submitted ✓"; the assessment never moved to review | Saves, then posts the `SUBMITTED_FOR_REVIEW` transition and shows the lifecycle guard's reasons on refusal | Browser suite (questionnaire flow) |

### Medium (all fixed)

| # | Area | Defect | Fix |
|---|---|---|---|
| M1 | clarifications API | Reply / status change accepted any thread the user could see, not only threads of the assessment in the URL; evidence links were not checked either | Thread and evidence must belong to the URL's assessment (404 otherwise) |
| M2 | reviews API | A partial save reset omitted fields (findings, notes, flag) to empty | `COALESCE` keeps stored values; history records the stored row |
| M3 | remediation API | A consultant could set `VALIDATED_CLOSED` through the progress path, skipping the mandatory validation notes; tasks were not checked against the URL's assessment | Progress path limited to progress statuses; task must belong to the assessment (unit tests) |
| M4 | `lib/gaps/service.ts` | Re-audit trend compared unlike metrics (coverage vs readiness, all "not implemented" vs critical-domain gaps, hard-coded 100% completeness) | Baseline is the parent assessment evaluated by the same gap engine (unit test) |
| M5 | evidence upload form | Initial question `GOV-01` was not an option; evidence was stored under non-canonical codes the assessor screen did not match | Form uses canonical codes; server stores canonical codes; review screen matches canonically |
| M6 | assessor review screen | Every refresh overwrote unsaved review drafts (including the status set when raising a clarification) | Refreshes merge drafts; only the first load replaces them |
| M7 | assessment summary | Read `state.status` instead of `lifecycle.currentStatus`, so the status never refreshed | Correct field |
| M8 | evidence upload API | Request body buffered without a size check (authenticated memory exhaustion) | Declared bodies over 51 MB refused with 413 before parsing; text fields bounded (browser test) |
| M9 | accessibility | 50 form controls had no accessible name; the upload drop zone and two clickable table rows were mouse-only | `aria-label`s from the visible labels; keyboard activation and focus styles |

### Low (fixed)

- Evidence coverage counted `GENERIC`/control codes and quarantined files (unit test).
- Word report: `\n` inside text runs did not break lines (unit test checks `<w:br/>`).
- Responses and reviews stored raw variant codes; duplicates resolving to one question accepted (browser test). Answers
  stored by earlier versions under variant codes are returned canonically so autosave keeps working.
- `/api/auth/me` and `GET /api/assessments` returned 500 instead of 403/401 for MFA-required or revoked sessions.
- Clarification payload errors returned 500; status now an enum.
- Re-audit request body unvalidated: now a schema, real calendar dates, malformed JSON and `null` rejected (browser test).
  Remediation dates also require real calendar dates (unit test).
- Invitation acceptance: unbounded token and name; password not checked against the invited email. Login fields bounded
  (browser test).
- Activation page accepted 8-character passwords the server rejects (policy is 12 with a letter and a number).
- New-customer form copied only the first typed character of the DPO email into the admin email.
- Invite dialog stayed open with no feedback when the server sends the link only by email (production).
- Evidence "Status" and "Description" looked editable but changes were discarded; now read-only.
- Remediation update dialog could submit a status its select did not show.
- Lifecycle controls disappeared silently on a load error; now an alert with Retry.
- Deleting evidence removed it from the list even when the delete failed.
- Assessor clarification panel showed stale threads after sending.
- Misleading or invented text: customer DPO placeholders, "Anita Sharma" and "IT / ITES" fallbacks, "Q4 2026 Audit",
  "0 Deficits" when unknown, every user shown "Active", SMTP banner, "PostgreSQL triggers", status badges showing
  "Draft" for issued assessments; customer search box did nothing (now filters by name, industry and contact).
- `db status` / `verify` treated migrations from a newer release as healthy.
- Production checklist release step omitted `migrate`.
- A test's cleanup used PostgreSQL-only `ALTER TABLE … DISABLE TRIGGER` and logged an error on every run.

### Not changed

| Finding | Decision |
|---|---|
| Invitation API returns the activation link outside production (CodeRabbit, `lib/onboarding`) | Accepted: production never returns it; the inviting administrator can already create users directly. Development-only convenience kept. |
| `outputFileTracingIncludes`/`Excludes` use the key `"*"` (CodeRabbit, `next.config.mjs`) | False positive: Next matches keys with `contains: true`, so `"*"` matches every route. The build confirms migrations are included and no local databases are traced. |
| 9 dev-only `npm audit` advisories (2 moderate, 7 high) from Tailwind CSS 3 tooling and `eslint-config-next` | Build-time only; the runtime image prunes dev dependencies and `npm audit --omit=dev` is clean. Fixing needs a Tailwind 4 migration — a separate decision. |
| `cloudflare/cloudflared:latest`, `axllent/mailpit:latest` image tags | Unpinned optional images (testing profiles). Pin digests before production use. |

## Open questions for the owner

- Self-service assessments start in `DRAFT`, and only `DATA_GATHERING` can be submitted; moving out of `DRAFT` needs a
  lead consultant. Customers without a consultant cannot submit (they now see the lifecycle's reason instead of a false
  success). Decide whether self-assessments should start in `DATA_GATHERING`.
- Evidence uploads without a declared body length (chunked through some proxies) are still parsed before the 50 MB
  check; Caddy limits bodies to 55 MB in the production profile.
- Route-level fixes (clarification scoping, review partial updates, legacy response codes) are covered by code review
  and the browser suite rather than dedicated route tests, because route modules use the `@/` alias the Node test runner
  cannot resolve.

## Verification (actual results)

| Check | Result |
|---|---|
| `npm test` | 240/240 pass (232 before the audit; new tests in `tests/security_findings.test.ts`). The 5 new `lib` regression tests were confirmed to fail with the fixes reverted. |
| `npm run test:e2e` (scratch server, Mailpit, desktop + mobile + tablet) | 6/6 pass (final run serial, fresh database). An earlier parallel run timed out twice on a cold dev-server compile; the re-run passed. |
| `npm run lint` | 0 errors, 0 warnings |
| `npx tsc --noEmit` | clean |
| `next build` | success |
| `npm audit --omit=dev` | 0 vulnerabilities |
| Secret patterns (tracked files and all history) | no real secrets; 2 matches in archived docs and 12 in history, all placeholder database URLs |
| Client bundle (33 chunks) | no server secret names or credential fields |
| CodeRabbit re-reviews of the fixes | round 2: 2 findings (fixed) · round 3: 2 distinct (fixed) · round 4: 1 (fixed) · round 5: **0 findings** (42 files) |
| Not run | Gitleaks, Semgrep, Trivy, OSV-Scanner (not installed); ClamAV-specific browser test (no ClamAV in the scratch server) |

## Files changed

41 modified files and 2 new files (`lib/http/dates.ts`, this report):
API routes under `app/api/` (assessments, clarifications, re-audit, remediations, responses, reviews, auth/login,
auth/me, invitations/accept, evidence/upload), dashboard pages under `app/dashboard/` and `app/activate/`, components
(evidence, gaps, lifecycle, questionnaire, remediation, review), `lib/` (db client, gaps, remediation, reports, scoring,
storage), `scripts/cloude5-db.ts`, `docs/PRODUCTION_CHECKLIST.md`, `e2e/cloude5.spec.ts` and tests.

## Final state

- During the audit (08:12 IST) the owner merged PR #4, rebased this branch onto it and pushed the earlier fix commit to
  GitHub `main` (`4e30944`). The branch now equals `origin/main`; the audit changes above sit on top, uncommitted.
- CodeRabbit's GitHub app opened PR #5 ("prevent viewers from modifying clarification threads and messages"). The same
  fix is already on `main` in `4e30944` (API check, policy check and tests), so PR #5 can be closed after comparing.
- No commit, push or deployment was made by this audit. The live laptop container still runs the version deployed
  before both reviews.
