-- CloudE5 SQLite schema (migration 0001).
--
-- Generated from the final state of the PostgreSQL migrations 001-014 (migrations/postgres)
-- and reviewed. Type conventions (consumed by lib/db/sqlite/translate.ts):
--   TEXT            UUIDs and strings
--   TIMESTAMP_TEXT  ISO-8601 UTC timestamps, e.g. 2026-10-18T07:51:05.641Z
--   DATE_TEXT       YYYY-MM-DD
--   BOOLEAN         0 / 1
--   JSON_TEXT       JSON documents and arrays
-- PostgreSQL enums are CHECK constraints. Tenant isolation is not part of the schema: it is
-- applied per connection by lib/db/sqlite/policies.ts.

CREATE TABLE assessment_assignments (
  id TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  assessment_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  assignment_role TEXT NOT NULL,
  assigned_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT assessment_assignments_assignment_role_check CHECK (((assignment_role) IN ('ENGAGEMENT_LEAD', 'REVIEWER', 'CLIENT_COORDINATOR'))),
  CONSTRAINT assessment_assignments_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE RESTRICT,
  CONSTRAINT assessment_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  PRIMARY KEY (id),
  CONSTRAINT uq_assessment_user UNIQUE (assessment_id, user_id)
);

CREATE TABLE assessment_control_activities (
  id TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  assessment_control_id TEXT NOT NULL,
  processing_activity_id TEXT NOT NULL,
  CONSTRAINT assessment_control_activities_assessment_control_id_fkey FOREIGN KEY (assessment_control_id) REFERENCES assessment_controls(id) ON DELETE RESTRICT,
  CONSTRAINT assessment_control_activities_processing_activity_id_fkey FOREIGN KEY (processing_activity_id) REFERENCES processing_activities(id) ON DELETE RESTRICT,
  PRIMARY KEY (id),
  CONSTRAINT uq_control_activity UNIQUE (assessment_control_id, processing_activity_id)
);

