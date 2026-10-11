-- ============================================================================
-- Truth Labs International (TLI) — DPDP Compliance Gap Analysis Tool
-- Migration 011: Assessment Lifecycle State Enforcement & Forensic Immutability (Phase 3D.5)
--
-- RATIONALE & GOVERNANCE:
-- Audits and completes the canonical 14-state assessment lifecycle defined in
-- docs/03_assessment_workflow_and_state_machine.md and docs/09_unresolved_decisions_and_tl_assumptions.md:
--   DRAFT, SCOPING, SCOPE_LOCKED, DATA_GATHERING, SUBMITTED_FOR_REVIEW,
--   UNDER_REVIEW, CLARIFICATION_PENDING, REVIEW_COMPLETED,
--   DRAFT_REPORT_GENERATED, LEAD_APPROVED, FINAL_ISSUED,
--   REMEDIATION_ACTIVE, CANCELLED, ARCHIVED.
--
-- DEFENSE-IN-DEPTH ENFORCEMENT:
-- 1. Refined Audit Log Row-Level Security:
--    - Grants assigned consultants and assessment client tenants bidirectional SELECT
--      visibility over assessment lifecycle transition logs in 'audit_logs'.
--    - Allows assigned consultants to append immutable audit logs scoped to client assessments.
-- 2. Kernel-Level Forensic Immutability Triggers:
--    - 'assessments' table: Prevents mutation of core metadata once status reaches FINAL_ISSUED
--      or ARCHIVED. Only permits valid forward progression (REMEDIATION_ACTIVE, ARCHIVED).
--    - 'assessment_questionnaire_responses': Strictly prevents INSERT, UPDATE, or DELETE
--      when the assessment is in LEAD_APPROVED, FINAL_ISSUED, REMEDIATION_ACTIVE, ARCHIVED, or CANCELLED.
--    - 'questionnaire_assessor_reviews': Strictly prevents INSERT, UPDATE, or DELETE
--      when the assessment is in LEAD_APPROVED, FINAL_ISSUED, REMEDIATION_ACTIVE, ARCHIVED, or CANCELLED.
--    - 'evidence_items': Strictly prevents INSERT, UPDATE, or DELETE
--      when the assessment is in LEAD_APPROVED, FINAL_ISSUED, ARCHIVED, or CANCELLED.
-- ============================================================================

-- 1. REFINED AUDIT LOGS ROW-LEVEL SECURITY POLICY
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
        OR (
            entity_type = 'assessments'
            AND (
                (
                    app_current_user_role() IN ('TLI_LEAD_CONSULTANT', 'TLI_REVIEWER')
                    AND is_user_assigned_to_assessment(entity_id, app_current_user_id())
                )
                OR (
                    app_current_tenant_id() IS NOT NULL
                    AND get_assessment_tenant_id(entity_id) = app_current_tenant_id()
                )
            )
        )
    )
    WITH CHECK (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (
            app_current_tenant_id() IS NOT NULL
            AND tenant_id = app_current_tenant_id()
        )
        OR (
            entity_type = 'assessments'
            AND app_current_user_role() IN ('TLI_LEAD_CONSULTANT', 'TLI_REVIEWER')
            AND is_user_assigned_to_assessment(entity_id, app_current_user_id())
            AND (tenant_id = app_current_tenant_id() OR tenant_id = get_assessment_tenant_id(entity_id))
        )
    );

-- 2. REFINED ASSESSMENTS & REPORT SNAPSHOTS RLS POLICIES FOR CONSULTANTS
DROP POLICY IF EXISTS rls_assessments_policy ON assessments;
CREATE POLICY rls_assessments_policy ON assessments
    FOR ALL
    TO dpdp_app_user
    USING (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (
            app_current_user_role() IN ('TLI_LEAD_CONSULTANT', 'TLI_REVIEWER')
            AND (
                is_user_assigned_to_assessment(id, app_current_user_id())
                OR lead_consultant_id = app_current_user_id()
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
                is_user_assigned_to_assessment(id, app_current_user_id())
                OR lead_consultant_id = app_current_user_id()
            )
        )
        OR (
            app_current_tenant_id() IS NOT NULL
            AND tenant_id = app_current_tenant_id()
        )
    );

