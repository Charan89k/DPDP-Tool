-- ============================================================================
-- Migration: 001_initial_schema.sql
-- Description: Core relational schema for TLI DPDP Compliance Gap Analysis Tool
-- Version: 1.0.0
-- Author: Principal Software Architect / Database Security Engineer
-- Target: PostgreSQL 16+
-- Rollback Procedure:
--   DROP SCHEMA public CASCADE; CREATE SCHEMA public;
--   (Or drop tables in reverse dependency order)
-- ============================================================================

-- 1. EXTENSIONS & CORE FUNCTIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Pure PL/pgSQL UUIDv7 Generator (Zero External C-Extensions Required)
-- Generates time-ordered UUIDs (Unix epoch ms in high 48 bits, version 7, variant 2)
CREATE OR REPLACE FUNCTION generate_uuid_v7() RETURNS UUID AS $$
DECLARE
    unix_time_ms BIGINT;
    uuid_bytes BYTEA;
BEGIN
    unix_time_ms := FLOOR(EXTRACT(EPOCH FROM CLOCK_TIMESTAMP()) * 1000);
    uuid_bytes := set_byte(
        set_byte(
            gen_random_bytes(16),
            6, (get_byte(gen_random_bytes(1), 0) & 15) | 112 -- Version 7: 0111xxxx
        ),
        8, (get_byte(gen_random_bytes(1), 0) & 63) | 128  -- Variant 2: 10xxxxxx
    );
    -- Set 48-bit timestamp
    uuid_bytes := set_byte(uuid_bytes, 0, ((unix_time_ms >> 40) & 255)::INT);
    uuid_bytes := set_byte(uuid_bytes, 1, ((unix_time_ms >> 32) & 255)::INT);
    uuid_bytes := set_byte(uuid_bytes, 2, ((unix_time_ms >> 24) & 255)::INT);
    uuid_bytes := set_byte(uuid_bytes, 3, ((unix_time_ms >> 16) & 255)::INT);
    uuid_bytes := set_byte(uuid_bytes, 4, ((unix_time_ms >> 8) & 255)::INT);
    uuid_bytes := set_byte(uuid_bytes, 5, (unix_time_ms & 255)::INT);
    RETURN encode(uuid_bytes, 'hex')::UUID;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Migration History Tracking Table
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    checksum CHAR(64) NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 2. ENUMERATED TYPES
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE tenant_type AS ENUM ('TLI', 'CLIENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE tenant_status AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
        'TLI_SUPER_ADMIN',
        'TLI_LEAD_CONSULTANT',
        'TLI_REVIEWER',
        'CLIENT_ADMIN',
        'CLIENT_BU_LEAD',
        'CLIENT_CONTRIBUTOR',
        'CLIENT_VIEWER'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE processing_ground AS ENUM (
        'CONSENT_SECTION_6',
        'VOLUNTARY_SECTION_7_A',
        'STATE_BENEFITS_SECTION_7_B',
        'STATE_FUNCTIONS_SECTION_7_C',
        'LEGAL_DECREE_SECTION_7_D',
        'MEDICAL_EMERGENCY_SECTION_7_E',
        'EMPLOYMENT_SECTION_7_G'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE legal_source_type AS ENUM (
        'ENACTED_STATUTE',
        'COMMENCEMENT_NOTIFICATION',
        'NOTIFIED_RULES',
        'OFFICIAL_ORDER',
        'CONSTITUTIONAL_REFERENCE',
        'SECTORAL_REGULATION'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE source_commencement_status AS ENUM (
        'IN_FORCE',
        'PHASED_COMMENCEMENT',
        'SCHEDULED_COMMENCEMENT_13_NOV_2026',
        'SCHEDULED_COMMENCEMENT_13_MAY_2027',
        'AWAITING_COMMENCEMENT_NOTIFICATION'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE obligation_type AS ENUM (
        'MANDATORY_STATUTORY',
        'STATUTORY_EXCEPTION_CONDITIONAL',
        'SDF_MANDATORY_CONDITIONAL',
        'TLI_RECOMMENDED_PRACTICE'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE framework_status AS ENUM ('DRAFT', 'ACTIVE', 'DEPRECATED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    -- Reconciled: Includes TIER_5_10K following Phase 2 remediation of Section 15 statutory ceiling
    CREATE TYPE penalty_tier AS ENUM (
        'TIER_1_250CR',
        'TIER_2_200CR',
        'TIER_3_150CR',
        'TIER_4_50CR',
        'TIER_5_10K'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE assessment_status AS ENUM (
        'DRAFT',
        'SCOPING',
        'SCOPE_LOCKED',
        'DATA_GATHERING',
        'SUBMITTED_FOR_REVIEW',
        'UNDER_REVIEW',
        'CLARIFICATION_PENDING',
        'REVIEW_COMPLETED',
        'DRAFT_REPORT_GENERATED',
        'LEAD_APPROVED',
        'FINAL_ISSUED',
        'REMEDIATION_ACTIVE',
        'CANCELLED',
        'ARCHIVED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE verification_status AS ENUM (
        'UNANSWERED',
        'IN_PROGRESS',
        'ANSWERED',
        'UNDER_EVALUATION',
        'CLARIFICATION_REQUESTED',
        'VERIFIED_COMPLIANT',
        'PARTIALLY_COMPLIANT',
        'NON_COMPLIANT',
        'UNASSESSED_DEFICIT',
        'EXCLUSION_PROPOSED',
        'EXCLUSION_APPROVED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE gap_severity AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE evidence_status AS ENUM ('PENDING_SCAN', 'ACTIVE', 'REJECTED', 'SUPERSEDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE remediation_status AS ENUM (
        'OPEN',
        'IN_REMEDIATION',
        'SUBMITTED_FOR_CLOSURE',
        'VALIDATED_CLOSED',
        'REJECTED_REOPENED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 3. TENANT & IDENTITY TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    type tenant_type NOT NULL DEFAULT 'CLIENT',
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    industry VARCHAR(100),
    is_sdf BOOLEAN NOT NULL DEFAULT FALSE,
    dpo_name VARCHAR(255),
    dpo_email VARCHAR(255),
    status tenant_status NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS business_units (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_bu_code UNIQUE (tenant_id, code)
);
CREATE INDEX IF NOT EXISTS idx_business_units_tenant ON business_units(tenant_id);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    role user_role NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_secret_encrypted TEXT,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_tenant_role ON users(tenant_id, role);

CREATE TABLE IF NOT EXISTS processing_activities (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    business_unit_id UUID REFERENCES business_units(id) ON DELETE SET NULL,
    activity_name VARCHAR(255) NOT NULL,
    purpose_description TEXT NOT NULL,
    data_principal_category VARCHAR(150) NOT NULL,
    personal_data_categories JSONB NOT NULL,
    statutory_ground processing_ground NOT NULL,
    external_processors JSONB,
    cross_border_transfer BOOLEAN NOT NULL DEFAULT FALSE,
    destination_countries TEXT[],
    retention_period_months INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_processing_activities_tenant ON processing_activities(tenant_id);

-- ============================================================================
-- 4. CANONICAL LEGAL FRAMEWORK & CONTROL LIBRARY TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS legal_sources (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    source_id VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'SRC-01'
    title VARCHAR(255) NOT NULL,
    citation VARCHAR(150) NOT NULL,
    issuing_authority VARCHAR(255) NOT NULL,
    publication_date DATE NOT NULL,
    gazette_reference VARCHAR(255),
    source_type legal_source_type NOT NULL,
    commencement_status source_commencement_status NOT NULL,
    url TEXT,
    verification_status VARCHAR(50) NOT NULL DEFAULT 'VERIFIED_PRIMARY_SOURCE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS framework_versions (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    code VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'DPDPA-2023-V1.0'
    name VARCHAR(255) NOT NULL,
    description TEXT,
    legal_basis VARCHAR(255) NOT NULL DEFAULT 'Digital Personal Data Protection Act, 2023',
    status framework_status NOT NULL DEFAULT 'DRAFT',
    effective_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scoring_models (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    code VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'SCORING-V1-STANDARD-WEIGHTED'
    name VARCHAR(255) NOT NULL,
    version VARCHAR(20) NOT NULL,
    formula_definition JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS control_domains (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    framework_version_id UUID NOT NULL REFERENCES framework_versions(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    statutory_focus VARCHAR(255),
    weight NUMERIC(5,2) NOT NULL DEFAULT 1.0,
    order_index INT NOT NULL,
    CONSTRAINT uq_framework_domain_code UNIQUE (framework_version_id, code)
);

CREATE TABLE IF NOT EXISTS controls (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    framework_version_id UUID NOT NULL REFERENCES framework_versions(id) ON DELETE RESTRICT,
    domain_id UUID NOT NULL REFERENCES control_domains(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL, -- e.g., 'TLI-DPDP-SCO-01'
    control_version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    source_id UUID REFERENCES legal_sources(id) ON DELETE RESTRICT,
    source_provision VARCHAR(150) NOT NULL,
    title VARCHAR(255) NOT NULL,
    intent TEXT NOT NULL,
    obligation_type obligation_type NOT NULL DEFAULT 'MANDATORY_STATUTORY',
    legal_reference_summary TEXT NOT NULL,
    applicability_conditions TEXT NOT NULL,
    applicability_rationale TEXT NOT NULL,
    assessment_question TEXT NOT NULL,
    implementation_expectations TEXT NOT NULL,
    acceptable_evidence JSONB NOT NULL,
    evidence_limitations TEXT,
    assessment_guidance TEXT,
    risk_guidance TEXT,
    suggested_remediation TEXT,
    related_control_ids JSONB,
    penalty_tier penalty_tier NOT NULL DEFAULT 'TIER_4_50CR',
    default_weight NUMERIC(5,2) NOT NULL DEFAULT 1.0,
    order_index INT NOT NULL,
    is_sdf_only BOOLEAN NOT NULL DEFAULT FALSE,
    legal_review_status VARCHAR(50) NOT NULL DEFAULT 'PROVISIONAL_RESEARCH_COMPLETE',
    methodology_review_status VARCHAR(50) NOT NULL DEFAULT 'METHODOLOGY_REVIEW_PENDING',
    review_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_framework_control_code UNIQUE (framework_version_id, code)
);
CREATE INDEX IF NOT EXISTS idx_controls_domain ON controls(domain_id);
CREATE INDEX IF NOT EXISTS idx_controls_source ON controls(source_id);

CREATE TABLE IF NOT EXISTS evidence_types (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    evidence_type_id VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'EVID-ROPA-01'
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    linked_controls JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'MANDATORY',
    confidentiality_tier VARCHAR(50) NOT NULL,
    recommended_freshness VARCHAR(100),
    acceptable_examples JSONB,
    alternative_evidence TEXT,
    verification_procedure JSONB,
    limitations_and_weaknesses TEXT,
    masking_and_redaction_requirements TEXT,
    retention_considerations TEXT,
    reviewer_guidance TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 5. ASSESSMENT ENGAGEMENT TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS assessments (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    framework_version_id UUID NOT NULL REFERENCES framework_versions(id) ON DELETE RESTRICT,
    scoring_model_id UUID NOT NULL REFERENCES scoring_models(id) ON DELETE RESTRICT,
    parent_assessment_id UUID REFERENCES assessments(id) ON DELETE SET NULL,
    engagement_code VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    status assessment_status NOT NULL DEFAULT 'DRAFT',
    lead_consultant_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    is_partial_assessment BOOLEAN NOT NULL DEFAULT FALSE,
    target_completion_date DATE,
    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    issued_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_assessments_tenant_status ON assessments(tenant_id, status);

CREATE TABLE IF NOT EXISTS assessment_assignments (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assignment_role VARCHAR(50) NOT NULL CHECK (assignment_role IN ('ENGAGEMENT_LEAD', 'REVIEWER', 'CLIENT_COORDINATOR')),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_assessment_user UNIQUE (assessment_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_assignments_assessment ON assessment_assignments(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assignments_user ON assessment_assignments(user_id);

CREATE TABLE IF NOT EXISTS assessment_controls (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE RESTRICT,
    control_id UUID NOT NULL REFERENCES controls(id) ON DELETE RESTRICT,
    business_unit_id UUID REFERENCES business_units(id) ON DELETE SET NULL,
    assigned_contributor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Scoping & Exclusions
    is_applicable BOOLEAN NOT NULL DEFAULT TRUE,
    exclusion_justification TEXT,
    exclusion_approved_by_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    exclusion_approved_at TIMESTAMPTZ,
    
    -- Client Response State
    verification_status verification_status NOT NULL DEFAULT 'UNANSWERED',
    current_response_narrative TEXT,
    current_self_maturity_score SMALLINT CHECK (current_self_maturity_score BETWEEN 0 AND 5),
    response_submitted_at TIMESTAMPTZ,
    
    -- Consultant Review & Findings
    reviewer_verified_maturity_score SMALLINT CHECK (reviewer_verified_maturity_score BETWEEN 0 AND 5),
    reviewer_eval_notes TEXT,
    gap_findings TEXT,
    remediation_recommendation TEXT,
    gap_severity gap_severity,
    score_override_reason TEXT,
    evaluated_by_reviewer_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    evaluated_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_assessment_control UNIQUE (assessment_id, control_id)
);
CREATE INDEX IF NOT EXISTS idx_assessment_controls_status ON assessment_controls(assessment_id, verification_status);
CREATE INDEX IF NOT EXISTS idx_assessment_controls_contributor ON assessment_controls(assigned_contributor_id);

CREATE TABLE IF NOT EXISTS assessment_control_activities (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    assessment_control_id UUID NOT NULL REFERENCES assessment_controls(id) ON DELETE RESTRICT,
    processing_activity_id UUID NOT NULL REFERENCES processing_activities(id) ON DELETE RESTRICT,
    CONSTRAINT uq_control_activity UNIQUE (assessment_control_id, processing_activity_id)
);

CREATE TABLE IF NOT EXISTS control_response_history (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    assessment_control_id UUID NOT NULL REFERENCES assessment_controls(id) ON DELETE RESTRICT,
    version_number INT NOT NULL,
    response_narrative TEXT NOT NULL,
    self_maturity_score SMALLINT CHECK (self_maturity_score BETWEEN 0 AND 5),
    submitted_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_control_response_version UNIQUE (assessment_control_id, version_number)
);
CREATE INDEX IF NOT EXISTS idx_response_history_control ON control_response_history(assessment_control_id, version_number);

-- ============================================================================
-- 6. EVIDENCE VAULT & CLARIFICATION ENGINE
-- ============================================================================

CREATE TABLE IF NOT EXISTS evidence_items (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    assessment_control_id UUID NOT NULL REFERENCES assessment_controls(id) ON DELETE RESTRICT,
    evidence_type_id UUID REFERENCES evidence_types(id) ON DELETE SET NULL,
    uploaded_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
    mime_type VARCHAR(100) NOT NULL,
    s3_key VARCHAR(512) NOT NULL,
    s3_bucket VARCHAR(255) NOT NULL,
    sha256_hash CHAR(64) NOT NULL,
    encryption_kms_key_id VARCHAR(255),
    status evidence_status NOT NULL DEFAULT 'ACTIVE',
    redaction_certified_by_client BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Consultant Verification State
    verified_by_reviewer_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    verification_notes TEXT,
    verified_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_evidence_tenant ON evidence_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_evidence_control ON evidence_items(assessment_control_id);
CREATE INDEX IF NOT EXISTS idx_evidence_hash ON evidence_items(sha256_hash);

CREATE TABLE IF NOT EXISTS clarification_threads (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    assessment_control_id UUID NOT NULL REFERENCES assessment_controls(id) ON DELETE RESTRICT,
    raised_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_clarification_threads_control ON clarification_threads(assessment_control_id);

CREATE TABLE IF NOT EXISTS clarification_messages (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    thread_id UUID NOT NULL REFERENCES clarification_threads(id) ON DELETE RESTRICT,
    author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    message_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_clarification_messages_thread ON clarification_messages(thread_id);

-- ============================================================================
-- 7. SCORING SNAPSHOTS, REPORTS & REMEDIATION MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS assessment_scores (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE RESTRICT,
    scoring_model_id UUID NOT NULL REFERENCES scoring_models(id) ON DELETE RESTRICT,
    overall_maturity_score NUMERIC(4,2) NOT NULL,
    overall_coverage_pct NUMERIC(5,2) NOT NULL,
    domain_scores_json JSONB NOT NULL,
    statutory_deficits_count INT NOT NULL DEFAULT 0,
    critical_gaps_count INT NOT NULL DEFAULT 0,
    high_gaps_count INT NOT NULL DEFAULT 0,
    medium_gaps_count INT NOT NULL DEFAULT 0,
    low_gaps_count INT NOT NULL DEFAULT 0,
    potential_penalty_exposure_inr BIGINT NOT NULL DEFAULT 0,
    calculation_hash CHAR(64) NOT NULL,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_scores_assessment ON assessment_scores(assessment_id);

CREATE TABLE IF NOT EXISTS report_snapshots (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE RESTRICT,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    report_type VARCHAR(10) NOT NULL CHECK (report_type IN ('PDF', 'XLSX')),
    version_label VARCHAR(50) NOT NULL,
    s3_key VARCHAR(512) NOT NULL,
    file_sha256_hash CHAR(64) NOT NULL,
    dataset_sha256_hash CHAR(64) NOT NULL,
    generated_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    lead_approver_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    approved_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_reports_assessment ON report_snapshots(assessment_id, tenant_id);

CREATE TABLE IF NOT EXISTS remediation_tasks (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    assessment_control_id UUID NOT NULL REFERENCES assessment_controls(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    priority gap_severity NOT NULL,
    target_date DATE NOT NULL,
    owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status remediation_status NOT NULL DEFAULT 'OPEN',
    closure_submission_notes TEXT,
    closure_submitted_at TIMESTAMPTZ,
    closure_validated_by_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    closure_validation_notes TEXT,
    validated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_remediation_tenant_status ON remediation_tasks(tenant_id, status);

CREATE TABLE IF NOT EXISTS remediation_evidence_items (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    remediation_task_id UUID NOT NULL REFERENCES remediation_tasks(id) ON DELETE RESTRICT,
    evidence_item_id UUID NOT NULL REFERENCES evidence_items(id) ON DELETE RESTRICT,
    attached_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_remediation_evidence UNIQUE (remediation_task_id, evidence_item_id)
);
CREATE INDEX IF NOT EXISTS idx_remediation_evidence_task ON remediation_evidence_items(remediation_task_id);

-- ============================================================================
-- 8. IMMUTABLE FORENSIC AUDIT LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT,
    user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    ip_address INET,
    user_agent TEXT,
    previous_state JSONB,
    new_state JSONB,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_time ON audit_logs(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);

-- ============================================================================
-- 9. FORENSIC IMMUTABILITY TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_immutable_record_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'FORENSIC_INTEGRITY_VIOLATION: Table % is strictly append-only. UPDATE and DELETE operations are prohibited.',
        TG_TABLE_NAME
        USING ERRCODE = '23505';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_immutable_record_modification();

DROP TRIGGER IF EXISTS trg_response_history_immutable ON control_response_history;
CREATE TRIGGER trg_response_history_immutable
    BEFORE UPDATE OR DELETE ON control_response_history
    FOR EACH ROW
    EXECUTE FUNCTION prevent_immutable_record_modification();

DROP TRIGGER IF EXISTS trg_report_snapshots_immutable ON report_snapshots;
CREATE TRIGGER trg_report_snapshots_immutable
    BEFORE UPDATE OR DELETE ON report_snapshots
    FOR EACH ROW
    EXECUTE FUNCTION prevent_immutable_record_modification();

