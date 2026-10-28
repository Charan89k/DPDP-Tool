# CloudE5 audit — 28 October 2026

Second full-repository audit with CodeRabbit CLI 0.9.0, after the questionnaire table, customer menu, work-email,
organisation profile, CI and licence changes (PRs #8–#12). Audited code: `main` at `4b84ecb`. Fixes are on branch
`fix/coderabbit-audit-2`; nothing was deployed by the audit.

## Method

- Whole codebase reviewed in throwaway scratch clones with an empty base commit, split into five areas: `lib/`, `app/`,
  `components/` + `proxy.ts`, `tests/` + `e2e/`, and the rest. `coderabbit review --agent`; no paid credits used.
- After the fixes, `coderabbit review --agent --uncommitted --fresh` was re-run on this repository until it reported no
  findings.
- Static checks: `npm audit`, secret patterns over tracked files and full Git history, ESLint, TypeScript, production
  build, unit tests, Playwright browser suite.

## Results

| Source | Findings | Fixed | Not changed |
|---|---|---|---|
| CodeRabbit initial review (lib 3, app 3, components 9, tests 0, rest 0) | 15 | 14 | 1 false positive |
| CodeRabbit re-reviews of the fixes (rounds 2–7) | 4, 2, 1, 3, 1, 0 | 11 | — |

Severity: Medium = authorization, wrong official output or data loss; Low = functional defect, accessibility, misleading UI.

### Medium (all fixed)

| # | Area | Defect | Fix | Regression test |
|---|---|---|---|---|
| M1 | `lib/remediation/service.ts` | Customer roles could set `REJECTED_REOPENED`, an assessor decision | Customers are refused both `VALIDATED_CLOSED` and `REJECTED_REOPENED` | `security_findings`: customer cannot reject a closure |
| M2 | `lib/remediation/service.ts` | Assigned TLI consultants could not create remediation tasks, and closure validations were logged under the platform tenant | Audit rows use the assessment's tenant, entity `assessments`, task id in `new_state` | `security_findings`: assigned consultant creates and validates a task |
| M3 | `app/dashboard/reports/[id]/page.tsx`, `lib/reports/generator.ts` | Post-issuance statuses rendered as drafts; the first fix then treated every `ARCHIVED` assessment (including never-issued ones) as official | Official only when the status is issued/remediation/archived **and** `issued_at` is set | `security_findings`: archived without `issued_at` stays draft |
| M4 | `components/evidence/EvidenceManagementClient.tsx` | The evidence panel showed a hard-coded fake "Data Protection Policy" preview for every file | Removed; panel shows type, upload date, uploader and a download link | Browser suite |
| M5 | `components/questionnaire/QuestionnaireClient.tsx` | Submit cancelled the pending autosave; if the save failed (error or network), recent answers were never retried | Autosave re-armed whenever the pre-submit save did not succeed | Browser suite (questionnaire flow) |

### Low (all fixed)

| # | Area | Defect | Fix |
|---|---|---|---|
| L1 | `lib/lifecycle/service.ts` | Post-transition summary ignored `assessment_assignments` | Shared `isAssignedToAssessment` helper |
| L2 | `CreateAssessmentForm.tsx` | Customer self-assessments showed `DRAFT` as the initial status | Shows `DATA_GATHERING` for `CLIENT_ADMIN` |
| L3 | `components/layout/topbar.tsx` | Logout redirected even when the request failed | Checks `res.ok`, shows an alert |
| L4 | `components/layout/sidebar.tsx` | Closed mobile drawer stayed in the tab order | `invisible` when closed below `lg` |
| L5 | `AssessorReviewClient.tsx` | One reply draft shared by all threads; full-page spinner on every refresh | Draft per thread; spinner only on first load |
| L6 | `EvidenceManagementClient.tsx` | "Drag and drop" text with no drop handlers | `onDragOver` / `onDrop` added |
| L7 | `AssessmentSummaryView.tsx` | Evidence column ignored control-level evidence | Uses `belongsTo` like the questionnaire table |
| L8 | `QuestionCard.tsx` | Failed clarification replies were silent; a failed refresh looked like a failed send | Separate error messages |
| L9 | `QuestionnaireClient.tsx`, `ReviewStep.tsx` | Answers stayed editable after submit or after reloading a submitted assessment; "Submitted" badge lost on returning to review | Locked unless the status is open (mirrors `OPEN_STATUSES` in the write policy) |
| L10 | `QuestionnaireClient.tsx`, `ReviewStep.tsx`, questionnaire page | Cancelled or archived assessments showed "Submitted for Validation ✓" with no submission | Badge only when `submitted_at` is set; otherwise "Closed for changes" |
| L11 | `AssessorReviewClient.tsx` | A failed refresh or save left stale data on screen with no notice, including inside the clarification dialog | Inline alert on the page and in the dialog |
| L12 | `QuestionCard.tsx` | A network error after a reply said "not sent", inviting a duplicate post | Says delivery is unconfirmed and asks to reload first |

### Not changed

- `app/page.tsx` landing text: CodeRabbit asked to change "local SQLite database" to PostgreSQL. False positive: the app runs on SQLite (`better-sqlite3`), so the text is correct.

## Static checks

- Secrets: none in tracked files or Git history (only placeholder database URLs in archived docs); only `.env.example` is tracked.
- `npm audit --omit=dev`: 0 vulnerabilities. Development-only: 1 moderate (`postcss-selector-parser`), not shipped.
- ESLint, TypeScript: clean. Unit tests: 247/247. Production build: passes. Playwright: 6/6 (re-run on the final code). CodeRabbit round 7: 0 findings.

## Not run

- Gitleaks, Semgrep, Trivy, OSV-Scanner (not installed).
- ClamAV-specific browser tests (local run had antivirus disabled).
