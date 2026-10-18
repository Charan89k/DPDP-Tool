-- CloudE5 migration 0005: TOTP multi-factor authentication.
--
-- users.mfa_enabled / users.mfa_secret_encrypted already exist (from the original schema).
-- users.mfa_last_used_step   Last accepted TOTP time step; a code can never be used twice.
-- mfa_recovery_codes         Single-use recovery codes (SHA-256 hashes only).

ALTER TABLE users ADD COLUMN mfa_last_used_step INTEGER;

CREATE TABLE mfa_recovery_codes (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL CHECK (length(code_hash) = 64),
  used_at TIMESTAMP_TEXT,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT uq_mfa_recovery_code UNIQUE (user_id, code_hash)
);

CREATE INDEX idx_mfa_recovery_codes_user ON mfa_recovery_codes (user_id);
