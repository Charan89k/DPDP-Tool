# 36. Post-Login Failure Diagnosis and Recovery Report

## Executive Summary

Following successful user authentication at `/login`, client browsers navigating to the authenticated application workspace (`/dashboard`, `/dashboard/assessments`, `/dashboard/reports`) encountered runtime server errors (HTTP 500) rather than the authorized workspace views.

An empirical investigation identified two distinct root causes:
1. **Schema Mismatch in Server Component Queries**: Queries executed within React Server Components directly selected non-existent columns (`target_framework`, `start_date`, `assessment_type`, `lead_consultant_name`, `dpo_contact_name`) from the `assessments` table, resulting in immediate fatal PostgreSQL exceptions (`ERROR: column "target_framework" does not exist`).
2. **PostgreSQL Row-Level Security (RLS) Visibility Gap & Missing Engagement Assignments**:
   - `consultant.demo@tli.local` was seeded into the `users` table but was not mapped to any assessment in `assessment_assignments`. Under canonical RLS policy `rls_assessments_policy`, consultants are granted access to assessments strictly when `is_user_assigned_to_assessment(id, user_id)` returns true.
   - Under `rls_tenants_policy` (from Migration 002), users could only view tenant records where `id = app_current_tenant_id()`. Because TLI consultants belong to the TLI Advisory tenant (`018f3a5b-7c8d-7e90-8000-000000000001`), inner joins on `tenants` for client assessments (e.g. Alpha Healthcare) filtered out all client rows.

Both root causes have been resolved without redesigning the application or weakening security boundaries:
- **Migration 006** (`006_consultant_tenant_rls_policy.sql`) scopes tenant and user metadata visibility to assigned consultants strictly for engagements they are legally assigned to evaluate.
- **`scripts/seed_demo_users.py`** assigns demo users to canonical assessments in `assessment_assignments`.
- **SQL Queries** across dashboard routes have been corrected to join `framework_versions`, `users`, and `tenants` properly.
- All **55 automated tests across 9 test suites pass cleanly**, and the Next.js production build succeeds with 100% static/dynamic route validation.

---

## 1. Empirical Root Cause Analysis

### 1.1 Fatal SQL Column References in Server Components
When inspecting `assessments` table schema in the PostgreSQL database kernel:
```text
Table "public.assessments"
- id (UUID)
- tenant_id (UUID -> tenants.id)
- framework_version_id (UUID -> framework_versions.id)
- scoring_model_id (UUID -> scoring_models.id)
- engagement_code (VARCHAR)
- title (VARCHAR)
- status (assessment_status)
- lead_consultant_id (UUID -> users.id)
- is_partial_assessment (BOOLEAN)
- target_completion_date (DATE)
- created_at (TIMESTAMPTZ)
```

The server components executed the following queries:
- `app/dashboard/page.tsx`:
  ```sql
  SELECT id, title, status, target_framework, start_date FROM assessments ORDER BY created_at DESC LIMIT 1;
  ```
  **PostgreSQL Response**: `ERROR: column "target_framework" does not exist`.
- `app/api/assessments/route.ts`, `app/dashboard/assessments/page.tsx`, and `app/dashboard/reports/page.tsx`:
  ```sql
  SELECT a.id, a.tenant_id, a.title, a.assessment_type, a.status, a.target_framework, a.start_date, a.lead_consultant_name, a.dpo_contact_name ...
  ```
  **PostgreSQL Response**: `ERROR: column a.assessment_type does not exist`.

Because these queries executed within server-side components via `executeWithRls`, the unhandled rejections caused Next.js server runtime crashes immediately after login.

### 1.2 Consultant RLS Scoping & Missing Assignments
Two additional RLS obstacles blocked `consultant.demo@tli.local`:
1. **Unassigned Persona**: Under `migrations/002_rls_and_security.sql`, the RLS policy on `assessments` requires:
   ```sql
   (app_current_user_role() IN ('TLI_LEAD_CONSULTANT', 'TLI_REVIEWER')
    AND is_user_assigned_to_assessment(id, app_current_user_id()))
   ```
   The original seed script inserted `consultant.demo@tli.local` into `users` but omitted corresponding records in `assessment_assignments`. As a result, the consultant could see zero assessments.
2. **Tenant Policy Restriction**: The original `rls_tenants_policy` restricted access to `id = app_current_tenant_id()`. Even when a consultant was assigned to an assessment belonging to Alpha Healthcare, executing `JOIN tenants t ON t.id = a.tenant_id` resulted in 0 rows because PostgreSQL RLS filtered out Alpha Healthcare from the consultant's query context.

---

## 2. Engineering Remediation

