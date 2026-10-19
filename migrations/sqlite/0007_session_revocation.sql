-- CloudE5 migration 0007: per-session sign-out.
--
-- Session cookies are signed tokens valid for up to 8 hours. Signing out records the token's id here
-- so a copied cookie cannot be replayed afterwards; other sessions of the same user stay valid
-- ("Sign out everywhere" still uses users.session_version). Rows are pruned after expires_at.

CREATE TABLE revoked_sessions (
  session_id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP_TEXT NOT NULL,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_revoked_sessions_expires ON revoked_sessions (expires_at);
