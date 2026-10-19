# Phase 3D: Canonical Questionnaire Alignment & Implementation Audit

**Document Reference:** `docs/archive/38_canonical_questionnaire_alignment.md`  
**Milestone:** Phase 3D — Canonical Questionnaire Implementation  
**Working Directory:** `/home/charan/Documents/DPDP Tool`  
**Authoritative Source Document:** `Truth_Labs_DPDP_60_Question_MS_Forms_Quick_Import_v1.docx`  
**Version Identifier:** `TLI-DPDP-MSFORMS-60Q-V1` (v1.0.0)  
**Date:** October 11, 2026  

---

## 1. Executive Summary

This milestone establishes **100% exact, verified alignment** between the TLI DPDP compliance assessment application and the authoritative source questionnaire document:
`Truth_Labs_DPDP_60_Question_MS_Forms_Quick_Import_v1.docx`.

### Core Principle
> **"The original questionnaire is authoritative. Change the application to match the source, never rewrite the source to fit the application."**

In accordance with project governance:
1. The 60-question MS Forms Quick Import source was verified directly from the DOCX file inside the repository root.
2. An exact machine-readable manifest was established at `data/questionnaire_v1.json`.
3. Independent automated validators (`scripts/validate_questionnaire_source_parity.py` and `tests/canonical_questionnaire_parity.test.ts`) verified that **zero questions, section headings, punctuation marks, answer choices, follow-up instructions, or respondent instructions were altered, reordered, paraphrased, or omitted**.
4. A forward-only database migration (`migrations/008_assessment_questionnaire_responses.sql`) was created and applied, introducing RLS-enforced persistence and append-only version history for the 60 questions with kernel-level check constraints mandating written justification for exclusions.
5. The questionnaire UI was updated to render all 8 sections and 60 questions, supporting auto-saving to PostgreSQL and localStorage restoration.
6. All 69 automated tests across 10 test suites passed, the Phase 2 data validator passed, all 8 database migrations verified checksums, and the Next.js production build succeeded with zero errors.

---

## 2. Canonical Source Document & Verification Results

### 2.1 Authoritative Document Identification
- **Filesystem Path:** `/home/charan/Documents/DPDP Tool/Truth_Labs_DPDP_60_Question_MS_Forms_Quick_Import_v1.docx`
- **SHA-256 Digest:** `836dead0ae82439980d2e9a4f9d75d792f148436b8db01f3d837538a772cb299`
- **Document Structure:** 436 non-empty Word paragraphs, 0 Word tables. All questions are formatted as structured paragraph blocks with explicit question headers, 5 answer options, follow-up field prompts, and section division banners.

### 2.2 Verified Section & Question Counts
The document contains **exactly 60 questions organized across 8 canonical sections**:

| Section Code | Section Title | Question Codes | Verified Count |
|---|---|---|:---:|
| **GOV** | Governance and accountability | `GOV-001` to `GOV-008` | 8 |
| **DAT** | Personal data inventory and processing | `DAT-001` to `DAT-008` | 8 |
| **NOT** | Notice, consent and applicable processing grounds | `NOT-001` to `NOT-008` | 8 |
| **RGT** | Data principal rights and grievances | `RGT-001` to `RGT-007` | 7 |
| **SEC** | Security safeguards and breach response | `SEC-001` to `SEC-010` | 10 |
| **RET** | Retention and erasure | `RET-001` to `RET-006` | 6 |
| **TPR** | Processors and third parties | `TPR-001` to `TPR-006` | 6 |
| **APP** | Applicability and special obligations | `APP-001` to `APP-007` | 7 |
| **Total** | **8 Canonical Sections** | **60 Unique Question Codes** | **60** |

### 2.3 Exact Canonical Answer Options
Across every one of the 60 questions, the five answer choices appear in identical, uncompromised form:
1. `Implemented`
2. `Partially implemented`
3. `Not implemented`
4. `Unknown / not verified`
5. `Not applicable — justification required`

### 2.4 Exact Follow-up Field Prompt
Every question in the source contains the identical follow-up instruction:
> `"Follow-up field to add in Forms: Assessor / respondent comments and, if Not applicable, justification."`

### 2.5 Exact Respondent Instructions
The preamble instructions for respondents are preserved verbatim in the UI banner:
> `"Select the response that best describes the current state. Do not select “Not applicable” without providing a justification in the follow-up field. Evidence will be collected and validated separately by the Truth Labs assessor."`

### 2.6 Segregation of Assessor-Only Notes
Following question `APP-007`, the source document contains restricted assessor notes:
> `"Do not place all legal references, evidence instructions and remediation recommendations into the public respondent form. Keep them in the restricted SharePoint DPDP_QuestionBank and assessor workspace. Use QuestionCode to map each response back to the approved question-bank record."`
>
> `"Scoring defaults for MVP (subject to methodology approval): Implemented = 100; Partially implemented = 50; Not implemented = 0; Unknown / not verified = unscored pending review; Not applicable = excluded only after written justification and assessor approval. Report readiness score, evidence coverage and assessment completeness separately."`

