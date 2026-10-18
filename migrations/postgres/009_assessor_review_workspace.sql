-- ============================================================================
-- Truth Labs International (TLI) — DPDP Compliance Gap Analysis Tool
-- Migration 009: Assessor Review Workspace & Clarification Threads (Phase 3D.2)
--
-- RATIONALE & GOVERNANCE:
-- Accommodates independent assessor evaluations for the 60 canonical questions
-- extracted from Truth_Labs_DPDP_60_Question_MS_Forms_Quick_Import_v1.docx.
--
-- ARCHITECTURAL SEPARATION OF CONCERNS:
-- 1. Client responses in 'assessment_questionnaire_responses' remain immutable to
--    consultants and assessors. Assessors NEVER overwrite client submissions.
-- 2. 'questionnaire_assessor_reviews': Stores independent assessor review findings,
--    statutory verification status, evidence deficiency notes, and follow-up flags.
-- 3. 'questionnaire_assessor_review_history': Immutable append-only version log
--    protected by prevent_immutable_record_modification() trigger.
-- 4. 'clarification_threads' & 'clarification_messages':
--    - Relax assessment_control_id NOT NULL constraint.
--    - Add direct (assessment_id, question_code) binding so clarifications can be
--      raised against any of the 60 canonical questions.
-- 5. 'evidence_items':
--    - Relax assessment_control_id NOT NULL constraint.
--    - Add optional assessment_id and question_code columns for direct question binding.
-- 6. PostgreSQL Row-Level Security:
--    - Assessor write operations restricted strictly to TLI_SUPER_ADMIN and assigned
--      consultants (is_user_assigned_to_assessment).
--    - Client users and unassigned consultants have ZERO write privileges on reviews.
--    - Client users have SELECT read access to reviews and clarification threads
--      for assessments belonging to their tenant.
-- ============================================================================

