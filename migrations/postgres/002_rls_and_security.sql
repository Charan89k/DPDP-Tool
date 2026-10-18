-- ============================================================================
-- Migration: 002_rls_and_security.sql
-- Description: Row-Level Security (RLS) policies, session context resolution,
--              and least-privilege database roles for TLI DPDP Tool
-- Version: 1.0.0
-- Author: Principal Software Architect / Database Security Engineer
-- Target: PostgreSQL 16+
-- ============================================================================

-- ============================================================================
-- 1. DATABASE RUNTIME ROLES CREATION
-- ============================================================================

DO $$
BEGIN
    -- Dedicated Migration Administrator Role
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dpdp_migration_admin') THEN
        CREATE ROLE dpdp_migration_admin WITH LOGIN CREATEDB;
    END IF;

    -- Dedicated Least-Privilege Application Runtime Role (Strictly NOBYPASSRLS)
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dpdp_app_user') THEN
        CREATE ROLE dpdp_app_user WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    ELSE
        -- Ensure NOBYPASSRLS is explicitly maintained even if role pre-existed
        ALTER ROLE dpdp_app_user NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    END IF;
END $$;

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO dpdp_app_user;

-- ============================================================================
-- 2. LEAST-PRIVILEGE OBJECT PERMISSIONS
-- ============================================================================

-- A. Canonical Reference Tables: SELECT ONLY (Immutable by application users)
GRANT SELECT ON TABLE legal_sources TO dpdp_app_user;
GRANT SELECT ON TABLE framework_versions TO dpdp_app_user;
GRANT SELECT ON TABLE scoring_models TO dpdp_app_user;
GRANT SELECT ON TABLE control_domains TO dpdp_app_user;
GRANT SELECT ON TABLE controls TO dpdp_app_user;
GRANT SELECT ON TABLE evidence_types TO dpdp_app_user;
GRANT SELECT ON TABLE schema_migrations TO dpdp_app_user;

-- B. Append-Only Forensic History & Audit Tables: SELECT, INSERT ONLY (NO UPDATE, NO DELETE)
GRANT SELECT, INSERT ON TABLE control_response_history TO dpdp_app_user;
GRANT SELECT, INSERT ON TABLE report_snapshots TO dpdp_app_user;
GRANT SELECT, INSERT ON TABLE audit_logs TO dpdp_app_user;

-- C. Operational Multi-Tenant Tables: Full CRUD subject to RLS Policies
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE tenants TO dpdp_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE business_units TO dpdp_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE users TO dpdp_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE processing_activities TO dpdp_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE assessments TO dpdp_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE assessment_assignments TO dpdp_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE assessment_controls TO dpdp_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE assessment_control_activities TO dpdp_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE evidence_items TO dpdp_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE clarification_threads TO dpdp_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE clarification_messages TO dpdp_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE assessment_scores TO dpdp_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE remediation_tasks TO dpdp_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE remediation_evidence_items TO dpdp_app_user;

-- ============================================================================
-- 3. FAIL-CLOSED CONTEXT RESOLUTION HELPER FUNCTIONS
-- ============================================================================

-- Extracts transaction-local 'app.current_tenant_id' safely as UUID
-- Returns NULL on missing setting, empty string, or malformed UUID (guaranteeing fail-closed)
CREATE OR REPLACE FUNCTION app_current_tenant_id() RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public;

-- Extracts transaction-local 'app.current_user_id' safely as UUID
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_user_id', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public;

-- Extracts transaction-local 'app.current_user_role' safely as TEXT
CREATE OR REPLACE FUNCTION app_current_user_role() RETURNS TEXT AS $$
BEGIN
    RETURN COALESCE(NULLIF(current_setting('app.current_user_role', true), ''), '');
EXCEPTION WHEN OTHERS THEN
    RETURN '';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public;

