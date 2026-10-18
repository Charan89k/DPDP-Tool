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
- Rate limiting: failed logins and account emails are limited per IP and per email address
  (in-memory, per server process).
- CSRF: in addition to SameSite cookies, every state-changing API request must come from this site's
  origin.

## Evidence files

Evidence is stored on local disk outside the web root under an opaque, tenant-partitioned key.
Uploads are size-limited, checked against an allowlist of types, and verified by file signature.
Access is authorised before any bytes are written, and every download is checked against the tenant
policy and the evidence status (quarantined, pending or deleted files are never served). No malware
scanner is configured by default; do not describe uploads as virus-scanned unless one is added.

## Out of scope / known limitations

- Rate limits are per process and reset on restart; place CloudE5 behind a reverse proxy with its own
  rate limiting for internet-facing deployments.
- Multi-factor authentication is not implemented.
- SQLite suits a single application server. Running several app servers against one database file,
  or placing the file on a network filesystem, is not supported.
