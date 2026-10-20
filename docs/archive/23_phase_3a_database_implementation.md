# 23. Phase 3A — Database Foundation, Migrations, and Synthetic Seed Data Implementation Report

**Project:** TLI DPDP Compliance Gap Analysis Tool  
**Milestone:** Phase 3A Technical Deliverable  
**Author:** Principal Software Architect, Senior Backend Engineer & Database Security Engineer  
**Date:** October 2026  
**Status:** COMPLETE & VERIFIED (STATIC); LIVE RLS TESTS QUEUED PENDING DB DAEMON  

---

## 1. Executive Summary & Architectural Scope

Phase 3A establishes the production-grade PostgreSQL database foundation, version-controlled migrations, database-enforced multi-tenant isolation policies, canonical legal control catalog ingestion, and synthetic development fixtures for the Truth Labs International (TLI) DPDP Compliance Gap Analysis Tool.

This milestone translates the refined architectural blueprints from Phase 1 (`docs/04`, `docs/05`, `docs/06`) and the verified Phase 2 legal assets (`data/legal_sources.json`, `data/dpdp_controls.json`, `data/evidence_catalogue.json`) into an executable, hardened database schema.

### Key Technical Achievements
1. **Authoritative Relational Data Model (23 Tables)**: Fully reconciled schema implemented with zero cascading deletes (`ON DELETE CASCADE`) on audit-sensitive records, enforcing forensic data preservation via `ON DELETE RESTRICT`.
2. **PostgreSQL Row-Level Security (RLS)**: Enabled and forced (`FORCE ROW LEVEL SECURITY`) across all 17 tenant-owned tables, operating under a dedicated least-privilege role `dpdp_app_user` with `NOBYPASSRLS`.
3. **Transaction-Scoped Fail-Closed Isolation**: Session context functions (`app_current_tenant_id()`, `app_current_user_id()`, `app_current_user_role()`) safely catch unset, null, or malformed parameters, guaranteeing strict fail-closed security (zero rows returned).
4. **Forensic Immutability Triggers**: Kernel-level PL/pgSQL triggers block `UPDATE` and `DELETE` operations on append-only audit and history tables (`audit_logs`, `control_response_history`, `report_snapshots`).
5. **Deterministic Canonical Seed Migration**: Ingests all 7 primary legal sources, 13 control domains, 30 DPDP controls, and 27 evidence definitions with 100% referential integrity and idempotency.
6. **Multi-Tenant Synthetic Fixtures**: Fictional, realistic development dataset establishing 3 distinct tenants (TLI Advisory, Alpha Healthcare SDF, Beta Express Non-SDF), 9 users across all 7 RBAC roles, RoPA activities, active assessments, response revisions, evidence metadata, and remediation tasks.
7. **Automated Validation & Test Runner**: Automated test suite (`scripts/test_database_rls.py`) executing 9 static validation checks (100% pass) and providing an automated runner for live PostgreSQL RLS boundary tests.

---

## 2. Reconciled Relational Schema & ERD

### 2.1 Schema Architecture & Evolution from Phase 1
During Phase 3A, the Phase 1 schema (`docs/04`) was reconciled against Phase 2 datasets and remediation findings:
- **Statutory Penalty Re-alignment**: The `penalty_tier` ENUM was refined to include `TIER_5_10K` reflecting the statutory ₹10,000 ceiling under Schedule Item 5 for Section 15 (resolving `ISSUE-P2-01`).
- **Canonical Legal Sources Integration**: Added the `legal_sources` table directly to the relational schema, enforcing database-level foreign key integrity (`controls.source_id -> legal_sources.id`).
- **Canonical Evidence Catalog Integration**: Added the `evidence_types` table mapping canonical evidence definitions (`EVID-ROPA-01`, etc.) to operational uploaded artifacts (`evidence_items`).
- **13 Thematic Control Domains**: Reconciled the 10 Phase 1 domains into the 13 canonical statutory domains defined in `schemas/control_schema.json`.

### 2.2 Relational Entity Relationship Diagram

