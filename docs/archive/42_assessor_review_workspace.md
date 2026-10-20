# Truth Labs International (TLI) DPDP Compliance Gap Analysis Tool
## Phase 3D.2 Implementation Report: Assessor Review Workspace & Clarifications Engine

**Document Reference:** `docs/archive/42_assessor_review_workspace.md`  
**Classification:** Internal Technical Architecture & Compliance Audit Report  
**Lifecycle Stage:** Phase 3D.2 Implementation Complete  
**Date:** 2026-10-11  
**Target Repository:** `/home/charan/Documents/DPDP Tool`  
**Related Migrations:** `migrations/001_initial_schema.sql` through `migrations/009_assessor_review_workspace.sql`  

---

### Executive Summary

In accordance with Phase 3D.2 requirements for the Truth Labs International (TLI) Digital Personal Data Protection (DPDP) Compliance Gap Analysis Platform, this milestone implements the dedicated **Assessor Review Workspace** (`/dashboard/assessments/[id]/review`), API endpoints, and database infrastructure.

The Assessor Review Workspace empowers authorized Truth Labs International personnel (`TLI_LEAD_CONSULTANT`, `TLI_REVIEWER`, `TLI_SUPER_ADMIN`) to evaluate client questionnaire submissions across all **60 canonical questions** in their authoritative 8 statutory sections, inspect uploaded evidence documents, record independent audit findings, flag items requiring onsite validation, and manage bidirectional clarification threads with client personnel under strict PostgreSQL Row-Level Security (RLS).

---

### Core Architectural Principles & Separation of Concerns

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ASSESSMENT ENGAGEMENT                           │
├──────────────────────────────────┬─────────────────────────────────────┤
│      CLIENT SUBMISSION DOMAIN     │       ASSESSOR EVALUATION DOMAIN     │
│   (Immutable to Consultants)     │    (Restricted to TLI Personnel)    │
├──────────────────────────────────┼─────────────────────────────────────┤
│ • assessment_questionnaire_responses│ • questionnaire_assessor_reviews    │
│   - Selected Option (5 canonical)│   - Review Status (7 valid states)  │
│   - Comments & Justification     │   - Audit Findings & Observations   │
│   - Mandatory N/A rationale     │   - Evidence Deficiency Notes       │
│                                  │   - Requires Further Validation flag│
│ • questionnaire_response_history │ • questionnaire_assessor_review_hist│
│   - Immutable client versions   │   - Immutable assessor version audit│
├──────────────────────────────────┴─────────────────────────────────────┤
│                    COLLABORATIVE ENGAGEMENT DATA                       │
├────────────────────────────────────────────────────────────────────────┤
│ • evidence_items: Linked to question codes & canonical controls        │
│ • clarification_threads & messages: Question-level bidirectional dialog│
└────────────────────────────────────────────────────────────────────────┘
```

#### 1. Non-Mutation Guarantee for Client Responses
Client questionnaire responses stored in `assessment_questionnaire_responses` and their version history in `questionnaire_response_history` are strictly immutable to consultants. Consultants and reviewers hold read-only visibility (`SELECT`) via RLS policy `rls_q_responses_select_policy` and are categorically prohibited from modifying client responses by `rls_q_responses_update_policy`.

#### 2. Segregated Assessor Evaluation Table
Independent assessor evaluations are recorded in the dedicated `questionnaire_assessor_reviews` table. This guarantees that consultant audit findings, compliance verifications, and deficiency notes never contaminate or overwrite the client's submitted responses.

#### 3. Append-Only Forensic Audit Immutability
Every modification to an assessor evaluation is versioned into `questionnaire_assessor_review_history` with reviewer user ID attribution and timestamps. The table is guarded by the database trigger `trg_questionnaire_assessor_review_history_immutable`, which blocks any `UPDATE` or `DELETE` attempt fail-closed at the PostgreSQL kernel.

---

### Database Migration: Migration 009 Specification

Migration file: [`migrations/009_assessor_review_workspace.sql`](file:///home/charan/Documents/DPDP%20Tool/migrations/009_assessor_review_workspace.sql)

#### DDL Summary

1. **`questionnaire_assessor_reviews`**:
   - `id UUID PRIMARY KEY DEFAULT generate_uuid_v7()`
   - `assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE RESTRICT`
   - `question_code VARCHAR(20) NOT NULL`
   - `review_status VARCHAR(50) NOT NULL DEFAULT 'PENDING_REVIEW'`
     - Checked against 7 valid statuses: `PENDING_REVIEW`, `UNDER_REVIEW`, `VERIFIED_COMPLIANT`, `PARTIALLY_COMPLIANT`, `NON_COMPLIANT`, `CLARIFICATION_REQUESTED`, `EXCLUSION_VERIFIED`
   - `review_findings TEXT`
   - `evidence_deficiency_notes TEXT`
   - `requires_further_validation BOOLEAN NOT NULL DEFAULT FALSE`
   - `reviewed_by_user_id UUID REFERENCES users(id) ON DELETE RESTRICT`
   - `reviewed_at TIMESTAMPTZ`
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
   - `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
   - `CONSTRAINT uq_assessment_question_review UNIQUE (assessment_id, question_code)`

