# Document 34: Phase 3D.UI.1 Implementation Report — Questionnaire Structure, Local Storage Vault & Editorial Redesign

**Project**: TLI DPDP Compliance Gap Analysis Tool  
**Phase**: Phase 3D.UI.1  
**Author**: Truth Labs International Implementation Team  
**Status**: Completed & Verified  
**Date**: October 11, 2026  

---

## 1. Executive Summary

Phase 3D.UI.1 delivers the user interface foundation, canonical questionnaire pagination engine, real local-disk evidence vault, and editorial aesthetic redesign for the TLI DPDP Compliance Gap Analysis Tool.

All work strictly adheres to the canonical requirements:
1. **Questionnaire Structure (Section A)**: Built directly from the 30 canonical DPDP controls across the 13 canonical domains. **Strict invariant enforced**: No questionnaire section contains more than 4 questions. Standardized 4-choice MCQ options mapped to deterministic maturity scores (4, 2, 1, 0) plus consultant-reviewed exclusion proposals.
2. **Local Evidence Storage Vault (Section B)**: Implemented real local-disk vault adapter (`lib/storage/local_adapter.ts`) configured via `DPDP_LOCAL_EVIDENCE_DIR`. Enforces path traversal defense, strict file bounds (100B–50MB), MIME allowlist, binary magic byte verification, opaque object keys, and fail-closed download gating for quarantined or unscanned files. Never exposes absolute filesystem paths or stores payloads in `public/`.
3. **Editorial Login Redesign (Section C)**: Replaced generic AI SaaS styling with a warm paper (`#fbfaf8`), deep ink (`#16191f`), and stone rule aesthetic inspired by professional forensic audits. Features a structured audit engagement ledger (`TLI-DPDP-AUDIT-PLATFORM`, statutory perimeter, RLS isolation notice) while retaining secure session creation, rate limiting, and dev persona fixtures.
4. **Validation & Verification (Section D)**: Added 19 new automated tests (`tests/questionnaire_and_storage.test.ts`), bringing total passing test suite count to **46 tests across 7 test suites**. Completed full Next.js production build (`npm run build`) with zero linting or type errors, and verified clean `git diff --check`.

---

## 2. Architectural Deliverables

### 2.1 Canonical Questionnaire & Section Invariant Engine
- **Files**: `lib/questionnaire/types.ts`, `lib/questionnaire/data.ts`
- **Domain Partitioning**: All 30 canonical controls are grouped into the 13 canonical database domains:
  1. `NOTICE_TRANSPARENCY` (4 controls, $W_D = 1.25$)
  2. `LEGITIMATE_USES` (3 controls, $W_D = 1.00$)
  3. `CONSENT_MANAGEMENT` (3 controls, $W_D = 1.25$)
  4. `FIDUCIARY_DUTIES` (2 controls, $W_D = 1.00$)
  5. `PROCESSOR_OVERSIGHT` (1 control, $W_D = 1.00$)
  6. `SECURITY_SAFEGUARDS` (2 controls, $W_D = 1.50$)
  7. `BREACH_READINESS` (2 controls, $W_D = 1.50$)
  8. `RETENTION_ERASURE` (2 controls, $W_D = 1.00$)
  9. `DATA_PRINCIPAL_RIGHTS` (4 controls, $W_D = 1.25$)
  10. `CHILDREN_DISABLED_DATA` (2 controls, $W_D = 1.25$)
  11. `SDF_GOVERNANCE` (2 controls, $W_D = 1.25$)
  12. `CROSS_BORDER_TRANSFERS` (2 controls, $W_D = 1.00$)
  13. `PENALTY_READINESS` (1 control, $W_D = 1.00$)
- **Invariant Guarantee**: Each section contains between 1 and 4 questions ($\le 4$). A runtime assertion strictly throws if any section ever exceeds 4 questions.
- **Multiple Choice Response Schema**:
  - `FULLY_IMPLEMENTED`: Verified operational safeguards, automated controls, and documented RoPA procedures actively enforced (Maturity Score: 4/5, Weight: 1.0).
  - `PARTIALLY_IMPLEMENTED`: Controls and procedures formally defined; operational gaps exist (Maturity Score: 2/5, Weight: 0.5).
  - `PLANNED_AD_HOC`: Initial planning or ad-hoc measures exist; formal governance not operational (Maturity Score: 1/5, Weight: 0.25).
  - `ABSENT`: No technical safeguards or policies exist (Maturity Score: 0/5, Weight: 0.0).
  - `PROPOSE_EXCLUSION`: Requires mandatory exemption justification; does not mark control as compliant; subject to TLI consultant approval under DEC-01 / DEC-08.

