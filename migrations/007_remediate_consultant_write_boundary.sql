-- ============================================================================
-- TLI DPDP Compliance Gap Analysis Tool
-- Migration 007: Remediate Consultant Write Boundary & Split RLS Policies (Phase 3D)
--
-- SECURITY AUDIT FINDING & REMEDIATION RATIONALE:
-- In Migration 006, rls_tenants_policy and rls_users_policy were declared 'FOR ALL'
-- commands (SELECT, INSERT, UPDATE, DELETE). In PostgreSQL Row-Level Security:
-- 1. DELETE operations evaluate ONLY the 'USING' expression; 'WITH CHECK' is ignored.
-- 2. Because the 'USING' clause included assigned client tenants/users to permit
--    reading during assessment reviews, consultants inadvertently gained DELETE
--    and UPDATE capabilities over client tenant and user records.
--
-- REMEDIATION:
-- This migration replaces the monolithic 'FOR ALL' policies on 'tenants' and 'users'
-- with separated, least-privilege policies:
-- 1. 'rls_tenants_admin_policy' (FOR ALL): Strictly scoped to TLI_SUPER_ADMIN or the
--    tenant's own administration (id = app_current_tenant_id()). Governs ALL writes.
-- 2. 'rls_tenants_consultant_select_policy' (FOR SELECT ONLY): Allows TLI_LEAD_CONSULTANT
--    and TLI_REVIEWER to read client tenant metadata strictly for assigned assessments.
-- 3. 'rls_users_admin_policy' (FOR ALL): Strictly scoped to TLI_SUPER_ADMIN or the
--    user's own tenant (tenant_id = app_current_tenant_id()). Governs ALL writes.
-- 4. 'rls_users_assigned_select_policy' (FOR SELECT ONLY): Allows client users to view
--    their assigned lead consultant, and allows assigned consultants to view client
--    users in participating assessments.
--
-- ZERO WRITE PRIVILEGES FOR CONSULTANTS ON CLIENT DATA:
-- - Consultants CANNOT INSERT, UPDATE, or DELETE client tenant or user records.
-- - Client users CANNOT INSERT, UPDATE, or DELETE other client records.
-- - Cross-tenant isolation is strictly preserved.
-- ============================================================================

-- 1. DROP MONOLITHIC POLICIES FROM MIGRATION 006
DROP POLICY IF EXISTS rls_tenants_policy ON tenants;
DROP POLICY IF EXISTS rls_users_policy ON users;

-- 2. TENANTS TABLE: SEPARATE ADMIN WRITE FROM CONSULTANT READ
DROP POLICY IF EXISTS rls_tenants_admin_policy ON tenants;
CREATE POLICY rls_tenants_admin_policy ON tenants
    FOR ALL
    TO dpdp_app_user
    USING (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (app_current_tenant_id() IS NOT NULL AND id = app_current_tenant_id())
    )
    WITH CHECK (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (app_current_tenant_id() IS NOT NULL AND id = app_current_tenant_id())
    );

DROP POLICY IF EXISTS rls_tenants_consultant_select_policy ON tenants;
CREATE POLICY rls_tenants_consultant_select_policy ON tenants
    FOR SELECT
    TO dpdp_app_user
    USING (
        app_current_user_role() IN ('TLI_LEAD_CONSULTANT', 'TLI_REVIEWER')
        AND id IN (
            SELECT a.tenant_id FROM assessments a
            WHERE is_user_assigned_to_assessment(a.id, app_current_user_id())
        )
    );

-- 3. USERS TABLE: SEPARATE ADMIN WRITE FROM ASSIGNED READ
DROP POLICY IF EXISTS rls_users_admin_policy ON users;
CREATE POLICY rls_users_admin_policy ON users
    FOR ALL
    TO dpdp_app_user
    USING (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (app_current_tenant_id() IS NOT NULL AND tenant_id = app_current_tenant_id())
    )
    WITH CHECK (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (app_current_tenant_id() IS NOT NULL AND tenant_id = app_current_tenant_id())
    );

DROP POLICY IF EXISTS rls_users_assigned_select_policy ON users;
CREATE POLICY rls_users_assigned_select_policy ON users
    FOR SELECT
    TO dpdp_app_user
    USING (
        (
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
    );

