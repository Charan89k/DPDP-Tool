-- ============================================================================
-- Migration: 014_runtime_role_grants.sql
-- Description: Grant least-privilege runtime role (dpdp_app_user) to connection role
-- Version: 1.0.0
-- Target: PostgreSQL 16+ (Neon Cloud & Local PostgreSQL)
-- ============================================================================

-- Grant dpdp_app_user membership to CURRENT_USER (e.g. neondb_owner or database connection role)
-- On non-superuser cloud platforms (such as Neon PostgreSQL 16+), a database user cannot
-- execute 'SET LOCAL ROLE dpdp_app_user' inside transactions unless granted membership in the target role.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dpdp_app_user') THEN
        EXECUTE format('GRANT dpdp_app_user TO %I', CURRENT_USER);
    END IF;
END $$;

