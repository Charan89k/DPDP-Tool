# CloudE5 security model

## Tenant isolation

Every organisation is a tenant. Users belong to exactly one tenant. Customer data (assessments,
answers, evidence, clarifications, reviews, reports, remediation tasks, invitations, audit logs) is
owned by a tenant and must never be visible to another tenant.

### Previous design (PostgreSQL)

The original deployment enforced isolation with PostgreSQL row-level security (RLS): each request ran
as a restricted database role with the user's tenant, user id and role set as transaction-local
settings, and 44 policies filtered rows and checked writes.

### Current design (SQLite)

SQLite has no row-level security. CloudE5 reproduces the same policies in a single, central layer
(`lib/db/sqlite/policies.ts`) that every query passes through:

1. **Identity binding.** `executeWithRls()` (`lib/db/rls.ts`) opens a transaction, re-verifies the
   session against the database (account active, tenant active, role unchanged, session not
   revoked), then records the verified tenant, user and role in a per-connection context table.
2. **Reads.** For every tenant-owned table the connection has a temporary view with the same name
   that filters rows by the policy. SQLite resolves unqualified table names to these views first, so
   `SELECT ... FROM assessments` in application code only ever returns permitted rows.
3. **Writes.** Inserts, updates and deletes are routed to the base tables, where temporary triggers
   apply the policy: rows outside the policy are silently skipped (as RLS hides them), new rows that
   violate the policy abort the statement, and operations the runtime role was never granted (for
   example updating an audit log) fail with "permission denied".
4. **Privileged paths.** Authentication, registration, onboarding by platform administrators,
   migrations and maintenance run in the system context, exactly as the PostgreSQL table owner did.
   These paths re-verify the caller's account before any privileged write.

Because the policy objects belong to the connection, individual queries cannot forget tenant
filtering. Automated tests attempt cross-tenant reads and writes, forged roles and tenants,
deactivated accounts, revoked sessions and identifier manipulation, and verify they are denied.

### Implications

- Isolation is enforced by application-controlled SQL objects rather than by the database server's
  privilege system. Anyone with direct file access to the database (operating system users with read
  access to the data volume, backups) can read all tenants' data. Protect the volume and backups.
- All requests share one SQLite connection; the client serialises units of work so one request's
  context can never apply to another request's statements.
- Forensic tables (audit logs, response and review history, report snapshots) are append-only via
  triggers; finalised assessments are immutable.
- Credential columns (`users.password_hash`, `users.mfa_secret_encrypted`,
  `users.mfa_last_used_step`, `user_invitations.token_hash`) read as NULL in every tenant context;
  only the system context (sign-in, MFA, account recovery) can read them.
- Tables that only the system context uses (`auth_tokens`, `rate_limit_buckets`,
  `mfa_recovery_codes`) are deny-all in tenant contexts; `revoked_sessions` shows a user only their
  own rows (the session check runs in tenant context) and is written only by sign-out.
- In a tenant context, statements that name a schema explicitly (`main.`, `temp.`) or use
  `ATTACH`, `DETACH`, `PRAGMA` or `VACUUM` are refused, so no query can reach the base tables behind
  the policy views or alter the policy context.

## Accounts and sessions

- Passwords: bcrypt (cost 12); minimum 12 characters including a letter and a number; must not
  contain the email name; bcrypt's 72-byte limit is enforced.
- Sessions: HS256-signed, HttpOnly, SameSite=Lax cookies (Secure in production), 8-hour lifetime.
  Each user has a session version; password reset, administrator password reset and "sign out
  everywhere" increment it and invalidate existing sessions.
- Email verification is required before sign-in. Verification, password reset and invitation tokens
  are 256-bit random values; only SHA-256 hashes are stored; they are single-use and expire
  (24 hours, 1 hour and 7 days).
- Registration, verification resend and password reset return identical responses whether or not
  an account exists. Login takes the same time for unknown and known emails.
- Multi-factor authentication (optional, per user, under Settings → Security): TOTP (RFC 6238,
  30-second codes, ±1 step). Secrets are encrypted with AES-256-GCM using `CLOUDE5_ENCRYPTION_KEY`
  (32 bytes, base64) or, if unset, a key derived from `SESSION_SECRET` with HKDF; changing the key
  source makes existing enrolments unreadable (users then sign in with a recovery code or an operator
  runs `reset-mfa`). A used time step is recorded so a code cannot be replayed. Ten single-use
  recovery codes are issued at enrolment and stored only as keyed HMAC-SHA-256 hashes. Sign-in is two
  steps: the password step returns a 5-minute signed challenge in an HttpOnly, SameSite=Strict
  cookie scoped to `/api/auth/mfa`; the session is issued only after a valid code. Code attempts are
  limited to 5 per 15 minutes per account. Enabling or disabling MFA (disabling requires the password
  and a current code) revokes all other sessions.
