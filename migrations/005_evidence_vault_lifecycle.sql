-- ============================================================================
-- TLI DPDP Compliance Gap Analysis Tool
-- Migration 005: Evidence Vault Lifecycle & Security Expansion (Phase 3B)
--
-- RATIONALE & ARCHITECTURAL NECESSITY:
-- Phase 3B implements the provider-neutral Evidence Storage Vault with pre-signed
-- upload and download authorization workflows. In accordance with Section 3 and
-- Section 5 of docs/05_tenant_isolation_and_evidence_security.md:
-- 1. Initial upload authorization precedes physical file transfer to S3. To prevent
--    unverified/abandoned uploads from being reviewed or scored, evidence items must
--    begin in 'PENDING_UPLOAD' status, transitioning to 'PENDING_SCAN' upon upload
--    completion, and 'ACTIVE' only after passing automated malware scanning.
-- 2. If malware or malicious heuristics are detected, objects must transition to
--    'QUARANTINED', isolating the binary payload and preventing any download.
-- 3. 'sha256_hash' cannot be definitively computed by the server before the binary
--    payload is received in S3. It is relaxed to NULL during 'PENDING_UPLOAD' and
--    strictly enforced via CHECK constraint once status is 'ACTIVE' or 'SUPERSEDED'.
-- ============================================================================

-- 1. ENUMERATION EXPANSION: evidence_status
-- Add lifecycle states in deterministic sequence
DO $$ BEGIN
    ALTER TYPE evidence_status ADD VALUE IF NOT EXISTS 'PENDING_UPLOAD' BEFORE 'PENDING_SCAN';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TYPE evidence_status ADD VALUE IF NOT EXISTS 'QUARANTINED' AFTER 'ACTIVE';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TYPE evidence_status ADD VALUE IF NOT EXISTS 'DELETION_PENDING' AFTER 'SUPERSEDED';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TYPE evidence_status ADD VALUE IF NOT EXISTS 'DELETED' AFTER 'DELETION_PENDING';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. RELAX sha256_hash NOT NULL FOR PENDING_UPLOAD STATE
ALTER TABLE evidence_items ALTER COLUMN sha256_hash DROP NOT NULL;

-- 3. ENFORCE sha256_hash MUST BE PRESENT FOR ACTIVE OR SUPERSEDED EVIDENCE
DO $$ BEGIN
    ALTER TABLE evidence_items 
        ADD CONSTRAINT chk_evidence_active_hash 
        CHECK (status NOT IN ('ACTIVE', 'SUPERSEDED') OR sha256_hash IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. ADD FORENSIC LIFECYCLE & SCANNING METADATA COLUMNS
ALTER TABLE evidence_items 
    ADD COLUMN IF NOT EXISTS upload_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS quarantined_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS quarantine_reason TEXT,
    ADD COLUMN IF NOT EXISTS quarantined_s3_key VARCHAR(512),
    ADD COLUMN IF NOT EXISTS scan_provider VARCHAR(100),
    ADD COLUMN IF NOT EXISTS scan_result VARCHAR(50),
    ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES users(id) ON DELETE RESTRICT;

-- 5. PERFORMANCE & AUDIT INDEXES
CREATE INDEX IF NOT EXISTS idx_evidence_tenant_status 
    ON evidence_items(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_evidence_pending_upload_expiry 
    ON evidence_items(status, upload_expires_at) 
    WHERE status = 'PENDING_UPLOAD';

-- 6. LEAST-PRIVILEGE GRANTS RE-AFFIRMATION
GRANT SELECT, INSERT, UPDATE ON evidence_items TO dpdp_app_user;