DROP POLICY IF EXISTS rls_report_snapshots_policy ON report_snapshots;
CREATE POLICY rls_report_snapshots_policy ON report_snapshots
    FOR ALL
    TO dpdp_app_user
    USING (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (
            app_current_user_role() IN ('TLI_LEAD_CONSULTANT', 'TLI_REVIEWER')
            AND (
                is_user_assigned_to_assessment(assessment_id, app_current_user_id())
                OR lead_approver_id = app_current_user_id()
                OR generated_by_user_id = app_current_user_id()
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
                is_user_assigned_to_assessment(assessment_id, app_current_user_id())
                OR lead_approver_id = app_current_user_id()
                OR generated_by_user_id = app_current_user_id()
            )
        )
        OR (
            app_current_tenant_id() IS NOT NULL
            AND tenant_id = app_current_tenant_id()
        )
    );

-- 3. KERNEL IMMUTABILITY ENFORCEMENT FUNCTIONS & TRIGGERS

CREATE OR REPLACE FUNCTION enforce_assessment_lifecycle_immutability()
RETURNS TRIGGER AS $$
DECLARE
    curr_status assessment_status;
BEGIN
    -- A. ASSESSMENT RECORD LEVEL
    IF TG_TABLE_NAME = 'assessments' THEN
        -- If currently ARCHIVED, total lockdown: no updates or deletes permitted
        IF OLD.status = 'ARCHIVED' THEN
            RAISE EXCEPTION 'FORENSIC_INTEGRITY_VIOLATION: Assessment % is ARCHIVED and permanently locked against modification.', OLD.id
                USING ERRCODE = '23505';
        END IF;

        -- If currently FINAL_ISSUED, protect core engagement definition
        IF OLD.status = 'FINAL_ISSUED' THEN
            IF NEW.status NOT IN ('FINAL_ISSUED', 'REMEDIATION_ACTIVE', 'ARCHIVED') THEN
                RAISE EXCEPTION 'FORENSIC_INTEGRITY_VIOLATION: Assessment % is FINAL_ISSUED. Only progression to REMEDIATION_ACTIVE or ARCHIVED is permitted.', OLD.id
                    USING ERRCODE = '23505';
            END IF;

            IF NEW.title != OLD.title OR
               NEW.engagement_code != OLD.engagement_code OR 
               NEW.tenant_id != OLD.tenant_id OR 
               NEW.framework_version_id != OLD.framework_version_id OR
               NEW.scoring_model_id != OLD.scoring_model_id OR 
               NEW.is_partial_assessment != OLD.is_partial_assessment THEN
                RAISE EXCEPTION 'FORENSIC_INTEGRITY_VIOLATION: Assessment % is FINAL_ISSUED. Core assessment metadata is immutable.', OLD.id
                    USING ERRCODE = '23505';
            END IF;
        END IF;

        -- If currently CANCELLED, only progression to ARCHIVED is permitted
        IF OLD.status = 'CANCELLED' AND NEW.status NOT IN ('CANCELLED', 'ARCHIVED') THEN
            RAISE EXCEPTION 'FORENSIC_INTEGRITY_VIOLATION: Assessment % is CANCELLED. Only transition to ARCHIVED is permitted.', OLD.id
                USING ERRCODE = '23505';
        END IF;

        RETURN NEW;
    END IF;

    -- B. CHILD RECORDS IMMUTABILITY (responses, reviews, evidence)
    IF TG_TABLE_NAME = 'evidence_items' THEN
        IF TG_OP = 'DELETE' THEN
            IF OLD.assessment_id IS NOT NULL THEN
                SELECT status INTO curr_status FROM assessments WHERE id = OLD.assessment_id;
            ELSIF OLD.assessment_control_id IS NOT NULL THEN
                SELECT a.status INTO curr_status FROM assessments a JOIN assessment_controls ac ON ac.assessment_id = a.id WHERE ac.id = OLD.assessment_control_id;
            END IF;
        ELSE
            IF NEW.assessment_id IS NOT NULL THEN
                SELECT status INTO curr_status FROM assessments WHERE id = NEW.assessment_id;
            ELSIF NEW.assessment_control_id IS NOT NULL THEN
                SELECT a.status INTO curr_status FROM assessments a JOIN assessment_controls ac ON ac.assessment_id = a.id WHERE ac.id = NEW.assessment_control_id;
            END IF;
        END IF;

        IF curr_status IN ('LEAD_APPROVED', 'FINAL_ISSUED', 'ARCHIVED', 'CANCELLED') THEN
            RAISE EXCEPTION 'FORENSIC_INTEGRITY_VIOLATION: Evidence items cannot be modified for assessment in status %.', curr_status
                USING ERRCODE = '23505';
        END IF;
    ELSE
        -- assessment_questionnaire_responses or questionnaire_assessor_reviews
        IF TG_OP = 'DELETE' THEN
            SELECT status INTO curr_status FROM assessments WHERE id = OLD.assessment_id;
        ELSE
            SELECT status INTO curr_status FROM assessments WHERE id = NEW.assessment_id;
        END IF;

        IF curr_status IN ('LEAD_APPROVED', 'FINAL_ISSUED', 'REMEDIATION_ACTIVE', 'ARCHIVED', 'CANCELLED') THEN
            RAISE EXCEPTION 'FORENSIC_INTEGRITY_VIOLATION: Table % cannot be modified for assessment in status %.',
                TG_TABLE_NAME, curr_status
                USING ERRCODE = '23505';
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 3. ATTACH TRIGGERS