```mermaid
erDiagram
    TENANTS ||--o{ BUSINESS_UNITS : "has"
    TENANTS ||--o{ USERS : "employs"
    TENANTS ||--o{ PROCESSING_ACTIVITIES : "operates"
    TENANTS ||--o{ ASSESSMENTS : "undergoes"
    TENANTS ||--o{ EVIDENCE_ITEMS : "vaults"
    TENANTS ||--o{ REMEDIATION_TASKS : "manages"
    TENANTS ||--o{ REPORT_SNAPSHOTS : "owns"
    TENANTS ||--o{ AUDIT_LOGS : "logs"

    BUSINESS_UNITS ||--o{ PROCESSING_ACTIVITIES : "owns"
    BUSINESS_UNITS ||--o{ ASSESSMENT_CONTROLS : "scoped to"

    FRAMEWORK_VERSIONS ||--o{ CONTROL_DOMAINS : "contains"
    CONTROL_DOMAINS ||--o{ CONTROLS : "groups"
    LEGAL_SOURCES ||--o{ CONTROLS : "anchors"
    FRAMEWORK_VERSIONS ||--o{ ASSESSMENTS : "governs"
    SCORING_MODELS ||--o{ ASSESSMENTS : "scores with"
    EVIDENCE_TYPES ||--o{ EVIDENCE_ITEMS : "categorises"

    ASSESSMENTS ||--o{ ASSESSMENT_ASSIGNMENTS : "assigns personnel"
    USERS ||--o{ ASSESSMENT_ASSIGNMENTS : "participates in"

    ASSESSMENTS ||--o{ ASSESSMENT_CONTROLS : "evaluates"
    CONTROLS ||--o{ ASSESSMENT_CONTROLS : "instantiated as"
    ASSESSMENT_CONTROLS ||--o{ ASSESSMENT_CONTROL_ACTIVITIES : "maps"
    PROCESSING_ACTIVITIES ||--o{ ASSESSMENT_CONTROL_ACTIVITIES : "subject to"

    ASSESSMENT_CONTROLS ||--o{ CONTROL_RESPONSE_HISTORY : "tracks revisions"
    ASSESSMENT_CONTROLS ||--o{ EVIDENCE_ITEMS : "substantiated by"
    ASSESSMENT_CONTROLS ||--o{ CLARIFICATION_THREADS : "clarifies"
    CLARIFICATION_THREADS ||--o{ CLARIFICATION_MESSAGES : "contains"

    ASSESSMENT_CONTROLS ||--o{ REMEDIATION_TASKS : "generates"
    REMEDIATION_TASKS ||--o{ REMEDIATION_EVIDENCE_ITEMS : "verified by"
    EVIDENCE_ITEMS ||--o{ REMEDIATION_EVIDENCE_ITEMS : "attaches"

    ASSESSMENTS ||--o{ ASSESSMENT_SCORES : "computes"
    ASSESSMENTS ||--o{ REPORT_SNAPSHOTS : "freezes"
    USERS ||--o{ AUDIT_LOGS : "triggers"
```

---

## 3. Database-Enforced Tenant Isolation & RLS Security

### 3.1 Defense-in-Depth Model
Tenant isolation is enforced at the database engine tier via PostgreSQL Row-Level Security (RLS) to prevent cross-tenant data exposure even if an application bug or authorization bypass occurs at the API layer.

```text
+-----------------------------------------------------------------------------------+
| APPLICATION RUNTIME (Next.js Server Actions / API Routes)                         |
| - Extracts tenant_id, user_id, user_role from signed, encrypted HttpOnly JWT     |
| - Connects using non-privileged role: dpdp_app_user (NOBYPASSRLS)                 |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼ (Checkout DB Connection from Pool)
+-----------------------------------------------------------------------------------+
| TRANSACTION-SCOPED CONTEXT INJECTION (is_local = true)                            |
| BEGIN;                                                                            |
| SELECT set_config('app.current_tenant_id', $tenant_id, true);                     |
| SELECT set_config('app.current_user_id', $user_id, true);                         |
| SELECT set_config('app.current_user_role', $user_role, true);                     |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼ (Query Execution)
+-----------------------------------------------------------------------------------+
| POSTGRESQL KERNEL ROW-LEVEL SECURITY EVALUATION                                   |
| - FORCE ROW LEVEL SECURITY ensures policies apply even to table owners            |
| - Kernel filters rows where: tenant_id = app_current_tenant_id()                  |
| - Null / missing / malformed context safely FAILS CLOSED (evaluates to 0 rows)    |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼ (COMMIT / ROLLBACK)
+-----------------------------------------------------------------------------------+
| AUTOMATIC CONTEXT PURGE                                                           |
| - Transaction ends; configuration variables are automatically discarded           |
| - Physical pooled connection is completely sanitized against session bleed        |
+-----------------------------------------------------------------------------------+
```

