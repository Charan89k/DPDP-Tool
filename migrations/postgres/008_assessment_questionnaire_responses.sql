-- ============================================================================
-- Truth Labs International (TLI) — DPDP Compliance Gap Analysis Tool
-- Migration 008: Canonical 60-Question Assessment Responses & History (Phase 3D)
--
-- RATIONALE & GOVERNANCE:
-- Accommodates the authoritative 60-question DPDP questionnaire extracted from
-- Truth_Labs_DPDP_60_Question_MS_Forms_Quick_Import_v1.docx.
--
-- Distinct from the 30-control statutory library and 13 database domains:
-- 1. assessment_questionnaire_responses: Scoped to assessment_id, tenant_id, and
--    question_code ('GOV-001' to 'APP-007').
-- 2. questionnaire_response_history: Append-only immutable version audit log
--    protected by enforce_table_immutability() trigger.
-- 3. Strict database-level check: 'Not applicable — justification required'
--    mandates non-empty justification narrative.
-- 4. PostgreSQL Row-Level Security:
--    - Tenant isolation enforced fail-closed at the kernel.
--    - Client users can edit only when assessment status is in permitted lifecycle
--      states ('DRAFT', 'SCOPING', 'SCOPE_LOCKED', 'DATA_GATHERING').
--    - Client viewers and consultants have ZERO write privileges on client responses.
--    - Consultants assigned to the engagement have SELECT read visibility.
-- ============================================================================