CREATE TABLE assessment_controls (
  id TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  assessment_id TEXT NOT NULL,
  control_id TEXT NOT NULL,
  business_unit_id TEXT,
  assigned_contributor_id TEXT,
  is_applicable BOOLEAN NOT NULL DEFAULT 1,
  exclusion_justification TEXT,
  exclusion_approved_by_id TEXT,
  exclusion_approved_at TIMESTAMP_TEXT,
  verification_status TEXT NOT NULL DEFAULT 'UNANSWERED' CHECK (verification_status IN ('UNANSWERED', 'IN_PROGRESS', 'ANSWERED', 'UNDER_EVALUATION', 'CLARIFICATION_REQUESTED', 'VERIFIED_COMPLIANT', 'PARTIALLY_COMPLIANT', 'NON_COMPLIANT', 'UNASSESSED_DEFICIT', 'EXCLUSION_PROPOSED', 'EXCLUSION_APPROVED')),
  current_response_narrative TEXT,
  current_self_maturity_score INTEGER,
  response_submitted_at TIMESTAMP_TEXT,
  reviewer_verified_maturity_score INTEGER,
  reviewer_eval_notes TEXT,
  gap_findings TEXT,
  remediation_recommendation TEXT,
  gap_severity TEXT CHECK (gap_severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL')),
  score_override_reason TEXT,
  evaluated_by_reviewer_id TEXT,
  evaluated_at TIMESTAMP_TEXT,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT assessment_controls_current_self_maturity_score_check CHECK (((current_self_maturity_score >= 0) AND (current_self_maturity_score <= 5))),
  CONSTRAINT assessment_controls_reviewer_verified_maturity_score_check CHECK (((reviewer_verified_maturity_score >= 0) AND (reviewer_verified_maturity_score <= 5))),
  CONSTRAINT assessment_controls_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE RESTRICT,
  CONSTRAINT assessment_controls_assigned_contributor_id_fkey FOREIGN KEY (assigned_contributor_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT assessment_controls_business_unit_id_fkey FOREIGN KEY (business_unit_id) REFERENCES business_units(id) ON DELETE SET NULL,
  CONSTRAINT assessment_controls_control_id_fkey FOREIGN KEY (control_id) REFERENCES controls(id) ON DELETE RESTRICT,
  CONSTRAINT assessment_controls_evaluated_by_reviewer_id_fkey FOREIGN KEY (evaluated_by_reviewer_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT assessment_controls_exclusion_approved_by_id_fkey FOREIGN KEY (exclusion_approved_by_id) REFERENCES users(id) ON DELETE RESTRICT,
  PRIMARY KEY (id),
  CONSTRAINT uq_assessment_control UNIQUE (assessment_id, control_id)
);

CREATE TABLE assessment_questionnaire_responses (
  id TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  assessment_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  question_code TEXT NOT NULL,
  questionnaire_version TEXT NOT NULL DEFAULT '1.0.0',
  selected_option TEXT,
  comments_and_justification TEXT,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT chk_na_justification_required CHECK ((((selected_option)<> 'Not applicable — justification required') OR ((comments_and_justification IS NOT NULL) AND (length(trim(comments_and_justification)) > 0)))),
  CONSTRAINT chk_selected_option_valid CHECK (((selected_option IS NULL) OR ((selected_option) IN ('Implemented', 'Partially implemented', 'Not implemented', 'Unknown / not verified', 'Not applicable — justification required')))),
  CONSTRAINT assessment_questionnaire_responses_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE RESTRICT,
  CONSTRAINT assessment_questionnaire_responses_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
  PRIMARY KEY (id),
  CONSTRAINT uq_assessment_question UNIQUE (assessment_id, question_code)
);

CREATE TABLE assessment_scores (
  id TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  assessment_id TEXT NOT NULL,
  scoring_model_id TEXT NOT NULL,
  overall_maturity_score REAL NOT NULL,
  overall_coverage_pct REAL NOT NULL,
  domain_scores_json JSON_TEXT NOT NULL,
  statutory_deficits_count INTEGER NOT NULL DEFAULT 0,
  critical_gaps_count INTEGER NOT NULL DEFAULT 0,
  high_gaps_count INTEGER NOT NULL DEFAULT 0,
  medium_gaps_count INTEGER NOT NULL DEFAULT 0,
  low_gaps_count INTEGER NOT NULL DEFAULT 0,
  potential_penalty_exposure_inr INTEGER NOT NULL DEFAULT 0,
  calculation_hash TEXT NOT NULL,
  calculated_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT assessment_scores_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE RESTRICT,
  CONSTRAINT assessment_scores_scoring_model_id_fkey FOREIGN KEY (scoring_model_id) REFERENCES scoring_models(id) ON DELETE RESTRICT,
  PRIMARY KEY (id)
);

CREATE TABLE assessments (
  id TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  tenant_id TEXT NOT NULL,
  framework_version_id TEXT NOT NULL,
  scoring_model_id TEXT NOT NULL,
  parent_assessment_id TEXT,
  engagement_code TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SCOPING', 'SCOPE_LOCKED', 'DATA_GATHERING', 'SUBMITTED_FOR_REVIEW', 'UNDER_REVIEW', 'CLARIFICATION_PENDING', 'REVIEW_COMPLETED', 'DRAFT_REPORT_GENERATED', 'LEAD_APPROVED', 'FINAL_ISSUED', 'REMEDIATION_ACTIVE', 'CANCELLED', 'ARCHIVED')),
  lead_consultant_id TEXT NOT NULL,
  is_partial_assessment BOOLEAN NOT NULL DEFAULT 0,
  target_completion_date DATE_TEXT,
  submitted_at TIMESTAMP_TEXT,
  reviewed_at TIMESTAMP_TEXT,
  approved_at TIMESTAMP_TEXT,
  issued_at TIMESTAMP_TEXT,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT assessments_framework_version_id_fkey FOREIGN KEY (framework_version_id) REFERENCES framework_versions(id) ON DELETE RESTRICT,
  CONSTRAINT assessments_lead_consultant_id_fkey FOREIGN KEY (lead_consultant_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT assessments_parent_assessment_id_fkey FOREIGN KEY (parent_assessment_id) REFERENCES assessments(id) ON DELETE SET NULL,
  CONSTRAINT assessments_scoring_model_id_fkey FOREIGN KEY (scoring_model_id) REFERENCES scoring_models(id) ON DELETE RESTRICT,
  CONSTRAINT assessments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
  PRIMARY KEY (id),
  CONSTRAINT assessments_engagement_code_key UNIQUE (engagement_code)
);

CREATE TABLE audit_logs (
  id TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  tenant_id TEXT,
  user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  previous_state JSON_TEXT,
  new_state JSON_TEXT,
  timestamp TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT audit_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
  CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  PRIMARY KEY (id)
);

CREATE TABLE business_units (
  id TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT business_units_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
  PRIMARY KEY (id),
  CONSTRAINT uq_tenant_bu_code UNIQUE (tenant_id, code)
);

CREATE TABLE clarification_messages (
  id TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  thread_id TEXT NOT NULL,
  author_user_id TEXT NOT NULL,
  message_text TEXT NOT NULL,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT clarification_messages_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT clarification_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES clarification_threads(id) ON DELETE RESTRICT,
  PRIMARY KEY (id)
);

CREATE TABLE clarification_threads (
  id TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  assessment_control_id TEXT,
  raised_by_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  resolved_at TIMESTAMP_TEXT,
  assessment_id TEXT,
  question_code TEXT,
  evidence_item_id TEXT,
  target_role TEXT,
  CONSTRAINT clarification_threads_status_check CHECK (((status) IN ('OPEN', 'IN_PROGRESS', 'REQUIRES_FURTHER_INFO', 'RESOLVED'))),
  CONSTRAINT clarification_threads_assessment_control_id_fkey FOREIGN KEY (assessment_control_id) REFERENCES assessment_controls(id) ON DELETE RESTRICT,
  CONSTRAINT clarification_threads_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE RESTRICT,
  CONSTRAINT clarification_threads_evidence_item_id_fkey FOREIGN KEY (evidence_item_id) REFERENCES evidence_items(id) ON DELETE SET NULL,
  CONSTRAINT clarification_threads_raised_by_user_id_fkey FOREIGN KEY (raised_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  PRIMARY KEY (id)
);

CREATE TABLE control_domains (
  id TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  framework_version_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  statutory_focus TEXT,
  weight REAL NOT NULL DEFAULT 1.0,
  order_index INTEGER NOT NULL,
  CONSTRAINT control_domains_framework_version_id_fkey FOREIGN KEY (framework_version_id) REFERENCES framework_versions(id) ON DELETE RESTRICT,
  PRIMARY KEY (id),
  CONSTRAINT uq_framework_domain_code UNIQUE (framework_version_id, code)
);

CREATE TABLE control_response_history (
  id TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  assessment_control_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  response_narrative TEXT NOT NULL,
  self_maturity_score INTEGER,
  submitted_by_id TEXT NOT NULL,
  submitted_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT control_response_history_self_maturity_score_check CHECK (((self_maturity_score >= 0) AND (self_maturity_score <= 5))),
  CONSTRAINT control_response_history_assessment_control_id_fkey FOREIGN KEY (assessment_control_id) REFERENCES assessment_controls(id) ON DELETE RESTRICT,
  CONSTRAINT control_response_history_submitted_by_id_fkey FOREIGN KEY (submitted_by_id) REFERENCES users(id) ON DELETE RESTRICT,
  PRIMARY KEY (id),
  CONSTRAINT uq_control_response_version UNIQUE (assessment_control_id, version_number)
);

CREATE TABLE controls (
  id TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  framework_version_id TEXT NOT NULL,
  domain_id TEXT NOT NULL,
  code TEXT NOT NULL,
  control_version TEXT NOT NULL DEFAULT '1.0.0',
  source_id TEXT,
  source_provision TEXT NOT NULL,
  title TEXT NOT NULL,
  intent TEXT NOT NULL,
  obligation_type TEXT NOT NULL DEFAULT 'MANDATORY_STATUTORY' CHECK (obligation_type IN ('MANDATORY_STATUTORY', 'STATUTORY_EXCEPTION_CONDITIONAL', 'SDF_MANDATORY_CONDITIONAL', 'TLI_RECOMMENDED_PRACTICE')),
  legal_reference_summary TEXT NOT NULL,
  applicability_conditions TEXT NOT NULL,
  applicability_rationale TEXT NOT NULL,
  assessment_question TEXT NOT NULL,
  implementation_expectations TEXT NOT NULL,
  acceptable_evidence JSON_TEXT NOT NULL,
  evidence_limitations TEXT,
  assessment_guidance TEXT,
  risk_guidance TEXT,
  suggested_remediation TEXT,
  related_control_ids JSON_TEXT,
  penalty_tier TEXT NOT NULL DEFAULT 'TIER_4_50CR' CHECK (penalty_tier IN ('TIER_1_250CR', 'TIER_2_200CR', 'TIER_3_150CR', 'TIER_4_50CR', 'TIER_5_10K')),
  default_weight REAL NOT NULL DEFAULT 1.0,
  order_index INTEGER NOT NULL,
  is_sdf_only BOOLEAN NOT NULL DEFAULT 0,
  legal_review_status TEXT NOT NULL DEFAULT 'PROVISIONAL_RESEARCH_COMPLETE',
  methodology_review_status TEXT NOT NULL DEFAULT 'METHODOLOGY_REVIEW_PENDING',
  review_notes TEXT,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT controls_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES control_domains(id) ON DELETE RESTRICT,
  CONSTRAINT controls_framework_version_id_fkey FOREIGN KEY (framework_version_id) REFERENCES framework_versions(id) ON DELETE RESTRICT,
  CONSTRAINT controls_source_id_fkey FOREIGN KEY (source_id) REFERENCES legal_sources(id) ON DELETE RESTRICT,
  PRIMARY KEY (id),
  CONSTRAINT uq_framework_control_code UNIQUE (framework_version_id, code)
);

CREATE TABLE evidence_items (
  id TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  tenant_id TEXT NOT NULL,
  assessment_control_id TEXT,
  evidence_type_id TEXT,
  uploaded_by_user_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  s3_key TEXT NOT NULL,
  s3_bucket TEXT NOT NULL,
  sha256_hash TEXT,
  encryption_kms_key_id TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('PENDING_UPLOAD', 'PENDING_SCAN', 'ACTIVE', 'VERIFIED', 'QUARANTINED', 'REJECTED', 'SUPERSEDED', 'DELETION_PENDING', 'DELETED')),
  redaction_certified_by_client BOOLEAN NOT NULL DEFAULT 0,
  verified_by_reviewer_id TEXT,
  verification_notes TEXT,
  verified_at TIMESTAMP_TEXT,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  upload_expires_at TIMESTAMP_TEXT,
  quarantined_at TIMESTAMP_TEXT,
  quarantine_reason TEXT,
  quarantined_s3_key TEXT,
  scan_provider TEXT,
  scan_result TEXT,
  scanned_at TIMESTAMP_TEXT,
  deleted_at TIMESTAMP_TEXT,
  deleted_by_user_id TEXT,
  assessment_id TEXT,
  question_code TEXT,
  evidence_category TEXT,
  description TEXT,
  CONSTRAINT chk_evidence_active_hash CHECK (((status NOT IN ('ACTIVE', 'VERIFIED', 'SUPERSEDED')) OR (sha256_hash IS NOT NULL))),
  CONSTRAINT evidence_items_file_size_bytes_check CHECK ((file_size_bytes > 0)),
  CONSTRAINT evidence_items_assessment_control_id_fkey FOREIGN KEY (assessment_control_id) REFERENCES assessment_controls(id) ON DELETE RESTRICT,
  CONSTRAINT evidence_items_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE RESTRICT,
  CONSTRAINT evidence_items_deleted_by_user_id_fkey FOREIGN KEY (deleted_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT evidence_items_evidence_type_id_fkey FOREIGN KEY (evidence_type_id) REFERENCES evidence_types(id) ON DELETE SET NULL,
  CONSTRAINT evidence_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
  CONSTRAINT evidence_items_uploaded_by_user_id_fkey FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT evidence_items_verified_by_reviewer_id_fkey FOREIGN KEY (verified_by_reviewer_id) REFERENCES users(id) ON DELETE RESTRICT,
  PRIMARY KEY (id)
);

CREATE TABLE evidence_review_history (
  id TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  evidence_item_id TEXT NOT NULL,
  previous_status TEXT CHECK (previous_status IN ('PENDING_UPLOAD', 'PENDING_SCAN', 'ACTIVE', 'VERIFIED', 'QUARANTINED', 'REJECTED', 'SUPERSEDED', 'DELETION_PENDING', 'DELETED')),
  new_status TEXT NOT NULL CHECK (new_status IN ('PENDING_UPLOAD', 'PENDING_SCAN', 'ACTIVE', 'VERIFIED', 'QUARANTINED', 'REJECTED', 'SUPERSEDED', 'DELETION_PENDING', 'DELETED')),
  verification_notes TEXT,
  reviewed_by_user_id TEXT NOT NULL,
  reviewed_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT evidence_review_history_evidence_item_id_fkey FOREIGN KEY (evidence_item_id) REFERENCES evidence_items(id) ON DELETE RESTRICT,
  CONSTRAINT evidence_review_history_reviewed_by_user_id_fkey FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  PRIMARY KEY (id)
);

CREATE TABLE evidence_types (
  id TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  evidence_type_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  linked_controls JSON_TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'MANDATORY',
  confidentiality_tier TEXT NOT NULL,
  recommended_freshness TEXT,
  acceptable_examples JSON_TEXT,
  alternative_evidence TEXT,
  verification_procedure JSON_TEXT,
  limitations_and_weaknesses TEXT,
  masking_and_redaction_requirements TEXT,
  retention_considerations TEXT,
  reviewer_guidance TEXT,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (id),
  CONSTRAINT evidence_types_evidence_type_id_key UNIQUE (evidence_type_id)
);

CREATE TABLE framework_versions (
  id TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  legal_basis TEXT NOT NULL DEFAULT 'Digital Personal Data Protection Act, 2023',
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'DEPRECATED')),
  effective_date DATE_TEXT NOT NULL,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (id),
  CONSTRAINT framework_versions_code_key UNIQUE (code)
);

CREATE TABLE legal_sources (
  id TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  citation TEXT NOT NULL,
  issuing_authority TEXT NOT NULL,
  publication_date DATE_TEXT NOT NULL,
  gazette_reference TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('ENACTED_STATUTE', 'COMMENCEMENT_NOTIFICATION', 'NOTIFIED_RULES', 'OFFICIAL_ORDER', 'CONSTITUTIONAL_REFERENCE', 'SECTORAL_REGULATION')),
  commencement_status TEXT NOT NULL CHECK (commencement_status IN ('IN_FORCE', 'PHASED_COMMENCEMENT', 'SCHEDULED_COMMENCEMENT_13_NOV_2026', 'SCHEDULED_COMMENCEMENT_13_MAY_2027', 'AWAITING_COMMENCEMENT_NOTIFICATION')),
  url TEXT,
  verification_status TEXT NOT NULL DEFAULT 'VERIFIED_PRIMARY_SOURCE',
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (id),
  CONSTRAINT legal_sources_source_id_key UNIQUE (source_id)
);

CREATE TABLE processing_activities (
  id TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  tenant_id TEXT NOT NULL,
  business_unit_id TEXT,
  activity_name TEXT NOT NULL,
  purpose_description TEXT NOT NULL,
  data_principal_category TEXT NOT NULL,
  personal_data_categories JSON_TEXT NOT NULL,
  statutory_ground TEXT NOT NULL CHECK (statutory_ground IN ('CONSENT_SECTION_6', 'VOLUNTARY_SECTION_7_A', 'STATE_BENEFITS_SECTION_7_B', 'STATE_FUNCTIONS_SECTION_7_C', 'LEGAL_DECREE_SECTION_7_D', 'MEDICAL_EMERGENCY_SECTION_7_E', 'EMPLOYMENT_SECTION_7_G')),
  external_processors JSON_TEXT,
  cross_border_transfer BOOLEAN NOT NULL DEFAULT 0,
  destination_countries JSON_TEXT,
  retention_period_months INTEGER,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT processing_activities_business_unit_id_fkey FOREIGN KEY (business_unit_id) REFERENCES business_units(id) ON DELETE SET NULL,
  CONSTRAINT processing_activities_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
  PRIMARY KEY (id)
);

CREATE TABLE questionnaire_assessor_review_history (
  id TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  assessment_id TEXT NOT NULL,
  question_code TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  review_status TEXT NOT NULL,
  review_findings TEXT,
  evidence_deficiency_notes TEXT,
  requires_further_validation BOOLEAN NOT NULL DEFAULT 0,
  reviewed_by_user_id TEXT NOT NULL,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT questionnaire_assessor_review_history_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE RESTRICT,
  CONSTRAINT questionnaire_assessor_review_history_reviewed_by_user_id_fkey FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  PRIMARY KEY (id),
  CONSTRAINT uq_assessor_review_history UNIQUE (assessment_id, question_code, version_number)
);

CREATE TABLE questionnaire_assessor_reviews (
  id TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  assessment_id TEXT NOT NULL,
  question_code TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  review_findings TEXT,
  evidence_deficiency_notes TEXT,
  requires_further_validation BOOLEAN NOT NULL DEFAULT 0,
  reviewed_by_user_id TEXT,
  reviewed_at TIMESTAMP_TEXT,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT chk_review_status_valid CHECK (((review_status) IN ('PENDING_REVIEW', 'UNDER_REVIEW', 'VERIFIED_COMPLIANT', 'PARTIALLY_COMPLIANT', 'NON_COMPLIANT', 'CLARIFICATION_REQUESTED', 'EXCLUSION_VERIFIED'))),
  CONSTRAINT questionnaire_assessor_reviews_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE RESTRICT,
  CONSTRAINT questionnaire_assessor_reviews_reviewed_by_user_id_fkey FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  PRIMARY KEY (id),
  CONSTRAINT uq_assessment_question_review UNIQUE (assessment_id, question_code)
);

CREATE TABLE questionnaire_response_history (
  id TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  assessment_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  question_code TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  selected_option TEXT NOT NULL,
  comments_and_justification TEXT,
  submitted_by_id TEXT NOT NULL,
  submitted_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT questionnaire_response_history_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE RESTRICT,
  CONSTRAINT questionnaire_response_history_submitted_by_id_fkey FOREIGN KEY (submitted_by_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT questionnaire_response_history_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
  PRIMARY KEY (id),
  CONSTRAINT uq_question_response_history UNIQUE (assessment_id, question_code, version_number)
);

CREATE TABLE remediation_evidence_items (
  id TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  remediation_task_id TEXT NOT NULL,
  evidence_item_id TEXT NOT NULL,
  attached_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT remediation_evidence_items_evidence_item_id_fkey FOREIGN KEY (evidence_item_id) REFERENCES evidence_items(id) ON DELETE RESTRICT,
  CONSTRAINT remediation_evidence_items_remediation_task_id_fkey FOREIGN KEY (remediation_task_id) REFERENCES remediation_tasks(id) ON DELETE RESTRICT,
  PRIMARY KEY (id),
  CONSTRAINT uq_remediation_evidence UNIQUE (remediation_task_id, evidence_item_id)
);

CREATE TABLE remediation_tasks (
  id TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  tenant_id TEXT NOT NULL,
  assessment_control_id TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL')),
  target_date DATE_TEXT NOT NULL,
  owner_user_id TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_REMEDIATION', 'SUBMITTED_FOR_CLOSURE', 'VALIDATED_CLOSED', 'REJECTED_REOPENED')),
  closure_submission_notes TEXT,
  closure_submitted_at TIMESTAMP_TEXT,
  closure_validated_by_id TEXT,
  closure_validation_notes TEXT,
  validated_at TIMESTAMP_TEXT,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  assessment_id TEXT,
  question_code TEXT,
  CONSTRAINT remediation_tasks_assessment_control_id_fkey FOREIGN KEY (assessment_control_id) REFERENCES assessment_controls(id) ON DELETE RESTRICT,
  CONSTRAINT remediation_tasks_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE RESTRICT,
  CONSTRAINT remediation_tasks_closure_validated_by_id_fkey FOREIGN KEY (closure_validated_by_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT remediation_tasks_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT remediation_tasks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
  PRIMARY KEY (id)
);

CREATE TABLE report_snapshots (
  id TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  assessment_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  report_type TEXT NOT NULL,
  version_label TEXT NOT NULL,
  s3_key TEXT NOT NULL,
  file_sha256_hash TEXT NOT NULL,
  dataset_sha256_hash TEXT NOT NULL,
  generated_by_user_id TEXT NOT NULL,
  lead_approver_id TEXT NOT NULL,
  approved_at TIMESTAMP_TEXT NOT NULL,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  is_draft BOOLEAN NOT NULL DEFAULT 0,
  summary_metadata JSON_TEXT DEFAULT '[]',
  CONSTRAINT report_snapshots_report_type_check CHECK (((report_type) IN ('PDF', 'XLSX', 'DOCX'))),
  CONSTRAINT report_snapshots_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE RESTRICT,
  CONSTRAINT report_snapshots_generated_by_user_id_fkey FOREIGN KEY (generated_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT report_snapshots_lead_approver_id_fkey FOREIGN KEY (lead_approver_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT report_snapshots_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
  PRIMARY KEY (id)
);

CREATE TABLE scoring_models (
  id TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  formula_definition JSON_TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (id),
  CONSTRAINT scoring_models_code_key UNIQUE (code)
);

CREATE TABLE tenants (
  id TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  type TEXT NOT NULL DEFAULT 'CLIENT' CHECK (type IN ('TLI', 'CLIENT')),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  industry TEXT,
  is_sdf BOOLEAN NOT NULL DEFAULT 0,
  dpo_name TEXT,
  dpo_email TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'ARCHIVED')),
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (id),
  CONSTRAINT tenants_slug_key UNIQUE (slug)
);

CREATE TABLE user_invitations (
  id TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  tenant_id TEXT NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('TLI_SUPER_ADMIN', 'TLI_LEAD_CONSULTANT', 'TLI_REVIEWER', 'CLIENT_ADMIN', 'CLIENT_BU_LEAD', 'CLIENT_CONTRIBUTOR', 'CLIENT_VIEWER')),
  invited_by_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP_TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  accepted_at TIMESTAMP_TEXT,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT user_invitations_status_check CHECK (((status) IN ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED'))),
  CONSTRAINT user_invitations_invited_by_id_fkey FOREIGN KEY (invited_by_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT user_invitations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  PRIMARY KEY (id),
  CONSTRAINT user_invitations_token_hash_key UNIQUE (token_hash)
);

CREATE TABLE users (
  id TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  tenant_id TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('TLI_SUPER_ADMIN', 'TLI_LEAD_CONSULTANT', 'TLI_REVIEWER', 'CLIENT_ADMIN', 'CLIENT_BU_LEAD', 'CLIENT_CONTRIBUTOR', 'CLIENT_VIEWER')),
  is_active BOOLEAN NOT NULL DEFAULT 1,
  mfa_enabled BOOLEAN NOT NULL DEFAULT 0,
  mfa_secret_encrypted TEXT,
  last_login_at TIMESTAMP_TEXT,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
  PRIMARY KEY (id),
  CONSTRAINT users_email_key UNIQUE (email)
);

CREATE INDEX idx_assignments_assessment ON assessment_assignments (assessment_id);
CREATE INDEX idx_assignments_user ON assessment_assignments (user_id);
CREATE INDEX idx_assessment_controls_contributor ON assessment_controls (assigned_contributor_id);
CREATE INDEX idx_assessment_controls_status ON assessment_controls (assessment_id, verification_status);
CREATE INDEX idx_assessment_responses_assessment ON assessment_questionnaire_responses (assessment_id);
CREATE INDEX idx_assessment_responses_qcode ON assessment_questionnaire_responses (question_code);
CREATE INDEX idx_assessment_responses_tenant ON assessment_questionnaire_responses (tenant_id);
CREATE INDEX idx_scores_assessment ON assessment_scores (assessment_id);
CREATE INDEX idx_assessments_tenant_status ON assessments (tenant_id, status);
CREATE INDEX idx_audit_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_tenant_time ON audit_logs (tenant_id, "timestamp" DESC);
CREATE INDEX idx_business_units_tenant ON business_units (tenant_id);
CREATE INDEX idx_clarification_messages_thread ON clarification_messages (thread_id);
CREATE INDEX idx_clarification_threads_assessment_qcode ON clarification_threads (assessment_id, question_code);
CREATE INDEX idx_clarification_threads_control ON clarification_threads (assessment_control_id);
CREATE INDEX idx_clarification_threads_evidence ON clarification_threads (evidence_item_id);
CREATE INDEX idx_response_history_control ON control_response_history (assessment_control_id, version_number);
CREATE INDEX idx_controls_domain ON controls (domain_id);
CREATE INDEX idx_controls_source ON controls (source_id);
CREATE INDEX idx_evidence_control ON evidence_items (assessment_control_id);
CREATE INDEX idx_evidence_hash ON evidence_items (sha256_hash);
CREATE INDEX idx_evidence_items_assessment_qcode ON evidence_items (assessment_id, question_code);
CREATE INDEX idx_evidence_pending_upload_expiry ON evidence_items (status, upload_expires_at) WHERE (status = 'PENDING_UPLOAD');
CREATE INDEX idx_evidence_tenant ON evidence_items (tenant_id);
CREATE INDEX idx_evidence_tenant_status ON evidence_items (tenant_id, status);
CREATE INDEX idx_evidence_review_history_item ON evidence_review_history (evidence_item_id);
CREATE INDEX idx_processing_activities_tenant ON processing_activities (tenant_id);
CREATE INDEX idx_assessor_review_hist_assessment ON questionnaire_assessor_review_history (assessment_id, question_code);
CREATE INDEX idx_assessor_reviews_assessment ON questionnaire_assessor_reviews (assessment_id);
CREATE INDEX idx_assessor_reviews_qcode ON questionnaire_assessor_reviews (question_code);
CREATE INDEX idx_assessor_reviews_status ON questionnaire_assessor_reviews (assessment_id, review_status);
CREATE INDEX idx_response_history_assessment ON questionnaire_response_history (assessment_id, question_code);
CREATE INDEX idx_remediation_evidence_task ON remediation_evidence_items (remediation_task_id);
CREATE INDEX idx_remediation_assessment ON remediation_tasks (assessment_id, tenant_id);
CREATE INDEX idx_remediation_question ON remediation_tasks (question_code);
CREATE INDEX idx_remediation_tenant_status ON remediation_tasks (tenant_id, status);
CREATE INDEX idx_reports_assessment ON report_snapshots (assessment_id, tenant_id);
CREATE INDEX idx_user_invitations_email ON user_invitations (email);
CREATE INDEX idx_user_invitations_tenant ON user_invitations (tenant_id);
CREATE INDEX idx_user_invitations_token ON user_invitations (token_hash);
CREATE INDEX idx_users_tenant_role ON users (tenant_id, role);

-- ---------------------------------------------------------------------------------------------
-- Forensic integrity triggers (translated from prevent_immutable_record_modification and
-- enforce_assessment_lifecycle_immutability).
-- ---------------------------------------------------------------------------------------------

CREATE TRIGGER trg_audit_logs_immutable_update BEFORE UPDATE ON audit_logs
BEGIN
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table audit_logs is strictly append-only. UPDATE and DELETE operations are prohibited.');
END;
CREATE TRIGGER trg_audit_logs_immutable_delete BEFORE DELETE ON audit_logs
BEGIN
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table audit_logs is strictly append-only. UPDATE and DELETE operations are prohibited.');
END;

CREATE TRIGGER trg_control_response_history_immutable_update BEFORE UPDATE ON control_response_history
BEGIN
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table control_response_history is strictly append-only. UPDATE and DELETE operations are prohibited.');
END;
CREATE TRIGGER trg_control_response_history_immutable_delete BEFORE DELETE ON control_response_history
BEGIN
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table control_response_history is strictly append-only. UPDATE and DELETE operations are prohibited.');
END;

CREATE TRIGGER trg_report_snapshots_immutable_update BEFORE UPDATE ON report_snapshots
BEGIN
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table report_snapshots is strictly append-only. UPDATE and DELETE operations are prohibited.');
END;
CREATE TRIGGER trg_report_snapshots_immutable_delete BEFORE DELETE ON report_snapshots
BEGIN
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table report_snapshots is strictly append-only. UPDATE and DELETE operations are prohibited.');
END;

CREATE TRIGGER trg_questionnaire_response_history_immutable_update BEFORE UPDATE ON questionnaire_response_history
BEGIN
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table questionnaire_response_history is strictly append-only. UPDATE and DELETE operations are prohibited.');
END;
CREATE TRIGGER trg_questionnaire_response_history_immutable_delete BEFORE DELETE ON questionnaire_response_history
BEGIN
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table questionnaire_response_history is strictly append-only. UPDATE and DELETE operations are prohibited.');
END;

CREATE TRIGGER trg_questionnaire_assessor_review_history_immutable_update BEFORE UPDATE ON questionnaire_assessor_review_history
BEGIN
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table questionnaire_assessor_review_history is strictly append-only. UPDATE and DELETE operations are prohibited.');
END;
CREATE TRIGGER trg_questionnaire_assessor_review_history_immutable_delete BEFORE DELETE ON questionnaire_assessor_review_history
BEGIN
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table questionnaire_assessor_review_history is strictly append-only. UPDATE and DELETE operations are prohibited.');
END;

CREATE TRIGGER trg_evidence_review_history_immutable_update BEFORE UPDATE ON evidence_review_history
BEGIN
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table evidence_review_history is strictly append-only. UPDATE and DELETE operations are prohibited.');
END;
CREATE TRIGGER trg_evidence_review_history_immutable_delete BEFORE DELETE ON evidence_review_history
BEGIN
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table evidence_review_history is strictly append-only. UPDATE and DELETE operations are prohibited.');
END;

CREATE TRIGGER trg_assessments_lifecycle_guard BEFORE UPDATE ON assessments
BEGIN
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Assessment is ARCHIVED and permanently locked against modification.')
  WHERE OLD.status = 'ARCHIVED';
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Assessment is FINAL_ISSUED. Only progression to REMEDIATION_ACTIVE or ARCHIVED is permitted.')
  WHERE OLD.status = 'FINAL_ISSUED' AND NEW.status NOT IN ('FINAL_ISSUED', 'REMEDIATION_ACTIVE', 'ARCHIVED');
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Assessment is FINAL_ISSUED. Core assessment metadata is immutable.')
  WHERE OLD.status = 'FINAL_ISSUED' AND (
    NEW.title IS NOT OLD.title OR NEW.engagement_code IS NOT OLD.engagement_code OR
    NEW.tenant_id IS NOT OLD.tenant_id OR NEW.framework_version_id IS NOT OLD.framework_version_id OR
    NEW.scoring_model_id IS NOT OLD.scoring_model_id OR NEW.is_partial_assessment IS NOT OLD.is_partial_assessment);
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Assessment is CANCELLED. Only transition to ARCHIVED is permitted.')
  WHERE OLD.status = 'CANCELLED' AND NEW.status NOT IN ('CANCELLED', 'ARCHIVED');
END;

CREATE TRIGGER trg_assessment_questionnaire_responses_finalized_guard_insert BEFORE INSERT ON assessment_questionnaire_responses
BEGIN
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table assessment_questionnaire_responses cannot be modified for assessment in status LEAD_APPROVED.')
  WHERE (SELECT status FROM assessments WHERE id = NEW.assessment_id) = 'LEAD_APPROVED';
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table assessment_questionnaire_responses cannot be modified for assessment in status FINAL_ISSUED.')
  WHERE (SELECT status FROM assessments WHERE id = NEW.assessment_id) = 'FINAL_ISSUED';
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table assessment_questionnaire_responses cannot be modified for assessment in status REMEDIATION_ACTIVE.')
  WHERE (SELECT status FROM assessments WHERE id = NEW.assessment_id) = 'REMEDIATION_ACTIVE';
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table assessment_questionnaire_responses cannot be modified for assessment in status ARCHIVED.')
  WHERE (SELECT status FROM assessments WHERE id = NEW.assessment_id) = 'ARCHIVED';
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table assessment_questionnaire_responses cannot be modified for assessment in status CANCELLED.')
  WHERE (SELECT status FROM assessments WHERE id = NEW.assessment_id) = 'CANCELLED';
END;
CREATE TRIGGER trg_assessment_questionnaire_responses_finalized_guard_update BEFORE UPDATE ON assessment_questionnaire_responses
BEGIN
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table assessment_questionnaire_responses cannot be modified for assessment in status LEAD_APPROVED.')
  WHERE (SELECT status FROM assessments WHERE id = NEW.assessment_id) = 'LEAD_APPROVED';
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table assessment_questionnaire_responses cannot be modified for assessment in status FINAL_ISSUED.')
  WHERE (SELECT status FROM assessments WHERE id = NEW.assessment_id) = 'FINAL_ISSUED';
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table assessment_questionnaire_responses cannot be modified for assessment in status REMEDIATION_ACTIVE.')
  WHERE (SELECT status FROM assessments WHERE id = NEW.assessment_id) = 'REMEDIATION_ACTIVE';
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table assessment_questionnaire_responses cannot be modified for assessment in status ARCHIVED.')
  WHERE (SELECT status FROM assessments WHERE id = NEW.assessment_id) = 'ARCHIVED';
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table assessment_questionnaire_responses cannot be modified for assessment in status CANCELLED.')
  WHERE (SELECT status FROM assessments WHERE id = NEW.assessment_id) = 'CANCELLED';
END;
CREATE TRIGGER trg_assessment_questionnaire_responses_finalized_guard_delete BEFORE DELETE ON assessment_questionnaire_responses
BEGIN
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table assessment_questionnaire_responses cannot be modified for assessment in status LEAD_APPROVED.')
  WHERE (SELECT status FROM assessments WHERE id = OLD.assessment_id) = 'LEAD_APPROVED';
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table assessment_questionnaire_responses cannot be modified for assessment in status FINAL_ISSUED.')
  WHERE (SELECT status FROM assessments WHERE id = OLD.assessment_id) = 'FINAL_ISSUED';
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table assessment_questionnaire_responses cannot be modified for assessment in status REMEDIATION_ACTIVE.')
  WHERE (SELECT status FROM assessments WHERE id = OLD.assessment_id) = 'REMEDIATION_ACTIVE';
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table assessment_questionnaire_responses cannot be modified for assessment in status ARCHIVED.')
  WHERE (SELECT status FROM assessments WHERE id = OLD.assessment_id) = 'ARCHIVED';
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table assessment_questionnaire_responses cannot be modified for assessment in status CANCELLED.')
  WHERE (SELECT status FROM assessments WHERE id = OLD.assessment_id) = 'CANCELLED';
END;

CREATE TRIGGER trg_questionnaire_assessor_reviews_finalized_guard_insert BEFORE INSERT ON questionnaire_assessor_reviews
BEGIN
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table questionnaire_assessor_reviews cannot be modified for assessment in status LEAD_APPROVED.')
  WHERE (SELECT status FROM assessments WHERE id = NEW.assessment_id) = 'LEAD_APPROVED';
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table questionnaire_assessor_reviews cannot be modified for assessment in status FINAL_ISSUED.')
  WHERE (SELECT status FROM assessments WHERE id = NEW.assessment_id) = 'FINAL_ISSUED';
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table questionnaire_assessor_reviews cannot be modified for assessment in status REMEDIATION_ACTIVE.')
  WHERE (SELECT status FROM assessments WHERE id = NEW.assessment_id) = 'REMEDIATION_ACTIVE';
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table questionnaire_assessor_reviews cannot be modified for assessment in status ARCHIVED.')
  WHERE (SELECT status FROM assessments WHERE id = NEW.assessment_id) = 'ARCHIVED';
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table questionnaire_assessor_reviews cannot be modified for assessment in status CANCELLED.')
  WHERE (SELECT status FROM assessments WHERE id = NEW.assessment_id) = 'CANCELLED';
END;
CREATE TRIGGER trg_questionnaire_assessor_reviews_finalized_guard_update BEFORE UPDATE ON questionnaire_assessor_reviews
BEGIN
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table questionnaire_assessor_reviews cannot be modified for assessment in status LEAD_APPROVED.')
  WHERE (SELECT status FROM assessments WHERE id = NEW.assessment_id) = 'LEAD_APPROVED';
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table questionnaire_assessor_reviews cannot be modified for assessment in status FINAL_ISSUED.')
  WHERE (SELECT status FROM assessments WHERE id = NEW.assessment_id) = 'FINAL_ISSUED';
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table questionnaire_assessor_reviews cannot be modified for assessment in status REMEDIATION_ACTIVE.')
  WHERE (SELECT status FROM assessments WHERE id = NEW.assessment_id) = 'REMEDIATION_ACTIVE';
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table questionnaire_assessor_reviews cannot be modified for assessment in status ARCHIVED.')
  WHERE (SELECT status FROM assessments WHERE id = NEW.assessment_id) = 'ARCHIVED';
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table questionnaire_assessor_reviews cannot be modified for assessment in status CANCELLED.')
  WHERE (SELECT status FROM assessments WHERE id = NEW.assessment_id) = 'CANCELLED';
END;
CREATE TRIGGER trg_questionnaire_assessor_reviews_finalized_guard_delete BEFORE DELETE ON questionnaire_assessor_reviews
BEGIN
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table questionnaire_assessor_reviews cannot be modified for assessment in status LEAD_APPROVED.')
  WHERE (SELECT status FROM assessments WHERE id = OLD.assessment_id) = 'LEAD_APPROVED';
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table questionnaire_assessor_reviews cannot be modified for assessment in status FINAL_ISSUED.')
  WHERE (SELECT status FROM assessments WHERE id = OLD.assessment_id) = 'FINAL_ISSUED';
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table questionnaire_assessor_reviews cannot be modified for assessment in status REMEDIATION_ACTIVE.')
  WHERE (SELECT status FROM assessments WHERE id = OLD.assessment_id) = 'REMEDIATION_ACTIVE';
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table questionnaire_assessor_reviews cannot be modified for assessment in status ARCHIVED.')
  WHERE (SELECT status FROM assessments WHERE id = OLD.assessment_id) = 'ARCHIVED';
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Table questionnaire_assessor_reviews cannot be modified for assessment in status CANCELLED.')
  WHERE (SELECT status FROM assessments WHERE id = OLD.assessment_id) = 'CANCELLED';
END;

CREATE TRIGGER trg_evidence_items_finalized_guard_insert BEFORE INSERT ON evidence_items
BEGIN
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Evidence items cannot be modified for assessment in status LEAD_APPROVED.')
  WHERE (CASE WHEN NEW.assessment_id IS NOT NULL THEN (SELECT status FROM assessments WHERE id = NEW.assessment_id) WHEN NEW.assessment_control_id IS NOT NULL THEN (SELECT a.status FROM assessments a JOIN assessment_controls ac ON ac.assessment_id = a.id WHERE ac.id = NEW.assessment_control_id) END) = 'LEAD_APPROVED';
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Evidence items cannot be modified for assessment in status FINAL_ISSUED.')
  WHERE (CASE WHEN NEW.assessment_id IS NOT NULL THEN (SELECT status FROM assessments WHERE id = NEW.assessment_id) WHEN NEW.assessment_control_id IS NOT NULL THEN (SELECT a.status FROM assessments a JOIN assessment_controls ac ON ac.assessment_id = a.id WHERE ac.id = NEW.assessment_control_id) END) = 'FINAL_ISSUED';
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Evidence items cannot be modified for assessment in status ARCHIVED.')
  WHERE (CASE WHEN NEW.assessment_id IS NOT NULL THEN (SELECT status FROM assessments WHERE id = NEW.assessment_id) WHEN NEW.assessment_control_id IS NOT NULL THEN (SELECT a.status FROM assessments a JOIN assessment_controls ac ON ac.assessment_id = a.id WHERE ac.id = NEW.assessment_control_id) END) = 'ARCHIVED';
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Evidence items cannot be modified for assessment in status CANCELLED.')
  WHERE (CASE WHEN NEW.assessment_id IS NOT NULL THEN (SELECT status FROM assessments WHERE id = NEW.assessment_id) WHEN NEW.assessment_control_id IS NOT NULL THEN (SELECT a.status FROM assessments a JOIN assessment_controls ac ON ac.assessment_id = a.id WHERE ac.id = NEW.assessment_control_id) END) = 'CANCELLED';
END;
CREATE TRIGGER trg_evidence_items_finalized_guard_update BEFORE UPDATE ON evidence_items
BEGIN
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Evidence items cannot be modified for assessment in status LEAD_APPROVED.')
  WHERE (CASE WHEN NEW.assessment_id IS NOT NULL THEN (SELECT status FROM assessments WHERE id = NEW.assessment_id) WHEN NEW.assessment_control_id IS NOT NULL THEN (SELECT a.status FROM assessments a JOIN assessment_controls ac ON ac.assessment_id = a.id WHERE ac.id = NEW.assessment_control_id) END) = 'LEAD_APPROVED';
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Evidence items cannot be modified for assessment in status FINAL_ISSUED.')
  WHERE (CASE WHEN NEW.assessment_id IS NOT NULL THEN (SELECT status FROM assessments WHERE id = NEW.assessment_id) WHEN NEW.assessment_control_id IS NOT NULL THEN (SELECT a.status FROM assessments a JOIN assessment_controls ac ON ac.assessment_id = a.id WHERE ac.id = NEW.assessment_control_id) END) = 'FINAL_ISSUED';
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Evidence items cannot be modified for assessment in status ARCHIVED.')
  WHERE (CASE WHEN NEW.assessment_id IS NOT NULL THEN (SELECT status FROM assessments WHERE id = NEW.assessment_id) WHEN NEW.assessment_control_id IS NOT NULL THEN (SELECT a.status FROM assessments a JOIN assessment_controls ac ON ac.assessment_id = a.id WHERE ac.id = NEW.assessment_control_id) END) = 'ARCHIVED';
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Evidence items cannot be modified for assessment in status CANCELLED.')
  WHERE (CASE WHEN NEW.assessment_id IS NOT NULL THEN (SELECT status FROM assessments WHERE id = NEW.assessment_id) WHEN NEW.assessment_control_id IS NOT NULL THEN (SELECT a.status FROM assessments a JOIN assessment_controls ac ON ac.assessment_id = a.id WHERE ac.id = NEW.assessment_control_id) END) = 'CANCELLED';
END;
CREATE TRIGGER trg_evidence_items_finalized_guard_delete BEFORE DELETE ON evidence_items
BEGIN
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Evidence items cannot be modified for assessment in status LEAD_APPROVED.')
  WHERE (CASE WHEN OLD.assessment_id IS NOT NULL THEN (SELECT status FROM assessments WHERE id = OLD.assessment_id) WHEN OLD.assessment_control_id IS NOT NULL THEN (SELECT a.status FROM assessments a JOIN assessment_controls ac ON ac.assessment_id = a.id WHERE ac.id = OLD.assessment_control_id) END) = 'LEAD_APPROVED';
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Evidence items cannot be modified for assessment in status FINAL_ISSUED.')
  WHERE (CASE WHEN OLD.assessment_id IS NOT NULL THEN (SELECT status FROM assessments WHERE id = OLD.assessment_id) WHEN OLD.assessment_control_id IS NOT NULL THEN (SELECT a.status FROM assessments a JOIN assessment_controls ac ON ac.assessment_id = a.id WHERE ac.id = OLD.assessment_control_id) END) = 'FINAL_ISSUED';
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Evidence items cannot be modified for assessment in status ARCHIVED.')
  WHERE (CASE WHEN OLD.assessment_id IS NOT NULL THEN (SELECT status FROM assessments WHERE id = OLD.assessment_id) WHEN OLD.assessment_control_id IS NOT NULL THEN (SELECT a.status FROM assessments a JOIN assessment_controls ac ON ac.assessment_id = a.id WHERE ac.id = OLD.assessment_control_id) END) = 'ARCHIVED';
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: Evidence items cannot be modified for assessment in status CANCELLED.')
  WHERE (CASE WHEN OLD.assessment_id IS NOT NULL THEN (SELECT status FROM assessments WHERE id = OLD.assessment_id) WHEN OLD.assessment_control_id IS NOT NULL THEN (SELECT a.status FROM assessments a JOIN assessment_controls ac ON ac.assessment_id = a.id WHERE ac.id = OLD.assessment_control_id) END) = 'CANCELLED';
END;
