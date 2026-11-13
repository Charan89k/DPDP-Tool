-- TLI migration 0010: consultation booking and compliance-gap remediation requests.
--
-- Consultations
--   appointment_types         administrator-configured meeting types and durations
--   assessor_availability     each TLI assessor's weekly hours (in their own timezone), buffer, notice
--   availability_exceptions   blocked dates
--   appointments              bookings; times stored in UTC. A trigger refuses overlapping active
--                             appointments for the same assessor (including buffers), so double
--                             booking is impossible even if two requests race.
-- Notifications
--   notification_deliveries   every appointment/remediation email (invitations, updates, reminders),
--                             one row per recipient per event, unique dedupe_key
-- Remediation
--   remediation_requests      a customer's request for help with selected gaps; also carries the
--                             engagement once a proposal is accepted
--   remediation_request_gaps  the selected gaps (question codes) and the CAPA task created for each
--   remediation_messages      clarification thread (append-only)
--   remediation_proposals     versioned proposals; content is frozen once sent
--   remediation_documents     client supporting documents and corrective evidence
--
-- All tables are written only by privileged service code after authorisation
-- (see lib/db/sqlite/policies.ts).

CREATE TABLE appointment_types (
  id TEXT NOT NULL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 15 AND 240),
  requires_approval BOOLEAN NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO appointment_types (id, code, name, description, duration_minutes, sort_order) VALUES
  ('a7c0f6b2-0001-4000-8000-000000000001', 'INITIAL_CONSULTATION', 'Initial DPDP consultation', 'Introduction to your DPDP obligations and how TLI can help.', 45, 1),
  ('a7c0f6b2-0001-4000-8000-000000000002', 'REPORT_WALKTHROUGH', 'Assessment report walkthrough', 'A TLI assessor walks you through your final report and findings.', 60, 2),
  ('a7c0f6b2-0001-4000-8000-000000000003', 'GAP_DISCUSSION', 'Compliance gap discussion', 'Discuss specific compliance gaps and their risks.', 45, 3),
  ('a7c0f6b2-0001-4000-8000-000000000004', 'REMEDIATION_PLANNING', 'Remediation planning', 'Plan corrective actions, owners and timelines.', 60, 4),
  ('a7c0f6b2-0001-4000-8000-000000000005', 'FOLLOW_UP', 'Follow-up consultation', 'Review progress and answer follow-up questions.', 30, 5);

CREATE TABLE assessor_availability (
  user_id TEXT NOT NULL PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  -- {"1":[["09:00","13:00"],["14:00","17:00"]], ...}; keys are ISO weekdays 1 (Mon) to 7 (Sun)
  weekly_hours JSON_TEXT NOT NULL DEFAULT '{}',
  buffer_minutes INTEGER NOT NULL DEFAULT 15 CHECK (buffer_minutes BETWEEN 0 AND 120),
  slot_step_minutes INTEGER NOT NULL DEFAULT 30 CHECK (slot_step_minutes IN (15, 30, 60)),
  min_notice_hours INTEGER NOT NULL DEFAULT 24 CHECK (min_notice_hours BETWEEN 0 AND 336),
  max_days_ahead INTEGER NOT NULL DEFAULT 60 CHECK (max_days_ahead BETWEEN 1 AND 365),
  meeting_url TEXT,
  location TEXT,
  is_accepting BOOLEAN NOT NULL DEFAULT 1,
  updated_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE availability_exceptions (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  starts_on DATE_TEXT NOT NULL,
  ends_on DATE_TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (ends_on >= starts_on)
);
CREATE INDEX idx_availability_exceptions_user ON availability_exceptions (user_id, starts_on);

CREATE TABLE remediation_requests (
  id TEXT NOT NULL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE RESTRICT,
  requested_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_assessor_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CLARIFICATION_REQUIRED',
    'PROPOSAL_PREPARED', 'PROPOSAL_SENT', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'DECLINED', 'CANCELLED')),
  help_description TEXT NOT NULL DEFAULT '',
  wants_consultation BOOLEAN NOT NULL DEFAULT 0,
  accepted_proposal_id TEXT,
  submitted_at TIMESTAMP_TEXT,
  engagement_started_at TIMESTAMP_TEXT,
  completed_at TIMESTAMP_TEXT,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_remediation_requests_tenant ON remediation_requests (tenant_id, status);
