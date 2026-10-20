# 37. Migration 006 Security Review and Post-Login Verification

## 1. Executive Summary & Security Verdict

### 1.1 Security Verdict
**CONDITIONAL APPROVAL WITH IMMEDIATE REMEDIATION (MIGRATION 007 APPLIED)**

The security review of `migrations/006_consultant_tenant_rls_policy.sql` and post-login workspace recovery confirmed that read visibility was correctly scoped to assigned engagements. However, the review discovered a **High-severity vulnerability** in Migration 006: declaring the policy `FOR ALL` permitted consultants to execute `DELETE` operations and cross-tenant `UPDATE` operations on client records because PostgreSQL RLS evaluates only `USING` on `DELETE` (ignoring `WITH CHECK`).

To resolve this without altering applied migration history, **Migration 007** (`migrations/007_remediate_consultant_write_boundary.sql`) was developed and applied. It splits the policies on `tenants` and `users` into:
1. `FOR ALL` policies strictly governing writes, restricted to Super Admin or the tenant's own administration.
2. `FOR SELECT` policies strictly governing read access for assigned consultants.

Following Migration 007:
- All unauthorized `UPDATE` and `DELETE` attempts by consultants or client users affect **0 rows** or fail closed.
- All **60 automated tests across 9 test suites pass cleanly**.
- All **17 live PostgreSQL database RLS tests** and **9 static schema validations pass**.
- All **39 storage vault security tests pass**.
- All **7 migration checksums are 100% verified**.
- Manual HTTP wire verification confirms authenticated workspace access for both demo personas and strict cross-tenant denial.

---

## 2. Scope & Files Reviewed

| Component | Files Inspected | Review Focus |
|---|---|---|
| **RLS Migrations** | `migrations/006_consultant_tenant_rls_policy.sql`<br/>`migrations/002_rls_and_security.sql`<br/>`migrations/007_remediate_consultant_write_boundary.sql` | Policy composition (`FOR ALL` vs `FOR SELECT`), `USING` vs `WITH CHECK` semantics, recursion, bypass vulnerability |
| **Database Helpers & Kernel** | `pg_proc` (`is_user_assigned_to_assessment`, `get_assessment_tenant_id`, `app_current_*`) | `SECURITY DEFINER` safety, search path sanitization, least-privilege role `dpdp_app_user` |
| **Runtime Enforcement** | `lib/db/rls.ts`, `lib/db/pool.ts` | Transaction boundaries, local context variable injection (`is_local=true`), session bleed prevention |
| **Workspace Routes** | `app/dashboard/page.tsx`<br/>`app/dashboard/assessments/page.tsx`<br/>`app/dashboard/reports/page.tsx`<br/>`app/dashboard/reports/[id]/page.tsx`<br/>`app/api/assessments/route.ts` | Query correctness, join integrity (`framework_versions`, `users`, `tenants`), fail-closed UI state |
| **Seed & Verification Scripts** | `scripts/seed_demo_users.py`<br/>`scripts/migrate.py`<br/>`scripts/test_database_rls.py`<br/>`tests/post_login_workflow.test.ts` | Checksum tracking, idempotent assignment mapping, negative test assertions |

---

## 3. Findings Classification

### Finding 1: Monolithic `FOR ALL` RLS Policy Permitted DELETE and Tenant Transfer on Client Records
- **Severity**: **HIGH**
- **Affected File**: `migrations/006_consultant_tenant_rls_policy.sql`
- **Mechanism & Evidence**:
  In PostgreSQL Row-Level Security, a policy defined `FOR ALL` applies its `USING` expression to `SELECT`, `UPDATE`, and `DELETE`. Crucially, `DELETE` statements evaluate **only** the `USING` clause; `WITH CHECK` is never evaluated on deletion.
  Because Migration 006 added assigned client tenants and client users to the `USING` clause:
  ```sql
  -- Migration 006 (Vulnerable)
  CREATE POLICY rls_tenants_policy ON tenants FOR ALL TO dpdp_app_user
  USING (... OR (app_current_user_role() IN ('TLI_LEAD_CONSULTANT', 'TLI_REVIEWER') AND id IN (...)))
  WITH CHECK (app_current_user_role() = 'TLI_SUPER_ADMIN' OR id = app_current_tenant_id());
  ```
  Empirical database execution proved:
  1. A consultant could execute `DELETE FROM users WHERE tenant_id = <client_tenant_id>` and delete client users (verified: `DELETE 1`).
  2. A consultant could execute `UPDATE users SET tenant_id = <tli_tenant_id> WHERE email = ...` (verified: `UPDATE 1`). Because the old row satisfied `USING` and the new row satisfied `WITH CHECK` (`tenant_id = app_current_tenant_id()`), the update succeeded, enabling cross-tenant account hijacking.