### 2.1 Schema-Aligned Queries
All queries across `/dashboard`, `/dashboard/assessments`, `/dashboard/reports`, `/dashboard/reports/[id]`, and `/api/assessments` were refactored to join the authoritative tables:
```sql
SELECT 
  a.id,
  a.tenant_id,
  a.title,
  'ENTERPRISE_GAP_ASSESSMENT' AS assessment_type,
  a.status,
  fv.name AS target_framework,
  a.created_at AS start_date,
  a.target_completion_date,
  u.full_name AS lead_consultant_name,
  t.dpo_name AS dpo_contact_name,
  a.created_at,
  t.name AS tenant_name,
  t.slug AS tenant_slug,
  t.is_sdf
FROM assessments a
JOIN framework_versions fv ON fv.id = a.framework_version_id
LEFT JOIN users u ON u.id = a.lead_consultant_id
LEFT JOIN tenants t ON t.id = a.tenant_id
ORDER BY a.created_at DESC;
```

### 2.2 Migration 006: Tenant & User Scoping for Assigned Engagements
A formal database migration was created and applied via `scripts/migrate.py`:
- **File**: `migrations/006_consultant_tenant_rls_policy.sql`
- **Policy Refinement**:
  ```sql
  CREATE POLICY rls_tenants_policy ON tenants
      FOR ALL
      TO dpdp_app_user
      USING (
          app_current_user_role() = 'TLI_SUPER_ADMIN'
          OR (app_current_tenant_id() IS NOT NULL AND id = app_current_tenant_id())
          OR (
              app_current_user_role() IN ('TLI_LEAD_CONSULTANT', 'TLI_REVIEWER')
              AND id IN (
                  SELECT a.tenant_id FROM assessments a
                  WHERE is_user_assigned_to_assessment(a.id, app_current_user_id())
              )
          )
      )
      WITH CHECK (
          app_current_user_role() = 'TLI_SUPER_ADMIN'
          OR (app_current_tenant_id() IS NOT NULL AND id = app_current_tenant_id())
      );
  ```
- **Guarantees Preserved**:
  1. Client tenants (`CLIENT_ADMIN`, `CLIENT_CONTRIBUTOR`) remain strictly isolated; they can never view any other client tenant records or other client users.
  2. Consultants can only see tenant records for assessments to which they are assigned.
  3. `WITH CHECK` remains restricted to super administrators and the tenant's own administration, preventing unauthorized modifications.

### 2.3 Demo User Seeding Update
`scripts/seed_demo_users.py` was updated to idempotently map demo personas to canonical engagements:
- `consultant.demo@tli.local` mapped as `ENGAGEMENT_LEAD` to both Alpha Healthcare and Beta Express assessments.
- `customer.demo@tli.local` mapped as `CLIENT_COORDINATOR` to Alpha Healthcare assessment.

---

## 3. Verification & Validation Evidence

### 3.1 Automated Test Execution (`npm test`)
A new dedicated test suite `tests/post_login_workflow.test.ts` was added to verify post-login queries and tenant isolation under live PostgreSQL RLS:
```text
▶ Phase 3D: Post-Login Workspace Flow & Live RLS Enforcement
  ✔ should successfully execute /dashboard metric and sample queries for DEMO_CUSTOMER (53.42ms)
  ✔ should successfully execute /dashboard metric and sample queries for DEMO_CONSULTANT (13.80ms)
  ✔ should execute /dashboard/assessments query and enforce strict tenant boundaries (24.06ms)
  ✔ should enforce RLS isolation preventing customer from querying Beta Express assessment (9.44ms)
  ✔ should allow consultant to view report detail for assigned assessment (11.08ms)
✔ Phase 3D: Post-Login Workspace Flow & Live RLS Enforcement (120.85ms)

ℹ tests 55
ℹ suites 9
ℹ pass 55
ℹ fail 0
```

### 3.2 Production Build Verification (`npm run build`)
```text
✓ Compiled successfully in 5.7s
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages (12/12)
✓ Finalizing page optimization
All 12 routes generated cleanly with zero TypeScript or packaging errors.
```

---

## 4. Local Exploration Instructions

Both demo accounts can now authenticate and navigate the application workspace without errors:

| Persona | Email | Password | Tenant | Authorized Scope |
|---|---|---|---|---|
| **TLI Lead Consultant** | `consultant.demo@tli.local` | `SyntheticTestPassword123!` | Truth Labs International | Both Alpha Healthcare & Beta Express engagements; full advisory scoping & report review |
| **Client Administrator** | `customer.demo@tli.local` | `SyntheticTestPassword123!` | Alpha Healthcare Solutions Ltd | Strictly Alpha Healthcare scope (SDF); questionnaire & evidence management |

### Steps to Test Locally:
1. **Start Application**:
   ```bash
   npm run dev
   ```
2. **Access Login**:
   Navigate to `http://localhost:3000/login`.
3. **Log in as Consultant**:
   - Use `consultant.demo@tli.local` or click the quick-login shortcut.
   - Verify access to `/dashboard`, `/dashboard/assessments`, `/dashboard/assessments/018f3a5b-7c8d-7e90-8000-000000000201/questionnaire`, and `/dashboard/reports`.
4. **Log in as Customer**:
   - Log out and log in with `customer.demo@tli.local`.
   - Verify access to `/dashboard` displaying Alpha Healthcare metrics (1 assessment, 3 business units).
   - Verify that Beta Express data is completely inaccessible under RLS.