**Governance Enforcement:** These assessor-only notes, proposed weights, and scoring rules are segregated into the manifest metadata (`assessor_only_reference`) and documentation; they are **strictly excluded** from the respondent-facing questionnaire UI.

---

## 3. Separation of Architectural Concepts & Control Mapping Registry

To avoid confusing distinct platform concepts:
1. **Respondent Questionnaire (60 questions across 8 sections):** Customer-facing inquiry evaluating current operational state.
2. **Statutory DPDP Control Library (30 controls across 13 domains):** Production controls (`TLI-DPDP-SCO-01` to `TLI-DPDP-PEN-01`) grounded in primary legislation.
3. **Database Control Domains (13 normalized domains):** Domain categorization (`NOTICE_TRANSPARENCY`, `SECURITY_SAFEGUARDS`, etc.) used in the relational database and executive report scoring.

### Control Mapping Register
In accordance with the rule to *never invent control mappings or guess*, each questionnaire question is mapped to canonical controls only where supported by statutory provisions. Questions requiring the external Excel build sheet are classified as `UNRESOLVED_PENDING_EXCEL_SHEET`:

| Category | Count | Status | Notes |
|---|:---:|:---:|---|
| **Primary Statutory Mappings** | 56 | `MAPPED_PRIMARY` | Direct statutory alignment with Section 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 16, 17 controls in `data/dpdp_controls.json`. |
| **Unresolved Mappings** | 4 | `UNRESOLVED_PENDING_EXCEL_SHEET` | `GOV-005` (Privacy by Design / Pre-launch risk), `GOV-006` (Regulatory monitoring), `GOV-008` (Exception tracking), `APP-006` (Research & statistical exemptions) await the external Excel build sheet or legal counsel binding. |

---

## 4. Database Architecture & Migration 008

A forward-only migration was implemented to support 60-question response persistence without altering previous migrations:

**Migration File:** `migrations/008_assessment_questionnaire_responses.sql`

### 4.1 Schema Additions
1. **`assessment_questionnaire_responses`**:
   - `id UUID PRIMARY KEY DEFAULT generate_uuid_v7()`
   - `assessment_id UUID REFERENCES assessments(id) ON DELETE RESTRICT`
   - `tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT`
   - `question_code VARCHAR(20) NOT NULL` (e.g., `'GOV-001'`)
   - `questionnaire_version VARCHAR(50) DEFAULT '1.0.0'`
   - `selected_option VARCHAR(100)` (checked against canonical 5 options)
   - `comments_and_justification TEXT`
   - `CONSTRAINT uq_assessment_question UNIQUE (assessment_id, question_code)`
   - `CONSTRAINT chk_na_justification_required CHECK (selected_option != 'Not applicable — justification required' OR (comments_and_justification IS NOT NULL AND length(trim(comments_and_justification)) > 0))`
     *(Enforces non-empty justification at the database kernel level).*

2. **`questionnaire_response_history`**:
   - `id UUID PRIMARY KEY DEFAULT generate_uuid_v7()`
   - `assessment_id UUID REFERENCES assessments(id) ON DELETE RESTRICT`
   - `tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT`
   - `question_code VARCHAR(20) NOT NULL`
   - `version_number INT NOT NULL`
   - `selected_option VARCHAR(100) NOT NULL`
   - `comments_and_justification TEXT`
   - `submitted_by_id UUID REFERENCES users(id) ON DELETE RESTRICT`
   - `submitted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`
   - Immutability trigger: `trg_questionnaire_response_history_immutable` executing `prevent_immutable_record_modification()`, blocking `UPDATE` and `DELETE`.

### 4.2 Row-Level Security Policies
- **Tenant Isolation:** Client users can read and write only their own tenant's responses (`tenant_id = app_current_tenant_id()`).
- **Lifecycle Boundary:** Client users can INSERT and UPDATE responses only when the assessment status is in an active scoping/data gathering state (`status IN ('DRAFT', 'SCOPING', 'SCOPE_LOCKED', 'DATA_GATHERING')`).
- **Consultant Boundaries:** Assigned consultants have SELECT read access to responses for assigned assessments, with **zero write privileges** on client responses.
- **Fail-Closed:** Unset session context returns 0 rows.

---

## 5. User Interface Implementation

### 5.1 Updated Components
- `components/questionnaire/QuestionnaireClient.tsx`:
  - Renders all 8 canonical sections and 60 questions.
  - Automatically loads saved state from `/api/assessments/[id]/responses` with `localStorage` fallback.
  - Real-time debounced auto-save to server with visual status indicators.
  - Verbatim display of canonical respondent instructions.