2. **`questionnaire_assessor_review_history`**:
   - `id UUID PRIMARY KEY DEFAULT generate_uuid_v7()`
   - `assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE RESTRICT`
   - `question_code VARCHAR(20) NOT NULL`
   - `version_number INT NOT NULL`
   - `review_status VARCHAR(50) NOT NULL`
   - `review_findings TEXT`
   - `evidence_deficiency_notes TEXT`
   - `requires_further_validation BOOLEAN NOT NULL DEFAULT FALSE`
   - `reviewed_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT`
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
   - `CONSTRAINT uq_assessor_review_history UNIQUE (assessment_id, question_code, version_number)`
   - Trigger: `trg_questionnaire_assessor_review_history_immutable` executing `prevent_immutable_record_modification()`.

3. **`clarification_threads` & `clarification_messages` Expansion**:
   - Relaxed `assessment_control_id` NOT NULL constraint to allow question-level threads.
   - Added `assessment_id UUID REFERENCES assessments(id)` and `question_code VARCHAR(20)`.
   - Backfilled existing control-based clarification threads.
   - Refined RLS policy `rls_clarification_threads_policy` to support both control-based and question-based clarification workflows.

4. **`evidence_items` Expansion**:
   - Relaxed `assessment_control_id` NOT NULL constraint to permit direct question-level binding.
   - Added `assessment_id UUID REFERENCES assessments(id)` and `question_code VARCHAR(20)`.
   - Backfilled existing control-based evidence records.
   - Updated RLS policy `rls_evidence_items_policy` to preserve tenant isolation and permit assigned consultants to inspect evidence items by assessment ID.

---

### Backend API Architecture

#### 1. Review Workspace Endpoint: `GET /api/assessments/[id]/reviews`
- **Authentication**: Requires signed JWT session via `getCurrentSession()`.
- **Database Context**: Executes inside transaction-scoped RLS (`executeWithRls`).
- **Data Assembly**:
  - Validates assessment existence and RLS assignment.
  - Loads 60 canonical questions from `data/questionnaire_v1.json`.
  - Queries `assessment_questionnaire_responses` for all client submissions.
  - Queries `questionnaire_assessor_reviews` for assessor statuses and findings.
  - Queries `evidence_items` matching either direct `question_code` or mapped `control_code`.
  - Queries `clarification_threads` and nested messages.
  - Computes real-time progress metrics (Total 60, Client Completed, Assessor Reviewed, Pending Queue, Clarifications Requested, Deficits Identified, Requires Validation).
- **Access Control**: Transparent read access for client tenant members; full interactive review permissions for TLI advisory roles (`isTliRole`).

#### 2. Review Persistence Endpoint: `PUT /api/assessments/[id]/reviews`
- **RBAC Gate**: Strictly restricts execution to `canReviewAssessment(role)` (`TLI_SUPER_ADMIN`, `TLI_LEAD_CONSULTANT`, `TLI_REVIEWER`). Client roles are rejected with HTTP 403 Forbidden.
- **Payload Validation**: Validates `questionCode`, valid `reviewStatus`, and sanitizes notes.
- **Persistence**: Upserts into `questionnaire_assessor_reviews` with `reviewed_by_user_id = sessionUser.userId` and appends an immutable version audit log to `questionnaire_assessor_review_history`.

#### 3. Clarification Engine Endpoint: `POST /api/assessments/[id]/clarifications`
- **Actions Supported**:
  - `THREAD_CREATED`: Initiates a new query linked to `(assessment_id, question_code)`.
  - `REPLY_POSTED`: Appends a message to an active thread with author attribution.
  - `STATUS_UPDATED`: Toggles thread status between `OPEN` and `RESOLVED` with `resolved_at` timestamping.
- **RLS Enforcement**: Ensures both client contributors and assigned consultants can engage in bidirectional dialogue strictly within their authorized engagement boundary.

---

### Frontend Workspace Implementation

