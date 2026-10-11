# 24. Phase 3A.1 — Live PostgreSQL Security Verification Report

**Project:** TLI DPDP Compliance Gap Analysis Tool  
**Milestone:** Phase 3A.1 Live Database Security & RLS Verification  
**Author:** Principal Software Architect, Application Security Engineer & Database Architect  
**Date:** October 2026  
**Status:** COMPLETED & VERIFIED — VERDICT: PASS  

---

## 1. Executive Summary & Verification Context

Following the completion of Phase 3A static migrations and schema definitions, this milestone established a safe, disposable local PostgreSQL 18.6 test environment to execute live integration, migration idempotency, and kernel-level Row-Level Security (RLS) boundary tests.

### Verification Outcome Summary
- **Target Database Engine**: PostgreSQL 18.6 (x86_64, conda-forge gcc 15.3.0-7).
- **Target Database Environment**: Dedicated, isolated local user-space cluster (`/tmp/dpdp_test_cluster`, port 54329, database `dpdp_test`).
- **Target Verification**: 100% disposable test database; zero production or shared TLI systems were touched.
- **Migration Execution**: 4/4 migrations applied cleanly, verified against SHA-256 checksums, and proven idempotent.
- **Live Security Tests Executed**: 17 distinct automated test scenarios executed under the unprivileged runtime role `dpdp_app_user`.
- **Live Security Test Results**: **17/17 PASSED (100% Success Rate)**.
- **Static Schema & Policy Validation**: **9/9 PASSED (100% Success Rate)**.
- **Phase 2 Canonical Data Audit**: **100% PASSED**.
- **Final Verdict**: **PASS**.

---

## 2. Test Environment & Database Identity Verification

To adhere strictly to project safety mandates, an isolated, disposable PostgreSQL cluster was created and verified:

```text
Cluster Path:     /tmp/dpdp_test_cluster
Port:             54329 (Localhost unprivileged)
Socket Dir:       /tmp/dpdp_test_cluster
Database Name:    dpdp_test
PostgreSQL Ver:   PostgreSQL 18.6 on x86_64-conda-linux-gnu
Connection URL:   postgresql://postgres@127.0.0.1:54329/dpdp_test
Target Status:    VERIFIED DISPOSABLE (Isolated local development cluster)
```

Before migration execution, the connection was verified via `SELECT version();` confirming a fresh PostgreSQL 18.6 engine.

---

## 3. Pre-Application SQL Review & Root Cause Remediation

Before and during execution against the real PostgreSQL kernel, the SQL was reviewed for edge cases, resulting in three significant security and correctness fixes:

