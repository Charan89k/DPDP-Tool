-- CloudE5 migration 0003: account security for self-service registration.
--
-- users.email_verified_at  When the user proved control of their email address. Accounts that
--                          existed before this migration were provisioned or invited by an
--                          administrator, so they are treated as verified at creation time.
-- users.session_version    Incremented on logout-everywhere, password change and password reset;
--                          signed sessions carrying an older version are rejected.
-- auth_tokens              Single-use, expiring email verification and password reset tokens.
--                          Only SHA-256 hashes are stored; raw tokens exist only in the email link.
-- tenants.onboarding_completed_at  Set when a self-registered organisation finishes onboarding.

ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMP_TEXT;
ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0;
UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL;

ALTER TABLE tenants ADD COLUMN onboarding_completed_at TIMESTAMP_TEXT;
UPDATE tenants SET onboarding_completed_at = created_at WHERE onboarding_completed_at IS NULL;

CREATE TABLE auth_tokens (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('EMAIL_VERIFICATION', 'PASSWORD_RESET')),
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  expires_at TIMESTAMP_TEXT NOT NULL,
  consumed_at TIMESTAMP_TEXT,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_auth_tokens_user_purpose ON auth_tokens (user_id, purpose);
