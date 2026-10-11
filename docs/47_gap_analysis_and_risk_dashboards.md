# Truth Labs International (TLI) DPDP Compliance Gap Analysis Tool
## Phase 4 Implementation Report: Gap Analysis Engine, Risk Prioritization & Dashboards

**Document Reference:** `docs/47_gap_analysis_and_risk_dashboards.md`  
**Classification:** Internal Technical Architecture & Compliance Governance Report  
**Lifecycle Stage:** Phase 4 Implementation Complete  
**Date:** 2026-10-11  
**Target Repository:** `/home/charan/Documents/DPDP Tool`  
**Related Code Modules:**  
- `lib/gaps/types.ts`
- `lib/gaps/engine.ts`
- `lib/gaps/service.ts`
- `lib/gaps/index.ts`
- `app/api/assessments/[id]/gaps/route.ts`
- `components/gaps/GapAnalysisDashboardClient.tsx`
- `app/dashboard/assessments/[id]/gaps/page.tsx`
- `components/questionnaire/AssessmentSummaryView.tsx`
- `app/dashboard/assessments/page.tsx`
- `app/dashboard/reports/[id]/page.tsx`
- `tests/phase4_gap_analysis.test.ts`

---

### Executive Summary

In accordance with Phase 4 requirements, this milestone implements the authoritative **Compliance Gap Analysis Engine, Explainable Risk Prioritization Framework, and Reactive Analytical Dashboards** for the Truth Labs International (TLI) Digital Personal Data Protection (DPDP) Compliance Platform.

The implementation strictly maintains the foundational architectural distinction between:
1. The **30-Control Statutory Library** (`data/dpdp_controls.json`), which represents codified legal obligations and organizational controls across 13 statutory domains.
2. The **60-Question Respondent Questionnaire** (`data/questionnaire_v1.json`), which represents the operational data gathering instrument organized into 8 assessment sections.

Every questionnaire finding is linked to canonical controls exclusively via explicit, approved question-to-control mappings (`canonical_control_id`). The **four unresolved question records** (`GOV-005`, `GOV-006`, `GOV-008`, and `APP-006`) identified in `docs/09_unresolved_decisions_and_tl_assumptions.md` as pending the canonical Excel cross-reference sheet are strictly isolated: they are never mapped to statutory controls, never assigned statutory domains, and never counted in legal penalty calculations.

Crucially, in compliance with advisory governance and legal review standards (`docs/19_legal_review_and_interpretation_register.md`), the engine **never asserts a legal violation or organizational liability** solely on the basis of a self-attested questionnaire response or an unreviewed gap. Observed deficits are formally classified as *factual compliance gaps* or *potential statutory exposures*, while statutory penalty ceilings under Section 33(1) of the DPDP Act (up to ₹250 Crores) are explicitly labeled as statutory maximums rather than assessed fines.

---

### 1. Architectural & Domain Separation

#### 1.1 The 30 Controls vs. 60 Questions Separation Principle

```
┌────────────────────────────────────────────────────────────────────────┐
│                      MAPPING & DOMAIN SEPARATION                       │
├──────────────────────────────────┬─────────────────────────────────────┤
│ 60-Question Questionnaire        │ 30-Control Statutory Library        │
│ (`data/questionnaire_v1.json`)   │ (`data/dpdp_controls.json`)         │
├──────────────────────────────────┼─────────────────────────────────────┤
│ • 8 Assessment Sections          │ • 13 Statutory Domains              │
│ • Client Operational Questions   │ • Legal Baselines & Provisions      │
│ • 5 Canonical MCQ Options        │ • Implementation Expectations       │
│ • Mandatory N/A Justifications   │ • Schedule Penalties (Tiers 1 to 4) │
│ • Target Evidence Artefacts      │ • Acceptable Evidence Standards     │
└──────────────────────────────────┴─────────────────────────────────────┘
                 │                                    │
                 └───► Explicit Mapping Table ◄───────┘
                       (`canonical_control_id`)
```

- **56 Mapped Questions:** Formally mapped to a unique canonical control in `TLI-DPDP-*` series.
- **4 Unresolved Questions (`GOV-005`, `GOV-006`, `GOV-008`, `APP-006`):**
  - Explicitly tagged `UNRESOLVED_PENDING_EXCEL_SHEET` under decision `DEC-08`.
  - `canonical_control_id: null`.
  - Excluded from statutory domain rollups, control deficit registers, and penalty exposure tiers.
  - Classified in gap analysis under the dedicated gap type `UNRESOLVED_MAPPING` with Informational severity pending stakeholder resolution.