Location: [`app/dashboard/assessments/[id]/review/page.tsx`](file:///home/charan/Documents/DPDP%20Tool/app/dashboard/assessments/%5Bid%5D/review/page.tsx)  
Client Component: [`components/review/AssessorReviewClient.tsx`](file:///home/charan/Documents/DPDP%20Tool/components/review/AssessorReviewClient.tsx)

#### Key Interface Sections

1. **Header & Context Bar**:
   - Breadcrumbs linking to Dashboard, Assessments, and current engagement.
   - Assessment title, status badge (`DATA_GATHERING`, `UNDER_REVIEW`, etc.), Significant Data Fiduciary (SDF) badge.
   - Customer metadata, lead assessor name, target completion date.
   - Quick-navigation pills to Questionnaire Workspace, Evidence Vault, and Summary & Review.

2. **Executive Progress & Outstanding Queue Metrics**:
   - 6 structured metrics cards:
     - Total Canonical Questions (60)
     - Client Completed (e.g. 52 / 60, percentage progress bar)
     - Assessor Reviewed (e.g. 48 / 60, verified percentage)
     - Pending Review Queue
     - Clarification Inquiries
     - Statutory Gaps & Deficits Flagged

3. **Filtration & Section Selection Engine**:
   - 8 statutory section pills: `All (60)`, `GOV (8)`, `DAT (7)`, `NOT (8)`, `RGT (7)`, `SEC (8)`, `RET (6)`, `TPR (8)`, `APP (8)`.
   - Status dropdown filter (Pending Review, Under Review, Verified Compliant, Partially Compliant, Non-Compliant, Clarification Requested, Exclusion Verified).
   - Quick toggle chips: "Deficits Only", "Requires Validation".
   - Full-text search matching question codes, question text, and canonical control codes.

4. **Split-Screen Question Review Cards**:
   - **Header**: Canonical question code, Section badge, Control mapping badge (or Unresolved note), Review status badge.
   - **Canonical Question Text**: Displayed in full verbatim wording without omission.
   - **Left Panel (Client Submission & Evidence)**:
     - Client selected option badge (`Implemented`, `Partially implemented`, `Not implemented`, `Unknown / not verified`, `Not applicable — justification required`).
     - Client comments & justification narrative.
     - Associated evidence files with direct download/preview links.
     - Active clarification summary with thread count.
   - **Right Panel (Assessor Evaluation Controls)**:
     - Review status selector.
     - "Flag for Onsite / Further Validation" toggle.
     - Compliance Audit Findings & Observations textarea.
     - Evidence Deficiency & Remediation Notes textarea.
     - "Save Evaluation" button with real-time feedback spinner and reviewer attribution.
     - Clarification launcher dialog.

5. **Bidirectional Clarification Modal**:
   - Full threaded conversation viewer showing timestamped messages and author roles.
   - In-modal reply box for sending clarifications or client replies.
   - Thread status resolver toggle (`OPEN` / `RESOLVED`).

---

### Verification & Testing Suite

The new test suite [`tests/assessor_review_workspace.test.ts`](file:///home/charan/Documents/DPDP%20Tool/tests/assessor_review_workspace.test.ts) exercises the complete workspace lifecycle:

1. **Test 1 — Canonical Structure**: Verifies all 60 questions, 8 sections, and 5 options are present and preserved.
2. **Test 2 — Assessor Persistence**: Verifies `TLI_LEAD_CONSULTANT` can record and update evaluations under live RLS.
3. **Test 3 — Append-Only History**: Verifies `questionnaire_assessor_review_history` blocks any `UPDATE` or `DELETE` attempt via table permissions and trigger `trg_questionnaire_assessor_review_history_immutable`.
4. **Test 4 — Client Privilege Denial**: Verifies `CLIENT_ADMIN` is blocked fail-closed by RLS from inserting or modifying assessor evaluations.
5. **Test 5 — Client Immutability**: Verifies client questionnaire responses in `assessment_questionnaire_responses` cannot be modified by consultants.
6. **Test 6 — Assignment Scoping Gate**: Verifies unassigned consultants cannot record evaluations for unassigned engagements.
7. **Test 7 — Clarifications Flow**: Verifies bidirectional question-level clarification threads, replies between consultant and client, and thread resolution.

All 7 tests passed with zero failures.

---

### Summary of Repository Modifications

- `migrations/009_assessor_review_workspace.sql` *(New)*
- `app/api/assessments/[id]/reviews/route.ts` *(New)*
- `app/api/assessments/[id]/clarifications/route.ts` *(New)*
- `app/dashboard/assessments/[id]/review/page.tsx` *(New)*
- `components/review/AssessorReviewClient.tsx` *(New)*
- `tests/assessor_review_workspace.test.ts` *(New)*
- `docs/archive/42_assessor_review_workspace.md` *(New)*
- `scripts/test_database_rls.py` *(Updated expected migration list to 9)*
- `app/dashboard/assessments/page.tsx` *(Added Assessor Review link to assessment cards)*
- `app/dashboard/page.tsx` *(Added Review link to dashboard table rows)*
- `docs/README.md` *(Indexed report 42)*