-- 1. CREATE ASSESSOR REVIEWS TABLE
CREATE TABLE IF NOT EXISTS questionnaire_assessor_reviews (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE RESTRICT,
    question_code VARCHAR(20) NOT NULL,
    review_status VARCHAR(50) NOT NULL DEFAULT 'PENDING_REVIEW',
    review_findings TEXT,
    evidence_deficiency_notes TEXT,
    requires_further_validation BOOLEAN NOT NULL DEFAULT FALSE,
    reviewed_by_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_assessment_question_review UNIQUE (assessment_id, question_code),
    CONSTRAINT chk_review_status_valid CHECK (
        review_status IN (
            'PENDING_REVIEW',
            'UNDER_REVIEW',
            'VERIFIED_COMPLIANT',
            'PARTIALLY_COMPLIANT',
            'NON_COMPLIANT',
            'CLARIFICATION_REQUESTED',
            'EXCLUSION_VERIFIED'
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_assessor_reviews_assessment 
    ON questionnaire_assessor_reviews(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessor_reviews_qcode 
    ON questionnaire_assessor_reviews(question_code);
CREATE INDEX IF NOT EXISTS idx_assessor_reviews_status 
    ON questionnaire_assessor_reviews(assessment_id, review_status);

-- 2. CREATE ASSESSOR REVIEW HISTORY TABLE
CREATE TABLE IF NOT EXISTS questionnaire_assessor_review_history (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE RESTRICT,
    question_code VARCHAR(20) NOT NULL,
    version_number INT NOT NULL,
    review_status VARCHAR(50) NOT NULL,
    review_findings TEXT,
    evidence_deficiency_notes TEXT,
    requires_further_validation BOOLEAN NOT NULL DEFAULT FALSE,
    reviewed_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_assessor_review_history UNIQUE (assessment_id, question_code, version_number)
);

CREATE INDEX IF NOT EXISTS idx_assessor_review_hist_assessment 
    ON questionnaire_assessor_review_history(assessment_id, question_code);

-- 3. ENFORCE IMMUTABILITY ON REVIEW HISTORY
DROP TRIGGER IF EXISTS trg_questionnaire_assessor_review_history_immutable 
    ON questionnaire_assessor_review_history;
CREATE TRIGGER trg_questionnaire_assessor_review_history_immutable
    BEFORE UPDATE OR DELETE ON questionnaire_assessor_review_history
    FOR EACH ROW
    EXECUTE FUNCTION prevent_immutable_record_modification();

-- 4. EXPAND CLARIFICATION THREADS TO SUPPORT CANONICAL QUESTION CODES
ALTER TABLE clarification_threads 
    ALTER COLUMN assessment_control_id DROP NOT NULL;

ALTER TABLE clarification_threads 
    ADD COLUMN IF NOT EXISTS assessment_id UUID REFERENCES assessments(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS question_code VARCHAR(20);

-- Backfill assessment_id for existing control-based clarification threads
UPDATE clarification_threads ct
SET assessment_id = ac.assessment_id
FROM assessment_controls ac
WHERE ct.assessment_control_id = ac.id AND ct.assessment_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_clarification_threads_assessment_qcode 
    ON clarification_threads(assessment_id, question_code);

-- 5. EXPAND EVIDENCE ITEMS TO SUPPORT CANONICAL QUESTION CODES
ALTER TABLE evidence_items 
    ALTER COLUMN assessment_control_id DROP NOT NULL;

ALTER TABLE evidence_items 
    ADD COLUMN IF NOT EXISTS assessment_id UUID REFERENCES assessments(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS question_code VARCHAR(20);

-- Backfill assessment_id for existing control-based evidence items
UPDATE evidence_items ei
SET assessment_id = ac.assessment_id
FROM assessment_controls ac
WHERE ei.assessment_control_id = ac.id AND ei.assessment_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_evidence_items_assessment_qcode 
    ON evidence_items(assessment_id, question_code);

-- 6. ENABLE & FORCE ROW LEVEL SECURITY ON NEW TABLES
ALTER TABLE questionnaire_assessor_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_assessor_reviews FORCE ROW LEVEL SECURITY;

ALTER TABLE questionnaire_assessor_review_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_assessor_review_history FORCE ROW LEVEL SECURITY;

-- 7. RLS POLICIES FOR questionnaire_assessor_reviews

-- SELECT POLICY:
-- Super admin, assigned consultant, or client tenant member
DROP POLICY IF EXISTS rls_q_reviews_select_policy ON questionnaire_assessor_reviews;
CREATE POLICY rls_q_reviews_select_policy ON questionnaire_assessor_reviews
    FOR SELECT
    TO dpdp_app_user
    USING (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (
            app_current_user_role() IN ('TLI_LEAD_CONSULTANT', 'TLI_REVIEWER')
            AND is_user_assigned_to_assessment(assessment_id, app_current_user_id())
        )
        OR (
            app_current_tenant_id() IS NOT NULL
            AND get_assessment_tenant_id(assessment_id) = app_current_tenant_id()
        )
    );

-- INSERT POLICY:
-- ONLY Super Admin or assigned consultants
DROP POLICY IF EXISTS rls_q_reviews_insert_policy ON questionnaire_assessor_reviews;
CREATE POLICY rls_q_reviews_insert_policy ON questionnaire_assessor_reviews
    FOR INSERT
    TO dpdp_app_user
    WITH CHECK (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (
            app_current_user_role() IN ('TLI_LEAD_CONSULTANT', 'TLI_REVIEWER')
            AND is_user_assigned_to_assessment(assessment_id, app_current_user_id())
        )
    );

-- UPDATE POLICY:
-- ONLY Super Admin or assigned consultants
DROP POLICY IF EXISTS rls_q_reviews_update_policy ON questionnaire_assessor_reviews;
CREATE POLICY rls_q_reviews_update_policy ON questionnaire_assessor_reviews
    FOR UPDATE
    TO dpdp_app_user
    USING (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (
            app_current_user_role() IN ('TLI_LEAD_CONSULTANT', 'TLI_REVIEWER')
            AND is_user_assigned_to_assessment(assessment_id, app_current_user_id())
        )
    )
    WITH CHECK (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (
            app_current_user_role() IN ('TLI_LEAD_CONSULTANT', 'TLI_REVIEWER')
            AND is_user_assigned_to_assessment(assessment_id, app_current_user_id())
        )
    );

-- 8. RLS POLICIES FOR questionnaire_assessor_review_history

DROP POLICY IF EXISTS rls_q_review_history_select_policy ON questionnaire_assessor_review_history;
CREATE POLICY rls_q_review_history_select_policy ON questionnaire_assessor_review_history
    FOR SELECT
    TO dpdp_app_user
    USING (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (
            app_current_user_role() IN ('TLI_LEAD_CONSULTANT', 'TLI_REVIEWER')
            AND is_user_assigned_to_assessment(assessment_id, app_current_user_id())
        )
        OR (
            app_current_tenant_id() IS NOT NULL
            AND get_assessment_tenant_id(assessment_id) = app_current_tenant_id()
        )
    );

DROP POLICY IF EXISTS rls_q_review_history_insert_policy ON questionnaire_assessor_review_history;
CREATE POLICY rls_q_review_history_insert_policy ON questionnaire_assessor_review_history
    FOR INSERT
    TO dpdp_app_user
    WITH CHECK (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (
            app_current_user_role() IN ('TLI_LEAD_CONSULTANT', 'TLI_REVIEWER')
            AND is_user_assigned_to_assessment(assessment_id, app_current_user_id())
            AND reviewed_by_user_id = app_current_user_id()
        )
    );

-- 9. UPDATE RLS POLICIES FOR clarification_threads & clarification_messages

DROP POLICY IF EXISTS rls_clarification_threads_policy ON clarification_threads;
CREATE POLICY rls_clarification_threads_policy ON clarification_threads
    FOR ALL
    TO dpdp_app_user
    USING (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (
            assessment_control_id IS NOT NULL 
            AND assessment_control_id IN (SELECT ac.id FROM assessment_controls ac)
        )
        OR (
            assessment_id IS NOT NULL AND (
                (app_current_tenant_id() IS NOT NULL AND get_assessment_tenant_id(assessment_id) = app_current_tenant_id())
                OR (
                    app_current_user_role() IN ('TLI_LEAD_CONSULTANT', 'TLI_REVIEWER')
                    AND is_user_assigned_to_assessment(assessment_id, app_current_user_id())
                )
            )
        )
    )
    WITH CHECK (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (
            assessment_control_id IS NOT NULL 
            AND assessment_control_id IN (SELECT ac.id FROM assessment_controls ac)
        )
        OR (
            assessment_id IS NOT NULL AND (
                (app_current_tenant_id() IS NOT NULL AND get_assessment_tenant_id(assessment_id) = app_current_tenant_id())
                OR (
                    app_current_user_role() IN ('TLI_LEAD_CONSULTANT', 'TLI_REVIEWER')
                    AND is_user_assigned_to_assessment(assessment_id, app_current_user_id())
                )
            )
        )
    );

-- 10. UPDATE RLS POLICY FOR evidence_items

DROP POLICY IF EXISTS rls_evidence_items_policy ON evidence_items;
CREATE POLICY rls_evidence_items_policy ON evidence_items
    FOR ALL
    TO dpdp_app_user
    USING (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (
            app_current_user_role() IN ('TLI_LEAD_CONSULTANT', 'TLI_REVIEWER')
            AND (
                (assessment_control_id IS NOT NULL AND assessment_control_id IN (SELECT ac.id FROM assessment_controls ac))
                OR (assessment_id IS NOT NULL AND is_user_assigned_to_assessment(assessment_id, app_current_user_id()))
            )
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

-- 11. RUNTIME APPLICATION ROLE GRANTS
GRANT SELECT, INSERT, UPDATE ON questionnaire_assessor_reviews TO dpdp_app_user;
GRANT SELECT, INSERT ON questionnaire_assessor_review_history TO dpdp_app_user;

-- 12. SEED INITIAL SYNTHETIC ASSESSOR REVIEWS FOR ALPHA HEALTHCARE DEMO ENGAGEMENT
INSERT INTO questionnaire_assessor_reviews (
    id, assessment_id, question_code, review_status, review_findings,
    evidence_deficiency_notes, requires_further_validation,
    reviewed_by_user_id, reviewed_at
)
VALUES
    (
        '018f3a5b-7c8d-7e90-8000-000000000501',
        '018f3a5b-7c8d-7e90-8000-000000000201',
        'GOV-001',
        'VERIFIED_COMPLIANT',
        'Verified corporate governance charter and appointment of Data Protection Officer under Section 8(1). Board charter confirmed.',
        NULL,
        FALSE,
        '018f3a5b-7c8d-7e90-8000-000000000103',
        CURRENT_TIMESTAMP - INTERVAL '2 days'
    ),
    (
        '018f3a5b-7c8d-7e90-8000-000000000502',
        '018f3a5b-7c8d-7e90-8000-000000000201',
        'NOT-001',
        'PARTIALLY_COMPLIANT',
        'Patient registration notice contains itemised purposes but lacks localized translations in Schedule 8 languages.',
        'Requires certified regional language translations (Hindi/Marathi) and DPBI grievance escalation URL.',
        TRUE,
        '018f3a5b-7c8d-7e90-8000-000000000103',
        CURRENT_TIMESTAMP - INTERVAL '1 day'
    ),
    (
        '018f3a5b-7c8d-7e90-8000-000000000503',
        '018f3a5b-7c8d-7e90-8000-000000000201',
        'SEC-001',
        'VERIFIED_COMPLIANT',
        'AWS KMS encryption architecture and SOC 2 Type II attestation reviewed and verified compliant under Section 8(5).',
        NULL,
        FALSE,
        '018f3a5b-7c8d-7e90-8000-000000000103',
        CURRENT_TIMESTAMP - INTERVAL '1 day'
    ),
    (
        '018f3a5b-7c8d-7e90-8000-000000000504',
        '018f3a5b-7c8d-7e90-8000-000000000201',
        'DAT-001',
        'CLARIFICATION_REQUESTED',
        'Processing activity inventory provided covers clinical BU, but telemetry and corporate employee databases appear missing from current RoPA.',
        'Clarification requested from client coordinator regarding scope of corporate HR telemetry.',
        TRUE,
        '018f3a5b-7c8d-7e90-8000-000000000103',
        CURRENT_TIMESTAMP - INTERVAL '12 hours'
    )
ON CONFLICT (assessment_id, question_code) DO NOTHING;

-- Seed a clarification thread linked to DAT-001
INSERT INTO clarification_threads (
    id, assessment_id, question_code, raised_by_user_id, title, status, created_at
)
VALUES (
    '018f3a5b-7c8d-7e90-8000-000000000511',
    '018f3a5b-7c8d-7e90-8000-000000000201',
    'DAT-001',
    '018f3a5b-7c8d-7e90-8000-000000000103',
    'Scope of Corporate RoPA across subsidiary entities',
    'OPEN',
    CURRENT_TIMESTAMP - INTERVAL '12 hours'
)
ON CONFLICT DO NOTHING;

INSERT INTO clarification_messages (
    id, thread_id, author_user_id, message_text, created_at
)
VALUES (
    '018f3a5b-7c8d-7e90-8000-000000000521',
    '018f3a5b-7c8d-7e90-8000-000000000511',
    '018f3a5b-7c8d-7e90-8000-000000000103',
    'Please confirm whether telemetry data from diagnostic mobile apps is maintained in a centralized RoPA or managed separately by the diagnostics subsidiary.',
    CURRENT_TIMESTAMP - INTERVAL '12 hours'
)
ON CONFLICT DO NOTHING;

