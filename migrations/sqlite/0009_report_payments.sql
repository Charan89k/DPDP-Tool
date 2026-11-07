-- TLI migration 0009: payment-gated delivery of the final compliance report (Razorpay).
--
-- report_payments   one row per Razorpay order. A report unlocks for the customer only while a PAID
--                   row exists for its assessment; PAID is written only after server-side verification.
-- payment_events    every processed Razorpay webhook, keyed by its event id, so redelivered webhooks
--                   are recognised and ignored.
-- report_deliveries one row per recipient (customer, TLI assessor) per paid order; the unique key
--                   prevents duplicate emails. Each attempt is also written to audit_logs.
-- platform_settings administrator-managed configuration such as the report price.
--
-- All four tables are written only by privileged server code (see lib/db/sqlite/policies.ts).

CREATE TABLE platform_settings (
  key TEXT NOT NULL PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  updated_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE report_payments (
  id TEXT NOT NULL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE RESTRICT,
  report_snapshot_id TEXT NOT NULL REFERENCES report_snapshots(id) ON DELETE RESTRICT,
  requested_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  razorpay_order_id TEXT NOT NULL UNIQUE,
  razorpay_payment_id TEXT UNIQUE,
  amount_paise INTEGER NOT NULL CHECK (amount_paise >= 100),
  currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  mode TEXT NOT NULL CHECK (mode IN ('test', 'live')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
  failure_reason TEXT,
  paid_at TIMESTAMP_TEXT,
  refunded_at TIMESTAMP_TEXT,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_report_payments_assessment ON report_payments (assessment_id, status);
CREATE INDEX idx_report_payments_tenant ON report_payments (tenant_id, created_at);

CREATE TABLE payment_events (
  event_id TEXT NOT NULL PRIMARY KEY,
  event_type TEXT NOT NULL,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  payload_sha256 TEXT NOT NULL CHECK (length(payload_sha256) = 64),
  outcome TEXT NOT NULL,
  received_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE report_deliveries (
  id TEXT NOT NULL PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES report_payments(id) ON DELETE RESTRICT,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE RESTRICT,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('CLIENT', 'ASSESSOR')),
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'SENDING', 'SENT', 'FAILED')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error TEXT,
  last_attempt_at TIMESTAMP_TEXT,
  sent_at TIMESTAMP_TEXT,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT report_deliveries_one_per_recipient UNIQUE (payment_id, recipient_type)
);

CREATE INDEX idx_report_deliveries_status ON report_deliveries (status);

-- Payment rows are financial records: never deleted, and their amount and links never rewritten.
CREATE TRIGGER trg_report_payments_no_delete BEFORE DELETE ON report_payments
BEGIN
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: report_payments rows cannot be deleted');
END;

CREATE TRIGGER trg_report_payments_fixed_terms BEFORE UPDATE ON report_payments
WHEN NEW.amount_paise <> OLD.amount_paise OR NEW.currency <> OLD.currency
  OR NEW.assessment_id <> OLD.assessment_id OR NEW.tenant_id <> OLD.tenant_id
  OR NEW.razorpay_order_id <> OLD.razorpay_order_id OR NEW.report_snapshot_id <> OLD.report_snapshot_id
BEGIN
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: report payment terms cannot be changed');
END;

CREATE TRIGGER trg_payment_events_immutable_update BEFORE UPDATE ON payment_events
BEGIN
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: payment_events is append-only');
END;

CREATE TRIGGER trg_payment_events_immutable_delete BEFORE DELETE ON payment_events
BEGIN
  SELECT RAISE(ABORT, 'FORENSIC_INTEGRITY_VIOLATION: payment_events is append-only');
END;