### 2.2 Local Disk Evidence Vault & Defense-in-Depth
- **Files**: `lib/storage/validation.ts`, `lib/storage/local_adapter.ts`, `lib/storage/service.ts`, `app/api/evidence/upload/route.ts`, `app/api/evidence/[id]/download/route.ts`
- **Vault Location**: Outside web root (`.local_evidence/` in repository root, ignored in `.gitignore`, customizable via `DPDP_LOCAL_EVIDENCE_DIR`). Initialization strictly fails if configured inside `public/`.
- **Validation Pipeline**:
  - Strict size bounds: 100 bytes minimum to 50 MB maximum.
  - Allowed MIME types: PDF, DOCX, XLSX, PNG, JPEG.
  - Binary magic byte validation: `%PDF-`, `\x89PNG\r\n\x1a\n`, `\xff\xd8\xff`, `PK\x03\x04`.
  - Dangerous signature blocking: Windows PE executables (`MZ`), Linux ELF (`\x7fELF`), HTML XSS vectors (`<!DOCTYPE html`, `<html`), SVG (`<svg`), XML (`<?xml`), shell scripts (`#!/`).
  - Filename sanitization: Strips directory traversal (`../`, `..\\`), control chars, null bytes; truncates base to 80 chars.
  - Opaque storage key: `tenants/{tenantId}/assessments/{assessmentId}/controls/{controlCode}/{evidenceId}.bin`.
- **Download Security**:
  - Content served with `Content-Disposition: attachment; filename="..."`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-cache, no-store`.
  - Fail-closed download gate: Files in `QUARANTINED`, `PENDING_SCAN`, or `PENDING_UPLOAD` status reject download requests with `403 Forbidden`.
  - Multi-tenant isolation: Cross-tenant download attempts are rejected with `403 Forbidden` unless authorized under `TLI_SUPER_ADMIN` or TLI Consultant roles.

### 2.3 Editorial Design Redesign
- **Files**: `app/login/page.tsx`
- **Visual Identity**:
  - Warm paper/ivory background (`#fbfaf8`, `#f6f4ee`).
  - Deep ink charcoal typography (`#16191f`, `text-stone-900`, `text-stone-800`).
  - Fine stone borders and structured rules (`border-stone-200`, `border-stone-300`).
  - Formal forensic engagement ledger panel (`TLI-DPDP-AUDIT-PLATFORM`, statutory base, classification, active RLS).
  - Clean dev persona helper preserved exclusively for development environments (`process.env.NODE_ENV !== "production"`).

### 2.4 Interactive Questionnaire User Interface
- **Files**:
  - `components/questionnaire/QuestionCard.tsx`: MCQ selector, statutory citation header, prominent question prompt, exclusion proposal box, explanatory notes textarea, and real evidence vault upload dropzone.
  - `components/questionnaire/SectionNavigator.tsx`: 13-section domain stepper showing per-section question counts and completion checks.
  - `components/questionnaire/ReviewStep.tsx`: Comprehensive pre-submission review showing progress metrics, unanswered question jump links, proposed exclusions list, and consultant handoff notice.
  - `components/questionnaire/QuestionnaireClient.tsx`: Client-side questionnaire coordinator with local progress auto-saving.
  - `app/dashboard/assessments/[id]/questionnaire/page.tsx`: Dynamic server page fetching assessment context under PostgreSQL RLS.
  - `app/dashboard/assessments/page.tsx`: Integrated "Open Questionnaire" action links on assessment cards.

---

## 3. Test & Verification Results

### 3.1 Automated Test Suite (`npm test`)
Ran 46 tests across 7 test suites via `node --experimental-strip-types --test tests/**/*.test.ts`:
- `Phase 3C: Authentication & Session Tests`: 11 tests passed.
- `Phase 3C: RBAC Matrix & Role Permissions`: 5 tests passed.
- `Phase 3C: Database RLS & Multi-Tenant Kernel Isolation`: 11 tests passed.
- `Phase 3D.UI.1: Questionnaire Structure & Domain Constraints`: 5 tests passed.
- `Phase 3D.UI.1: File Validation Engine & Defense-in-Depth`: 6 tests passed.
- `Phase 3D.UI.1: Local Storage Adapter & Filesystem Vault`: 4 tests passed.
- `Phase 3D.UI.1: Multi-Tenant Access & Quarantine Download Gate`: 4 tests passed.
- **Result**: **46 passed, 0 failed, 0 skipped**.

### 3.2 Production Application Build (`npm run build`)
- Next.js 15.5.27 compiled successfully.
- TypeScript validity checked with zero errors.
- 12 static and dynamic routes generated successfully.
- Zero webpack or client/server boundary errors.

### 3.3 Static Git Check (`git diff --check`)
- Verified zero whitespace, line ending, or trailing space errors.
- No database migrations created.
- No automatic git commits executed. Working tree clean and ready for user inspection.

