# 29. Phase 3C.1 — Authentication, Session, RBAC & RLS Security Gate Review

**Project:** TLI DPDP Compliance Gap Analysis Tool  
**Milestone:** Phase 3C.1 Security Gate & Remediation  
**Author:** Principal Application Security Architect & Senior Backend Engineer  
**Date:** October 2026  
**Status:** COMPLETE & REMEDIATED (VERDICT: READY FOR PHASE 3C REVIEW)  

---

## 1. Executive Summary & Review Scope

This milestone conducted a rigorous, evidence-based application security audit of the **Phase 3C** implementation in the **TLI DPDP Compliance Gap Analysis Tool** (`/home/charan/Documents/DPDP Tool`).

The audit reviewed frontend components, server-side authentication flows, session encryption, RBAC matrix definitions, API route guards, and live PostgreSQL Row-Level Security (RLS) execution pipelines. Every security assumption was subjected to automated verification, adversarial testing, and static analysis.

### Summary of Audit Outcome
- **Initial Baseline Tests**: 17 passing tests reported in Phase 3C.
- **Vulnerabilities Identified & Remediated**: 5 distinct security vulnerabilities (1 High, 3 Medium, 1 Low).
- **Hardened Application Test Suite**: Expanded from 17 to **24 automated tests** (100% pass rate).
- **Production Build Validation**: Next.js 15 production build compiled cleanly; developer credentials UI successfully dead-code eliminated from the production client bundle.
- **Cross-Milestone Regression**: Zero regressions across Phase 2 statutory data schemas (100%), Phase 3A PostgreSQL RLS kernel (17/17 live tests), Phase 3B evidence vault (39/39 tests), and migration checksums (5/5 verified).

---

## 2. Security Boundaries & Files Inspected

The following security-critical files and boundaries were inspected in detail:

| File / Component | Security Boundary | Inspected Mechanism |
|---|---|---|
| [`lib/auth/passwords.ts`](file:///home/charan/Documents/DPDP%20Tool/lib/auth/passwords.ts) | Credential Verification | Bcrypt hashing work factor 12, timing-safe evaluation, synthetic dev fixture safety. |
| [`lib/auth/session.ts`](file:///home/charan/Documents/DPDP%20Tool/lib/auth/session.ts) | Session Lifecycle | HMAC-SHA256 (`jose`) signing, secret strength enforcement, issuer/audience validation, cookie attributes. |
| [`lib/auth/redirects.ts`](file:///home/charan/Documents/DPDP%20Tool/lib/auth/redirects.ts) | Navigation Safety | CWE-601 open redirect sanitization, protocol-relative and backslash injection prevention. |
| [`lib/auth/rate_limit.ts`](file:///home/charan/Documents/DPDP%20Tool/lib/auth/rate_limit.ts) | Brute-Force Defense | Sliding-window memory rate limiter tracking failed attempts per IP and target email. |
| [`lib/auth/rbac.ts`](file:///home/charan/Documents/DPDP%20Tool/lib/auth/rbac.ts) | Authorization Matrix | 7 application roles, least-privilege policy, DEC-01 assessment finalization enforcement. |
| [`lib/db/rls.ts`](file:///home/charan/Documents/DPDP%20Tool/lib/db/rls.ts) | Kernel RLS Binding | `executeWithRls` transaction lifecycle, `SET LOCAL ROLE`, transaction-local GUCs, DB identity verification, cleanup safety. |
| [`lib/db/pool.ts`](file:///home/charan/Documents/DPDP%20Tool/lib/db/pool.ts) | Connection Management | PostgreSQL connection pool sizing, idle client error logging, singleton lifecycle. |
| [`app/api/auth/login/route.ts`](file:///home/charan/Documents/DPDP%20Tool/app/api/auth/login/route.ts) | Authentication Endpoint | Zod validation, rate limiting, timing safety, account status check, audit logging, cookie issuance. |
| [`app/api/health/route.ts`](file:///home/charan/Documents/DPDP%20Tool/app/api/health/route.ts) | Public Probe | Redaction of database credentials, hostnames, connection strings, and exception traces. |
| [`app/login/page.tsx`](file:///home/charan/Documents/DPDP%20Tool/app/login/page.tsx) | Client Login Experience | Conditional tree-shaking of developer quick-login UI based on `NODE_ENV`. |

---

## 3. Vulnerability Findings, Severity & Remediations

### Finding SEC-01 (High): Synthetic Development Credentials Allowed in Production Authentication Path
- **Vulnerability**: In `lib/auth/passwords.ts`, the check for `SYNTHETIC_SEED_HASH` and `SyntheticTestPassword123!` was executed unconditionally without verifying `process.env.NODE_ENV !== "production"`. If synthetic seed users were present or an account had that hash, an attacker could authenticate with the hardcoded dev password. Furthermore, `app/login/page.tsx` rendered the "Show Synthetic Test Personas" quick-login UI unconditionally.
- **Remediation**:
  1. Updated `lib/auth/passwords.ts`: In production (`NODE_ENV === "production"`), synthetic test hashes (`SYNTHETIC_SEED_HASH`) and synthetic test passwords (`SyntheticTestPassword123!`) are unconditionally rejected (fail closed).
  2. Updated `app/api/auth/login/route.ts`: In production, accounts possessing `SYNTHETIC_SEED_HASH` are rejected immediately with the generic `AUTH_FAILED_MSG`.
  3. Updated `app/login/page.tsx`: Wrapped the developer quick-login component in `{process.env.NODE_ENV !== "production" && ...}`. In production builds, Next.js dead-code eliminates this entire block from the client bundle (reducing route size from 4.38 kB to 3.86 kB).
- **Regression Test**: Added automated tests verifying that in production mode, synthetic hashes and credentials return `false` and cannot authenticate.

---

### Finding SEC-02 (Medium): Hardcoded Fallback for JWT Signing Secret in Production
- **Vulnerability**: In `lib/auth/session.ts`, `getSigningKey()` fell back to a hardcoded string (`tli_dpdp_local_development_secret_key_...`) if `SESSION_SECRET` was unset in production.
- **Remediation**:
  1. Updated `lib/auth/session.ts`: In production (`NODE_ENV === "production"`), `getSigningKey()` strictly validates that `SESSION_SECRET` is set, is not a placeholder, does not contain `REPLACE_WITH`, and is at least 32 characters (256 bits) long. If any requirement fails, it throws a fatal configuration error and fails closed.
  2. In non-production, a clear development fallback is permitted for local testing.
- **Regression Test**: Added test cases asserting that missing, placeholder, or short secrets throw a fatal error in production mode.

---

### Finding SEC-03 (Medium): Incomplete Claims Verification in Session Tokens
- **Vulnerability**: Tokens were signed with `alg: "HS256"` but omitted explicit `issuer` and `audience` claims. Tokens from different environments or systems sharing a key could potentially be accepted.
- **Remediation**:
  1. Defined `TOKEN_ISSUER = "tli-dpdp-platform"` and `TOKEN_AUDIENCE = "tli-dpdp-app"`.
  2. `createSessionToken` sets `iss` and `aud`.
  3. `verifySessionToken` enforces both `issuer` and `audience` during cryptographic verification.
- **Regression Test**: Added automated test cases verifying that tokens signed with unexpected issuers or audiences fail closed (return `null`).

---

### Finding SEC-04 (Medium): Role & Tenant Forgery Risk in `executeWithRls` & Session-Wide GUCs
- **Vulnerability**:
  1. `lib/db/rls.ts` previously trusted `context.role` and `context.tenantId` from the caller without verifying them against current database records. If a caller supplied a manipulated `SessionUser` claiming `role: "TLI_SUPER_ADMIN"`, PostgreSQL RLS would evaluate `app_current_user_role() = 'TLI_SUPER_ADMIN'` and grant cross-tenant visibility.
  2. `set_config` was invoked with `is_local = false` (session-wide) without an explicit transaction boundary (`BEGIN`/`COMMIT`/`ROLLBACK`). If an exception occurred during a query, the connection could remain in an uncommitted state or leak session variables.
  3. `RESET ROLE` and `DISCARD TEMP` alone did not reset all GUC parameters.
- **Remediation**:
  1. **Transaction Boundary**: Wrapped `executeWithRls` in an explicit `BEGIN;` / `COMMIT;` transaction with safe `ROLLBACK;` on error.
  2. **Transaction-Local Settings**: Replaced session-wide settings with `SET LOCAL ROLE dpdp_app_user;` and `set_config(..., ..., true)` (`is_local = true`). When the transaction finishes, all context settings automatically revert.
  3. **Database Identity Verification**: Within the transaction, `executeWithRls` queries `users` and `tenants`:
     - Verifies user exists and belongs to the specified tenant.
     - Verifies `is_active = true` and `tenant_status = 'ACTIVE'`.
     - Verifies user's database role matches `context.role`.
     - Verifies `TLI_SUPER_ADMIN` belongs strictly to a `TLI` advisory tenant.
     - Only after database verification does it bind `app.current_user_role`.
  4. **Fail-Closed Cleanup**: In `finally`, executes `RESET ALL; RESET ROLE; DISCARD TEMP;`. If cleanup encounters any error, `client.release(err)` is invoked to force `pg` to destroy and purge the contaminated connection from the pool.
- **Regression Test**: Added automated tests verifying that forged roles, forged tenant IDs, deactivated users, and exception paths fail closed and leave zero leaked context on reused pool connections.

---

### Finding SEC-05 (Low): Missing Rate Limiting on Login Endpoint & Backslash Open Redirect
- **Vulnerability**:
  1. `app/api/auth/login/route.ts` did not throttle failed authentication attempts, leaving the endpoint open to brute-force credential stuffing.
  2. `lib/auth/redirects.ts` rejected `//` and `/\`, but did not reject arbitrary backslashes (`\`) anywhere in the path, which can trigger parser discrepancies in certain browsers.
- **Remediation**:
  1. Built `lib/auth/rate_limit.ts`: Sliding-window memory rate limiter capping failed login attempts to 5 per 15-minute window per client IP and normalized target email. Returns HTTP `429 Too Many Requests` with a `Retry-After` header.
  2. Updated `lib/auth/redirects.ts`: Unconditionally rejects any backslash character (`\`) and scheme-bearing patterns in redirect paths, failing closed to `/dashboard`.
- **Regression Test**: Added automated tests for rate limit threshold triggering and backslash open redirect defense.

---

## 4. Verification Results & Regression Matrix

### 4.1 Automated Application Tests (`npm test`)
Ran 24 automated tests across 3 test suites:

```
▶ Phase 3C: Authentication & Session Tests
  ✔ should verify valid bcrypt password hashes (1246.75ms)
  ✔ should support synthetic development test fixtures safely in dev mode (0.37ms)
  ✔ should unconditionally reject synthetic development credentials in production mode (351.68ms)
  ✔ should fail closed on null, undefined, or empty password verification (0.44ms)
  ✔ should enforce mandatory strong signing secret in production mode (1.15ms)
  ✔ should issue and verify cryptographically signed JWT sessions with issuer and audience (3.29ms)
  ✔ should reject tampered, malformed, or wrongly scoped JWT tokens (fail closed) (2.11ms)
  ✔ should prevent open redirect attacks including backslash and scheme bypasses (0.34ms)
  ✔ should enforce sliding window rate limiting on repeated failed login attempts (0.41ms)
✔ Phase 3C: Authentication & Session Tests (1608.81ms)

▶ Phase 3C: RBAC Matrix & Role Permissions
  ✔ should verify 7 defined application roles (0.30ms)
  ✔ should enforce TLI consultant review permissions (0.12ms)
  ✔ should enforce finalization authority (DEC-01) (0.10ms)
  ✔ should block CLIENT_VIEWER from uploading evidence (0.10ms)
  ✔ should allow cross-tenant inspection only to TLI_SUPER_ADMIN (0.09ms)
✔ Phase 3C: RBAC Matrix & Role Permissions (1.04ms)

▶ Phase 3C: Database RLS & Multi-Tenant Kernel Isolation
  ✔ should fail closed if session context is missing or incomplete (1.87ms)
  ✔ should enforce tenant isolation for Client Alpha under live PostgreSQL RLS (27.67ms)
  ✔ should block Client Alpha from reading Client Beta assessment records (5.77ms)
  ✔ should block Client Alpha from updating Client Beta assessment records (3.71ms)
  ✔ should grant cross-tenant global visibility to TLI_SUPER_ADMIN (5.59ms)
  ✔ should reject forged role in session context against database records (3.33ms)
  ✔ should reject cross-tenant identity forgery against database records (3.29ms)
  ✔ should reject non-existent or inactive user accounts (2.72ms)
  ✔ should safely rollback transaction and prevent context bleed on operation exception (6.62ms)
  ✔ should safely reuse pool connection across sequential multi-tenant queries without bleed (10.60ms)
✔ Phase 3C: Database RLS & Multi-Tenant Kernel Isolation (74.49ms)

ℹ tests 24
ℹ suites 3
ℹ pass 24
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
```

### 4.2 Production Build Verification (`npm run build`)
```
   ▲ Next.js 15.5.27
   Creating an optimized production build ...
 ✓ Compiled successfully in 3.8s
 ✓ Linting and checking validity of types
 ✓ Collecting page data
 ✓ Generating static pages (11/11)
 ✓ Collecting build traces
 ✓ Finalizing page optimization

Route (app)                                 Size  First Load JS
┌ ƒ /                                      143 B         103 kB
├ ○ /_not-found                            992 B         104 kB
├ ƒ /api/assessments                       143 B         103 kB
├ ƒ /api/auth/login                        143 B         103 kB
├ ƒ /api/auth/logout                       143 B         103 kB
├ ƒ /api/auth/me                           143 B         103 kB
├ ƒ /api/health                            143 B         103 kB
├ ƒ /dashboard                             164 B         106 kB
├ ƒ /dashboard/assessments                 143 B         103 kB
├ ƒ /dashboard/settings                    143 B         103 kB
├ ○ /login                               3.86 kB         107 kB
└ ○ /unauthorized                          164 B         106 kB
```
*Note*: The production `/login` bundle decreased from 4.38 kB to 3.86 kB due to complete tree-shaking of the development test credentials component.

### 4.3 Full Multi-Stack Regression Matrix

| Test Suite / Script | Command | Target Component | Result | Status |
|---|---|---|:---:|:---:|
| **Phase 2 Data Integrity** | `python3 scripts/validate_phase2_data.py` | Statutory Controls & Evidence Schemas | **PASS** | 100% compliant |
| **Phase 3A Database Security** | `python3 scripts/test_database_rls.py` | PostgreSQL RLS Kernel & Triggers | **PASS** | 9 static + 17 live passed |
| **Phase 3B Evidence Vault** | `python3 scripts/test_evidence_vault.py` | S3 Vault, Upload/Download, Quarantine | **PASS** | 39/39 passed |
| **Database Migrations** | `python3 scripts/migrate.py verify` | Migration Sequence & Checksums | **PASS** | 5/5 checksums match |
| **Phase 3C.1 Hardened App Suite** | `npm test` | Auth, JWT, RBAC, DB RLS Pool Binding | **PASS** | 24/24 passed |
| **Production Build** | `npm run build` | Next.js 15 App Router & TypeScript | **PASS** | 11/11 routes clean |

---

## 5. Stateless JWT Revocation & Session Limitations

Honest architectural disclosure regarding session revocation:
1. **Stateless JWT Cookie Revocation**: On `POST /api/auth/logout`, the server instructs the client to clear the cookie (`maxAge: 0`).
2. **Token Invalidation Scope**: If an attacker has extracted the raw JWT before logout, the token remains cryptographically valid until its 8-hour expiry unless server-side validation is performed.
3. **Database-Mediated Protection**: Because `executeWithRls()` performs database identity verification on every transaction, deactivating a user account (`is_active = false`), changing a user's role, or suspending a tenant takes effect immediately for all database operations, even if the raw token has not expired.
4. **Future Milestone Recommendation**: If strict instant token revocation for purely static/cached responses is required by enterprise clients, a server-side session registry (e.g., Redis blocklist or a PostgreSQL `active_sessions` table) should be introduced under `DEC-04`.

---

## 6. Stakeholder Decision Register Alignment

- **`DEC-01` (Assessment Finalization Authority)**: Enforced. Client administrators cannot finalize assessments; only `TLI_LEAD_CONSULTANT` and `TLI_SUPER_ADMIN` have finalization authority.
- **`DEC-04` (Authentication & Enterprise SSO Federation)**: Decoupled. The application uses a provider-neutral session and authorization interface. External SAML 2.0 / OIDC IdPs can be wired into the existing login contract without modifying downstream RBAC or PostgreSQL RLS policies.

---

## 7. Conclusion & Milestone Verdict

All identified security defects have been remediated with zero regressions across the codebase.

**VERDICT: READY FOR PHASE 3C REVIEW**

