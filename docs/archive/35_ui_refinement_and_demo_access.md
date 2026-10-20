# Document 35: UI Refinement, Demo Authentication & Compliance Reports Specification

**Project**: TLI DPDP Compliance Gap Analysis Tool  
**Phase**: Phase 3D.UI Refinement & Demo Access  
**Author**: Truth Labs International Implementation Team  
**Status**: Completed & Verified  
**Date**: October 11, 2026  

---

## 1. Executive Summary

This milestone establishes a restrained, professional consulting interface, dedicated non-production demo access (`consultant.demo@tli.local` and `customer.demo@tli.local`), functional questionnaire navigation, and document-oriented compliance report previews.

All design, security, and tenant isolation constraints have been verified against the live PostgreSQL database:
- **50 automated tests passing** across 8 test suites.
- **Next.js production build** passed with zero type or lint errors.
- **Zero database migrations** created (existing database schema preserved intact).
- **Working tree unstaged and uncommitted** for review.

---

## 2. Demo Authentication & Persona Access

### 2.1 Demo Accounts & Roles

| Account | Target Persona | Role | Tenant Scope | Purpose |
|---|---|---|---|---|
| `consultant.demo@tli.local` | TLI Advisory Lead Consultant | `TLI_LEAD_CONSULTANT` | Truth Labs International (Advisory) | Cross-tenant evaluation, gap scoring, exclusion review under DEC-01. |
| `customer.demo@tli.local` | Alpha Healthcare Client Admin | `CLIENT_ADMIN` | Alpha Healthcare Technologies (SDF Client) | Tenant assessment management, questionnaire completion, evidence submission. |

### 2.2 Local Setup Command & Password Configuration

1. **Local Setup Command**:
   To seed or verify the demo accounts in the local PostgreSQL database:
   ```bash
   npm run seed:demo
   # or directly:
   python3 scripts/seed_demo_users.py
   ```
   *Note: If testing without a live database, the Next.js login endpoint includes non-production fallback alias resolution mapped to the canonical synthetic seed personas.*

2. **Configuring the Demo Password**:
   The password can be customized locally in `.env.local` or via environment variable:
   ```bash
   export DEMO_USER_PASSWORD="YourCustomLocalPassword123!"
   ```
   If `DEMO_USER_PASSWORD` is not set, it defaults in non-production environments to the canonical synthetic test password:
   ```text
   SyntheticTestPassword123!
   ```

3. **Strict Production Lockout**:
   - In production mode (`NODE_ENV=production`), `verifyPassword` unconditionally rejects both `SYNTHETIC_SEED_HASH` and `DEMO_USER_PASSWORD`.
   - The quick-fill demo buttons on the login page are wrapped in `process.env.NODE_ENV !== "production"` and completely tree-shaken in production builds.

---

## 3. URLs & Navigation Guide

| Module | URL | Description |
|---|---|---|
| **Login Portal** | `/login` | Restrained consulting login with one-click demo credentials helper (dev mode only). |
| **Workspace Overview** | `/dashboard` | High-level compliance stats, quick links to active questionnaire and reports. |
| **Assessments List** | `/dashboard/assessments` | Tenant assessments list with direct links to "Open Questionnaire" and "View Report". |
| **DPDP Questionnaire** | `/dashboard/assessments/[id]/questionnaire` | 13 canonical sections, strictly $\le 4$ questions per section, local vault evidence attachment. |
| **Compliance Reports List** | `/dashboard/reports` | List of reports accessible under RLS (Consultants see all clients; Customers see only their tenant). |
| **Compliance Report Preview** | `/dashboard/reports/[id]` | Document-oriented evaluation report showing scope, findings, limitations, and remediation. |

---

## 4. Feature Matrix: Functional vs. Preview

| Action / Capability | Status | Implementation Details |
|---|:---:|---|
| **User Authentication & JWT Issuance** | **FUNCTIONAL** | Real `jose` token signing with `issuer`, `audience`, rate limiting, and HTTP-only cookie. |
| **PostgreSQL RLS Tenant Isolation** | **FUNCTIONAL** | Enforced at database kernel via `SET LOCAL app.current_tenant_id`. |
| **Questionnaire Pagination & Invariant** | **FUNCTIONAL** | Strictly $\le 4$ questions per section across all 13 canonical domains (30 controls total). |
| **MCQ Selection & Progress Tracking** | **FUNCTIONAL** | Real in-memory state tracking, answered vs. unanswered metrics, and auto-save indicators. |
| **Evidence Attachment & Local Vault** | **FUNCTIONAL** | Real binary writing to `.local_evidence/`, magic-byte checks, SHA-256 calculation, and fail-closed quarantine download gate. |
| **Evidence Download Gate** | **FUNCTIONAL** | Real binary streaming with `Content-Disposition: attachment`, blocking quarantined files with 403. |
| **Compliance Report Document View** | **PREVIEW** | Document-oriented layout detailing scope, 13 domain findings, evidence limitations, and remediation. |
| **Consultant Final Sign-off / Issuance** | **PREVIEW / BLOCKED** | Customer roles are strictly blocked from finalizing reports; consultant scoring is labeled as provisional pending DEC-01 / DEC-08 approval. |

---

## 5. Verification Test Results

Executed test suite via `npm test` (`node --experimental-strip-types --test tests/**/*.test.ts`):
- `Phase 3C: Authentication & Session Tests`: 11 passed.
- `Phase 3C: RBAC Matrix & Role Permissions`: 5 passed.
- `Phase 3D: Demo Authentication & Tenant Scoping Tests`: 4 passed.
- `Phase 3D.UI.1: Questionnaire Structure & Domain Constraints`: 5 passed.
- `Phase 3D.UI.1: File Validation Engine & Defense-in-Depth`: 6 passed.
- `Phase 3D.UI.1: Local Storage Adapter & Filesystem Vault`: 4 passed.
- `Phase 3D.UI.1: Multi-Tenant Access & Quarantine Download Gate`: 4 passed.
- `Phase 3C: Database RLS & Multi-Tenant Kernel Isolation`: 11 passed.
- **Total: 50 passed, 0 failed, 0 skipped**.

Next.js production build (`npm run build`):
- Compiled 12 static and dynamic routes successfully with zero TypeScript or webpack errors.

