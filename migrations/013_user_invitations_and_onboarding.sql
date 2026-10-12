-- ============================================================================
-- Migration: 013_user_invitations_and_onboarding.sql
-- Description: User invitations, secure single-use token lifecycle, and onboarding RLS
-- Version: 1.0.0
-- Target: PostgreSQL 16+
-- ============================================================================

-- 1. USER INVITATIONS TABLE
CREATE TABLE IF NOT EXISTS user_invitations (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    invited_by_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED')),
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_invitations_tenant ON user_invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON user_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON user_invitations(email);

-- 2. LEAST-PRIVILEGE OBJECT PERMISSIONS
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_invitations TO dpdp_app_user;

-- 3. FORCE ROW-LEVEL SECURITY
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_invitations FORCE ROW LEVEL SECURITY;

-- 4. RLS POLICIES FOR INVITATIONS
DROP POLICY IF EXISTS rls_user_invitations_admin_policy ON user_invitations;
CREATE POLICY rls_user_invitations_admin_policy ON user_invitations
    FOR ALL
    TO dpdp_app_user
    USING (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (app_current_tenant_id() IS NOT NULL AND tenant_id = app_current_tenant_id() AND app_current_user_role() = 'CLIENT_ADMIN')
    )
    WITH CHECK (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (app_current_tenant_id() IS NOT NULL AND tenant_id = app_current_tenant_id() AND app_current_user_role() = 'CLIENT_ADMIN')
    );

DROP POLICY IF EXISTS rls_user_invitations_consultant_select ON user_invitations;
CREATE POLICY rls_user_invitations_consultant_select ON user_invitations
    FOR SELECT
    TO dpdp_app_user
    USING (
        app_current_user_role() IN ('TLI_LEAD_CONSULTANT', 'TLI_REVIEWER')
        AND tenant_id IN (
            SELECT a.tenant_id FROM assessments a
            WHERE is_user_assigned_to_assessment(a.id, app_current_user_id())
        )
    );

