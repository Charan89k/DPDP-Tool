# Truth Labs International (TLI) DPDP Compliance Gap Analysis Tool
## Phase 3D.4 Implementation Report: Deterministic Scoring Engine

**Document Reference:** `docs/archive/44_deterministic_scoring_engine.md`  
**Classification:** Internal Technical Architecture & Compliance Governance Report  
**Lifecycle Stage:** Phase 3D.4 Implementation Complete  
**Date:** 2026-10-11  
**Target Repository:** `/home/charan/Documents/DPDP Tool`  
**Related Code Modules:**  
- `lib/scoring/types.ts`
- `lib/scoring/config.ts`
- `lib/scoring/engine.ts`
- `lib/scoring/service.ts`
- `lib/scoring/index.ts`
- `app/api/assessments/[id]/scoring/route.ts`
- `tests/deterministic_scoring_engine.test.ts`

---

### Executive Summary

In accordance with Phase 3D.4 requirements for the Truth Labs International (TLI) Digital Personal Data Protection (DPDP) Compliance Gap Analysis Platform, this milestone delivers a pure, deterministic, and cryptographically verifiable **Scoring Engine** for the 60-question canonical assessment.

The engine strictly implements the **non-compensatory dual-metric governance model** established in decisions `DEC-01`, `DEC-08`, `DEC-09`, and `DEC-10`:
1. Technical calculations are decoupled from official compliance determinations. Numeric scores are labeled as **provisional engineering diagnostic measures** (`methodologyStatus: 'PROVISIONAL_PENDING_APPROVAL'`, `isOfficialScore: false`) pending formal methodology ratification by TLI Executive Leadership.
2. Four measures are reported as strictly independent metrics: **Assessment Completeness**, **Response Coverage**, **Evidence Coverage**, and **Indicative Readiness Score**.
3. Exception states (`Unknown / not verified`, unapproved exclusions, and unmapped questions) are handled with explicit governance rules rather than silent mathematical assumptions.
4. An overall percentage readiness score never obscures individual statutory deficits or Section 33 penalty exposures.

---

### Governance Rules & Methodological Boundaries

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        TLI DPDP METHODOLOGY GOVERNANCE BOUNDARY                        │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  STATUS: PROVISIONAL_PENDING_APPROVAL (DEC-08, DEC-09)                                 │
│  OFFICIAL SCORE STATUS: FALSE                                                          │
│  MODEL IDENTIFIER: SCORING-V1-PROVISIONAL (v1.0.0-provisional)                         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  PROPOSED OPTION VALUES (Engineering Baseline):                                        │
│  • Implemented              = 100 points                                               │
│  • Partially implemented    = 50 points (Generates Partial Deficit)                    │
│  • Not implemented          = 0 points  (Generates Critical Gap)                       │
│  • Unknown / not verified   = UNSCORED pending review (never converted to 0 or 100)    │
│  • Not applicable           = EXCLUDED strictly if: Written Justification != ""       │
│                               AND Assessor Status == EXCLUSION_VERIFIED                │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  UNRESOLVED CONTROL MAPPINGS:                                                          │
│  • GOV-005, GOV-006, GOV-008, APP-006 (Isolated from statutory domain aggregations)    │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

#### 1. Provisional Status & Mandatory Legal Disclaimer
In adherence to the decision register (`docs/reference/09_unresolved_decisions_and_tl_assumptions.md` and `docs/18_canonical_compliance_scoring_methodology.md`), the scoring values are an unratified engineering baseline. Every calculation output includes:
- `methodologyStatus: "PROVISIONAL_PENDING_APPROVAL"`
- `isOfficialScore: false`
- The mandatory statutory legal disclaimer:
  > *"IMPORTANT LEGAL NOTICE AND DISCLAIMER: This evaluation represents an independent professional advisory gap analysis conducted by Truth Labs International (TLI) based strictly upon questionnaire representations and supporting evidence provided. This document does NOT constitute a legal certification of statutory compliance, an immunity certificate, nor an endorsement by the Data Protection Board of India (DPBI) or the Central Government. Under the Digital Personal Data Protection Act, 2023, compliance is a continuous, non-compensatory legal duty of the Data Fiduciary. In accordance with TLI governance decisions DEC-01, DEC-08, and DEC-10, numeric scores are indicative engineering diagnostic measures under provisional model SCORING-V1-PROVISIONAL pending formal methodology ratification."*