-- Checks if a specific user is assigned to an assessment (breaks RLS recursion)
CREATE OR REPLACE FUNCTION is_user_assigned_to_assessment(p_assessment_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF p_assessment_id IS NULL OR p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM assessment_assignments
        WHERE assessment_id = p_assessment_id AND user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public;

-- Looks up an assessment's tenant_id (breaks RLS recursion between assignments and assessments)
CREATE OR REPLACE FUNCTION get_assessment_tenant_id(p_assessment_id UUID)
RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    IF p_assessment_id IS NULL THEN
        RETURN NULL;
    END IF;
    SELECT tenant_id INTO v_tenant_id FROM assessments WHERE id = p_assessment_id;
    RETURN v_tenant_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public;

GRANT EXECUTE ON FUNCTION app_current_tenant_id() TO dpdp_app_user;
GRANT EXECUTE ON FUNCTION app_current_user_id() TO dpdp_app_user;
GRANT EXECUTE ON FUNCTION app_current_user_role() TO dpdp_app_user;
GRANT EXECUTE ON FUNCTION is_user_assigned_to_assessment(UUID, UUID) TO dpdp_app_user;
GRANT EXECUTE ON FUNCTION get_assessment_tenant_id(UUID) TO dpdp_app_user;

-- ============================================================================
-- 4. FORCE ROW-LEVEL SECURITY ON ALL TENANT-SCOPED TABLES
-- ============================================================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;

ALTER TABLE business_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_units FORCE ROW LEVEL SECURITY;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

ALTER TABLE processing_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_activities FORCE ROW LEVEL SECURITY;

ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments FORCE ROW LEVEL SECURITY;

ALTER TABLE assessment_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_assignments FORCE ROW LEVEL SECURITY;

ALTER TABLE assessment_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_controls FORCE ROW LEVEL SECURITY;

ALTER TABLE assessment_control_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_control_activities FORCE ROW LEVEL SECURITY;

ALTER TABLE control_response_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_response_history FORCE ROW LEVEL SECURITY;

ALTER TABLE evidence_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_items FORCE ROW LEVEL SECURITY;

ALTER TABLE clarification_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE clarification_threads FORCE ROW LEVEL SECURITY;

ALTER TABLE clarification_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE clarification_messages FORCE ROW LEVEL SECURITY;

ALTER TABLE assessment_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_scores FORCE ROW LEVEL SECURITY;

ALTER TABLE report_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_snapshots FORCE ROW LEVEL SECURITY;

ALTER TABLE remediation_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE remediation_tasks FORCE ROW LEVEL SECURITY;

ALTER TABLE remediation_evidence_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE remediation_evidence_items FORCE ROW LEVEL SECURITY;

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. KERNEL-ENFORCED RLS POLICY DEFINITIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 5.1 Tenants Table Policy
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS rls_tenants_policy ON tenants;
CREATE POLICY rls_tenants_policy ON tenants
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

-- ----------------------------------------------------------------------------
-- 5.2 Business Units Policy
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS rls_business_units_policy ON business_units;
CREATE POLICY rls_business_units_policy ON business_units
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

-- ----------------------------------------------------------------------------
-- 5.3 Users Policy
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS rls_users_policy ON users;
CREATE POLICY rls_users_policy ON users
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

-- ----------------------------------------------------------------------------
-- 5.4 Processing Activities Policy
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS rls_processing_activities_policy ON processing_activities;
CREATE POLICY rls_processing_activities_policy ON processing_activities
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

-- ----------------------------------------------------------------------------
-- 5.5 Assessments Policy (Includes Consultant Engagement Assignment Scope)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS rls_assessments_policy ON assessments;
CREATE POLICY rls_assessments_policy ON assessments
    FOR ALL
    TO dpdp_app_user
    USING (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (
            app_current_user_role() IN ('TLI_LEAD_CONSULTANT', 'TLI_REVIEWER')
            AND is_user_assigned_to_assessment(id, app_current_user_id())
        )
        OR (
            app_current_tenant_id() IS NOT NULL
            AND tenant_id = app_current_tenant_id()
        )
    )
    WITH CHECK (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (
            app_current_user_role() IN ('TLI_LEAD_CONSULTANT', 'TLI_REVIEWER')
            AND is_user_assigned_to_assessment(id, app_current_user_id())
        )
        OR (
            app_current_tenant_id() IS NOT NULL
            AND tenant_id = app_current_tenant_id()
        )
    );

-- ----------------------------------------------------------------------------
-- 5.6 Assessment Assignments Policy
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS rls_assessment_assignments_policy ON assessment_assignments;
CREATE POLICY rls_assessment_assignments_policy ON assessment_assignments
    FOR ALL
    TO dpdp_app_user
    USING (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR user_id = app_current_user_id()
        OR (
            app_current_tenant_id() IS NOT NULL
            AND get_assessment_tenant_id(assessment_id) = app_current_tenant_id()
        )
    )
    WITH CHECK (
        app_current_user_role() IN ('TLI_SUPER_ADMIN', 'TLI_LEAD_CONSULTANT')
        OR (
            app_current_tenant_id() IS NOT NULL
            AND get_assessment_tenant_id(assessment_id) = app_current_tenant_id()
        )
    );

-- ----------------------------------------------------------------------------
-- 5.7 Assessment Controls Policy (Inherits Assessment Scope)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS rls_assessment_controls_policy ON assessment_controls;
CREATE POLICY rls_assessment_controls_policy ON assessment_controls
    FOR ALL
    TO dpdp_app_user
    USING (
        assessment_id IN (SELECT a.id FROM assessments a)
    )
    WITH CHECK (
        assessment_id IN (SELECT a.id FROM assessments a)
    );

-- ----------------------------------------------------------------------------
-- 5.8 Assessment Control Activities Policy
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS rls_control_activities_policy ON assessment_control_activities;
CREATE POLICY rls_control_activities_policy ON assessment_control_activities
    FOR ALL
    TO dpdp_app_user
    USING (
        assessment_control_id IN (SELECT ac.id FROM assessment_controls ac)
    )
    WITH CHECK (
        assessment_control_id IN (SELECT ac.id FROM assessment_controls ac)
    );

-- ----------------------------------------------------------------------------
-- 5.9 Control Response History Policy
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS rls_response_history_policy ON control_response_history;
CREATE POLICY rls_response_history_policy ON control_response_history
    FOR ALL
    TO dpdp_app_user
    USING (
        assessment_control_id IN (SELECT ac.id FROM assessment_controls ac)
    )
    WITH CHECK (
        assessment_control_id IN (SELECT ac.id FROM assessment_controls ac)
    );

-- ----------------------------------------------------------------------------
-- 5.10 Evidence Items Policy
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS rls_evidence_items_policy ON evidence_items;
CREATE POLICY rls_evidence_items_policy ON evidence_items
    FOR ALL
    TO dpdp_app_user
    USING (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (
            app_current_user_role() IN ('TLI_LEAD_CONSULTANT', 'TLI_REVIEWER')
            AND assessment_control_id IN (SELECT ac.id FROM assessment_controls ac)
        )
        OR (
            app_current_tenant_id() IS NOT NULL
            AND tenant_id = app_current_tenant_id()
        )
    )
    WITH CHECK (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (
            app_current_tenant_id() IS NOT NULL
            AND tenant_id = app_current_tenant_id()
            AND assessment_control_id IN (SELECT ac.id FROM assessment_controls ac)
        )
    );

-- ----------------------------------------------------------------------------
-- 5.11 Clarification Threads & Messages Policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS rls_clarification_threads_policy ON clarification_threads;
CREATE POLICY rls_clarification_threads_policy ON clarification_threads
    FOR ALL
    TO dpdp_app_user
    USING (
        assessment_control_id IN (SELECT ac.id FROM assessment_controls ac)
    )
    WITH CHECK (
        assessment_control_id IN (SELECT ac.id FROM assessment_controls ac)
    );

DROP POLICY IF EXISTS rls_clarification_messages_policy ON clarification_messages;
CREATE POLICY rls_clarification_messages_policy ON clarification_messages
    FOR ALL
    TO dpdp_app_user
    USING (
        thread_id IN (SELECT ct.id FROM clarification_threads ct)
    )
    WITH CHECK (
        thread_id IN (SELECT ct.id FROM clarification_threads ct)
    );

-- ----------------------------------------------------------------------------
-- 5.12 Assessment Scores Policy
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS rls_assessment_scores_policy ON assessment_scores;
CREATE POLICY rls_assessment_scores_policy ON assessment_scores
    FOR ALL
    TO dpdp_app_user
    USING (
        assessment_id IN (SELECT a.id FROM assessments a)
    )
    WITH CHECK (
        assessment_id IN (SELECT a.id FROM assessments a)
    );

-- ----------------------------------------------------------------------------
-- 5.13 Report Snapshots Policy
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS rls_report_snapshots_policy ON report_snapshots;
CREATE POLICY rls_report_snapshots_policy ON report_snapshots
    FOR ALL
    TO dpdp_app_user
    USING (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (
            app_current_user_role() IN ('TLI_LEAD_CONSULTANT', 'TLI_REVIEWER')
            AND assessment_id IN (SELECT a.id FROM assessments a)
        )
        OR (
            app_current_tenant_id() IS NOT NULL
            AND tenant_id = app_current_tenant_id()
        )
    )
    WITH CHECK (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (
            app_current_tenant_id() IS NOT NULL
            AND tenant_id = app_current_tenant_id()
        )
    );

-- ----------------------------------------------------------------------------
-- 5.14 Remediation Tasks & Evidence Policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS rls_remediation_tasks_policy ON remediation_tasks;
CREATE POLICY rls_remediation_tasks_policy ON remediation_tasks
    FOR ALL
    TO dpdp_app_user
    USING (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (
            app_current_user_role() IN ('TLI_LEAD_CONSULTANT', 'TLI_REVIEWER')
            AND assessment_control_id IN (SELECT ac.id FROM assessment_controls ac)
        )
        OR (
            app_current_tenant_id() IS NOT NULL
            AND tenant_id = app_current_tenant_id()
        )
    )
    WITH CHECK (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (
            app_current_tenant_id() IS NOT NULL
            AND tenant_id = app_current_tenant_id()
            AND assessment_control_id IN (SELECT ac.id FROM assessment_controls ac)
        )
    );

DROP POLICY IF EXISTS rls_remediation_evidence_policy ON remediation_evidence_items;
CREATE POLICY rls_remediation_evidence_policy ON remediation_evidence_items
    FOR ALL
    TO dpdp_app_user
    USING (
        remediation_task_id IN (SELECT rt.id FROM remediation_tasks rt)
    )
    WITH CHECK (
        remediation_task_id IN (SELECT rt.id FROM remediation_tasks rt)
    );

-- ----------------------------------------------------------------------------
-- 5.15 Audit Logs Policy
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS rls_audit_logs_policy ON audit_logs;
CREATE POLICY rls_audit_logs_policy ON audit_logs
    FOR ALL
    TO dpdp_app_user
    USING (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (
            app_current_tenant_id() IS NOT NULL
            AND tenant_id = app_current_tenant_id()
        )
    )
    WITH CHECK (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (
            app_current_tenant_id() IS NOT NULL
            AND tenant_id = app_current_tenant_id()
        )
    );