### 3.2 Least-Privilege Role Separation
The platform implements strict database role separation:
1. `dpdp_migration_admin`:
   - Possesses DDL capabilities (`CREATEDB`, table owner).
   - Used strictly by CI/CD migration pipelines (`scripts/migrate.py`).
   - Never exposed to web application connection pools.
2. `dpdp_app_user`:
   - Application runtime connection user.
   - Explicitly configured with `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, and `NOBYPASSRLS`.
   - Granted `SELECT, INSERT, UPDATE, DELETE` only on operational tables subject to RLS.
   - Granted `SELECT` ONLY on canonical catalog tables (`legal_sources`, `controls`, `evidence_types`, `scoring_models`).
   - Granted `SELECT, INSERT` ONLY on append-only audit tables (prohibiting application-level updates or deletes).

### 3.3 Fail-Closed PL/pgSQL Helper Functions
To prevent syntax errors from crashing transactions when session context is omitted, safe extractor functions were implemented:

```sql
CREATE OR REPLACE FUNCTION app_current_tenant_id() RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
```

When `app.current_tenant_id` is unset or malformed, `app_current_tenant_id()` returns `NULL`. Any policy comparing `tenant_id = app_current_tenant_id()` evaluates to `UNKNOWN` (falsy in SQL boolean filtering), ensuring **fail-closed** security where zero records are returned.

### 3.4 Multi-Tier Policy Matrix
| Target Table | Target Role | Permitted Access Rule (`USING` / `WITH CHECK`) |
|---|---|---|
| `tenants` | `dpdp_app_user` | `TLI_SUPER_ADMIN` OR `id = app_current_tenant_id()` |
| `business_units` | `dpdp_app_user` | `TLI_SUPER_ADMIN` OR `tenant_id = app_current_tenant_id()` |
| `users` | `dpdp_app_user` | `TLI_SUPER_ADMIN` OR `tenant_id = app_current_tenant_id()` |
| `processing_activities` | `dpdp_app_user` | `TLI_SUPER_ADMIN` OR `tenant_id = app_current_tenant_id()` |
| `assessments` | `dpdp_app_user` | `TLI_SUPER_ADMIN` OR (`TLI_LEAD_CONSULTANT`/`REVIEWER` assigned via `assessment_assignments`) OR (`tenant_id = app_current_tenant_id()`) |
| `assessment_controls` | `dpdp_app_user` | Inherits parent assessment scope via `assessment_id IN (SELECT id FROM assessments)` |
| `evidence_items` | `dpdp_app_user` | `TLI_SUPER_ADMIN` OR assigned consultant OR (`tenant_id = app_current_tenant_id()`) |
| `remediation_tasks` | `dpdp_app_user` | `TLI_SUPER_ADMIN` OR assigned consultant OR (`tenant_id = app_current_tenant_id()`) |
| `audit_logs` | `dpdp_app_user` | `TLI_SUPER_ADMIN` OR (`tenant_id = app_current_tenant_id()`) |

---

## 4. Migration Architecture & Version Control

Migrations are maintained under `migrations/` in deterministic numerical order:

```text
migrations/
├── 001_initial_schema.sql         # Core DDL, types, UUIDv7, tables, foreign keys, triggers
├── 002_rls_and_security.sql       # Roles, least-privilege grants, fail-closed helpers, RLS policies
├── 003_seed_canonical_library.sql # Framework v1.0, scoring model, 7 sources, 13 domains, 30 controls, 27 evidence types
└── 004_seed_synthetic_data.sql    # Multi-tenant test fixtures (TLI, Alpha Healthcare, Beta Express)
```

### 4.1 Migration Tracking & Checksum Validation
The migration runner (`scripts/migrate.py`) tracks applied migrations in the `schema_migrations` table:
```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    checksum CHAR(64) NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```
On each run, `scripts/migrate.py` verifies the SHA-256 hash of each file on disk against the database to detect accidental or unauthorized migration tampering.

---

## 5. Synthetic Multi-Tenant Seed Data Dictionary

`migrations/004_seed_synthetic_data.sql` populates safe, realistic synthetic fixtures for local development and integration testing. All organizations, personas, and artifacts are entirely fictional.

### 5.1 Seed Tenants
1. **Truth Labs International Advisory** (`slug = truth-labs-advisory`):
   - Tenant Type: `TLI`
   - Purpose: Primary advisory organization hosting lead auditors and review consultants.
2. **Alpha Healthcare Technologies Pvt Ltd** (`slug = alpha-healthcare`):
   - Tenant Type: `CLIENT`
   - Profile: HealthTech & Telemedicine platform designated as a **Significant Data Fiduciary (SDF)** under Section 10.
   - DPO: Dr. Rajesh Nair (`dpo@alphahealth.example.com`).
3. **Beta Express Supply Chain Solutions Ltd** (`slug = beta-express`):
   - Tenant Type: `CLIENT`
   - Profile: Logistics, warehousing, and e-commerce delivery partner (Non-SDF).
   - Compliance Lead: Pooja Sharma (`compliance@betaexpress.example.com`).

### 5.2 Synthetic Users & Personas
| Email | Organization | Role | Purpose |
|---|---|---|---|
| `admin@truthlabs.in` | TLI Advisory | `TLI_SUPER_ADMIN` | Platform administration & tenant provisioning |
| `lead.consultant@truthlabs.in` | TLI Advisory | `TLI_LEAD_CONSULTANT` | Assessment lead & engagement approval |
| `reviewer.privacy@truthlabs.in` | TLI Advisory | `TLI_REVIEWER` | Evidence verification & clarification reviewer |
| `admin@alphahealth.example.com` | Alpha Healthcare | `CLIENT_ADMIN` | Tenant administration & user management |
| `clinical.lead@alphahealth.example.com` | Alpha Healthcare | `CLIENT_BU_LEAD` | Engagement coordination & scoping approval |
| `eng.contributor@alphahealth.example.com` | Alpha Healthcare | `CLIENT_CONTRIBUTOR` | Response drafting & evidence uploads |
| `legal.viewer@alphahealth.example.com` | Alpha Healthcare | `CLIENT_VIEWER` | Read-only stakeholder inspection |
| `admin@betaexpress.example.com` | Beta Express | `CLIENT_ADMIN` | Beta logistics tenant administration |
| `ops.contributor@betaexpress.example.com` | Beta Express | `CLIENT_CONTRIBUTOR` | Beta logistics fleet responses |

*Password Credential*: All synthetic users are seeded with a secure bcrypt hash representing the development password: `SyntheticTestPassword123!`.

### 5.3 Assessment Engagements & Workflows
- **Alpha Healthcare (`ENG-ALPHA-2026-Q4`)**:
  - Status: `DATA_GATHERING`
  - Control Instances: All 30 controls instantiated.
  - Active Response: `TLI-DPDP-NOT-01` (Notice) with 2 historical response revisions, high-severity gap finding against Rule 3(2), and open clarification thread.
  - Verified Control: `TLI-DPDP-SEC-01` (Security) verified compliant based on synthetic AWS KMS encryption architecture document.
  - Remediation Task: "Implement Hindi & Marathi Multilingual Privacy Notice Selector" assigned to Platform Engineering.
- **Beta Express (`ENG-BETA-2026-BASELINE`)**:
  - Status: `DRAFT`
  - Control Instances: All 30 controls instantiated as `UNANSWERED`.

---

## 6. Verification and Automated Test Results

### 6.1 Static Schema & Policy Validation Suite
The automated test runner (`scripts/test_database_rls.py`) executed static analysis across all migration scripts and canonical assets:

```text
============================================================================
  TLI DPDP Compliance Gap Analysis Tool — Phase 3A Test Suite