- Section 28(2) statutory mitigating factor reminders emphasizing that statutory penalty figures represent maximum ceiling thresholds, not automatic fines.

#### 2. The Four Strictly Independent Measures
To eliminate misleading aggregations where progress, evidence, or responses are conflated, the platform reports four distinct measures:

| Measure | Mathematical Formula | Governance Definition |
| :--- | :--- | :--- |
| **Assessment Completeness** | $\frac{\text{Total Answered}}{60} \times 100$ | Proportion of the 60 canonical questions where a response option has been selected by the client. |
| **Response Coverage** | $\frac{\text{Conclusive Answered}}{\text{Total Applicable}} \times 100$ | Proportion of applicable questions with definitive answers (`Implemented`, `Partially implemented`, `Not implemented`). Answers marked `Unknown / not verified` depress coverage. |
| **Evidence Coverage** | $\frac{\text{Questions with Active/Verified Evidence}}{60} \times 100$ | Proportion of canonical questions supported by active or verified evidentiary records. Computed independently of questionnaire responses. |
| **Indicative Readiness Score** | $\frac{\sum \text{Raw Points}}{\text{Scored Questions}}$ | Mean percentage compliance score across scorable questions (0.0% to 100.0%). Mapped linearly to Indicative Maturity Score (0.00 to 5.00). |
| **Conservative Readiness Score** | $\frac{\sum \text{Raw Points}}{\text{Total Applicable}}$ | Diagnostic metric evaluating unanswered or unknown questions as 0 points to reflect unverified risk exposure. |

---

### Response Option Evaluation & Exception Handling

```
                      ┌─────────────────────────────────┐
                      │    Canonical Response Option    │
                      └────────────────┬────────────────┘
                                       │
         ┌──────────────┬──────────────┴───────────────┬─────────────────┐
         ▼              ▼                              ▼                 ▼
   Implemented      Partially                    Not implemented      Unknown /
    (100 pts)      implemented                      (0 pts)         not verified
   [Maturity 5.0]   (50 pts)                     [Critical Gap]     [UNSCORED]
                 [Partial Deficit]                                       │
                                                                         ▼
                                                                Depresses Coverage;
                                                                Tracked in Deficit
                                                                Register as
                                                                UNVERIFIED_RISK
                                       │
                                       ▼
                   Not applicable — justification required
                                       │
                 ┌─────────────────────┴─────────────────────┐
                 │ Valid justification AND Assessor Approved │
                 └─────────────────────┬─────────────────────┘
                                       │
                        YES ───────────┴─────────── NO
                         │                           │
                         ▼                           ▼
                 EXCLUDED_APPROVED             UNAPPROVED_NA
                 - Removed from denominator   - Remains in applicable scope
                 - totalApplicable drops      - Flagged as UNAPPROVED_EXCLUSION
                 - Zero deficit exposure      - Added to Deficit Register
```

#### 1. Treatment of 'Unknown / not verified'
- Answered questions with `Unknown / not verified` are classified as `UNSCORED_UNKNOWN`.
- They receive `rawPoints: null` and `maxPoints: null`.
- They are **never** converted to 0 or 100 points, preventing mathematical distortion of the scored items.
- They are non-conclusive, directly depressing **Response Coverage %**.
- Each unknown item is logged in the **Statutory Deficit Register** with severity `UNVERIFIED_RISK` and a remediation summary requiring organizational discovery.

