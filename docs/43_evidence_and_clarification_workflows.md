# Truth Labs International (TLI) DPDP Compliance Gap Analysis Tool
## Phase 3D.3 Implementation Report: Evidence Vault & Clarification Workflows

**Document Reference:** `docs/43_evidence_and_clarification_workflows.md`  
**Classification:** Internal Technical Architecture & Compliance Audit Report  
**Lifecycle Stage:** Phase 3D.3 Implementation Complete  
**Date:** 2026-10-11  
**Target Repository:** `/home/charan/Documents/DPDP Tool`  
**Related Migrations:** `migrations/001_initial_schema.sql` through `migrations/010_evidence_and_clarification_workflows.sql`  

---

### Executive Summary

In accordance with Phase 3D.3 requirements for the Truth Labs International (TLI) Digital Personal Data Protection (DPDP) Compliance Gap Analysis Platform, this milestone completes the end-to-end **Evidence Vault Lifecycle** and **Clarification Workflow Engine**.

The implementation strengthens the application's defense-in-depth architecture by unifying file validation, multi-tenant Row-Level Security (RLS), assessor review decisions (`VERIFIED` / `REJECTED`), immutable audit history tracking, question- and evidence-level clarification threads, and independent **Evidence Coverage** metrics calculated against the authoritative 60 canonical questions.

No duplicate evidence subsystem was created; existing capabilities in `lib/storage/service.ts`, `lib/storage/validation.ts`, and the reference UI in `components/evidence/EvidenceManagementClient.tsx` were extended and hardened.

---