- `components/questionnaire/QuestionCard.tsx`:
  - Displays exact question code, order (`Question X of 60`), and exact wording.
  - Displays exact 5 canonical choices.
  - Displays exact follow-up prompt.
  - Visually flags questions where `Not applicable` was chosen without a justification.
  - Preserves evidence vault integration for uploading evidentiary artifacts.
- `components/questionnaire/SectionNavigator.tsx`:
  - Displays the 8 canonical sections with completion counts and justification error warnings.
- `components/questionnaire/ReviewStep.tsx`:
  - Pre-submission summary across all 60 questions.
  - Validates that no questions are unanswered and that all `Not applicable` selections have non-empty written justifications before allowing submission.
  - Provides jump links directly to incomplete questions.

### 5.2 API Route
- `app/api/assessments/[id]/responses/route.ts`:
  - `GET`: Returns saved responses for the authorized assessment under `executeWithRls(sessionUser)`.
  - `PUT`: Validates payload, verifies mandatory justification for `Not applicable`, upserts `assessment_questionnaire_responses`, and records immutable revision history in `questionnaire_response_history`.

---

## 6. Automated Verification & Test Results

### 6.1 Test Execution Matrix

| Test Suite / Tool | Command | Scope | Result |
|---|---|---|:---:|
| **Full Node Test Suite** | `npm test` | 10 suites, 69 automated tests (Auth, RBAC, Demo, RLS, Parity, Vault, Storage) | **69/69 PASS (0 Fail)** |
| **Source Parity Validator** | `python3 scripts/validate_questionnaire_source_parity.py` | Direct extraction from DOCX vs `data/questionnaire_v1.json` | **100% PASS** |
| **Phase 2 Data Validator** | `python3 scripts/validate_phase2_data.py` | Controls, evidence items, legal sources schema & referential integrity | **100% PASS** |
| **Migration Verifier** | `python3 scripts/migrate.py verify --database-url=...` | Verifies SHA-256 checksums of migrations 001–008 | **8/8 VERIFIED** |
| **Database Security Tests** | `python3 scripts/test_database_rls.py --database-url=...` | 9 static validations + 17 live PostgreSQL kernel security tests | **26/26 PASS** |
| **Next.js Production Build** | `npm run build` | Full compile, typecheck, static generation, route compilation | **100% SUCCESS** |

---

## 7. Remaining Approvals & Governance Dependencies

1. **Scoring Methodology Approval (Assessor Reference):**
   The proposed values (`Implemented = 100`, `Partially implemented = 50`, `Not implemented = 0`, `Unknown = unscored`, `Not applicable = excluded upon written approval`) remain **proposals pending formal methodology signoff**. Scoring engine implementation is reserved for Phase 3D.2.
2. **Excel Build Sheet Ingestion:**
   Formal binding for the 4 unmapped questions (`GOV-005`, `GOV-006`, `GOV-008`, `APP-006`) awaits receipt of the separate Excel build sheet referenced in the Word document notes.
3. **Legal Verification Register:**
   Statutory interpretations flagged in `docs/reference/19_legal_review_and_interpretation_register.md` remain marked `LEGAL_VERIFICATION_REQUIRED` pending TLI legal counsel review.

---

## 8. Summary of Files Changed

- `Truth_Labs_DPDP_60_Question_MS_Forms_Quick_Import_v1.docx` *(Source document verified in repository)*
- `data/questionnaire_v1.json` *(New authoritative machine-readable manifest)*
- `scripts/extract_canonical_questionnaire.py` *(New extraction script)*
- `scripts/validate_questionnaire_source_parity.py` *(New independent validator)*
- `migrations/008_assessment_questionnaire_responses.sql` *(New forward-only migration)*
- `scripts/test_database_rls.py` *(Updated migration list)*
- `lib/questionnaire/types.ts` *(Updated canonical questionnaire types)*
- `lib/questionnaire/data.ts` *(Updated canonical data loader & progress calculator)*
- `app/api/assessments/[id]/responses/route.ts` *(New RLS-scoped responses API)*
- `components/questionnaire/QuestionCard.tsx` *(Updated question rendering)*
- `components/questionnaire/SectionNavigator.tsx` *(Updated 8-section navigation)*
- `components/questionnaire/ReviewStep.tsx` *(Updated validation & review step)*
- `components/questionnaire/QuestionnaireClient.tsx` *(Updated client state & auto-save)*
- `tests/canonical_questionnaire_parity.test.ts` *(New parity & persistence test suite)*
- `tests/questionnaire_and_storage.test.ts` *(Updated questionnaire constraints)*
- `docs/archive/38_canonical_questionnaire_alignment.md` *(This audit report)*
- `docs/README.md` *(Updated documentation index)*

