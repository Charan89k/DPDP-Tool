-- ============================================================================
-- Truth Labs International (TLI) — DPDP Compliance Gap Analysis Tool
-- Migration 010: Evidence & Clarification Workflows Completion (Phase 3D.3)
--
-- RATIONALE & GOVERNANCE:
-- Completes the end-to-end evidence vault lifecycle and clarification engine:
-- 1. Evidence Lifecycle: Adds 'VERIFIED' status to evidence_status enum,
--    distinguishing verified/reviewed evidence from initial received state ('ACTIVE').
-- 2. Evidence Categorization: Adds evidence_category and description columns.
-- 3. Clarification Linking: Expands clarification_threads to support direct
--    evidence_item_id association, target_role audience, and lifecycle states
--    ('OPEN', 'IN_PROGRESS', 'REQUIRES_FURTHER_INFO', 'RESOLVED').
-- 4. Evidence Audit Trail: Creates evidence_review_history table guarded by
--    prevent_immutable_record_modification() trigger.
-- 5. Row-Level Security: Enforces tenant isolation and least-privilege policies.
-- ============================================================================

-- 1. EXPAND evidence_status ENUM WITH 'VERIFIED'
DO $$ BEGIN
    ALTER TYPE evidence_status ADD VALUE IF NOT EXISTS 'VERIFIED' AFTER 'ACTIVE';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. UPDATE SHA-256 CHECK CONSTRAINT FOR VERIFIED STATUS
ALTER TABLE evidence_items DROP CONSTRAINT IF EXISTS chk_evidence_active_hash;
ALTER TABLE evidence_items ADD CONSTRAINT chk_evidence_active_hash 
    CHECK (status NOT IN ('ACTIVE', 'VERIFIED', 'SUPERSEDED') OR sha256_hash IS NOT NULL);

-- 3. EXPAND evidence_items METADATA COLUMNS
ALTER TABLE evidence_items 
    ADD COLUMN IF NOT EXISTS evidence_category VARCHAR(100),
    ADD COLUMN IF NOT EXISTS description TEXT;

-- 4. EXPAND clarification_threads WITH EVIDENCE ASSOCIATION & EXTENDED STATES
ALTER TABLE clarification_threads 
    ADD COLUMN IF NOT EXISTS evidence_item_id UUID REFERENCES evidence_items(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS target_role VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_clarification_threads_evidence 
    ON clarification_threads(evidence_item_id);

ALTER TABLE clarification_threads DROP CONSTRAINT IF EXISTS clarification_threads_status_check;
ALTER TABLE clarification_threads ADD CONSTRAINT clarification_threads_status_check
    CHECK (status IN ('OPEN', 'IN_PROGRESS', 'REQUIRES_FURTHER_INFO', 'RESOLVED'));

-- 5. CREATE EVIDENCE REVIEW AUDIT HISTORY TABLE
CREATE TABLE IF NOT EXISTS evidence_review_history (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    evidence_item_id UUID NOT NULL REFERENCES evidence_items(id) ON DELETE RESTRICT,
    previous_status evidence_status,
    new_status evidence_status NOT NULL,
    verification_notes TEXT,
    reviewed_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_evidence_review_history_item 
    ON evidence_review_history(evidence_item_id);

-- 6. ENFORCE IMMUTABILITY ON EVIDENCE REVIEW HISTORY
DROP TRIGGER IF EXISTS trg_evidence_review_history_immutable ON evidence_review_history;
CREATE TRIGGER trg_evidence_review_history_immutable
    BEFORE UPDATE OR DELETE ON evidence_review_history
    FOR EACH ROW
    EXECUTE FUNCTION prevent_immutable_record_modification();

-- 7. ENABLE & FORCE ROW-LEVEL SECURITY
ALTER TABLE evidence_review_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_review_history FORCE ROW LEVEL SECURITY;

-- 8. RLS POLICIES FOR evidence_review_history

DROP POLICY IF EXISTS rls_evidence_review_history_select_policy ON evidence_review_history;
CREATE POLICY rls_evidence_review_history_select_policy ON evidence_review_history
    FOR SELECT
    TO dpdp_app_user
    USING (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (
            app_current_user_role() IN ('TLI_LEAD_CONSULTANT', 'TLI_REVIEWER')
            AND evidence_item_id IN (SELECT ei.id FROM evidence_items ei)
        )
        OR (
            app_current_tenant_id() IS NOT NULL
            AND evidence_item_id IN (
                SELECT ei.id FROM evidence_items ei WHERE ei.tenant_id = app_current_tenant_id()
            )
        )
    );

DROP POLICY IF EXISTS rls_evidence_review_history_insert_policy ON evidence_review_history;
CREATE POLICY rls_evidence_review_history_insert_policy ON evidence_review_history
    FOR INSERT
    TO dpdp_app_user
    WITH CHECK (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (
            app_current_user_role() IN ('TLI_LEAD_CONSULTANT', 'TLI_REVIEWER')
            AND evidence_item_id IN (SELECT ei.id FROM evidence_items ei)
            AND reviewed_by_user_id = app_current_user_id()
        )
    );

-- 9. RUNTIME APPLICATION ROLE GRANTS
GRANT SELECT, INSERT ON evidence_review_history TO dpdp_app_user;
GRANT SELECT, INSERT, UPDATE ON evidence_items TO dpdp_app_user;
GRANT SELECT, INSERT, UPDATE ON clarification_threads TO dpdp_app_user;

-- 10. UPDATE RLS POLICY FOR evidence_items TO PERMIT ASSIGNED ASSESSOR REVIEWS
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
    );