#### 1.2 Legal Neutrality & Explainability Guardrails

In adherence to legal review item `LEG-INT-02` and the statutory framework of the DPDP Act, 2023:
1. **Factual Neutrality:** Gap explanations state observed operational facts (e.g., *"Respondent selected 'Not implemented' for encryption safeguards"*) rather than legal adjudications (*"The client is guilty of violating Section 8(4)"*).
2. **Information Uncertainty vs. Violation:** Responses of *"Unknown / not verified"* are categorized as `UNCERTAINTY_UNVERIFIED` (information deficits requiring discovery), not statutory non-compliance.
3. **Statutory Ceilings vs. Fines:** The Section 33(1) schedule amounts (Tier 1: ₹250 Cr, Tier 2: ₹200 Cr, Tier 3: ₹150 Cr, Tier 4: ₹50 Cr) are presented with mandatory statutory disclaimers stating that penalties are statutory maximum ceilings prescribed under the Act, subject to Data Protection Board of India (DPBI) discretion under Section 33(2) factors.

---

### 2. Deterministic Gap Analysis Engine (`lib/gaps/`)

The gap engine is implemented as a pure, deterministic domain calculation service (`lib/gaps/engine.ts`) with no network or database side-effects, paired with a database-backed execution service (`lib/gaps/service.ts`) operating strictly under PostgreSQL Row-Level Security (RLS).

#### 2.1 Gap Classification Taxonomy

Each of the 60 canonical questions is evaluated against the following mutually exclusive gap taxonomy:

| Gap Type | Trigger Condition | Default Severity | Statutory Treatment |
|---|---|---|---|
| `NEGATIVE_RESPONSE` | Selected option is `"Not implemented"` or `"Partially implemented"` | `CRITICAL_GAP` (if Tier 1 or mandatory) / `HIGH_GAP` / `MEDIUM_GAP` | Potential Statutory Exposure; links to provision and penalty tier. |
| `UNCERTAINTY_UNVERIFIED` | Selected option is `"Unknown / not verified"` | `MEDIUM_GAP` | Information Deficit; flagged for fact-finding; no penalty attributed. |
| `UNAPPROVED_NA_EXCLUSION` | Selected option is `"Not applicable"`, but assessor has not approved exclusion | `HIGH_GAP` | Scoping Deficiency; exclusion pending consultant validation. |
| `EVIDENCE_DEFICIENCY` | Selected option is `"Implemented"`, but linked evidence is missing or rejected by assessor | `HIGH_GAP` (missing) / `CRITICAL_GAP` (rejected) | Evidentiary Deficit; self-attestation unsubstantiated by verified artefacts. |
| `UNRESOLVED_MAPPING` | Question is one of the 4 unresolved codes (`GOV-005`, `GOV-006`, etc.) | `INFORMATIONAL` | Governance Backlog; unmapped pending canonical Excel cross-reference sheet. |

#### 2.2 Strict Separation of Four Core Metrics

In alignment with Phase 3D.4 and stakeholder governance, the platform never conflates completeness, evidence sufficiency, readiness scores, and gap deficits into a single misleading percentage:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                               FOUR INDEPENDENT METRICS LEDGER                           │
├────────────────────────────┬─────────────┬──────────────────────────────────────────────┤
│ Metric Name                │ Value Space │ Operational Meaning & Definition             │
├────────────────────────────┼─────────────┼──────────────────────────────────────────────┤
│ Assessment Completeness    │ 0% to 100%  │ Progress of answering all 60 questions with  │
│                            │             │ required N/A justifications.                 │
│ Evidence Coverage Ratio    │ 0% to 100%  │ Ratio of questions with uploaded, validated, │
│                            │             │ and assessor-verified documentation.         │
│ Indicative Readiness       │ 0% to 100%  │ Weighted statutory maturity score across     │
│                            │             │ the 13 statutory DPDP domains.               │
│ Non-Compensatory Deficits  │ Count       │ Concrete count of Critical/High statutory    │
│                            │ (Tiers 1-4) │ gaps that cannot be offset by high scores.   │
└────────────────────────────┴─────────────┴──────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Non-Compensatory Governance Principle:** A high Indicative Readiness score (e.g., 90%) **never** masks or dilutes a Critical Tier 1 security gap (e.g., failure to implement reasonable security safeguards under Section 8(4)). The Gap Analysis Dashboard presents Critical Gaps and Statutory Exposure alongside readiness scores to prevent dangerous false senses of compliance.

