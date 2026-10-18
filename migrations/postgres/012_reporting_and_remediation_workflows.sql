-- ============================================================================
-- Truth Labs International (TLI) DPDP Compliance Gap Analysis Tool
-- Migration 012: Reporting Snapshots & Remediation Workflows Enhancements
-- 
-- 1. Updates report_snapshots table to support DOCX report types.
-- 2. Enhances report_snapshots with is_draft and summary_metadata for auditability.
-- 3. Enhances remediation_tasks with direct assessment_id and question_code references.
-- 4. Makes assessment_control_id nullable on remediation_tasks for unmapped questions.
-- 5. Updates RLS policies for remediation_tasks and remediation_evidence_items.
-- ============================================================================

-- 1. REPORT SNAPSHOTS ENHANCEMENTS
-- Allow 'DOCX' as a valid report_type in addition to 'PDF' and 'XLSX'
ALTER TABLE report_snapshots DROP CONSTRAINT IF EXISTS report_snapshots_report_type_check;
ALTER TABLE report_snapshots ADD CONSTRAINT report_snapshots_report_type_check 
    CHECK (report_type IN ('PDF', 'XLSX', 'DOCX'));

-- Add is_draft flag to clearly distinguish draft from formally issued reports
ALTER TABLE report_snapshots ADD COLUMN IF NOT EXISTS is_draft BOOLEAN NOT NULL DEFAULT FALSE;

-- Add summary_metadata JSONB to store executive metrics, calculation hashes, and audit trace
ALTER TABLE report_snapshots ADD COLUMN IF NOT EXISTS summary_metadata JSONB DEFAULT '{}'::jsonb;

-- 2. REMEDIATION TASKS ENHANCEMENTS
-- Add direct assessment_id to remediation_tasks
ALTER TABLE remediation_tasks ADD COLUMN IF NOT EXISTS assessment_id UUID REFERENCES assessments(id) ON DELETE RESTRICT;

-- Backfill assessment_id from assessment_controls if not set
UPDATE remediation_tasks rt
SET assessment_id = ac.assessment_id
FROM assessment_controls ac
WHERE rt.assessment_control_id = ac.id
  AND rt.assessment_id IS NULL;

-- Add question_code to link directly to canonical 60-question findings
ALTER TABLE remediation_tasks ADD COLUMN IF NOT EXISTS question_code VARCHAR(50);

-- Make assessment_control_id nullable to support remediation on unmapped questions (e.g. GOV-005)
ALTER TABLE remediation_tasks ALTER COLUMN assessment_control_id DROP NOT NULL;

-- Index for assessment-level remediation queries
CREATE INDEX IF NOT EXISTS idx_remediation_assessment ON remediation_tasks(assessment_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_remediation_question ON remediation_tasks(question_code);

-- 3. RLS POLICIES FOR REMEDIATION TASKS
-- Drop and recreate policy to support direct assessment_id lookups
DROP POLICY IF EXISTS rls_remediation_tasks_policy ON remediation_tasks;
CREATE POLICY rls_remediation_tasks_policy ON remediation_tasks
    FOR ALL
    TO dpdp_app_user
    USING (
        app_current_user_role() = 'TLI_SUPER_ADMIN'
        OR (
            app_current_user_role() IN ('TLI_LEAD_CONSULTANT', 'TLI_REVIEWER')
            AND (
                (assessment_id IS NOT NULL AND is_user_assigned_to_assessment(assessment_id, app_current_user_id()))
                OR (assessment_control_id IN (SELECT ac.id FROM assessment_controls ac))
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
                (assessment_id IS NOT NULL AND is_user_assigned_to_assessment(assessment_id, app_current_user_id()))
                OR (assessment_control_id IN (SELECT ac.id FROM assessment_controls ac))
            )
        )
        OR (
            app_current_tenant_id() IS NOT NULL
            AND tenant_id = app_current_tenant_id()
        )
    );