#### 2. Dual-Gate Exclusion Mechanism for 'Not applicable'
In accordance with kernel constraints in `migrations/008_assessment_questionnaire_responses.sql`, `Not applicable` choices must satisfy both conditions:
1. **Respondent Justification Gate:** Must contain non-empty written justification (`commentsAndJustification.length > 0`).
2. **Assessor Verification Gate:** Must be verified and approved by an authorized TLI assessor (`questionnaire_assessor_reviews.review_status == 'EXCLUSION_VERIFIED'` or `isExclusionApproved == true`).

**Outcomes:**
- **Approved Exclusion (`EXCLUDED_APPROVED`):** The question is excluded from scorable scope. The applicable denominator decreases (`totalApplicable = 60 - approvedExcluded`). Scored questions retain their true percentage.
- **Unapproved Exclusion (`UNAPPROVED_NA`):** If justification is missing or assessor verification is pending/withheld, the question **remains in the applicable denominator**. It is logged as an `UNAPPROVED_EXCLUSION` in the Statutory Deficit Register, generating an audit finding.

#### 3. Strict Isolation of Unresolved Control Mappings
Four canonical questions currently have unresolved mappings pending the separate Excel build sheet:
- `GOV-005`: Data protection principles communication
- `GOV-006`: Privacy governance committee / council
- `GOV-008`: Board-level oversight and audit reporting
- `APP-006`: Consent logs and audit trail retention

**Scoring Architecture Guarantee:**
- These 4 questions are evaluated and contribute to their respective section scores and overall readiness scores.
- They have `canonicalControlId: null` and `statutoryDomain: null`.
- They are **strictly excluded** from all 13 statutory domain score aggregations.
- Total mapped questions across the 13 statutory domains equals exactly $56$ ($60 - 4$).
- The engine isolates them in `unmappedQuestions` with audit notices for transparency.

---

### Non-Compensatory Dual-Metric & Statutory Deficit Register

Under the DPDP Act 2023, high compliance in one area (e.g. Governance policies) does not compensate for statutory omissions in another (e.g. absent security safeguards). 

To enforce this principle, the engine couples numeric scores with an immutable **Statutory Deficit Register**:

| Severity | Triggering Condition | Section 33(1) Statutory Ceiling |
| :--- | :--- | :--- |
| `CRITICAL_GAP` | Question answered as `Not implemented` | **Tier 1 (Up to ₹250 Cr)** for Security Safeguards<br>**Tier 2 (Up to ₹200 Cr)** for Breach Readiness / Children<br>**Tier 3 (Up to ₹150 Cr)** for SDF Obligations<br>**Tier 4 (Up to ₹50 Cr)** for General Statutory Duties |
| `PARTIAL_DEFICIT` | Question answered as `Partially implemented` | Maximum statutory ceiling for domain with operational remediation requirement |
| `UNAPPROVED_EXCLUSION` | Question marked `Not applicable` without approved justification | Maximum statutory ceiling with requirement to justify or remediate |
| `UNVERIFIED_RISK` | Question marked `Unknown / not verified` | Unverified exposure warning requiring internal discovery |

**Illustrative Non-Compensatory Behavior:**
An assessment with 59 questions `Implemented` (100 pts) and 1 question `SEC-001` `Not implemented` (0 pts) achieves an indicative readiness score of **98.3%** and maturity **4.92 / 5.00**. However, the Statutory Deficit Register immediately isolates the **Tier 1 Critical Gap** on `SEC-001` (`SECURITY_SAFEGUARDS` with statutory ceiling up to ₹250 Crores), preventing executive leadership from misinterpreting a 98% score as statutory immunity.

---

### Module Architecture & API Design

#### 1. Pure Calculation Engine (`lib/scoring/engine.ts`)
- Pure function `calculateAssessmentScores(input, config)`.
- No network, file, or database I/O.
- Deterministic calculation hash: Computes a canonical SHA-256 hash over model code, version, input revision, and normalized responses. Identical inputs produce identical digests.
- Safe arithmetic: Guarded against zero division when assessments are empty ($0/0 \to \text{null}$ or $100\%$) or when all items are excluded.