### 3.1 Issue 1: Search-Path Hijacking Defense in Privileged Functions
- **Vulnerability Identified**: The context-extraction helper functions (`app_current_tenant_id()`, `app_current_user_id()`, `app_current_user_role()`) were declared as `SECURITY DEFINER` without an explicit `search_path`. In PostgreSQL, a malicious user creating objects in a public or temporary schema can exploit this to execute arbitrary code with function-owner privileges.
- **Root Cause Remediation**: Added `SET search_path = pg_catalog, public` to all `SECURITY DEFINER` functions in [`migrations/002_rls_and_security.sql`](file:///home/charan/Documents/DPDP%20Tool/migrations/002_rls_and_security.sql).

### 3.2 Issue 2: Foreign Key Mismatch in Assessment Assignments Seed
- **Defect Identified**: In [`migrations/004_seed_synthetic_data.sql`](file:///home/charan/Documents/DPDP%20Tool/migrations/004_seed_synthetic_data.sql), line 174 accidentally referenced the TLI platform tenant UUID (`018f3a5b-7c8d-7e90-8000-000000000001`) instead of the Alpha Healthcare assessment UUID (`018f3a5b-7c8d-7e90-8000-000000000201`), triggering `assessment_assignments_assessment_id_fkey` foreign key violation.
- **Root Cause Remediation**: Corrected the tuple to reference the valid assessment ID `018f3a5b-7c8d-7e90-8000-000000000201`.

### 3.3 Issue 3: Infinite Recursion in Mutual RLS Policies
- **Defect Identified**: Live query execution triggered:
  ```text
  ERROR: infinite recursion detected in policy for relation "assessments"
  ```
- **Root Cause Analysis**:
  - The policy on `assessments` checked: `id IN (SELECT assessment_id FROM assessment_assignments WHERE user_id = app_current_user_id())`.
  - The policy on `assessment_assignments` checked: `assessment_id IN (SELECT id FROM assessments)`.
  - When evaluating `assessments`, PostgreSQL evaluated `assessment_assignments`, which re-evaluated `assessments`, resulting in infinite policy recursion.
- **Architectural Solution**:
  Created two dedicated `SECURITY DEFINER` lookup functions in [`migrations/002_rls_and_security.sql`](file:///home/charan/Documents/DPDP%20Tool/migrations/002_rls_and_security.sql):
  1. `is_user_assigned_to_assessment(p_assessment_id UUID, p_user_id UUID)`
  2. `get_assessment_tenant_id(p_assessment_id UUID)`
  Both functions execute as the function creator with `SET search_path = pg_catalog, public`, performing fast indexed lookups without triggering recursive RLS re-evaluation. Mutual recursion is completely eliminated.

---

## 4. Migration Execution & Idempotency Results

### 4.1 Clean Migration Execution
Command:
```bash
python3 scripts/migrate.py up --database-url=postgresql://postgres@127.0.0.1:54329/dpdp_test
```
Actual Output:
```text
======================================================================
  TLI DPDP Applying Migrations
======================================================================
Applying migration: 001_initial_schema.sql ... OK
Applying migration: 002_rls_and_security.sql ... OK
Applying migration: 003_seed_canonical_library.sql ... OK
Applying migration: 004_seed_synthetic_data.sql ... OK
Successfully applied 4 migrations.
```

### 4.2 Migration Verification & Checksums
Command:
```bash
python3 scripts/migrate.py verify --database-url=postgresql://postgres@127.0.0.1:54329/dpdp_test
```
Actual Output:
```text
======================================================================
  TLI DPDP Migration Checksum Verification
======================================================================
[VERIFIED]  001_initial_schema.sql (SHA-256 match)
[VERIFIED]  002_rls_and_security.sql (SHA-256 match)
[VERIFIED]  003_seed_canonical_library.sql (SHA-256 match)
[VERIFIED]  004_seed_synthetic_data.sql (SHA-256 match)

All applied migrations match their disk checksums exactly.
```

### 4.3 Migration Idempotency Test
Re-running `python3 scripts/migrate.py up` reported:
```text
Database schema is already up to date. Zero pending migrations.
```
Direct re-execution of SQL files `003_seed_canonical_library.sql` and `004_seed_synthetic_data.sql` via `psql` succeeded with returncode 0 (`ON CONFLICT DO UPDATE` and `DO NOTHING` clauses prevented any primary key collisions or duplicate rows).

---

## 5. Live Security Test Execution & Results

The automated security test suite ([`scripts/test_database_rls.py`](file:///home/charan/Documents/DPDP%20Tool/scripts/test_database_rls.py)) was executed against `postgresql://postgres@127.0.0.1:54329/dpdp_test`. All tests were executed as the restricted `dpdp_app_user` role (with `NOBYPASSRLS`).

### 5.1 Test Results Matrix

| Test ID | Test Scenario | Execution Mode | Expected Behavior | Actual Result | Verdict |
|---|---|---|---|---|:---:|
| **L01** | Migration Status Tracking | Migration Admin | `schema_migrations` contains all 4 versions | 4 migrations tracked | **PASS** |
| **L02** | RLS Fail-Closed on Unset Context | `dpdp_app_user` | Querying `assessments` with empty context returns 0 rows | Returned `['0']` | **PASS** |
| **L03** | Tenant A Isolation (Alpha Read) | `dpdp_app_user` (Alpha) | Sees strictly Alpha Healthcare engagement | Returned `['ENG-ALPHA-2026-Q4']` | **PASS** |
| **L04** | Cross-Tenant Direct Query Block | `dpdp_app_user` (Alpha) | Querying Beta Express assessment ID returns 0 rows | Returned `['0']` | **PASS** |
| **L05** | Cross-Tenant Update Prevention | `dpdp_app_user` (Alpha) | Attempting to `UPDATE` Beta Express assessment updates 0 rows | Returned `UPDATE 0` | **PASS** |
| **L06** | Cross-Tenant Insert Block | `dpdp_app_user` (Alpha) | Inserting row with `tenant_id = Beta` is blocked by RLS | Rejected by RLS `WITH CHECK` | **PASS** |
| **L07** | Connection Reuse Bleed Prevention | `dpdp_app_user` | Transaction 1 context does not leak to Transaction 2 on same connection | Tx 1: 1 row, Tx 2: 0 rows | **PASS** |
| **L08** | Audit Log Immutability (UPDATE) | Database Superuser | Trigger blocks `UPDATE` on `audit_logs` | Blocked: `FORENSIC_INTEGRITY_VIOLATION` | **PASS** |
| **L09** | Audit Log Immutability (DELETE) | Database Superuser | Trigger blocks `DELETE` on `audit_logs` | Blocked: `FORENSIC_INTEGRITY_VIOLATION` | **PASS** |
| **L10** | Response History Immutability (DELETE) | Database Superuser | Trigger blocks `DELETE` on `control_response_history` | Blocked: `FORENSIC_INTEGRITY_VIOLATION` | **PASS** |
| **L11** | Canonical Library Immutability | `dpdp_app_user` | App user attempting to UPDATE `controls` is denied | `permission denied for table controls` | **PASS** |
| **L12** | Consultant Scoping Isolation | `dpdp_app_user` (Reviewer) | Reviewer assigned strictly to Alpha cannot view Beta | Returned `['ENG-ALPHA-2026-Q4']` | **PASS** |
| **L13** | Referential Audit Safety (RESTRICT) | Database Superuser | Deleting a tenant with active child records is blocked | Blocked: foreign key constraint RESTRICT | **PASS** |
| **L14** | Business Units Tenant Isolation | `dpdp_app_user` (Alpha) | Alpha user sees strictly Alpha business units | Returned `['BU-CLINICAL', 'BU-CORP', 'BU-ENG']` | **PASS** |
| **L15** | Processing Activities (RoPA) Isolation | `dpdp_app_user` (Alpha) | Alpha user sees strictly Alpha RoPA processing activities | Returned `['CONSENT_SECTION_6', 'EMPLOYMENT_SECTION_7_G']` | **PASS** |
| **L16** | Evidence Vault Tenant Isolation | `dpdp_app_user` (Alpha) | Alpha user sees strictly Alpha uploaded evidence files | Returned 2 Alpha evidence files | **PASS** |
| **L17** | TLI Super Admin Global Visibility | `dpdp_app_user` (Super Admin) | Super Admin sees all engagements across all tenants | Returned `['ENG-ALPHA-2026-Q4', 'ENG-BETA-2026-BASELINE']` | **PASS** |

### 5.2 Test Execution Output Log
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

Static Validation Summary: 9/9 checks passed.

============================================================================
  PostgreSQL Engine & Row-Level Security Kernel Tests
============================================================================

Connected to target PostgreSQL database: postgresql://postgres@127.0.0.1:54329/dpdp_test
  [PASS] Live DB Migration Status                 : schema_migrations present, 4 applied
  [PASS] RLS Fail-Closed (Unset Context)          : Unset context returned 0 rows (fail-closed)
  [PASS] RLS Tenant Isolation (Alpha Read)        : Alpha sees strictly own assessment: ['ENG-ALPHA-2026-Q4']
  [PASS] RLS Cross-Tenant Read Block              : Alpha query for Beta assessment ID returned 0 rows
  [PASS] RLS Cross-Tenant Update Block            : Alpha cannot UPDATE Beta Express assessment (0 rows affected)
  [PASS] RLS Cross-Tenant Insert Block            : Cross-tenant INSERT rejected by RLS WITH CHECK policy
  [PASS] Connection Reuse Bleed Prevention        : Tx 1 saw 1 assessment; subsequent reused connection without context saw 0 (no bleed)
  [PASS] Audit Log Immutability (UPDATE)          : Trigger trg_audit_logs_immutable blocked UPDATE
  [PASS] Audit Log Immutability (DELETE)          : Trigger trg_audit_logs_immutable blocked DELETE
  [PASS] Response History Immutability (DELETE)   : Trigger trg_response_history_immutable blocked DELETE
  [PASS] Canonical Library App User Immutability  : dpdp_app_user has SELECT-only permission on controls
  [PASS] Consultant Scoping Isolation (Assignment Gate) : Reviewer sees strictly assigned assessment: ['ENG-ALPHA-2026-Q4']
  [PASS] Referential Audit Safety (ON DELETE RESTRICT) : Database blocked tenant deletion with active child records
  [PASS] Business Units Tenant Isolation          : Alpha sees strictly own business units: ['BU-CLINICAL', 'BU-CORP', 'BU-ENG']
  [PASS] Processing Activities (RoPA) Tenant Isolation : Alpha sees strictly own RoPA activities: ['CONSENT_SECTION_6', 'EMPLOYMENT_SECTION_7_G']
  [PASS] Evidence Vault Tenant Isolation          : Alpha sees strictly own evidence records: 2 items
  [PASS] TLI Super Admin Global Visibility        : Super Admin sees all engagements across tenants: 2 items

Live Security Test Summary: 17/17 tests passed.

>>> ALL PHASE 3A STATIC AND LIVE DATABASE TESTS PASSED <<<
```

---

## 6. Effective Role Privileges Audit

An inspection of effective database privileges for `dpdp_app_user` confirmed:
1. `NOBYPASSRLS`: Confirmed via `pg_roles.rolbypassrls = false`. The role cannot bypass Row-Level Security under any circumstance.
2. `NOSUPERUSER`: Confirmed via `pg_roles.rolsuper = false`.
3. Canonical Table Write Prohibitions:
   `INSERT`, `UPDATE`, `DELETE` grants are withheld on `legal_sources`, `framework_versions`, `scoring_models`, `control_domains`, `controls`, and `evidence_types`. Direct write attempts trigger `ERROR: permission denied for table controls`.
4. Audit Log Write Prohibitions:
   `UPDATE` and `DELETE` grants are withheld on `audit_logs`, `control_response_history`, and `report_snapshots`. Attempts to delete trigger `ERROR: permission denied for table audit_logs`.

---

## 7. Commands Executed for Full Verification

To reproduce this verification from scratch on any clean system:

```bash
# 1. Run canonical Phase 2 integrity validator
python3 scripts/validate_phase2_data.py

# 2. Start disposable local PostgreSQL instance (if not running)
# export PATH="<postgres_bin_dir>:$PATH"
# initdb -D /tmp/dpdp_test_cluster -U postgres --auth=trust
# pg_ctl -D /tmp/dpdp_test_cluster -l /tmp/dpdp_test_cluster/postgres.log -o "-p 54329 -k /tmp/dpdp_test_cluster -h 127.0.0.1" start

# 3. Create fresh disposable database
createdb -p 54329 -h 127.0.0.1 -U postgres dpdp_test

# 4. Apply all versioned migrations
python3 scripts/migrate.py up --database-url=postgresql://postgres@127.0.0.1:54329/dpdp_test

# 5. Verify migration checksums
python3 scripts/migrate.py verify --database-url=postgresql://postgres@127.0.0.1:54329/dpdp_test

# 6. Execute full static and live security test suite
python3 scripts/test_database_rls.py --database-url=postgresql://postgres@127.0.0.1:54329/dpdp_test
```

---

## 8. Remaining Limitations & Architectural Dependencies

1. **Local Server Lifecycle**: The test database is a local disposable cluster (`/tmp/dpdp_test_cluster`). When moving to CI/CD, the pipeline should provision an ephemeral PostgreSQL container (e.g., GitHub Actions `services: postgres:16`).
2. **DEC-05 (SDF Rules Notification)**: The schema supports Significant Data Fiduciary scoping (`tenants.is_sdf`, `controls.is_sdf_only`), but formal statutory thresholds remain pending MeitY notification.
3. **DEC-08 (Provisional Legal Review)**: All 30 controls remain in `PROVISIONAL_RESEARCH_COMPLETE` status pending final sign-off by TLI Legal Counsel.
4. **DEC-09 (Private Object Storage Vault)**: Database evidence metadata tables (`evidence_items`, `remediation_evidence_items`) are verified; live S3 presigned URL generation and magic-byte header verification will be implemented in Phase 3B.

---

## 9. Final Verdict

| Metric | Target | Actual | Status |
|---|:---:|:---:|:---:|
| Static Schema Checks | 9 / 9 | 9 / 9 | **100% PASS** |
| Canonical Seed Integrity | 7 src / 30 ctrl / 27 evid | 7 src / 30 ctrl / 27 evid | **100% PASS** |
| Live PostgreSQL Engine Tests | 17 / 17 | 17 / 17 | **100% PASS** |
| Cross-Tenant Leakage | 0 leaks | 0 leaks | **100% PASS** |
| Forensic Immutability Violations | 0 permitted | 0 permitted | **100% PASS** |

**FINAL VERDICT: PASS**

The database foundation, migrations, RLS policies, and synthetic seed data have been proven sound, secure, and fully verified against an actual PostgreSQL database engine.

Phase 3A.1 is formally concluded. Development is cleared to proceed to **Phase 3B (Evidence Storage Vault & Presigned S3 Infrastructure)** upon stakeholder authorization.