### Core Architectural Principles & Separation of Concerns

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           ASSESSMENT ENGAGEMENT SCOPE                            │
├──────────────────────────────────────┬───────────────────────────────────────────┤
│       CLIENT SUBMISSION DOMAIN       │         ASSESSOR EVALUATION DOMAIN        │
│      (Immutable to Consultants)      │        (Restricted to TLI Personnel)      │
├──────────────────────────────────────┼───────────────────────────────────────────┤
│ • assessment_questionnaire_responses │ • questionnaire_assessor_reviews          │
│   - Selected Option (5 canonical)    │   - Review Status (7 valid states)        │
│   - Comments & Justification         │   - Audit Findings & Observations         │
│   - Mandatory N/A justification      │   - Evidence Deficiency Notes             │
│ • questionnaire_response_history     │ • questionnaire_assessor_review_history   │
├──────────────────────────────────────┴───────────────────────────────────────────┤
│                       EVIDENCE VAULT & VERIFICATION LIFECYCLE                    │
├──────────────────────────────────────────────────────────────────────────────────┤
│ • evidence_items: Bound to assessment_id, question_code, category, description   │
│   - Lifecycle: PENDING_UPLOAD → PENDING_SCAN → ACTIVE → VERIFIED / REJECTED      │
│   - Retention: DELETED (soft-delete with deleted_at and deleted_by_user_id)      │
│ • evidence_review_history: Append-only immutable log of reviewer decisions       │
│ • Independent Evidence Coverage: Distinct questions with verified evidence / 60   │
├──────────────────────────────────────────────────────────────────────────────────┤
│                       COLLABORATIVE CLARIFICATION THREADS                        │
├──────────────────────────────────────────────────────────────────────────────────┤
│ • clarification_threads: Bound to question_code, evidence_item_id, target_role   │
│   - Lifecycle: OPEN → IN_PROGRESS → REQUIRES_FURTHER_INFO → RESOLVED             │
│ • clarification_messages: Chronological threaded dialog with author attribution │
└──────────────────────────────────────────────────────────────────────────────────┘
```

#### 1. Non-Mutation Guarantee for Client Responses
Client questionnaire responses stored in `assessment_questionnaire_responses` and their version history in `questionnaire_response_history` are strictly isolated from evidence verification and clarification actions. Neither marking an evidence item as `VERIFIED` or `REJECTED`, nor opening or resolving a clarification thread, mutates client responses or answers.

#### 2. Segregated Assessor Evidence Review & Immutable Audit Trail
Assessor review decisions (`VERIFIED` / `REJECTED`) and verification notes are recorded directly on `evidence_items` and logged to `evidence_review_history`. The table is protected by PostgreSQL trigger `trg_evidence_review_history_immutable`, which blocks any `UPDATE` or `DELETE` attempt at the kernel level. Runtime role privileges for `dpdp_app_user` strictly grant `SELECT` and `INSERT` only.

#### 3. Independent Evidence Coverage Metric
Evidence coverage metrics (distinct questions supported by active or verified evidence out of the 60 canonical questions) are tracked and displayed independently from questionnaire completion percentages and readiness scores.

---

### Database Migration: Migration 010 Specification

Migration file: [`migrations/010_evidence_and_clarification_workflows.sql`](file:///home/charan/Documents/DPDP%20Tool/migrations/010_evidence_and_clarification_workflows.sql)

#### DDL Summary
1. **Enum Expansion:** Added `'VERIFIED'` value to `evidence_status` enum.
2. **SHA-256 Check Constraint:** Updated `chk_evidence_active_hash` on `evidence_items` to enforce non-null SHA-256 digests on `'ACTIVE'`, `'VERIFIED'`, and `'SUPERSEDED'` records.
3. **Evidence Metadata Columns:** Added `evidence_category VARCHAR(100)` and `description TEXT` to `evidence_items`.
4. **Clarification Thread Expansion:**
   - Added `evidence_item_id UUID REFERENCES evidence_items(id) ON DELETE SET NULL` to support direct evidence attachment in queries.
   - Added `target_role VARCHAR(50)` to allow targeting specific organizational personas (e.g. `CLIENT_ADMIN`, `DATA_PROTECTION_OFFICER`).
   - Expanded status check constraint to support `'OPEN'`, `'IN_PROGRESS'`, `'REQUIRES_FURTHER_INFO'`, and `'RESOLVED'`.
5. **Evidence Review Audit History:**
   - Created `evidence_review_history` (`id`, `evidence_item_id`, `previous_status`, `new_status`, `verification_notes`, `reviewed_by_user_id`, `reviewed_at`).
   - Attached trigger `trg_evidence_review_history_immutable` calling `prevent_immutable_record_modification()`.
6. **Row-Level Security & Grants:**
   - Enabled and forced RLS on `evidence_review_history`.
   - Updated `rls_evidence_items_policy` `WITH CHECK` to authorize assigned assessors (`TLI_LEAD_CONSULTANT`, `TLI_REVIEWER`) to update evidence items for their assigned engagements.
   - Granted least-privilege permissions to `dpdp_app_user`.

---

### File Validation, Bounds, and Storage Defense-in-Depth

#### 1. File Size Boundary Discrepancy Resolution
- **Server Security Boundary:** Maintained hard ceiling of 50 MB (`DEFAULT_MAX_SIZE_BYTES = 52_428_800`) and floor of 100 B in `lib/storage/validation.ts`.
- **Client Alignment:** Resolved UI text discrepancy in `components/evidence/EvidenceManagementClient.tsx`. Updated drop zone helper text from `(Max 20 MB per file)` to:
  `Supported formats: PDF, DOCX, XLSX, PNG, JPG (Max 50 MB per file, recommended < 20 MB)`.
- Client-side pre-validation strictly validates against the 50 MB ceiling and 100 B floor before dispatching network requests.

#### 2. Binary Magic Bytes Verification
Pre-storage validation checks magic bytes directly against binary buffers:
- **PDF:** `%PDF-` (`0x25 0x50 0x44 0x46 0x2D`)
- **PNG:** `\x89PNG\r\n\x1a\n` (`0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A`)
- **JPEG:** `\xFF\xD8\xFF` (`0xFF 0xD8 0xFF`)
- **OOXML (DOCX / XLSX):** `PK\x03\x04` (`0x50 0x4B 0x03 0x04`)
- **Blocked Signatures:** Blocks Windows PE executables (`MZ`), Linux ELF binaries (`\x7fELF`), and raw scripts disguised with document extensions.

#### 3. Fail-Closed Download Gating
Download requests via `GET /api/evidence/[id]/download` require active session authentication and RLS authorization. Downloads are blocked fail-closed for:
- Cross-tenant requests (non-assigned or cross-tenant accounts).
- `QUARANTINED` files.
- `PENDING_SCAN` and `PENDING_UPLOAD` files.
- `DELETED` files.

#### 4. Soft-Deletion and Audit Retention
When evidence is deleted:
- Record is soft-deleted by setting `status = 'DELETED'`, `deleted_at = CURRENT_TIMESTAMP`, and `deleted_by_user_id = sessionUser.userId`.
- The storage payload remains in the local disk vault to preserve forensic auditability.
- All subsequent download and inspection requests are rejected.

---

### API Route Endpoints

| Endpoint | Method | Role Authorization | Description |
|---|---|---|---|
| `/api/evidence/upload` | `POST` | `CLIENT_ADMIN`, `CLIENT_CONTRIBUTOR`, `TLI_*` | Validates binary metadata and magic bytes, persists to disk vault, binds metadata (`questionCode`, `category`, `description`) under RLS, returns HTTP 201. |
| `/api/evidence/[id]` | `GET` | Authenticated tenant / assigned consultant | Retrieves evidence metadata under RLS. |
| `/api/evidence/[id]` | `PATCH` | Assessor roles (`TLI_LEAD_CONSULTANT`, `TLI_REVIEWER`, `TLI_SUPER_ADMIN`) | Records reviewer decision (`VERIFIED` / `REJECTED`) with notes; appends immutable entry to `evidence_review_history`. |
| `/api/evidence/[id]` | `DELETE` | Uploader, `CLIENT_ADMIN`, `TLI_SUPER_ADMIN` | Soft-deletes evidence item with user attribution. |
| `/api/evidence/[id]/download` | `GET` | Authenticated tenant / assigned consultant | Retrieves binary file with security download headers (`nosniff`, `attachment`, `no-cache`). Gated against quarantined/deleted/unverified files. |
| `/api/assessments/[id]/evidence` | `GET` | Tenant members / assigned consultants | Returns all active evidence items and independent Evidence Coverage metrics. |
| `/api/assessments/[id]/clarifications` | `GET` | Tenant members / assigned consultants | Retrieves all clarification threads and chronological messages for the assessment. |
| `/api/assessments/[id]/clarifications` | `POST` | Tenant members / assigned consultants | Creates question- or evidence-linked threads, posts threaded replies, or updates thread lifecycle status. |

---

### Verification and Test Suite Results

#### 1. Automated Test Suites (`npm test`)
- **Total Tests:** 87 passing across 12 test suites.
- **Failures / Regressions:** 0.
- **Dedicated Phase 3D.3 Suite:** [`tests/evidence_clarification_workflow.test.ts`](file:///home/charan/Documents/DPDP%20Tool/tests/evidence_clarification_workflow.test.ts) (11/11 passing):
  1. Enforces file size bounds (<100 B or >50 MB rejected).
  2. Verifies binary magic bytes and rejects dangerous signatures (MZ, ELF).
  3. Rejects cross-tenant evidence upload attempts under live PostgreSQL RLS.
  4. Uploads evidence and binds `assessmentId`, `questionCode`, `category`, and `description`.
  5. Enforces fail-closed download gating blocking cross-tenant and quarantined downloads.
  6. Allows authorized assessor to record review decision (`VERIFIED`) and appends immutable audit log.
  7. Rejects review decision attempts by unauthorized client users.
  8. Supports clarification thread creation, target roles, and threaded messages linked to evidence.
  9. Preserves client questionnaire responses immutably across evidence and clarification actions.
  10. Calculates independent Evidence Coverage metrics separately from questionnaire readiness.
  11. Soft-deletes evidence items, records user attribution, and blocks subsequent downloads.

#### 2. PostgreSQL RLS Kernel Tests (`scripts/test_database_rls.py`)
- **Static Schema Checks:** 9/9 passed.
- **Live Kernel Security Tests:** 17/17 passed.
- **Tenant Isolation:** Alpha sees strictly its own evidence records; cross-tenant reads and updates are completely blocked.

#### 3. Database Migration Integrity (`scripts/migrate.py verify`)
- All 10 migrations (`001` through `010`) verified with exact SHA-256 disk checksum matches.

#### 4. Canonical Questionnaire Source Parity (`scripts/validate_questionnaire_source_parity.py`)
- 100% exact parity verified against `Truth_Labs_DPDP_60_Question_MS_Forms_Quick_Import_v1.docx`.

#### 5. Next.js Production Build (`npm run build`)
- Next.js 15.5.27 production build succeeded with 0 TypeScript or linting errors.

---

### Phase 3D Status Matrix

| Phase Milestone | Description | Status | Verification Reference |
|---|---|---|---|
| **Phase 3D.1** | Canonical Questionnaire Alignment (60 questions, 8 sections) | **COMPLETE** | `tests/canonical_questionnaire_parity.test.ts` |
| **Phase 3D.2** | Assessor Review Workspace & Findings Engine | **COMPLETE** | `tests/assessor_review_workspace.test.ts` |
| **Phase 3D.3** | Secure Evidence Vault & Clarification Workflows | **COMPLETE** | `tests/evidence_clarification_workflow.test.ts` |
| **Phase 3D.4** | Statutory DPDP Scoring & Readiness Model | **PENDING** | Next scheduled implementation milestone |