-- 1. CREATE ASSESSMENT QUESTIONNAIRE RESPONSES TABLE
CREATE TABLE IF NOT EXISTS assessment_questionnaire_responses (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE RESTRICT,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    question_code VARCHAR(20) NOT NULL,
    questionnaire_version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
    selected_option VARCHAR(100),
    comments_and_justification TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_assessment_question UNIQUE (assessment_id, question_code),
    CONSTRAINT chk_selected_option_valid CHECK (
        selected_option IS NULL OR selected_option IN (
            'Implemented',
            'Partially implemented',
            'Not implemented',
            'Unknown / not verified',
            'Not applicable — justification required'
        )
    ),
    CONSTRAINT chk_na_justification_required CHECK (
        selected_option != 'Not applicable — justification required'
        OR (comments_and_justification IS NOT NULL AND length(trim(comments_and_justification)) > 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_assessment_responses_tenant ON assessment_questionnaire_responses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_assessment_responses_assessment ON assessment_questionnaire_responses(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_responses_qcode ON assessment_questionnaire_responses(question_code);

-- 2. CREATE QUESTIONNAIRE RESPONSE HISTORY TABLE
CREATE TABLE IF NOT EXISTS questionnaire_response_history (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE RESTRICT,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    question_code VARCHAR(20) NOT NULL,
    version_number INT NOT NULL,
    selected_option VARCHAR(100) NOT NULL,
    comments_and_justification TEXT,
    submitted_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_question_response_history UNIQUE (assessment_id, question_code, version_number)
);

CREATE INDEX IF NOT EXISTS idx_response_history_assessment ON questionnaire_response_history(assessment_id, question_code);

-- 3. ENFORCE IMMUTABILITY ON RESPONSE HISTORY TABLE
DROP TRIGGER IF EXISTS trg_questionnaire_response_history_immutable ON questionnaire_response_history;
CREATE TRIGGER trg_questionnaire_response_history_immutable
    BEFORE UPDATE OR DELETE ON questionnaire_response_history
    FOR EACH ROW
    EXECUTE FUNCTION prevent_immutable_record_modification();

-- 4. ENABLE & FORCE ROW-LEVEL SECURITY
ALTER TABLE assessment_questionnaire_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_questionnaire_responses FORCE ROW LEVEL SECURITY;

ALTER TABLE questionnaire_response_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_response_history FORCE ROW LEVEL SECURITY;

-- 5. RLS POLICIES FOR assessment_questionnaire_responses

-- SELECT POLICY:
-- Super admin, tenant member, or assigned consultant
DROP POLICY IF EXISTS rls_q_responses_select_policy ON assessment_questionnaire_responses;
CREATE POLICY rls_q_responses_select_policy ON assessment_questionnaire_responses
    FOR SELECT
    TO dpdp_app_user
    USING (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (app_current_tenant_id() IS NOT NULL AND tenant_id = app_current_tenant_id())
        OR (
            app_current_user_role() IN ('TLI_LEAD_CONSULTANT', 'TLI_REVIEWER')
            AND is_user_assigned_to_assessment(assessment_id, app_current_user_id())
        )
    );

-- INSERT POLICY:
-- Client admin/bu_lead/contributor within own tenant while assessment is in editable state
DROP POLICY IF EXISTS rls_q_responses_insert_policy ON assessment_questionnaire_responses;
CREATE POLICY rls_q_responses_insert_policy ON assessment_questionnaire_responses
    FOR INSERT
    TO dpdp_app_user
    WITH CHECK (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (
            app_current_tenant_id() IS NOT NULL
            AND tenant_id = app_current_tenant_id()
            AND app_current_user_role() IN ('CLIENT_ADMIN', 'CLIENT_BU_LEAD', 'CLIENT_CONTRIBUTOR')
            AND assessment_id IN (
                SELECT a.id FROM assessments a
                WHERE a.tenant_id = app_current_tenant_id()
                  AND a.status IN ('DRAFT', 'SCOPING', 'SCOPE_LOCKED', 'DATA_GATHERING')
            )
        )
    );

-- UPDATE POLICY:
-- Same conditions as INSERT
DROP POLICY IF EXISTS rls_q_responses_update_policy ON assessment_questionnaire_responses;
CREATE POLICY rls_q_responses_update_policy ON assessment_questionnaire_responses
    FOR UPDATE
    TO dpdp_app_user
    USING (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (
            app_current_tenant_id() IS NOT NULL
            AND tenant_id = app_current_tenant_id()
            AND app_current_user_role() IN ('CLIENT_ADMIN', 'CLIENT_BU_LEAD', 'CLIENT_CONTRIBUTOR')
            AND assessment_id IN (
                SELECT a.id FROM assessments a
                WHERE a.tenant_id = app_current_tenant_id()
                  AND a.status IN ('DRAFT', 'SCOPING', 'SCOPE_LOCKED', 'DATA_GATHERING')
            )
        )
    )
    WITH CHECK (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (
            app_current_tenant_id() IS NOT NULL
            AND tenant_id = app_current_tenant_id()
            AND app_current_user_role() IN ('CLIENT_ADMIN', 'CLIENT_BU_LEAD', 'CLIENT_CONTRIBUTOR')
            AND assessment_id IN (
                SELECT a.id FROM assessments a
                WHERE a.tenant_id = app_current_tenant_id()
                  AND a.status IN ('DRAFT', 'SCOPING', 'SCOPE_LOCKED', 'DATA_GATHERING')
            )
        )
    );

-- 6. RLS POLICIES FOR questionnaire_response_history

DROP POLICY IF EXISTS rls_q_history_select_policy ON questionnaire_response_history;
CREATE POLICY rls_q_history_select_policy ON questionnaire_response_history
    FOR SELECT
    TO dpdp_app_user
    USING (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (app_current_tenant_id() IS NOT NULL AND tenant_id = app_current_tenant_id())
        OR (
            app_current_user_role() IN ('TLI_LEAD_CONSULTANT', 'TLI_REVIEWER')
            AND is_user_assigned_to_assessment(assessment_id, app_current_user_id())
        )
    );

DROP POLICY IF EXISTS rls_q_history_insert_policy ON questionnaire_response_history;
CREATE POLICY rls_q_history_insert_policy ON questionnaire_response_history
    FOR INSERT
    TO dpdp_app_user
    WITH CHECK (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (
            app_current_tenant_id() IS NOT NULL
            AND tenant_id = app_current_tenant_id()
            AND app_current_user_role() IN ('CLIENT_ADMIN', 'CLIENT_BU_LEAD', 'CLIENT_CONTRIBUTOR')
            AND submitted_by_id = app_current_user_id()
            AND assessment_id IN (
                SELECT a.id FROM assessments a
                WHERE a.tenant_id = app_current_tenant_id()
                  AND a.status IN ('DRAFT', 'SCOPING', 'SCOPE_LOCKED', 'DATA_GATHERING')
            )
        )
    );

-- 7. GRANTS TO RUNTIME APPLICATION ROLE
GRANT SELECT, INSERT, UPDATE ON assessment_questionnaire_responses TO dpdp_app_user;
GRANT SELECT, INSERT ON questionnaire_response_history TO dpdp_app_user;