CREATE INDEX idx_remediation_requests_assessment ON remediation_requests (assessment_id);

CREATE TABLE remediation_request_gaps (
  request_id TEXT NOT NULL REFERENCES remediation_requests(id) ON DELETE CASCADE,
  question_code TEXT NOT NULL,
  gap_title TEXT NOT NULL,
  gap_severity TEXT NOT NULL,
  remediation_task_id TEXT REFERENCES remediation_tasks(id) ON DELETE RESTRICT,
  PRIMARY KEY (request_id, question_code)
);

CREATE TABLE remediation_messages (
  id TEXT NOT NULL PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES remediation_requests(id) ON DELETE RESTRICT,
  author_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  author_side TEXT NOT NULL CHECK (author_side IN ('CLIENT', 'TLI')),
  kind TEXT NOT NULL DEFAULT 'MESSAGE' CHECK (kind IN ('MESSAGE', 'CLARIFICATION_REQUEST', 'CLARIFICATION_RESPONSE', 'PROPOSAL_QUESTION', 'STATUS_NOTE')),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_remediation_messages_request ON remediation_messages (request_id, created_at);

CREATE TABLE remediation_proposals (
  id TEXT NOT NULL PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES remediation_requests(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version >= 1),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'CLARIFICATION_REQUESTED', 'SUPERSEDED')),
  scope_of_services TEXT NOT NULL,
  corrective_activities TEXT NOT NULL,
  deliverables TEXT NOT NULL,
  estimated_timeline TEXT NOT NULL,
  target_completion_date DATE_TEXT NOT NULL,
  commercial_terms TEXT NOT NULL,
  fee_amount_paise INTEGER CHECK (fee_amount_paise IS NULL OR fee_amount_paise >= 0),
  valid_until DATE_TEXT NOT NULL,
  prepared_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  sent_at TIMESTAMP_TEXT,
  responded_at TIMESTAMP_TEXT,
  responded_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  response_note TEXT,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT remediation_proposals_version_unique UNIQUE (request_id, version)
);

-- A proposal the client has seen is a record: its content can never change afterwards (revise by
-- creating a new version), and proposals are never deleted.
CREATE TRIGGER trg_remediation_proposals_frozen BEFORE UPDATE ON remediation_proposals
WHEN OLD.status <> 'DRAFT' AND (
  NEW.scope_of_services IS NOT OLD.scope_of_services OR NEW.corrective_activities IS NOT OLD.corrective_activities
  OR NEW.deliverables IS NOT OLD.deliverables OR NEW.estimated_timeline IS NOT OLD.estimated_timeline
  OR NEW.target_completion_date IS NOT OLD.target_completion_date OR NEW.commercial_terms IS NOT OLD.commercial_terms
  OR NEW.fee_amount_paise IS NOT OLD.fee_amount_paise OR NEW.valid_until IS NOT OLD.valid_until
  OR NEW.version IS NOT OLD.version OR NEW.request_id IS NOT OLD.request_id)
BEGIN
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: a sent proposal cannot be changed; create a new version');
END;
CREATE TRIGGER trg_remediation_proposals_no_delete BEFORE DELETE ON remediation_proposals
BEGIN
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: proposals cannot be deleted');
END;
CREATE TRIGGER trg_remediation_messages_immutable_update BEFORE UPDATE ON remediation_messages
BEGIN
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: remediation_messages is append-only');
END;
CREATE TRIGGER trg_remediation_messages_immutable_delete BEFORE DELETE ON remediation_messages
BEGIN
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: remediation_messages is append-only');
END;