#### 2.3 Deterministic Hash Fingerprinting

To guarantee reproducibility and auditability, every execution of `evaluateAssessmentGaps` computes a SHA-256 fingerprint:
```ts
const hashPayload = JSON.stringify({
  assessmentId: input.assessmentId,
  scoringHash: scoringOutput.calculationHash,
  gaps: gaps.map(g => ({ code: g.questionCode, type: g.gapType, sev: g.gapSeverity, opt: g.selectedOption })),
  summary: { totalGaps: gaps.length, critical: criticalCount, high: highCount }
});
const calculationHash = createHash("sha256").update(hashPayload).digest("hex");
```
Identical inputs produce byte-for-byte identical gap outputs and identical cryptographic fingerprints.

---

### 3. Re-Audit Cycle Trend Analysis

When an engagement is cloned from a prior assessment (`parent_assessment_id IS NOT NULL`), the gap engine automatically extracts the baseline parent assessment's scoring snapshots and evaluates comparative deltas:

- **Readiness Delta:** $\Delta \text{Readiness} = \text{Readiness}_{\text{current}} - \text{Readiness}_{\text{baseline}}$
- **Maturity Score Delta:** $\Delta \text{Maturity} = \text{Maturity}_{\text{current}} - \text{Maturity}_{\text{baseline}}$
- **Completeness Delta:** $\Delta \text{Completeness} = \text{Completeness}_{\text{current}} - \text{Completeness}_{\text{baseline}}$
- **Critical Gaps Delta:** $\Delta \text{Critical} = \text{Critical}_{\text{current}} - \text{Critical}_{\text{baseline}}$
- **Total Gaps Delta:** $\Delta \text{Total} = \text{Total}_{\text{current}} - \text{Total}_{\text{baseline}}$

The dashboard displays historical comparison cards highlighting whether compliance posture has improved, degraded, or remained stable.

---

### 4. Role Segregation & Information Boundary Protection

Under Truth Labs International consulting integrity policies, internal assessor notes and evidence deficiency comments must **never leak** to client portal users:

```
┌────────────────────────────────────────────────────────────────────────┐
│                     ROLE-BASED INFORMATION FILTER                      │
├────────────────────────────────────────────────────────────────────────┤
│ TLI Consultants / Assessors:                                           │
│   • Full provenance view                                               │
│   • Internal assessor review findings (`reviewFindings`)               │
│   • Assessor deficiency notes (`evidenceDeficiencyNotes`)              │
│   • Clarification thread management                                    │
│                                                                        │
│ Client Users (Client Admin / Contributor / Viewer):                    │
│   • Factual gap observations and explanations                          │
│   • Suggested statutory remediations                                   │
│   • Statutory provisions and penalty tier ceilings                     │
│   • Sanitized view: `reviewFindings` and `evidenceDeficiencyNotes`    │
│     are strictly redacted / undefined at the API response boundary.   │
└────────────────────────────────────────────────────────────────────────┘
```

This boundary is enforced at `app/api/assessments/[id]/gaps/route.ts` via role inspection:
```ts
const isClientRole = session.user.role.startsWith("CLIENT_");
const responseData = isClientRole ? sanitizeGapsForClient(gapAnalysis) : gapAnalysis;
```

---

### 5. Reactive Dashboard UI Architecture

The user interface is implemented via `components/gaps/GapAnalysisDashboardClient.tsx` and mounted on the server route `app/dashboard/assessments/[id]/gaps/page.tsx`.

#### 5.1 Dashboard Layout & Functional Components

1. **Executive KPI Strip:**
   - 5 KPI summary cards displaying Total Gaps, Critical Gaps, High Gaps, Medium/Low/Info Gaps, and Top Statutory Penalty Exposure.
2. **Four-Metric Separation Ledger:**
   - Independent visual indicators for Assessment Completeness, Evidence Coverage, Indicative Readiness, and Open Clarifications.
3. **Statutory Penalty Exposure Summary Card:**
   - Highlights Schedule Tier 1 (₹250 Cr) and Tier 2 (₹200 Cr) exposure with an amber warning disclaimer citing Section 33(1) and Section 33(2) factors.
4. **Historical Cycle Comparison Strip:**
   - Renders if `parent_assessment_id` exists, showing baseline metrics, current metrics, and net deltas.
