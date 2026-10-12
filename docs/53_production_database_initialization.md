# TLI DPDP Platform — Phase 9: Production Database Initialization & Deployment Readiness

**Document Reference:** `docs/53_production_database_initialization.md`  
**Classification:** Operational Security & Database Initialization Plan  
**Target Infrastructure:**
- Deployed Application: `https://tl-assessment-tool.vercel.app/`
- Target Database: Neon PostgreSQL 18+ (Project: `morning-morning-49773193`, Branch: `production`, Database: `neondb`)
- Migration Suite: `migrations/001` through `migrations/014`

---

## 1. Executive Summary & Current Verified Status

In accordance with Phase 8 findings:
- The remote Neon production database (`neondb` on the `production` branch) is currently clean with **zero initialized tables**.
- Account provisioning (`admin@truthlabs.in` and `demo.admin@tlidemo.example`) has been developed, tested, and validated with 100% test pass rates on the local test database, but **has NOT been executed on production**.
- Zero Git commits, pushes, or production deployments have been executed.

This document establishes the verified inspection results, safety improvements made to the migration runner, a complete inventory of migrations `001–014`, and a step-by-step execution runbook with exact pre-flight, migration, and post-migration commands.

---

## 2. Technical Inspection & Critical Discoveries

A rigorous code inspection of `scripts/migrate.py`, `migrations/001–013`, `lib/db/pool.ts`, `lib/db/rls.ts`, and the Neon cloud PostgreSQL environment revealed three critical findings:

### 2.1 Critical Finding 1: Cloud Non-Superuser Role Permission (`SET ROLE`)
- **Inspection Detail:** In `lib/db/rls.ts:71`, every transaction bound to a user session executes:
  ```typescript
  await client.query("SET LOCAL ROLE dpdp_app_user;");
  ```
- **Cloud PostgreSQL Reality:** On local development environments, PostgreSQL connections typically run as `postgres` (a superuser), which can switch to any role autonomously. On Neon, connections run as `neondb_owner`, which has `rolsuper = false` and `rolcreaterole = true`.
- **Failure Mode Uncovered:** In PostgreSQL 16+, a non-superuser **cannot** execute `SET ROLE dpdp_app_user` unless explicitly granted membership in that role. Without this grant, any call to `executeWithRls` crashes immediately with:
  ```
  NeonDbError: permission denied to set role "dpdp_app_user"
  ```
- **Remediation Implemented (Migration 014):** Created `migrations/014_runtime_role_grants.sql` to execute:
  ```sql
  DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dpdp_app_user') THEN
          EXECUTE format('GRANT dpdp_app_user TO %I', CURRENT_USER);
      END IF;
  END $$;
  ```
  This ensures that whoever connects to run migrations (e.g., `neondb_owner`) is granted membership in `dpdp_app_user`, enabling clean role-switching under `executeWithRls` at runtime.

### 2.2 Critical Finding 2: Migration Runner Atomic Transaction Safety
- **Inspection Detail:** In the original `scripts/migrate.py`, migrations were executed via:
  ```python
  cmd = ["psql", database_url, "-v", "ON_ERROR_STOP=1", "-f", filepath]
  ```
- **Risk Analysis:** Without `--single-transaction` (or `-1`), `psql` executes SQL statements in autocommit mode. If an error occurs on line 150 of a 300-line migration, lines 1–149 remain committed to the database, but `schema_migrations` does not record the migration. A subsequent retry would fail on conflicting `CREATE TYPE` or `CREATE TABLE` statements.
- **Remediation Implemented:** Updated `scripts/migrate.py` to include `--single-transaction`:
  ```python
  cmd = ["psql", database_url, "-v", "ON_ERROR_STOP=1", "--single-transaction", "-f", filepath]
  ```
- **Guarantee:** PostgreSQL wraps each migration file in an atomic `BEGIN ... COMMIT` block. If any error occurs, the entire migration rolls back cleanly, leaving zero half-applied state.

### 2.3 Critical Finding 3: Target Validation Pre-Flight Guard
- **Inspection Detail:** `scripts/migrate.py` now verifies whether an unversioned database already contains tables in the `public` schema before beginning execution, protecting against accidental execution against an unintended, pre-existing database.

---

## 3. Migration Inventory & Ordering Analysis (001–014)

All 14 migrations execute in strict alphanumeric order. Each migration builds on objects created by its predecessors:

```
[001_initial_schema]
        │
[002_rls_and_security]
        │
[003_seed_canonical_library]
        │
[004_seed_synthetic_data]
        │
[005_evidence_vault_lifecycle]
        │
[006_consultant_tenant_rls_policy]
        │
[007_remediate_consultant_write_boundary]
        │
[008_assessment_questionnaire_responses]
        │
[009_assessor_review_workspace]
        │
[010_evidence_and_clarification_workflows]
        │
[011_assessment_lifecycle_and_immutability]
        │
[012_reporting_and_remediation_workflows]
        │
[013_user_invitations_and_onboarding]
        │
[014_runtime_role_grants]
```