CREATE TABLE remediation_documents (
  id TEXT NOT NULL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  request_id TEXT NOT NULL REFERENCES remediation_requests(id) ON DELETE RESTRICT,
  remediation_task_id TEXT REFERENCES remediation_tasks(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK (kind IN ('SUPPORTING_DOCUMENT', 'CORRECTIVE_EVIDENCE')),
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
  storage_key TEXT NOT NULL UNIQUE,
  uploaded_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_remediation_documents_request ON remediation_documents (request_id);

-- Corrective-action tasks created for an engagement point back to the request.
ALTER TABLE remediation_tasks ADD COLUMN remediation_request_id TEXT REFERENCES remediation_requests(id);

CREATE TABLE appointments (
  id TEXT NOT NULL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  assessment_id TEXT REFERENCES assessments(id) ON DELETE RESTRICT,
  remediation_request_id TEXT REFERENCES remediation_requests(id) ON DELETE RESTRICT,
  appointment_type_id TEXT NOT NULL REFERENCES appointment_types(id) ON DELETE RESTRICT,
  assessor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  client_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED')),
  starts_at TIMESTAMP_TEXT NOT NULL,
  ends_at TIMESTAMP_TEXT NOT NULL,
  buffer_minutes INTEGER NOT NULL DEFAULT 0 CHECK (buffer_minutes >= 0),
  client_timezone TEXT NOT NULL,
  assessor_timezone TEXT NOT NULL,
  agenda TEXT NOT NULL DEFAULT '',
  meeting_url TEXT,
  location TEXT,
  calendar_uid TEXT NOT NULL UNIQUE,
  sequence INTEGER NOT NULL DEFAULT 0 CHECK (sequence >= 0),
  cancelled_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  cancellation_reason TEXT,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (ends_at > starts_at)
);
CREATE INDEX idx_appointments_assessor_time ON appointments (assessor_user_id, starts_at);
CREATE INDEX idx_appointments_tenant ON appointments (tenant_id, starts_at);

-- No two active appointments of one assessor may overlap, counting each appointment's buffer
-- after its end. Enforced in the database so concurrent bookings cannot both succeed.
CREATE TRIGGER trg_appointments_no_overlap_insert BEFORE INSERT ON appointments
WHEN NEW.status IN ('PENDING', 'CONFIRMED')
BEGIN
  SELECT RAISE(ABORT, 'APPOINTMENT_SLOT_TAKEN')
  WHERE EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.assessor_user_id = NEW.assessor_user_id AND a.status IN ('PENDING', 'CONFIRMED') AND a.id <> NEW.id
      AND a.starts_at < strftime('%Y-%m-%dT%H:%M:%fZ', NEW.ends_at, '+' || NEW.buffer_minutes || ' minutes')
      AND strftime('%Y-%m-%dT%H:%M:%fZ', a.ends_at, '+' || a.buffer_minutes || ' minutes') > NEW.starts_at
  );
END;
CREATE TRIGGER trg_appointments_no_overlap_update BEFORE UPDATE OF starts_at, ends_at, status, assessor_user_id ON appointments
WHEN NEW.status IN ('PENDING', 'CONFIRMED')
BEGIN
  SELECT RAISE(ABORT, 'APPOINTMENT_SLOT_TAKEN')
  WHERE EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.assessor_user_id = NEW.assessor_user_id AND a.status IN ('PENDING', 'CONFIRMED') AND a.id <> NEW.id
      AND a.starts_at < strftime('%Y-%m-%dT%H:%M:%fZ', NEW.ends_at, '+' || NEW.buffer_minutes || ' minutes')
      AND strftime('%Y-%m-%dT%H:%M:%fZ', a.ends_at, '+' || a.buffer_minutes || ' minutes') > NEW.starts_at
  );
END;

CREATE TABLE notification_deliveries (
  id TEXT NOT NULL PRIMARY KEY,
  dedupe_key TEXT NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('appointment', 'remediation_request')),
  entity_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  recipient_role TEXT NOT NULL CHECK (recipient_role IN ('CLIENT', 'ASSESSOR', 'TLI')),
  recipient_email TEXT NOT NULL,
  -- Appointment sequence the message was created for; stale invitations are superseded, not sent.
  entity_sequence INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'SENDING', 'SENT', 'FAILED', 'CANCELLED')),
  scheduled_for TIMESTAMP_TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error TEXT,
  last_attempt_at TIMESTAMP_TEXT,
  sent_at TIMESTAMP_TEXT,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_notification_deliveries_due ON notification_deliveries (status, scheduled_for);
CREATE INDEX idx_notification_deliveries_entity ON notification_deliveries (entity_type, entity_id);