5. **13 Statutory Domains Gap Matrix:**
   - Tabular breakdown of mapped questions, answered questions, identified gaps, critical gaps, evidence coverage %, and domain readiness score.
6. **Searchable & Filterable Gaps Ledger:**
   - Full search over question codes, questions, and statutory provisions.
   - Filter chips for Severity (`ALL`, `CRITICAL_GAP`, `HIGH_GAP`, `MEDIUM_GAP`, `LOW_GAP`, `INFORMATIONAL`) and Gap Type (`ALL`, `NEGATIVE_RESPONSE`, `EVIDENCE_DEFICIENCY`, `UNCERTAINTY_UNVERIFIED`, `UNAPPROVED_NA_EXCLUSION`, `UNRESOLVED_MAPPING`).
   - Expandable row details revealing full factual observations, statutory obligations, recommended remediation actions, evidence audit status, and assessor findings (for consultants).

---

### 6. Verification & Automated Test Evidence

The Phase 4 implementation has been validated across four levels of rigorous automated testing:

#### 6.1 Phase 4 Gap Analysis Suite (`tests/phase4_gap_analysis.test.ts`)
```
▶ Phase 4: Gap Analysis Engine & Risk Prioritization Verification
  ✔ 1. should evaluate all 60 canonical questions and separate completeness, evidence, readiness, and gaps (9.6ms)
  ✔ 2. should correctly classify 'Not implemented' as critical/high gap with statutory provision (2.5ms)
  ✔ 3. should treat 'Unknown / not verified' as information uncertainty without declaring violation (2.7ms)
  ✔ 4. should enforce strict distinction between approved and unapproved N/A exclusions (3.3ms)
  ✔ 5. should detect evidence deficiencies for self-attested 'Implemented' questions (2.2ms)
  ✔ 6. should isolate the 4 unresolved question mappings from canonical controls (1.7ms)
  ✔ 7. should produce identical gap analysis output and hash for identical inputs (4.6ms)
  ✔ 8. should evaluate historical trend comparison when prior assessment scores exist (1.4ms)
  ✔ 9. should fetch assessment gap analysis under live PostgreSQL RLS and enforce tenant isolation (93.2ms)
✔ Phase 4: Gap Analysis Engine & Risk Prioritization Verification (125.9ms)
ℹ tests 9 | suites 1 | pass 9 | fail 0
```

#### 6.2 Full Regression Suite (`npm test`)
- **Total Test Suites:** 15 suites
- **Total Tests:** 120 tests
- **Pass Rate:** 100% (120/120 pass, 0 fail, 0 skipped)

#### 6.3 Live PostgreSQL Row-Level Security (`scripts/test_database_rls.py`)
- **Static Schema & Policy Checks:** 9/9 passed.
- **Live Kernel RLS Boundary Checks:** 17/17 passed.
- **Fail-Closed Context & Cross-Tenant Isolation:** 100% verified.

#### 6.4 Migration Integrity (`scripts/migrate.py verify`)
- All 11 applied database migrations match their disk checksums exactly.

#### 6.5 Production Build Gate (`npm run build`)
- Next.js 15 App Router production compilation completed in 9.3s with zero type errors and zero bundle warnings.
- New dynamic routes `/dashboard/assessments/[id]/gaps` and `/api/assessments/[id]/gaps` successfully built and optimized.

---

### 7. Governance, Limitations & Stakeholder Approval Dependencies

1. **Methodology Status:** The scoring engine and risk prioritization weights remain flagged as `PROVISIONAL_PENDING_APPROVAL` (`SCORING-V1-PROVISIONAL`) under decision `DEC-08`. They must not be represented as formally approved TLI advisory standards until explicit executive sign-off.
2. **Unresolved Question Mappings:** Questions `GOV-005`, `GOV-006`, `GOV-008`, and `APP-006` remain unmapped (`canonical_control_id: null`) pending receipt of the canonical Excel cross-reference sheet.
3. **Statutory Exposure Disclaimers:** All customer-facing screens include prominent statutory notices stating that penalty numbers reflect legislative ceilings under Section 33(1), not assessed fines, judicial orders, or predictions of DPBI enforcement.

---

### Conclusion & Commit Readiness

Phase 4 is complete, verified, and ready for pre-commit review.
Suggested commit message:
```
feat(analysis): implement explainable compliance gap dashboards
```

