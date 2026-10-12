# TLI DPDP Platform — Phase 8: Secure Production Admin Provisioning & Demo Customer Setup

**Document Reference:** `docs/52_production_admin_provisioning_and_demo_setup.md`  
**Classification:** Internal Advisory / Operations Runbook  
**Target Environments:**
- Deployed Application: `https://tl-assessment-tool.vercel.app/`
- Production Database: PostgreSQL 18+ on Neon (Project: `DPDP`, Branch: `production`, DB: `neondb`)
- Local Validation Database: PostgreSQL 16+ (`postgresql://postgres@127.0.0.1:54329/dpdp_test`)

---

## 1. Executive Summary & Objective

Phase 8 establishes secure, production-grade authentication credentials and workspaces for two critical platform personas:
1. **TLI Super Administrator** (`admin@truthlabs.in`): Root administrative authority with cross-tenant visibility, consultant assignment, customer organization onboarding, and platform governance.
2. **Demo Customer Administrator** (`demo.admin@tlidemo.example`): Customer-scoped administrative authority bound strictly to the synthetic customer workspace **TLI Demo Customer**, enabling safe management demonstrations without cross-tenant exposure.

All credentials are generated using cryptographically secure high-entropy random sequences, hashed with `bcrypt` (work factor 12), and delivered exclusively through a local, Git-ignored credentials file with restrictive permissions (`0600`). Zero plaintext credentials, database secrets, or session keys are stored in version control, logs, or public API endpoints.

---

## 2. Pre-Implementation Audit & Technical Discoveries

Before modifying code or executing database operations, a complete architectural audit of the authentication, schema, and production environment was conducted.

### 2.1 Production Authentication Fail-Closed Guards
- **Synthetic Fixture Block (`app/api/auth/login/route.ts:95`):** In `NODE_ENV=production`, the login endpoint unconditionally rejects any account whose `password_hash` matches the synthetic development placeholder hash (`$2b$12$e80yvV3n2YfV3n2YfV3n2Oe2Z3iP1W5e2Z3iP1W5e2Z3iP1W5e2Z3`).
- **Demo Alias Disable (`app/api/auth/login/route.ts:73`):** Development demo aliases (`consultant.demo@tli.local`, `customer.demo@tli.local`) are disabled in production.
- **Account State in Initial Migration:** Migration `004_seed_synthetic_data.sql` seeded `admin@truthlabs.in` with the synthetic placeholder hash. Consequently, in production, `admin@truthlabs.in` could not authenticate until its password hash was upgraded to a real, unique bcrypt hash.

### 2.2 Lack of Public Admin Bootstrap Route
- Customer user provisioning endpoints (`/api/customers/[id]/users`) strictly reject non-client roles (throwing HTTP 400 for `TLI_SUPER_ADMIN` or consultant roles).
- Customer creation (`/api/customers`) requires an existing active `TLI_SUPER_ADMIN` session.
- No public registration or bootstrap route exists. An offline, secure administrative provisioning CLI script is the approved architectural path.

### 2.3 Remote Neon Production Database Audit
- An audit of the remote Neon database (`neondb` on branch `production`, project `morning-morning-49773193`) via the Neon MCP tools revealed:
  - Public schema table count: `0` (the database is clean and has not had migrations applied).
  - Migration state: `schema_migrations` does not exist yet on the remote database.
- **Critical Architectural Gate:** Migrations `001_initial_schema.sql` through `013_user_invitations_and_onboarding.sql` must be applied to the remote Neon database before account records can be provisioned.

---

## 3. Provisioning Architecture & Implementation

### 3.1 Provisioning Script: `scripts/provision_production_accounts.ts`

The administrative runner is implemented in TypeScript and executed via Node.js native type stripping:
```bash
node --experimental-strip-types scripts/provision_production_accounts.ts --target=production --database-url=URL
# or via npm script
npm run provision:accounts -- --target=production --database-url=URL
```

### 3.2 Security Guarantees & Safeguards

| Safeguard | Implementation Mechanism |
|---|---|
| **Explicit Target Guard** | Requires `--target=production`, `--target=staging`, or `--target=local`. Refuses to run if target is omitted to prevent accidental execution. |
| **Target Database Validation** | Validates connectivity, tests for `tenants` and `users` tables, and checks `schema_migrations`. Fails safely with actionable errors if schema is uninitialized. |
| **High-Entropy Password Generation** | Generates 28-character passwords using `crypto.randomBytes` and `crypto.randomInt` with mandatory distribution across uppercase, lowercase, digits, and symbols (`!@#$%^&*()_+-=[]{}|~`), shuffled via Fisher-Yates. |
| **Password Hashing** | Uses application-standard `bcryptjs` (`hashPassword` from `lib/auth/passwords.ts`) with cost factor 12. |
| **Atomic PostgreSQL Transaction** | All operations (tenants, users, assessments, assignments, audit logs) run within `BEGIN ... COMMIT` with automatic `ROLLBACK` on error. |
| **Idempotency & Non-Destructive Operation** | Safe to re-run. If an account already possesses a non-synthetic password, the script **preserves** existing credentials and refuses to silently reset passwords (unless `--force-reset-admin` or `--force-reset-demo` is explicitly passed). |
| **Secure Credential Output** | Writes initial credentials exclusively to `.credentials_provisioned.txt` with file mode `0o600` (`chmod 600`, read/write only by current OS user). |
| **Zero Repository Exposure** | `.gitignore` was updated with `.credentials*` and `*.credentials`. Plaintext passwords and connection strings are excluded from persistent logs and git history. |