#### 2. RLS-Hardened Database Service (`lib/scoring/service.ts`)
- `getAssessmentScores(sessionUser, assessmentId, config)`: Executes under `executeWithRls`. Queries client responses (`assessment_questionnaire_responses`), assessor reviews (`questionnaire_assessor_reviews`), and active evidence items (`evidence_items`).
- Detects lifecycle locks (`FINAL_ISSUED` or `LEAD_APPROVED`) and attaches audit notices.
- `persistAssessmentScores(sessionUser, assessmentId, config)`: Persists calculation snapshots into PostgreSQL `assessment_scores` table with calculation hash, maturity score, domain breakdowns, gap counts, and potential penalty exposure.

#### 3. RESTful API Endpoint (`app/api/assessments/[id]/scoring/route.ts`)
- `GET /api/assessments/[id]/scoring`: Returns calculated metrics, section breakdown, domain breakdown, deficit register, and governance metadata under RLS.
- `POST /api/assessments/[id]/scoring`: Persists an immutable score snapshot into `assessment_scores`. Restricted via RBAC to authorized consultants and administrators (`canReviewAssessment(sessionUser.role)`).

---

### Verification & Test Evidence

The scoring engine implementation was subjected to comprehensive automated verification:

#### Test Suite: `tests/deterministic_scoring_engine.test.ts`
- **Test 1 — Code Normalization:** Verifies 2-digit (`GOV-01`), 3-digit (`GOV-001`), and lowercase codes are mapped deterministically.
- **Test 2 — Full Implementation:** 60/60 `Implemented` yields exactly 100.0% readiness, 5.00 maturity, 100% completeness, 0 deficits, and 100% across all 8 sections and 12 mapped statutory domains.
- **Test 3 — Incomplete Assessment:** 30/60 answered yields 50.0% completeness, 100.0% indicative readiness, and 50.0% conservative readiness with incomplete assessment warning.
- **Test 4 — Unknown Responses:** Verifies `Unknown / not verified` is tracked as `UNSCORED_UNKNOWN`, raw points remain `null`, response coverage is depressed, and `UNVERIFIED_RISK` is recorded in deficits.
- **Test 5 — Approved vs Unapproved N/A:** Verifies exclusion occurs only with both valid justification and assessor approval (`EXCLUSION_VERIFIED`). Unapproved exclusions remain in scorable scope.
- **Test 6 — Unresolved Mappings Isolation:** Confirms `GOV-005`, `GOV-006`, `GOV-008`, and `APP-006` remain isolated from statutory domain rollups, with exactly 56 questions mapped across the 13 domains.
- **Test 7 — Cryptographic Reproducibility:** Verifies identical inputs (including reordered input arrays) produce the exact same SHA-256 calculation hash and metrics down to every decimal place.
- **Test 8 — Division-by-Zero Guards:** Confirms empty assessments (0 responses) and all-excluded assessments (60 approved N/A) produce `null` scores safely without runtime exceptions or `NaN` values.
- **Test 9 — Non-Compensatory Dual Metric:** Confirms 98.3% score with 1 critical gap on `SEC-001` explicitly isolates Tier 1 (₹250 Cr) liability in the deficit register.
- **Test 10 — Governance Metadata:** Verifies `PROVISIONAL_PENDING_APPROVAL`, `isOfficialScore: false`, model code `SCORING-V1-PROVISIONAL`, and statutory legal disclaimers.
- **Test 11 — Live PostgreSQL RLS Integration & Persistence:** Verifies end-to-end database integration under `executeWithRls`, score persistence in `assessment_scores`, and cross-tenant isolation (Client Alpha cannot access Client Beta scores).

#### Comprehensive Suite Results
```
ℹ tests 98
ℹ suites 13
ℹ pass 98
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 31288.428602
```

#### Production Build Compilation
```
✓ Compiled successfully in 7.4s
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages (11/11)
✓ Collecting build traces
✓ Finalizing page optimization
Route: ƒ /api/assessments/[id]/scoring (Dynamic)
```