DROP TRIGGER IF EXISTS trg_assessments_lifecycle_guard ON assessments;
CREATE TRIGGER trg_assessments_lifecycle_guard
    BEFORE UPDATE ON assessments
    FOR EACH ROW
    EXECUTE FUNCTION enforce_assessment_lifecycle_immutability();

DROP TRIGGER IF EXISTS trg_q_responses_finalized_guard ON assessment_questionnaire_responses;
CREATE TRIGGER trg_q_responses_finalized_guard
    BEFORE INSERT OR UPDATE OR DELETE ON assessment_questionnaire_responses
    FOR EACH ROW
    EXECUTE FUNCTION enforce_assessment_lifecycle_immutability();

DROP TRIGGER IF EXISTS trg_q_reviews_finalized_guard ON questionnaire_assessor_reviews;
CREATE TRIGGER trg_q_reviews_finalized_guard
    BEFORE INSERT OR UPDATE OR DELETE ON questionnaire_assessor_reviews
    FOR EACH ROW
    EXECUTE FUNCTION enforce_assessment_lifecycle_immutability();

DROP TRIGGER IF EXISTS trg_evidence_finalized_guard ON evidence_items;
CREATE TRIGGER trg_evidence_finalized_guard
    BEFORE INSERT OR UPDATE OR DELETE ON evidence_items
    FOR EACH ROW
    EXECUTE FUNCTION enforce_assessment_lifecycle_immutability();

-- 4. ADMINISTRATIVE RE-AUDIT CLONING HELPER FUNCTION
CREATE OR REPLACE FUNCTION clone_assessment_questionnaire_responses(
    p_source_assessment_id UUID,
    p_target_assessment_id UUID
)
RETURNS INT AS $$
DECLARE
    inserted_count INT;
BEGIN
    INSERT INTO assessment_questionnaire_responses (
        assessment_id,
        tenant_id,
        question_code,
        questionnaire_version,
        selected_option,
        comments_and_justification
    )
    SELECT 
        p_target_assessment_id,
        tenant_id,
        question_code,
        questionnaire_version,
        selected_option,
        comments_and_justification
    FROM assessment_questionnaire_responses
    WHERE assessment_id = p_source_assessment_id;

    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION clone_assessment_questionnaire_responses(UUID, UUID) TO dpdp_app_user;