- Organisation administrators can require MFA for every member (Settings → Security; they must use
  MFA themselves first). The requirement is enforced in the same database session check as account
  status and revocation: a member without MFA can only enrol (and sign out) — every page redirects
  to `/setup-two-factor` and every API call is refused — and nobody can turn MFA off while it is
  required.
- Rate limiting: failed logins and account emails are limited per IP and per email address, new
  registrations are capped installation-wide (30 per hour), and MFA codes per account. Counters are
  stored in the database (`rate_limit_buckets`, keyed by SHA-256 hashes, never raw emails or IPs), so
  they survive restarts. Each attempt is counted atomically *before* the password or code is checked,
  so concurrent requests cannot exceed the limit.
  Client IPs come only from headers the deployment trusts: the rightmost `X-Forwarded-For` entry
  (appended by the reverse proxy); `X-Real-IP` only with `CLOUDE5_TRUST_X_REAL_IP=true`;
  `CF-Connecting-IP` only with `TRUST_CLOUDFLARE_IP_HEADER=true`. Expose CloudE5 only through a
  reverse proxy so clients cannot write the rightmost entry themselves. If no trusted header carries
  a valid address, all such requests share the bucket `127.0.0.1`; running without a proxy therefore
  makes per-IP limits installation-wide (per-email limits still apply).
- Each session token carries a unique id. Signing out records that id in `revoked_sessions` until
  the token would have expired, so a copied cookie cannot be replayed; other devices stay signed in.
  "Sign out everywhere" (and any password reset) revokes every session. A revoked, deactivated or
  demoted session gets HTTP 401 ("sign in again"). `/api/auth/me` re-checks the database on each call.
- Accounts can only sign in with a real bcrypt hash; there is no demo or fixture login path, and the
  former public demo password is refused as a new password.
- CSRF: in addition to SameSite cookies, every state-changing API request must come from this site's
  origin.

## HTTP hardening

- Content-Security-Policy (set per request in `proxy.ts`, built in `lib/http/csp.ts`): pages get a
  fresh 128-bit script nonce on every request; only scripts carrying it, or loaded by one
  (`'strict-dynamic'`), run, so injected inline scripts are blocked. Everything else is limited to
  this origin, with no plugins, no framing and forms posting only here. Inline style attributes
  remain allowed (React renders them). API responses get `default-src 'none'`. Pages are rendered
  per request so each can carry its nonce. The development server also allows `'unsafe-eval'` and
  WebSocket connections for hot reload.
- Pages are sent with `Cache-Control: private, no-store, no-transform`. `no-transform` stops proxies
  such as Cloudflare from rewriting the HTML (for example email obfuscation), which would inject a
  script the CSP blocks. Displayed dates use one fixed zone (India) so server and browser render
  identical HTML.
- Other headers on every route: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, `Permissions-Policy` (camera, microphone, geolocation off),
  `Cross-Origin-Opener-Policy: same-origin`, and in production `Strict-Transport-Security` (one year,
  including subdomains).
- Unexpected server errors return a generic message; details go to the server log only. Expected
  validation and permission errors (4xx) return their specific message.

## Evidence files

Evidence is stored on local disk outside the web root under an opaque, tenant-partitioned key.
Uploads are size-limited, checked against an allowlist of types, and verified by file signature.
Access is authorised before any bytes are written, and every download is checked against the tenant
policy and the evidence status (quarantined, pending or deleted files are never served).

Virus scanning is optional: with `CLOUDE5_CLAMAV_HOST` set (the compose `antivirus` profile runs
ClamAV), every upload is streamed to clamd before anything is stored. Detected files are rejected
and logged with tenant and user; if the scanner is unreachable, uploads are refused (HTTP 503)
rather than accepted unscanned, and `/api/ready` reports it. Each evidence record notes which check
it passed (`CLAMAV` or `LOCAL_VALIDATOR`). Without ClamAV, do not describe uploads as virus-scanned.

## Out of scope / known limitations

- Application rate limits are coarse (sign-in, account email, registration, MFA). Put a reverse
  proxy with request-rate limiting in front of internet-facing deployments as well.
- Per-email limits mean someone who knows a user's email can temporarily (15 minutes) block that
  user's sign-in attempts or reset emails. This is the usual trade-off against password guessing.
- Inviting or adding a user whose email already exists elsewhere reports that the email is taken,
  because email addresses are unique across the installation.
- When MFA is not required by the organisation, it is optional per user.
- Issuing a final report moves the assessment to FINAL_ISSUED before the report file is written. If
  writing the file fails, issuance reports an error and records no snapshot; issuing again retries
  the file and snapshot (the lifecycle step is not repeated).
- SQLite suits a single application server. Running several app servers against one database file,
  or placing the file on a network filesystem, is not supported.
