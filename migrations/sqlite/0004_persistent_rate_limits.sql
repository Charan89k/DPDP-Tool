-- CloudE5 migration 0004: persistent rate limiting.
--
-- Failed-login, account-email and registration limits survive restarts. Keys are SHA-256 hashes
-- of "<scope>:<value>" (for example an IP address or email), so no raw identifiers are stored.
-- Expired buckets are pruned opportunistically by the application.

CREATE TABLE rate_limit_buckets (
  key_hash TEXT NOT NULL PRIMARY KEY CHECK (length(key_hash) = 64),
  attempts INTEGER NOT NULL CHECK (attempts >= 0),
  window_started_at TIMESTAMP_TEXT NOT NULL,
  updated_at TIMESTAMP_TEXT NOT NULL
);

CREATE INDEX idx_rate_limit_buckets_updated ON rate_limit_buckets (updated_at);