### Detailed Migration Registry

| Version | Migration File | Primary Responsibilities & Objects Created | Dependencies |
|:---:|---|---|---|
| **001** | `001_initial_schema.sql` | `pgcrypto` extension, `generate_uuid_v7()`, 23 core tables, custom enums (`tenant_type`, `user_role`, `assessment_status`), immutability triggers on audit/history tables. | Baseline |
| **002** | `002_rls_and_security.sql` | `dpdp_app_user` least-privilege role, RLS enabled & forced on all tenant tables, context resolution helper functions (`app_current_tenant_id()`, `app_current_user_id()`, `app_current_user_role()`). | `001` |
| **003** | `003_seed_canonical_library.sql` | Seeds 7 legal sources, framework version 1.0.0, 13 control domains, 30 canonical controls, 27 evidence types, and default scoring model. | `001`, `002` |
| **004** | `004_seed_synthetic_data.sql` | Seeds synthetic multi-tenant test fixtures: TLI Advisory tenant (`000000000001`), Alpha Healthcare (SDF), Beta Express (Non-SDF), synthetic users (with `SYNTHETIC_SEED_HASH`), and demo assessments. | `001`, `002`, `003` |
| **005** | `005_evidence_vault_lifecycle.sql` | Expands evidence vault with `storage_key`, `sha256_hash`, `scan_status`, and quarantine state flags. | `001`, `002` |
| **006** | `006_consultant_tenant_rls_policy.sql` | Scopes consultant tenant access policies for multi-tenant assessment reviews. | `001`, `002` |
| **007** | `007_remediate_consultant_write_boundary.sql` | Hardens consultant policies to prevent unauthorized writes to client tenant records. | `006` |
| **008** | `008_assessment_questionnaire_responses.sql` | Creates canonical 60-question response table (`assessment_questionnaire_responses`), response revision history, and RLS policies. | `001`, `002` |
| **009** | `009_assessor_review_workspace.sql` | Creates `questionnaire_assessor_reviews`, review history, and assessor-only notes segregation. | `001`, `008` |
| **010** | `010_evidence_and_clarification_workflows.sql` | Assessor evidence verification decisions (`VERIFIED`, `REJECTED`), clarification thread resolution, and review notes. | `001`, `005` |
| **011** | `011_assessment_lifecycle_and_immutability.sql` | Implements canonical 14-state lifecycle machine, status transition history, and response freeze triggers. | `001`, `008`, `009` |
| **012** | `012_reporting_and_remediation_workflows.sql` | Report snapshots enhancements (`DOCX`, `is_draft`), remediation task lifecycle, question-level findings link. | `001`, `008` |
| **013** | `013_user_invitations_and_onboarding.sql` | Creates `user_invitations` table with SHA-256 token hashing, single-use activation gates, and customer onboarding RLS. | `001`, `002` |
| **014** | `014_runtime_role_grants.sql` | Grants `dpdp_app_user` membership to `CURRENT_USER` (e.g., `neondb_owner`) to enable runtime `SET LOCAL ROLE` in cloud PostgreSQL. | `002` |

---

## 4. Pre-Flight Checks & Execution Commands

### 4.1 Strict Environment Variable Convention
All commands below reference the target connection string via a shell environment variable to guarantee **zero plaintext password exposure**:

```bash
# Set in your secure shell session (DO NOT commit or log this value)
export TARGET_DATABASE_URL="postgresql://neondb_owner:<PASSWORD>@<HOST>/neondb?sslmode=require"
```

---

### 4.2 State-Inspection Commands (READ-ONLY — Safe to run anytime)

#### Check 1: Verify PostgreSQL Connectivity & Database Name
```bash
psql "$TARGET_DATABASE_URL" -c "SELECT current_database(), current_user, version();"
```
*Expected Result:* Database is `neondb`, user is `neondb_owner`, PostgreSQL 18+.

#### Check 2: Verify Target Database is Clean
```bash
psql "$TARGET_DATABASE_URL" -c "
SELECT COUNT(*) AS public_tables 
FROM information_schema.tables 
WHERE table_schema = 'public';
"
```
*Expected Result:* `public_tables` count is `0`.

#### Check 3: Inspect Migration Runner Status
```bash
python3 scripts/migrate.py status --database-url="$TARGET_DATABASE_URL"
```
*Expected Result:* All 14 migrations (`001` through `014`) are listed with status `PENDING`.

---

### 4.3 State-Modifying Commands (REQUIRES APPROVAL)

> [!CAUTION]
> The following commands will modify the production database schema and records. Execute only after obtaining explicit authorization.

#### Step 1: Apply All Migrations (001–014)
```bash
python3 scripts/migrate.py up --database-url="$TARGET_DATABASE_URL"
```
*Execution Details:*
- Runs with `--single-transaction` per migration file.
- Records each applied migration in `schema_migrations` with its SHA-256 checksum.
- Stops immediately if any statement fails, rolling back the failing file completely.