---

## 4. Account Specifications & Workspace Configuration

### 4.1 Account 1: TLI Super Administrator
- **Email:** `admin@truthlabs.in`
- **Role:** `TLI_SUPER_ADMIN`
- **Tenant:** `Truth Labs International Compliance Advisory` (`slug: truth-labs-advisory`, `type: TLI`)
- **Status:** `ACTIVE` (`is_active = TRUE`)
- **Permissions:**
  - `canAccessAllTenants: true` (Cross-tenant global visibility under PostgreSQL RLS)
  - `canCreateCustomer: true` (Authorized to onboard new client organizations)
  - `canFinalizeAssessment: true` (Authorized to approve and issue formal DPDP reports)
  - `canManageTenantUsers: true`
- **Audit Logging:** Emits `USER_PROVISIONED` or `USER_CREDENTIALS_INITIALIZED` into `audit_logs`.

### 4.2 Account 2: Demo Customer Administrator
- **Email:** `demo.admin@tlidemo.example`
- **Role:** `CLIENT_ADMIN`
- **Tenant Organization:** `TLI Demo Customer` (`slug: tli-demo-customer`, `type: CLIENT`)
  - Industry: `Demonstration & Evaluation`
  - Significant Data Fiduciary (SDF): `FALSE`
  - DPO Contact: `dpo@tlidemo.example`
  - Status: `ACTIVE`
- **Permissions:**
  - `canAccessAllTenants: false` (Strict tenant boundary under PostgreSQL RLS)
  - `canCreateCustomer: false` (Blocked from onboarding organizations)
  - `canFinalizeAssessment: false` (Blocked from approving/issuing reports)
  - `canManageTenantUsers: true` (Restricted to demo tenant users)
  - `canUploadEvidence: true`
- **Synthetic Demo Workspace:**
  - Assessment Engagement Code: `ENG-TLI-DEMO-2026-001`
  - Title: `TLI Demo Customer — DPDP Compliance Gap Assessment`
  - Status: `DATA_GATHERING`
  - Lead Consultant Assignment: `admin@truthlabs.in` (`ENGAGEMENT_LEAD`)
  - Client Assignment: `demo.admin@tlidemo.example` (`CLIENT_COORDINATOR`)
  - Populated Controls: Canonical 30 controls instantiated with `UNANSWERED` verification status for immediate demonstration.

---

## 5. Execution Runbook for Remote Production Database

In compliance with project safety protocols, changes were not applied autonomously to the production database. Follow the steps below to execute migrations and account provisioning against the production Neon database.

### Step 1: Apply Schema Migrations (001 through 013)
The production database currently has 0 tables. Run the migration suite to establish tables, types, RLS policies, canonical controls, review workspace triggers, and onboarding tables:

```bash
# Retrieve production DATABASE_URL from Vercel / Neon console (e.g., neondb on production branch)
python3 scripts/migrate.py up --database-url="<PRODUCTION_DATABASE_URL>"
```

*Verification:*
```bash
python3 scripts/migrate.py status --database-url="<PRODUCTION_DATABASE_URL>"
# Confirms all 13 migrations are marked APPLIED.
```

### Step 2: Provision Root Administrative & Demo Accounts
Execute the provisioning script with `--target=production`:

```bash
npm run provision:accounts -- --target=production --database-url="<PRODUCTION_DATABASE_URL>"
```

*Expected Terminal Output:*
```
=================================================================
  TLI DPDP Platform — Production Account Provisioning
=================================================================
Target Environment : PRODUCTION
Credentials File   : /home/charan/Documents/DPDP Tool/.credentials_provisioned.txt
-----------------------------------------------------------------
✔ Account provisioning completed successfully!

Account Summary:
  1. TLI Super Admin : admin@truthlabs.in [TLI_SUPER_ADMIN] -> PROVISIONED
  2. Demo Customer   : demo.admin@tlidemo.example [CLIENT_ADMIN] -> PROVISIONED
  Tenant Organization: TLI Demo Customer (tli-demo-customer)
  Latest Migration   : 013 (013_user_invitations_and_onboarding.sql)

-----------------------------------------------------------------
Initial credentials safely saved to local file (mode 0600):
  /home/charan/Documents/DPDP Tool/.credentials_provisioned.txt

View credentials via:
  cat "/home/charan/Documents/DPDP Tool/.credentials_provisioned.txt"
=================================================================
```

