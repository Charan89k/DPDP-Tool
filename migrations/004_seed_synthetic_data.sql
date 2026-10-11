-- ============================================================================
-- Migration: 004_seed_synthetic_data.sql
-- Description: Realistic synthetic multi-tenant test fixtures for local development
-- Version: 1.0.0
-- Author: Principal Software Architect / Database Security Engineer
-- Target: PostgreSQL 16+
-- Notes:
--   - All data is entirely fictional synthetic development data.
--   - Contains zero real customer data, real PII, or production credentials.
--   - Passwords use synthetic hashes for 'SyntheticTestPassword123!'.
-- ============================================================================

-- ============================================================================
-- 1. SYNTHETIC TENANTS
-- ============================================================================

-- Tenant 1: Truth Labs International (Advisory Platform Tenant)
INSERT INTO tenants (id, type, name, slug, industry, is_sdf, dpo_name, dpo_email, status)
VALUES (
    '018f3a5b-7c8d-7e90-8000-000000000001',
    'TLI',
    'Truth Labs International Compliance Advisory',
    'truth-labs-advisory',
    'Cybersecurity & Privacy Advisory',
    FALSE,
    'TLI Lead Privacy Counsel',
    'privacy.advisory@truthlabs.in',
    'ACTIVE'
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name, status = EXCLUDED.status;

-- Tenant 2: Alpha Healthcare Technologies Pvt Ltd (Client Tenant - SDF HealthTech)
INSERT INTO tenants (id, type, name, slug, industry, is_sdf, dpo_name, dpo_email, status)
VALUES (
    '018f3a5b-7c8d-7e90-8000-000000000002',
    'CLIENT',
    'Alpha Healthcare Technologies Pvt Ltd',
    'alpha-healthcare',
    'HealthTech & Telemedicine',
    TRUE, -- Significant Data Fiduciary
    'Dr. Rajesh Nair (Fictional DPO)',
    'dpo@alphahealth.example.com',
    'ACTIVE'
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name, is_sdf = EXCLUDED.is_sdf, status = EXCLUDED.status;

-- Tenant 3: Beta Express Supply Chain Solutions Ltd (Client Tenant - Logistics Non-SDF)
INSERT INTO tenants (id, type, name, slug, industry, is_sdf, dpo_name, dpo_email, status)
VALUES (
    '018f3a5b-7c8d-7e90-8000-000000000003',
    'CLIENT',
    'Beta Express Supply Chain Solutions Ltd',
    'beta-express',
    'Logistics & E-Commerce Delivery',
    FALSE,
    'Pooja Sharma (Fictional Lead)',
    'compliance@betaexpress.example.com',
    'ACTIVE'
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name, is_sdf = EXCLUDED.is_sdf, status = EXCLUDED.status;

-- ============================================================================
-- 2. BUSINESS UNITS
-- ============================================================================

-- Alpha Healthcare BUs
INSERT INTO business_units (id, tenant_id, name, code, description)
VALUES
    ('018f3a5b-7c8d-7e90-8000-000000000011', '018f3a5b-7c8d-7e90-8000-000000000002', 'Clinical Data Operations', 'BU-CLINICAL', 'Telemedicine EHR and doctor-patient interaction workflows'),
    ('018f3a5b-7c8d-7e90-8000-000000000012', '018f3a5b-7c8d-7e90-8000-000000000002', 'Platform Engineering', 'BU-ENG', 'Core cloud microservices, database clusters, and AWS infrastructure'),
    ('018f3a5b-7c8d-7e90-8000-000000000013', '018f3a5b-7c8d-7e90-8000-000000000002', 'Corporate HR & Legal', 'BU-CORP', 'Human resources, employee benefits, and vendor legal contracting')
ON CONFLICT (tenant_id, code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description;

-- Beta Express BUs
INSERT INTO business_units (id, tenant_id, name, code, description)
VALUES
    ('018f3a5b-7c8d-7e90-8000-000000000021', '018f3a5b-7c8d-7e90-8000-000000000003', 'Fleet Telematics Operations', 'BU-FLEET', 'Driver mobile application, real-time GPS telemetry, and vehicle routing'),
    ('018f3a5b-7c8d-7e90-8000-000000000022', '018f3a5b-7c8d-7e90-8000-000000000003', 'Customer Support & Dispatch', 'BU-CUSTOMER', 'Package tracking, customer notifications, and grievance call logs')
ON CONFLICT (tenant_id, code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description;

-- ============================================================================
-- 3. SYNTHETIC USERS ACROSS ALL ROLES
-- ============================================================================

-- Synthetic bcrypt password hash for 'SyntheticTestPassword123!'
-- $2b$12$e80yvV3n2YfV3n2YfV3n2Oe2Z3iP1W5e2Z3iP1W5e2Z3iP1W5e2Z3
INSERT INTO users (id, tenant_id, email, password_hash, full_name, phone, role, is_active)
VALUES
    -- TLI Advisory Personnel
    ('018f3a5b-7c8d-7e90-8000-000000000101', '018f3a5b-7c8d-7e90-8000-000000000001', 'admin@truthlabs.in', '$2b$12$e80yvV3n2YfV3n2YfV3n2Oe2Z3iP1W5e2Z3iP1W5e2Z3iP1W5e2Z3', 'TLI Super Administrator', '+91-9800000001', 'TLI_SUPER_ADMIN', TRUE),
    ('018f3a5b-7c8d-7e90-8000-000000000102', '018f3a5b-7c8d-7e90-8000-000000000001', 'lead.consultant@truthlabs.in', '$2b$12$e80yvV3n2YfV3n2YfV3n2Oe2Z3iP1W5e2Z3iP1W5e2Z3iP1W5e2Z3', 'Ananya Sengupta (Lead Consultant)', '+91-9800000002', 'TLI_LEAD_CONSULTANT', TRUE),
    ('018f3a5b-7c8d-7e90-8000-000000000103', '018f3a5b-7c8d-7e90-8000-000000000001', 'reviewer.privacy@truthlabs.in', '$2b$12$e80yvV3n2YfV3n2YfV3n2Oe2Z3iP1W5e2Z3iP1W5e2Z3iP1W5e2Z3', 'Karan Verma (Privacy Reviewer)', '+91-9800000003', 'TLI_REVIEWER', TRUE),

    -- Alpha Healthcare Personnel
    ('018f3a5b-7c8d-7e90-8000-000000000111', '018f3a5b-7c8d-7e90-8000-000000000002', 'admin@alphahealth.example.com', '$2b$12$e80yvV3n2YfV3n2YfV3n2Oe2Z3iP1W5e2Z3iP1W5e2Z3iP1W5e2Z3', 'Vikram Malhotra (Client Admin)', '+91-9810000001', 'CLIENT_ADMIN', TRUE),
    ('018f3a5b-7c8d-7e90-8000-000000000112', '018f3a5b-7c8d-7e90-8000-000000000002', 'clinical.lead@alphahealth.example.com', '$2b$12$e80yvV3n2YfV3n2YfV3n2Oe2Z3iP1W5e2Z3iP1W5e2Z3iP1W5e2Z3', 'Dr. Sunita Rao (Clinical BU Lead)', '+91-9810000002', 'CLIENT_BU_LEAD', TRUE),
    ('018f3a5b-7c8d-7e90-8000-000000000113', '018f3a5b-7c8d-7e90-8000-000000000002', 'eng.contributor@alphahealth.example.com', '$2b$12$e80yvV3n2YfV3n2YfV3n2Oe2Z3iP1W5e2Z3iP1W5e2Z3iP1W5e2Z3', 'Amitabh Roy (Security Contributor)', '+91-9810000003', 'CLIENT_CONTRIBUTOR', TRUE),
    ('018f3a5b-7c8d-7e90-8000-000000000114', '018f3a5b-7c8d-7e90-8000-000000000002', 'legal.viewer@alphahealth.example.com', '$2b$12$e80yvV3n2YfV3n2YfV3n2Oe2Z3iP1W5e2Z3iP1W5e2Z3iP1W5e2Z3', 'Meera Joshi (Compliance Viewer)', '+91-9810000004', 'CLIENT_VIEWER', TRUE),

    -- Beta Express Personnel
    ('018f3a5b-7c8d-7e90-8000-000000000121', '018f3a5b-7c8d-7e90-8000-000000000003', 'admin@betaexpress.example.com', '$2b$12$e80yvV3n2YfV3n2YfV3n2Oe2Z3iP1W5e2Z3iP1W5e2Z3iP1W5e2Z3', 'Rohan Kapoor (Client Admin)', '+91-9820000001', 'CLIENT_ADMIN', TRUE),
    ('018f3a5b-7c8d-7e90-8000-000000000122', '018f3a5b-7c8d-7e90-8000-000000000003', 'ops.contributor@betaexpress.example.com', '$2b$12$e80yvV3n2YfV3n2YfV3n2Oe2Z3iP1W5e2Z3iP1W5e2Z3iP1W5e2Z3', 'Deepak Tiwari (Ops Contributor)', '+91-9820000002', 'CLIENT_CONTRIBUTOR', TRUE)
ON CONFLICT (email) DO UPDATE SET
    full_name = EXCLUDED.full_name, role = EXCLUDED.role, is_active = EXCLUDED.is_active;

-- ============================================================================
-- 4. SYNTHETIC DATA PROCESSING ACTIVITIES (RoPA)
-- ============================================================================

-- Alpha Healthcare RoPA
INSERT INTO processing_activities (id, tenant_id, business_unit_id, activity_name, purpose_description, data_principal_category, personal_data_categories, statutory_ground, cross_border_transfer, retention_period_months)
VALUES
    ('018f3a5b-7c8d-7e90-8000-000000000031', '018f3a5b-7c8d-7e90-8000-000000000002', '018f3a5b-7c8d-7e90-8000-000000000011',
     'Telemedicine Consultation & EHR Ingestion',
     'Collection and storage of patient medical symptoms, audio recordings, and electronic health records to facilitate remote clinical consultations.',
     'Patients & Consulting Physicians',
     '["Identity", "Contact", "Health Records", "Prescriptions", "Payment"]'::jsonb,
     'CONSENT_SECTION_6',
     FALSE,
     84),
    ('018f3a5b-7c8d-7e90-8000-000000000032', '018f3a5b-7c8d-7e90-8000-000000000002', '018f3a5b-7c8d-7e90-8000-000000000013',
     'Corporate Payroll & Statutory Deductions',
     'Processing of employee bank accounts, PAN, and Provident Fund deductions for employment compliance.',
     'Direct Employees & Retainers',
     '["Identity", "Financial", "Biometric Attendance", "Tax ID"]'::jsonb,
     'EMPLOYMENT_SECTION_7_G',
     FALSE,
     60)
ON CONFLICT DO NOTHING;

-- Beta Express RoPA
INSERT INTO processing_activities (id, tenant_id, business_unit_id, activity_name, purpose_description, data_principal_category, personal_data_categories, statutory_ground, cross_border_transfer, retention_period_months)
VALUES
    ('018f3a5b-7c8d-7e90-8000-000000000041', '018f3a5b-7c8d-7e90-8000-000000000003', '018f3a5b-7c8d-7e90-8000-000000000021',
     'Driver Geolocation & Route Optimization',
     'Real-time GPS tracking of delivery partners via mobile application for route allocation and proof-of-delivery.',
     'Fleet Delivery Partners',
     '["Geolocation", "Identity", "Device Telemetry", "Vehicle Reg"]'::jsonb,
     'VOLUNTARY_SECTION_7_A',
     FALSE,
     12)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 5. SYNTHETIC ASSESSMENTS & ENGAGEMENT ASSIGNMENTS
-- ============================================================================

-- Alpha Healthcare In-Flight Assessment
INSERT INTO assessments (id, tenant_id, framework_version_id, scoring_model_id, engagement_code, title, status, lead_consultant_id, target_completion_date, is_partial_assessment)
VALUES (
    '018f3a5b-7c8d-7e90-8000-000000000201',
    '018f3a5b-7c8d-7e90-8000-000000000002', -- Alpha Healthcare
    'ab68a890-9932-5775-bd04-d18bffdb0415', -- DPDPA-2023-V1.0
    'c9ddba7f-8954-5d37-a92f-cf5a1f27e68b', -- SCORING-V1-STANDARD-WEIGHTED
    'ENG-ALPHA-2026-Q4',
    'Alpha Healthcare Enterprise DPDP Readiness & Gap Assessment 2026',
    'DATA_GATHERING',
    '018f3a5b-7c8d-7e90-8000-000000000102', -- Ananya Sengupta (Lead)
    '2026-12-31',
    FALSE
)
ON CONFLICT (engagement_code) DO UPDATE SET
    title = EXCLUDED.title, status = EXCLUDED.status;

-- Alpha Healthcare Assignments
INSERT INTO assessment_assignments (id, assessment_id, user_id, assignment_role)
VALUES
    ('018f3a5b-7c8d-7e90-8000-000000000211', '018f3a5b-7c8d-7e90-8000-000000000201', '018f3a5b-7c8d-7e90-8000-000000000102', 'ENGAGEMENT_LEAD'),
    ('018f3a5b-7c8d-7e90-8000-000000000212', '018f3a5b-7c8d-7e90-8000-000000000201', '018f3a5b-7c8d-7e90-8000-000000000103', 'REVIEWER'),
    ('018f3a5b-7c8d-7e90-8000-000000000213', '018f3a5b-7c8d-7e90-8000-000000000201', '018f3a5b-7c8d-7e90-8000-000000000112', 'CLIENT_COORDINATOR')
ON CONFLICT (assessment_id, user_id) DO NOTHING;

-- Beta Express Baseline Draft Assessment
INSERT INTO assessments (id, tenant_id, framework_version_id, scoring_model_id, engagement_code, title, status, lead_consultant_id, target_completion_date, is_partial_assessment)
VALUES (
    '018f3a5b-7c8d-7e90-8000-000000000202',
    '018f3a5b-7c8d-7e90-8000-000000000003', -- Beta Express
    'ab68a890-9932-5775-bd04-d18bffdb0415', -- DPDPA-2023-V1.0
    'c9ddba7f-8954-5d37-a92f-cf5a1f27e68b', -- SCORING-V1-STANDARD-WEIGHTED
    'ENG-BETA-2026-BASELINE',
    'Beta Express Baseline DPDP Regulatory Scoping Assessment',
    'DRAFT',
    '018f3a5b-7c8d-7e90-8000-000000000102', -- Ananya Sengupta (Lead)
    '2027-03-31',
    FALSE
)
ON CONFLICT (engagement_code) DO UPDATE SET
    title = EXCLUDED.title, status = EXCLUDED.status;

-- Beta Express Assignments
INSERT INTO assessment_assignments (id, assessment_id, user_id, assignment_role)
VALUES
    ('018f3a5b-7c8d-7e90-8000-000000000221', '018f3a5b-7c8d-7e90-8000-000000000202', '018f3a5b-7c8d-7e90-8000-000000000102', 'ENGAGEMENT_LEAD')
ON CONFLICT (assessment_id, user_id) DO NOTHING;

-- ============================================================================
-- 6. INSTANTIATE ASSESSMENT CONTROLS (ALL 30 CANONICAL CONTROLS)
-- ============================================================================

-- Instantiate 30 Controls for Alpha Healthcare Assessment
INSERT INTO assessment_controls (assessment_id, control_id, business_unit_id, assigned_contributor_id, is_applicable, verification_status)
SELECT
    '018f3a5b-7c8d-7e90-8000-000000000201'::uuid,
    c.id,
    '018f3a5b-7c8d-7e90-8000-000000000011'::uuid, -- BU-CLINICAL
    '018f3a5b-7c8d-7e90-8000-000000000113'::uuid, -- Amitabh Roy (Contributor)
    TRUE,
    'UNANSWERED'::verification_status
FROM controls c
WHERE c.framework_version_id = 'ab68a890-9932-5775-bd04-d18bffdb0415'
ON CONFLICT (assessment_id, control_id) DO NOTHING;

-- Instantiate 30 Controls for Beta Express Assessment
INSERT INTO assessment_controls (assessment_id, control_id, business_unit_id, assigned_contributor_id, is_applicable, verification_status)
SELECT
    '018f3a5b-7c8d-7e90-8000-000000000202'::uuid,
    c.id,
    '018f3a5b-7c8d-7e90-8000-000000000021'::uuid, -- BU-FLEET
    '018f3a5b-7c8d-7e90-8000-000000000122'::uuid, -- Deepak Tiwari (Contributor)
    TRUE,
    'UNANSWERED'::verification_status
FROM controls c
WHERE c.framework_version_id = 'ab68a890-9932-5775-bd04-d18bffdb0415'
ON CONFLICT (assessment_id, control_id) DO NOTHING;

-- ============================================================================
-- 7. SYNTHETIC RESPONSES & REVIEWER FINDINGS (ALPHA HEALTHCARE)
-- ============================================================================

-- Update TLI-DPDP-NOT-01 (Notice): Under Evaluation with Reviewer Gap Findings
UPDATE assessment_controls
SET
    verification_status = 'UNDER_EVALUATION',
    current_response_narrative = 'Standalone pre-consent privacy notice is presented to patients during mobile app onboarding. Notice specifies tele-consultation purposes and contact email for DPO.',
    current_self_maturity_score = 3,
    response_submitted_at = CURRENT_TIMESTAMP - INTERVAL '3 days',
    reviewer_verified_maturity_score = 2,
    reviewer_eval_notes = 'Notice is clear and standalone in English, but lacks explicit DPBI grievance escalation links and has not been localized into Schedule 8 languages.',
    gap_findings = 'Deficit against Rule 3(2): Notice does not provide alternative language access (Hindi/Marathi), and omits formal DPBI complaint escalation procedure URL.',
    remediation_recommendation = 'Implement multilingual notice selector with Hindi/Marathi translations and embed official DPBI adjudication link.',
    gap_severity = 'HIGH',
    evaluated_by_reviewer_id = '018f3a5b-7c8d-7e90-8000-000000000103',
    evaluated_at = CURRENT_TIMESTAMP - INTERVAL '1 day'
WHERE assessment_id = '018f3a5b-7c8d-7e90-8000-000000000201'
  AND control_id = (SELECT id FROM controls WHERE code = 'TLI-DPDP-NOT-01' AND framework_version_id = 'ab68a890-9932-5775-bd04-d18bffdb0415');

-- Update TLI-DPDP-SEC-01 (Security Safeguards): Verified Compliant
UPDATE assessment_controls
SET
    verification_status = 'VERIFIED_COMPLIANT',
    current_response_narrative = 'All patient tele-consultation records and EHR data are encrypted at rest using AWS KMS (AES-256) with customer-managed keys rotated annually. TLS 1.3 enforced for data in transit.',
    current_self_maturity_score = 4,
    response_submitted_at = CURRENT_TIMESTAMP - INTERVAL '5 days',
    reviewer_verified_maturity_score = 4,
    reviewer_eval_notes = 'Reviewed AWS KMS configuration and SOC 2 Type II attestation report. Reasonable security safeguards satisfy Section 8(5) requirements.',
    gap_severity = NULL,
    evaluated_by_reviewer_id = '018f3a5b-7c8d-7e90-8000-000000000103',
    evaluated_at = CURRENT_TIMESTAMP - INTERVAL '2 days'
WHERE assessment_id = '018f3a5b-7c8d-7e90-8000-000000000201'
  AND control_id = (SELECT id FROM controls WHERE code = 'TLI-DPDP-SEC-01' AND framework_version_id = 'ab68a890-9932-5775-bd04-d18bffdb0415');

-- ============================================================================
-- 8. RESPONSE REVISION HISTORY (IMMUTABLE AUDIT TRAIL)
-- ============================================================================

INSERT INTO control_response_history (id, assessment_control_id, version_number, response_narrative, self_maturity_score, submitted_by_id, submitted_at)
SELECT
    '018f3a5b-7c8d-7e90-8000-000000000301',
    ac.id,
    1,
    'Initial draft submission: Basic privacy notice linked in app store description.',
    2,
    '018f3a5b-7c8d-7e90-8000-000000000113', -- Amitabh Roy
    CURRENT_TIMESTAMP - INTERVAL '7 days'
FROM assessment_controls ac
JOIN controls c ON c.id = ac.control_id
WHERE ac.assessment_id = '018f3a5b-7c8d-7e90-8000-000000000201'
  AND c.code = 'TLI-DPDP-NOT-01'
ON CONFLICT (assessment_control_id, version_number) DO NOTHING;

INSERT INTO control_response_history (id, assessment_control_id, version_number, response_narrative, self_maturity_score, submitted_by_id, submitted_at)
SELECT
    '018f3a5b-7c8d-7e90-8000-000000000302',
    ac.id,
    2,
    'Standalone pre-consent privacy notice is presented to patients during mobile app onboarding. Notice specifies tele-consultation purposes and contact email for DPO.',
    3,
    '018f3a5b-7c8d-7e90-8000-000000000113', -- Amitabh Roy
    CURRENT_TIMESTAMP - INTERVAL '3 days'
FROM assessment_controls ac
JOIN controls c ON c.id = ac.control_id
WHERE ac.assessment_id = '018f3a5b-7c8d-7e90-8000-000000000201'
  AND c.code = 'TLI-DPDP-NOT-01'
ON CONFLICT (assessment_control_id, version_number) DO NOTHING;

-- ============================================================================
-- 9. SYNTHETIC EVIDENCE METADATA & REVIEW VERIFICATION
-- ============================================================================

-- Evidence for TLI-DPDP-NOT-01
INSERT INTO evidence_items (
    id, tenant_id, assessment_control_id, evidence_type_id, uploaded_by_user_id,
    file_name, file_size_bytes, mime_type, s3_key, s3_bucket, sha256_hash,
    status, redaction_certified_by_client, verified_by_reviewer_id, verification_notes, verified_at
)
SELECT
    '018f3a5b-7c8d-7e90-8000-000000000401',
    '018f3a5b-7c8d-7e90-8000-000000000002', -- Alpha Healthcare
    ac.id,
    (SELECT id FROM evidence_types WHERE evidence_type_id = 'EVID-NOT-01'),
    '018f3a5b-7c8d-7e90-8000-000000000113', -- Amitabh Roy
    'AlphaHealth_Patient_Mobile_Notice_Screenshot_v2.pdf',
    245892,
    'application/pdf',
    'tenants/alpha-healthcare/assessments/ENG-ALPHA-2026-Q4/controls/TLI-DPDP-NOT-01/evidence_01.pdf',
    'tli-dpdp-vault-prod',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    'ACTIVE',
    TRUE,
    '018f3a5b-7c8d-7e90-8000-000000000103', -- Karan Verma
    'Screenshot verifies pre-consent itemised notice on iOS/Android registration screen.',
    CURRENT_TIMESTAMP - INTERVAL '1 day'
FROM assessment_controls ac
JOIN controls c ON c.id = ac.control_id
WHERE ac.assessment_id = '018f3a5b-7c8d-7e90-8000-000000000201'
  AND c.code = 'TLI-DPDP-NOT-01'
ON CONFLICT DO NOTHING;

-- Evidence for TLI-DPDP-SEC-01
INSERT INTO evidence_items (
    id, tenant_id, assessment_control_id, evidence_type_id, uploaded_by_user_id,
    file_name, file_size_bytes, mime_type, s3_key, s3_bucket, sha256_hash,
    status, redaction_certified_by_client, verified_by_reviewer_id, verification_notes, verified_at
)
SELECT
    '018f3a5b-7c8d-7e90-8000-000000000402',
    '018f3a5b-7c8d-7e90-8000-000000000002', -- Alpha Healthcare
    ac.id,
    (SELECT id FROM evidence_types WHERE evidence_type_id = 'EVID-SEC-01'),
    '018f3a5b-7c8d-7e90-8000-000000000113', -- Amitabh Roy
    'AlphaHealth_AWS_Encryption_Architecture_2026.pdf',
    1845120,
    'application/pdf',
    'tenants/alpha-healthcare/assessments/ENG-ALPHA-2026-Q4/controls/TLI-DPDP-SEC-01/evidence_02.pdf',
    'tli-dpdp-vault-prod',
    'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    'ACTIVE',
    TRUE,
    '018f3a5b-7c8d-7e90-8000-000000000103', -- Karan Verma
    'Verified AWS KMS configuration diagram and envelope encryption key rotation policy.',
    CURRENT_TIMESTAMP - INTERVAL '2 days'
FROM assessment_controls ac
JOIN controls c ON c.id = ac.control_id
WHERE ac.assessment_id = '018f3a5b-7c8d-7e90-8000-000000000201'
  AND c.code = 'TLI-DPDP-SEC-01'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 10. CLARIFICATION THREADS & MESSAGES
-- ============================================================================

INSERT INTO clarification_threads (id, assessment_control_id, raised_by_user_id, title, status)
SELECT
    '018f3a5b-7c8d-7e90-8000-000000000451',
    ac.id,
    '018f3a5b-7c8d-7e90-8000-000000000103', -- Karan Verma
    'Multilingual Notice Language Coverage for Regional Clinics',
    'OPEN'
FROM assessment_controls ac
JOIN controls c ON c.id = ac.control_id
WHERE ac.assessment_id = '018f3a5b-7c8d-7e90-8000-000000000201'
  AND c.code = 'TLI-DPDP-NOT-01'
ON CONFLICT DO NOTHING;

INSERT INTO clarification_messages (id, thread_id, author_user_id, message_text)
VALUES (
    '018f3a5b-7c8d-7e90-8000-000000000461',
    '018f3a5b-7c8d-7e90-8000-000000000451',
    '018f3a5b-7c8d-7e90-8000-000000000103', -- Karan Verma
    'Does Alpha Healthcare currently have Hindi or Marathi translations ready for deployment on the registration gateway?'
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 11. REMEDIATION TASK & ATTACHMENT
-- ============================================================================

INSERT INTO remediation_tasks (
    id, tenant_id, assessment_control_id, title, description, priority, target_date,
    owner_user_id, status, closure_submission_notes
)
SELECT
    '018f3a5b-7c8d-7e90-8000-000000000501',
    '018f3a5b-7c8d-7e90-8000-000000000002', -- Alpha Healthcare
    ac.id,
    'Implement Hindi & Marathi Multilingual Privacy Notice Selector',
    'Deploy localized privacy notice banners accessible via one-click dropdown pursuant to DPDP Rules 2025 Rule 3.',
    'HIGH',
    '2026-11-30',
    '018f3a5b-7c8d-7e90-8000-000000000113', -- Amitabh Roy
    'IN_REMEDIATION',
    'Translation drafts under review with external localization agency.'
FROM assessment_controls ac
JOIN controls c ON c.id = ac.control_id
WHERE ac.assessment_id = '018f3a5b-7c8d-7e90-8000-000000000201'
  AND c.code = 'TLI-DPDP-NOT-01'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 12. IMMUTABLE FORENSIC AUDIT TRAIL LOGS
-- ============================================================================

INSERT INTO audit_logs (id, tenant_id, user_id, action, entity_type, entity_id, ip_address, user_agent, new_state)
VALUES
    ('018f3a5b-7c8d-7e90-8000-000000000601', '018f3a5b-7c8d-7e90-8000-000000000002', '018f3a5b-7c8d-7e90-8000-000000000102',
     'ASSESSMENT_CREATED', 'assessments', '018f3a5b-7c8d-7e90-8000-000000000201', '10.0.1.15'::inet,
     'Mozilla/5.0 (TLI Auditor Client v1.0)',
     '{"engagement_code": "ENG-ALPHA-2026-Q4", "title": "Alpha Healthcare Enterprise DPDP Readiness & Gap Assessment 2026"}'::jsonb),

    ('018f3a5b-7c8d-7e90-8000-000000000602', '018f3a5b-7c8d-7e90-8000-000000000002', '018f3a5b-7c8d-7e90-8000-000000000113',
     'EVIDENCE_UPLOADED', 'evidence_items', '018f3a5b-7c8d-7e90-8000-000000000401', '192.168.1.104'::inet,
     'Mozilla/5.0 (Chrome/130.0.0.0 Alpha Workplace)',
     '{"file_name": "AlphaHealth_Patient_Mobile_Notice_Screenshot_v2.pdf", "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}'::jsonb),

    ('018f3a5b-7c8d-7e90-8000-000000000603', '018f3a5b-7c8d-7e90-8000-000000000003', '018f3a5b-7c8d-7e90-8000-000000000102',
     'ASSESSMENT_CREATED', 'assessments', '018f3a5b-7c8d-7e90-8000-000000000202', '10.0.1.15'::inet,
     'Mozilla/5.0 (TLI Auditor Client v1.0)',
     '{"engagement_code": "ENG-BETA-2026-BASELINE", "title": "Beta Express Baseline DPDP Regulatory Scoping Assessment"}'::jsonb)
ON CONFLICT DO NOTHING;
