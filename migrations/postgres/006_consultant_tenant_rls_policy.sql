-- ============================================================================
-- TLI DPDP Compliance Gap Analysis Tool
-- Migration 006: Tenant and User Visibility Scoping for Assigned Engagements (Phase 3D)
--
-- RATIONALE & ARCHITECTURAL NECESSITY:
-- In Migration 002 (Sections 5.1 & 5.3), rls_tenants_policy and rls_users_policy
-- permitted row access only to TLI_SUPER_ADMIN or the user's own tenant.
-- However, TLI advisory personnel (TLI_LEAD_CONSULTANT, TLI_REVIEWER) reside
-- within the TLI advisory tenant while conducting assessments for client tenants
-- (e.g. Alpha Healthcare).
--
-- Under FORCE ROW LEVEL SECURITY, this prevented consultants from reading
-- client tenant metadata (name, slug, is_sdf) for client assessments assigned
-- to them, and prevented client users from reading their assigned lead consultant's
-- name and contact details.
--
-- In accordance with Section 2.3 of docs/05_tenant_isolation_and_evidence_security.md:
-- This migration refines rls_tenants_policy and rls_users_policy to:
-- 1. Grant SELECT visibility on 'tenants' to assigned consultants strictly for
--    tenants whose assessments they are actively assigned to in 'assessment_assignments'.
-- 2. Grant SELECT visibility on 'users' to assigned consultants for client users
--    participating in assigned assessments, and to client users for their assigned
--    lead consultant.
--
-- ISOLATION GUARANTEES PRESERVED:
-- 1. Client tenants (CLIENT_ADMIN, CLIENT_CONTRIBUTOR, etc.) remain strictly isolated;
--    they can NEVER see any other client tenant records or other client users.
-- 2. Consultants can ONLY see tenant records for assessments to which they are assigned.
-- 3. INSERT/UPDATE/DELETE (WITH CHECK) remains strictly restricted to TLI_SUPER_ADMIN
--    and the tenant's own administration.
-- ============================================================================

-- 1. TENANTS TABLE POLICY REFINEMENT
DROP POLICY IF EXISTS rls_tenants_policy ON tenants;
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

-- 2. USERS TABLE POLICY REFINEMENT
DROP POLICY IF EXISTS rls_users_policy ON users;
CREATE POLICY rls_users_policy ON users
    FOR ALL
    TO dpdp_app_user
    USING (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (app_current_tenant_id() IS NOT NULL AND tenant_id = app_current_tenant_id())
        OR (
            id IN (
                SELECT lead_consultant_id FROM assessments
                WHERE tenant_id = app_current_tenant_id()
            )
        )
        OR (
            app_current_user_role() IN ('TLI_LEAD_CONSULTANT', 'TLI_REVIEWER')
            AND tenant_id IN (
                SELECT a.tenant_id FROM assessments a
                WHERE is_user_assigned_to_assessment(a.id, app_current_user_id())
            )
        )
    )
    WITH CHECK (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (app_current_tenant_id() IS NOT NULL AND tenant_id = app_current_tenant_id())
    );