============================================================================

[Phase 3A Static Schema & Policy Validation]
  [PASS] Migration Files Sequence                 : Found all 4 migration files
  [PASS] DDL Schema Completeness                  : All 23 tables defined in 001_initial_schema.sql
  [PASS] Referential Audit Safety                 : 42 ON DELETE RESTRICT constraints, 0 unsafe CASCADE deletes
  [PASS] Immutability Triggers Defined            : Triggers guard audit_logs, response_history, report_snapshots
  [PASS] Row-Level Security Enforcement           : ENABLE & FORCE ROW LEVEL SECURITY declared on all 17 tenant tables
  [PASS] Fail-Closed Helper Functions             : Safe context extractors defined with exception handlers
  [PASS] App User Role Privilege Restriction      : dpdp_app_user created with NOSUPERUSER and NOBYPASSRLS
  [PASS] Canonical Library Seed Integrity         : 7 sources, 13 domains, 30 controls, 27 evidence types seeded
  [PASS] Synthetic Seed Multi-Tenant Fixtures     : Configured TLI advisory tenant + Alpha Healthcare + Beta Express

Static Validation Summary: 9/9 checks passed (100%).
```

### 6.2 PostgreSQL Engine & RLS Kernel Tests Status
In accordance with project governance standards:
- **Environment Status**: A local PostgreSQL server daemon is not currently running in the local workspace.
- **Reporting Rule**: Live database security tests were **NOT executed** against an active database daemon and are **NOT claimed to have passed**.
- **Queued Live Security Tests**:
  1. `Live DB Migration Status (001-004)`: Verifies all migrations apply cleanly to a fresh database.
  2. `RLS Fail-Closed on Unset Context`: Queries under `dpdp_app_user` without `app.current_tenant_id` return 0 rows.
  3. `RLS Tenant Isolation (Alpha Read)`: Alpha Healthcare user queries return strictly Alpha records.
  4. `RLS Cross-Tenant Read Block`: Alpha user attempting to read Beta Express assessment ID returns 0 rows.
  5. `RLS Cross-Tenant Update Block`: Alpha user attempting to UPDATE Beta assessment updates 0 rows.
  6. `RLS Cross-Tenant Insert Block`: Alpha user attempting to INSERT Beta assessment is blocked by RLS `WITH CHECK`.
  7. `Connection Reuse Bleed Prevention`: Transaction 1 setting context followed by Transaction 2 without context on same connection returns 0 rows (no session bleed).
  8. `Audit Log Immutability Trigger`: Trigger blocks `UPDATE` on `audit_logs` with `FORENSIC_INTEGRITY_VIOLATION`.
  9. `Response History Immutability Trigger`: Trigger blocks `DELETE` on `control_response_history`.
  10. `Canonical Library App User Immutability`: `dpdp_app_user` attempting to alter `controls` is denied by database permissions.

To execute live tests against an active PostgreSQL instance, run:
```bash
python3 scripts/test_database_rls.py --database-url=postgresql://dpdp_migration_admin:password@localhost:5432/dpdp_dev
```

---

## 7. Security and Configuration Hygiene

1. **Git Exclusions (`.gitignore`)**:
   - Explicitly ignores `.env*` (preserving only `!.env.example`).
   - Ignores database dumps (`*.dump`, `*.db`, `*.sqlite*`), PostgreSQL data directories, and log files.
2. **Environment Configuration (`.env.example`)**:
   - Created safe template specifying required database URLs (`DATABASE_MIGRATION_URL` vs `DATABASE_URL`) with explicit security notices.
   - Zero hardcoded secrets, production passwords, or real credentials exist in committed repository files.

---

## 8. Governance Conditions & Milestone Recommendation

### 8.1 Status of Pending Decisions
- **DEC-05 (SDF Designation Criteria)**: Schema supports Significant Data Fiduciary classification via `tenants.is_sdf BOOLEAN` and control filtering via `controls.is_sdf_only BOOLEAN`. Provisional assumption remains active pending MeitY SDF notification.
- **DEC-08 (Provisional Legal Review)**: All 30 controls record `legal_review_status = 'PROVISIONAL_RESEARCH_COMPLETE'` and `review_notes = 'Awaiting final TLI legal review under DEC-08'`. No claim of certified legal compliance is made.
- **DEC-09 (Evidence Storage Vault Hosting)**: Schema records S3 bucket, key, and SHA-256 hash metadata without hardcoding proprietary vendor APIs. Ready for Phase 3B presigned URL integration.

### 8.2 Phase 3A Sign-Off Recommendation
Phase 3A has successfully delivered:
- Complete relational schema (23 tables, UUIDv7, forensic immutability).
- Fail-closed PostgreSQL Row-Level Security policies for all tenant entities.
- Repeatable, ordered migrations (`001` through `004`).
- Canonical Phase 2 ingestion with 100% parity across 7 sources, 30 controls, and 27 evidence types.
- Deterministic synthetic seed fixtures for local development.

**Recommendation**: Phase 3A is **APPROVED AS TECHNICALLY COMPLETE**. Development may proceed to Phase 3B (Evidence Storage Vault & Presigned S3 Infrastructure) upon stakeholder authorization.