### Step 3: Retrieve Credentials Securely
Inspect the local Git-ignored credentials file:

```bash
cat .credentials_provisioned.txt
```

Save the credentials to an authorized organizational password vault (e.g. 1Password / Bitwarden), then securely purge the local file:
```bash
rm .credentials_provisioned.txt
```

---

## 6. Verification Steps on Deployed Application

Once the production database has been provisioned, sign in and verify the accounts on the deployed site:

### Test Case 1: TLI Super Administrator Verification
1. Navigate to: `https://tl-assessment-tool.vercel.app/login`
2. Enter email: `admin@truthlabs.in` and the provisioned initial password.
3. **Verify:**
   - Redirects to `/dashboard`.
   - Sidebar displays badge `TLI Super Admin`.
   - User has access to `/dashboard/customers` with the "Onboard Customer" button.
   - User can view all assessments across all organizations.

### Test Case 2: Demo Customer Administrator Verification
1. Navigate to: `https://tl-assessment-tool.vercel.app/login`
2. Enter email: `demo.admin@tlidemo.example` and the provisioned initial password.
3. **Verify:**
   - Redirects to `/dashboard`.
   - Sidebar displays organization: `TLI Demo Customer` with badge `Client Admin`.
   - Navigation does NOT show `/dashboard/customers` (customer management).
   - In `/dashboard/assessments`, the demo admin sees ONLY `ENG-TLI-DEMO-2026-001`.
   - Attempting to visit `/dashboard/customers` redirects to `/unauthorized`.
   - Assessment questionnaire can be opened and responses submitted for demonstration.

---

## 7. Verification Results & Test Evidence

### 7.1 Automated Phase 8 Test Suite (`tests/phase8_production_provisioning.test.ts`)
A dedicated 10-test suite validates all Phase 8 requirements against live PostgreSQL RLS:

```
▶ Phase 8: Production Provisioning, Authentication & Isolation Verification
  ✔ 1. Strong Password Generation: produces high-entropy passwords with required character classes
  ✔ 2. TLI Administrator Authentication: authenticates in production mode using provisioned password
  ✔ 3. TLI Administrator RBAC: receives full administrative authority
  ✔ 4. Demo Customer Authentication: authenticates in production mode using provisioned password
  ✔ 5. Demo Customer RBAC: strictly blocked from TLI administrative capabilities
  ✔ 6. Live PostgreSQL RLS: Demo Customer cannot view or modify other tenants' records
  ✔ 7. Live PostgreSQL RLS: TLI Super Admin retains global platform visibility
  ✔ 8. Password Hash Security: hashes use bcrypt cost factor 12 and are never stored in plaintext
  ✔ 9. Script Idempotency: re-running without force flags creates zero duplicates and preserves passwords
  ✔ 10. Credentials File Protection: file is created with 0600 permissions and is gitignored
✔ Phase 8: Production Provisioning, Authentication & Isolation Verification (10/10 PASS)
```

### 7.2 Full Regression Suite
- **Test execution:** `npm test`
  - Suites: **19 suites**
  - Tests: **165 tests**
  - Result: **165 passed, 0 failed, 0 skipped**
- **Database RLS Kernel:** `python3 scripts/test_database_rls.py --database-url=...`
  - Result: **17/17 live security checks passed**
- **Production Build:** `npm run build`
  - Next.js 15.5.27 production build succeeded with **0 TypeScript and lint errors**.

---

## 8. File Modification Summary

| File | Purpose |
|---|---|
| `scripts/provision_production_accounts.ts` | **New:** Production-safe administrative CLI script for provisioning `admin@truthlabs.in` and `demo.admin@tlidemo.example` with target guards, atomic transactions, bcrypt hashing, and 0600 credentials file delivery. |
| `tests/phase8_production_provisioning.test.ts` | **New:** 10-test automated verification suite testing production auth, RBAC permissions, live RLS cross-tenant barriers, hash security, and idempotency. |
| `.gitignore` | **Modified:** Added `.credentials*` and `*.credentials` to prevent accidental tracking of provisioned credential files. |
| `package.json` | **Modified:** Added `"provision:accounts"` npm run script. |
| `docs/52_production_admin_provisioning_and_demo_setup.md` | **New:** Authoritative operations and deployment runbook for Phase 8. |
| `docs/README.md` | **Modified:** Updated master documentation index with Phase 8 reference. |