#### Step 2: Verify Applied Migration Checksums
```bash
python3 scripts/migrate.py verify --database-url="$TARGET_DATABASE_URL"
```
*Expected Result:* All 14 migrations display `[VERIFIED]` with matching SHA-256 digests.

#### Step 3: Execute Phase 8 Production Account Provisioning
```bash
npm run provision:accounts -- --target=production --database-url="$TARGET_DATABASE_URL"
```
*Execution Details:*
- Validates that `tenants`, `users`, and `schema_migrations` exist.
- Upgrades `admin@truthlabs.in` with a fresh 28-character cryptographically secure bcrypt password (`TLI_SUPER_ADMIN`).
- Provisions `TLI Demo Customer` and `demo.admin@tlidemo.example` (`CLIENT_ADMIN`).
- Instantiates demo assessment `ENG-TLI-DEMO-2026-001`.
- Delivers credentials to local file `.credentials_provisioned.txt` (mode `0600`).

---

## 5. Post-Migration Verification Queries

Execute these read-only verification queries against the initialized production database:

### Query 1: Verify Core Table Inventory
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```
*Expected:* 26 tables present (including `tenants`, `users`, `controls`, `assessments`, `schema_migrations`, `user_invitations`).

### Query 2: Verify Row-Level Security is Active and Forced
```sql
SELECT tablename, rowsecurity, forcerowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('tenants', 'users', 'assessments', 'evidence_files', 'audit_logs', 'user_invitations');
```
*Expected:* `rowsecurity = true` AND `forcerowsecurity = true` on all listed tables.

### Query 3: Verify Canonical Control Library Seed Integrity
```sql
SELECT 
    (SELECT COUNT(*) FROM legal_sources) AS sources_count,
    (SELECT COUNT(*) FROM control_domains) AS domains_count,
    (SELECT COUNT(*) FROM controls) AS controls_count,
    (SELECT COUNT(*) FROM evidence_types) AS evidence_types_count;
```
*Expected:* 7 legal sources, 13 domains, 30 controls, 27 evidence types.

### Query 4: Verify Role Membership Grant (`dpdp_app_user`)
```sql
SELECT r.rolname, m.rolname AS member_of 
FROM pg_roles r 
JOIN pg_auth_members am ON am.member = r.oid 
JOIN pg_roles m ON m.oid = am.roleid 
WHERE m.rolname = 'dpdp_app_user';
```
*Expected:* `neondb_owner` is a member of `dpdp_app_user`.

### Query 5: Verify Provisioned Root Accounts
```sql
SELECT u.email, u.role, u.is_active, t.name AS tenant_name, t.type AS tenant_type,
       SUBSTRING(u.password_hash, 1, 7) AS hash_prefix
FROM users u 
JOIN tenants t ON t.id = u.tenant_id 
WHERE u.email IN ('admin@truthlabs.in', 'demo.admin@tlidemo.example');
```
*Expected:* Both users active, correct roles, and `hash_prefix` is `$2a$12$` or `$2b$12$` (strictly not synthetic seed hash).

---

## 6. Failure Recovery & Rollback Matrix

| Failure Point | Impact | Recovery Procedure |
|---|---|---|
| **Connection Timeout during Pre-Flight** | Zero changes made | Check network reachability, verify Neon compute is active, retry connection check. |
| **Migration Failure (e.g., at Migration 005)** | Migrations 001–004 committed; Migration 005 rolled back automatically via `--single-transaction`. | 1. Inspect error output.<br>2. Run `scripts/migrate.py status` to confirm 001–004 are recorded.<br>3. Fix the underlying issue.<br>4. Re-run `scripts/migrate.py up` (it will safely resume from 005). |
| **Partial Failure without Single-Transaction** | Database has unrecorded partial DDL. | Drop conflicted object or roll back to last recorded migration version; `--single-transaction` is now enabled to prevent this state. |
| **Provisioning Script Failure** | Transaction aborted automatically (`ROLLBACK`). | Zero partial users or tenants created. Correct configuration and re-run `npm run provision:accounts`. |

---

## 7. Local Testing & Verification Results

All static and live checks pass against the local development environment:

- **Migration Checksums:** 14/14 migrations verified (`python3 scripts/migrate.py verify`).
- **Database RLS Kernel Tests:** 17/17 live security checks passed (`python3 scripts/test_database_rls.py`).
- **Regression Suite:** 165/165 tests passed across 19 suites (`npm test`).
- **Production Build:** Next.js production build succeeded with zero TypeScript or lint errors (`npm run build`).

---

## 8. Summary of What Requires Approval Next

Before executing any commands on production infrastructure, your approval is requested to:
1. Run `python3 scripts/migrate.py up --database-url="$TARGET_DATABASE_URL"` against the production Neon database.
2. Run `npm run provision:accounts -- --target=production --database-url="$TARGET_DATABASE_URL"` to provision the production root administrator and demo customer accounts.
3. Commit and push the Phase 8 and Phase 9 code updates to Git.