- **Remediation Implemented**:
  Created **Migration 007** (`007_remediate_consultant_write_boundary.sql`). It replaces the monolithic `FOR ALL` policies on `tenants` and `users` with separated policies:
  - `rls_tenants_admin_policy` / `rls_users_admin_policy`: `FOR ALL` governing all write operations, strictly limited to `TLI_SUPER_ADMIN` and the tenant's own administration (`tenant_id = app_current_tenant_id()`).
  - `rls_tenants_consultant_select_policy` / `rls_users_assigned_select_policy`: `FOR SELECT` only.
- **Post-Remediation Verification**:
  - Consultant `DELETE` on client tenant: `DELETE 0`.
  - Consultant `UPDATE` on client tenant: `UPDATE 0`.
  - Consultant `DELETE` on client user: `DELETE 0`.
  - Consultant `UPDATE` (hijack) on client user: `UPDATE 0`.

---

### Finding 2: Trailing Newline Sensitivity in Migration Checksum Verification
- **Severity**: **LOW**
- **Affected File**: `scripts/migrate.py`, `migrations/006_consultant_tenant_rls_policy.sql`
- **Mechanism & Evidence**:
  `scripts/migrate.py` computes file SHA-256 digests on raw file bytes (`rb`). A subtle trailing newline difference caused `scripts/migrate.py verify` to report a mismatch between disk content and the database record in `schema_migrations`.
- **Remediation Implemented**:
  Normalized file line endings to single trailing newline. Verified all 7 migrations match their checksums exactly.

---

### Finding 3: Multi-Tenant Isolation for Client Users Verified Fail-Closed
- **Severity**: **NO FINDING (CLEAN)**
- **Evidence**:
  Extensive database-level tests in `tests/post_login_workflow.test.ts` confirmed:
  - Client Admin (`customer.demo@tli.local`) querying Beta Express assessment ID returned `0 rows`.
  - Client Admin querying `tenants` for Beta Express tenant ID returned `0 rows`.
  - Client Admin querying `users` for Beta Express users returned `0 rows`.
  - Client Admin attempting cross-tenant INSERT into `users` threw fatal PostgreSQL error: `new row violates row-level security policy for table "users"`.

---

### Finding 4: Consultant Scoping strictly Gated by `assessment_assignments`
- **Severity**: **NO FINDING (CLEAN)**
- **Evidence**:
  - A TLI Reviewer assigned to Alpha Healthcare but unassigned to Beta Express received 1 Alpha assessment and 0 Beta assessments.
  - Deleting an assignment record in `assessment_assignments` immediately revoked assessment, tenant, and user visibility (0 rows returned under live RLS).
  - Unauthenticated connections or unset session GUCs fail closed (0 rows returned).

---

## 4. Test & Verification Outcomes

### 4.1 Database & Security Test Suites

| Test Suite | Command | Result | Details |
|---|---|:---:|---|
| **Python Database RLS Suite** | `python3 scripts/test_database_rls.py --database-url=...` | **PASS (26/26)** | 9 static schema validations + 17 live PostgreSQL kernel isolation tests |
| **Migration Checksum Audit** | `python3 scripts/migrate.py verify --database-url=...` | **PASS (7/7)** | 100% SHA-256 checksum match across migrations 001–007 |
| **Phase 2 Data Integrity Validator** | `python3 scripts/validate_phase2_data.py` | **PASS (100%)** | 7 sources, 30 controls, 27 evidence types validated |
| **Phase 3B.1 Storage Security Suite** | `python3 scripts/test_evidence_vault.py --database-url=...` | **PASS (39/39)** | Magic bytes, upload policy, quarantine gate, cross-tenant download denial |
| **Full Node Test Suite** | `npm test` | **PASS (60/60)** | 9 test suites passing (Auth, RBAC, Demo, Post-Login, Questionnaire, Storage, RLS) |
| **Next.js Production Build** | `npm run build` | **PASS (12/12)** | 100% route generation, zero TypeScript or bundle warnings |

### 4.2 Manual HTTP Workspace Wire Verification

An automated HTTP client simulated browser interactions against the running application:

```text
=== Testing consultant.demo@tli.local (TLI_LEAD_CONSULTANT) ===
  [PASS] Login 200 OK: user=consultant.demo@tli.local, role=TLI_LEAD_CONSULTANT
  [PASS] /dashboard 200 OK (Contains "TLI Consultant Demo")
  [PASS] /dashboard/assessments 200 OK (Contains both Alpha Healthcare and Beta Express)
  [PASS] /dashboard/assessments/018f3a5b-7c8d-7e90-8000-000000000201/questionnaire 200 OK
  [PASS] /dashboard/reports 200 OK
  [PASS] /dashboard/reports/018f3a5b-7c8d-7e90-8000-000000000201 200 OK (Authorized report viewed)
  [PASS] /dashboard/reports/018f3a5b-7c8d-7e90-8000-000000000202 200 OK (Authorized consultant access to Beta report)

=== Testing customer.demo@tli.local (CLIENT_ADMIN) ===
  [PASS] Login 200 OK: user=customer.demo@tli.local, role=CLIENT_ADMIN
  [PASS] /dashboard 200 OK (Contains "Alpha Health Demo Admin")
  [PASS] /dashboard/assessments 200 OK (Strictly Alpha Healthcare; Beta Express isolated)
  [PASS] /dashboard/assessments/018f3a5b-7c8d-7e90-8000-000000000201/questionnaire 200 OK
  [PASS] /dashboard/reports 200 OK
  [PASS] /dashboard/reports/018f3a5b-7c8d-7e90-8000-000000000201 200 OK (Authorized report viewed)
  [PASS] /dashboard/reports/018f3a5b-7c8d-7e90-8000-000000000202 200 OK with Access Restricted / RLS denial message

>>> MANUAL WORKSPACE HTTP VERIFICATION 100% SUCCESSFUL <<<
```

---

## 5. Remaining Limitations & Boundaries

1. **Synthetic Demo Password Safeguard**:
   In `NODE_ENV=production`, synthetic seed passwords and the `DEMO_USER_PASSWORD` environment override are unconditionally rejected at the API tier (`/api/auth/login`). Only bcrypt-hashed credentials stored in the database can authenticate in production environments.
2. **In-Memory Rate Limiting**:
   The login rate limiter operates in-memory (`lib/auth/rate_limit.ts`). While effective for single-instance deployments, public multi-instance production deployments require a distributed Redis/Valkey rate limiting tier before public edge exposure.
3. **Draft Regulatory Status**:
   All statutory mappings reflect the Digital Personal Data Protection Act, 2023 and available draft guidelines; final notified central rules will require configuration updates via the canonical library migration scripts.

---

## 6. Release Recommendation

**PROCEED TO PHASE 3D IMPLEMENTATION**

With Migration 007 applied, the PostgreSQL Row-Level Security boundary strictly satisfies the principle of least privilege:
- Consultants cannot modify or delete client data.
- Client tenants cannot discover or modify cross-tenant data.
- The post-login workspace operates smoothly without runtime exceptions.
- The application foundation is secure and ready for subsequent Phase 3D milestones.

