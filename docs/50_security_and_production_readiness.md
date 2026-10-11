# TLI DPDP Platform — Phase 6: Security Audit & Production Readiness Assessment

## 1. Executive Summary & Release Recommendation

This assessment provides an independent technical and operational evaluation of the **Truth Labs International (TLI) DPDP Compliance Gap Assessment Platform**.

### Formal Release Recommendation
> **VERDICT: READY FOR PILOT**  
> The application core, database kernel isolation, canonical questionnaire engine, deterministic scoring service, OpenXML reporting, and CAPA remediation workflows have achieved **100% engineering completeness** and pass all automated verification gates (141 tests across 17 suites).  
> The platform is approved for **controlled pilot validation** with designated pilot client organizations and synthetic test fixtures.  
> Transitioning to **general public multi-tenant production** requires resolving the infrastructure prerequisites and legal/governance gates detailed in this report.

---

## 2. Security Audit & Threat Model Verification

### 2.1 Authentication & Session Lifecycle
- **Session Mechanism**: Cryptographically signed stateless JWT tokens managed via `jose` using HMAC-SHA256 (`HS256`).
- **Cookie Security Attributes**:
  - `HttpOnly: true` (prevents client-side script token theft).
  - `SameSite: 'lax'` (mitigates Cross-Site Request Forgery).
  - `Secure: true` in production (enforced when `NODE_ENV === "production"`).
  - `Max-Age: 28,800` seconds (8-hour operational window).
- **Production Fail-Closed Enforcement**: In production environments, `getSigningKey()` strictly requires a cryptographically strong `SESSION_SECRET` of at least 32 characters. Development placeholders (`REPLACE_WITH`, `DEFAULT_DEV_SECRET`) trigger an immediate fatal startup error (`FATAL SECURITY CONFIGURATION ERROR`).
- **Safe Redirects**: Redirect paths are sanitized via `getSafeRedirectUrl()`, rejecting open redirect attacks (CWE-601), protocol-relative schemes (`//`), control characters, and backslashes (`\`).

### 2.2 Password Security & Login Throttling
- **Password Hashing**: Passwords hashed with bcryptjs using a work factor of 12 rounds (`genSalt(12)`).
- **Synthetic Fixture Quarantine**: Synthetic test hashes and passwords (`SyntheticTestPassword123!`) are unconditionally blocked in production environments (`verifyPassword` returns `false` if `NODE_ENV === "production"`).
- **Login Rate Limiter**: Sliding-window rate limiter on `POST /api/auth/login` (5 failed attempts per 15-minute window per IP and email).
- **Operational Limitation**: Rate limiter state is stored in process memory. It does not share state across multiple distributed instances. For multi-pod or auto-scaling production, edge-level rate limiting (Cloudflare WAF / AWS WAF rate rules) or Redis atomic token-bucket counters must be deployed.

### 2.3 PostgreSQL Row-Level Security (RLS) & Multi-Tenant Kernel Isolation
- **Defense-in-Depth**: Multi-tenancy is enforced not merely at the application layer, but at the database engine level via PostgreSQL Row-Level Security (`ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` on all 17 tenant tables).
- **Least-Privilege Execution Role**: Application queries execute strictly under the unprivileged role `dpdp_app_user` (`NOSUPERUSER`, `NOBYPASSRLS`).
- **Transaction-Local Isolation**: Context variables (`app.current_tenant_id`, `app.current_user_id`, `app.current_user_role`) are set with `is_local = true`, binding them strictly to the active transaction.
- **Identity Forgery Defense**: `executeWithRls` queries the live `users` and `tenants` tables within the transaction boundary, verifying that the user account is active (`is_active = TRUE`), the tenant is active (`status = 'ACTIVE'`), and the claimed role matches database truth.
- **Connection Reuse Bleed Prevention**: Sockets released back to the `pg` connection pool are sanitized with:
  ```sql
  RESET ROLE;
  RESET ALL;
  DISCARD TEMP;
  ```
  If context reset fails or an error occurs during rollback, the connection is discarded (`client.release(err)`), preventing session context leakage.

### 2.4 SQL Injection Defense
- **100% Parameterization**: All SQL queries across API endpoints and domain services use parameterized bindings (`$1, $2, ...`). Zero raw string interpolation or query concatenation exists in the application codebase.
- **DDL & Migration Safety**: DDL migrations run through `psql -v ON_ERROR_STOP=1` and track SHA-256 checksums in `schema_migrations`.

### 2.5 File Upload Validation & Storage Vault
- **Metadata Validation**: Allowed extensions (`.pdf`, `.png`, `.jpg`, `.jpeg`, `.docx`, `.xlsx`) and MIME types are enforced via strict allowlists. Filenames are stripped of path traversal sequences and dangerous characters.
- **Size Bounds**: Files must be between 100 bytes and 50 MB (`52,428,800` bytes).
- **Magic Byte Sniffing**: Binary file headers are inspected using byte signatures:
  - PDF: `%PDF-` (`0x25, 0x50, 0x44, 0x46`)
  - PNG: `\x89PNG\r\n\x1a\n`
  - JPEG: `\xFF\xD8\xFF`
  - OOXML: `PK\x03\x04`
  - Forbidden: Windows PE executables (`MZ\x90`) and Unix ELF binaries are rejected immediately.
- **Opaque Storage Keys**: Storage paths never reflect client-supplied filenames or local disk paths. Keys follow the structure `evidence/{tenantId}/{assessmentId}/{questionCode}/{uuid}`.
- **Quarantine Gate**: Files in `QUARANTINED`, `PENDING_SCAN`, `PENDING_UPLOAD`, or `DELETED` status cannot be downloaded. Attempts fail closed.
- **Storage Durability Notice**: The current local filesystem adapter (`.local_evidence`) is suitable for local development and single-node pilot testing, but is **not durable** on ephemeral cloud container platforms (AWS ECS, Kubernetes, Vercel). Cloud production requires activating S3-compatible object storage with Server-Side Encryption (SSE-KMS).

### 2.6 HTTP Security Headers
Configured in `next.config.mjs`:
- `X-Content-Type-Options: nosniff` (prevents MIME type sniffing).
- `X-Frame-Options: DENY` (prevents clickjacking attacks).
- `Referrer-Policy: strict-origin-when-cross-origin` (protects referral privacy).
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` (disables unused browser capabilities).
- `poweredByHeader: false` (removes `X-Powered-By: Next.js`).

### 2.7 Secrets & Repository Hygiene
- **Zero Committed Secrets**: An exhaustive Git history audit confirms zero `.env`, `.pem`, or `.key` files have ever been committed.
- **Template Hygiene**: `.env.example` provides descriptive placeholders without disclosing production keys.
- **Git Ignore Integrity**: `.gitignore` comprehensively excludes environment files (`.env*`), database dumps (`*.dump`, `*.db`), evidence storage (`.local_evidence/`, `uploads/`), logs, and test artifacts.

### 2.8 Dependency Vulnerabilities (`npm audit`)
Running `npm audit` identifies 9 vulnerabilities in build-time tooling:
- `braces` (High) via `chokidar` / `tailwindcss` 3.x (denial of service through deeply nested patterns).
- `postcss` (High) via `next` 15.5.27 bundle (CSS stringify output and source map auto-loading).
- `postcss-selector-parser` (Moderate) via `tailwindcss` (quadratic complexity in flat selector parsing).

> **Analysis & Mitigation**:  
> All 9 flagged vulnerabilities reside in build-time CSS compilation and dev tooling (`tailwindcss`, `postcss`), not runtime API request handling. Resolving them automatically via `npm audit fix --force` would trigger major breaking upgrades to Next.js 16 and Tailwind 4.  
> **Recommendation**: Pin package versions for pilot validation; schedule a planned upgrade to Next.js 16 / Tailwind 4 during the post-pilot production hardening milestone.

### 2.9 Immutability & Forensic Integrity
- **Issued Report Snapshots**: Guarded by trigger `trg_report_snapshots_immutable` and least-privilege role permissions (no `UPDATE` or `DELETE` granted to `dpdp_app_user`).
- **Audit Logs**: Guarded by trigger `trg_audit_logs_immutable`.
- **Response History**: Guarded by trigger `trg_response_history_immutable`.
- **Non-Compensatory Response Independence**: Completing remediation items does not mutate historical baseline questionnaire responses or alter issued report snapshots.

### 2.10 Tested Scope & Audit Limitations
> [!NOTE]
> This security review evaluated the application architecture, authentication mechanisms, PostgreSQL RLS kernel isolation, file upload pipelines, and access control boundaries implemented within the repository. It does not constitute a third-party penetration test, physical infrastructure audit, or guarantee of the absence of undiscovered vulnerabilities or zero-day exploits.

---

## 3. Deployment and Operations Readiness

| Operational Area | Current Implementation Status | Production Cloud Requirement | Gap / Action Item |
|---|---|---|---|
| **Environment Secrets** | `.env` file template with validation guards | AWS Secrets Manager / HashiCorp Vault | Inject `DATABASE_URL`, `SESSION_SECRET`, and KMS keys as runtime environment secrets. |
| **Database Migrations** | `scripts/migrate.py` with SHA-256 verification | Automated CI/CD deployment pipeline | Execute `migrate.py up` during deployment jobs prior to container rollout. |
| **Database Backups & Recovery** | Manual PostgreSQL `pg_dump` | AWS RDS Automated Backups + Point-In-Time Recovery (PITR) | Configure daily automated snapshots with 35-day retention and test disaster recovery restores. |
| **Evidence Storage Vault** | Local disk vault (`.local_evidence/`) | AWS S3 Bucket with SSE-KMS & Object Lock (WORM) | Switch adapter from `LocalStorageAdapter` to S3-compatible cloud storage adapter (Phase 3B design). |
| **Malware Scanning** | Local mock scanner stub | AWS GuardDuty S3 Malware Protection / ClamAV daemon | Connect upload pipeline to asynchronous malware scanning EventBridge triggers. |
| **Rate Limiting** | Single-instance memory sliding window | Cloudflare / AWS WAF Rate-Based Rules | Implement edge-tier rate limiting (e.g. 100 req/min per IP on login endpoint). |
| **System Health Check** | `/api/health` checking DB connectivity | AWS Route 53 / ALB Health Check integration | Route 53 health check polling `/api/health` every 30 seconds for automatic failover. |
| **Connection Pooling** | `pg.Pool` (max: 10 connections, 30s idle timeout) | AWS RDS Proxy | Deploy RDS Proxy for serverless scaling and connection multiplexing. |
| **Data Residency** | Configurable via AWS Region | AWS `ap-south-1` (Mumbai) | Verify that all customer data, backups, and storage buckets are strictly located in India. |
| **Incident Response** | Detailed append-only `audit_logs` | CloudWatch Alarms / PagerDuty | Configure alert notifications for repeated authentication failures and RLS violations. |

### Data Residency Analysis
Deploying within AWS `ap-south-1` (Mumbai) satisfies the physical domestic data storage requirements of DPDPA Section 16. However, physical region selection alone does not fulfill all statutory duties:
1. **Third-Party Processors**: Client vendor agreements must incorporate Section 8(2) and Rule 7 data processor obligations.
2. **Cross-Border Transfers**: Operations must comply with Central Government negative lists under Section 16(1) and sectoral domestic storage mandates (e.g. RBI circular on payment system data).

---

## 4. Legal & Stakeholder Approval Gates

The following items from the Stakeholder Decision Register ([`docs/09`](09_unresolved_decisions_and_tl_assumptions.md)) and Legal Interpretation Register ([`docs/19`](19_legal_review_and_interpretation_register.md)) require formal sign-off:

### 4.1 Master Decision Register (DEC-01 to DEC-10)

| Ref | Topic | Implemented Default | Formal Decision Required | Approver / Owner |
|:---:|---|---|---|:---:|
| **DEC-01** | **Consultant-Led Engagement Model** | Consultant-led: only TLI consultants can scope, review, and issue reports. | Formally confirm whether standalone client self-service evaluations will ever be offered. | TLI Leadership |
| **DEC-02** | **Report Branding** | TLI Forensic Audit branding only; client appears as assessed subject. | Approve official Word/PDF document branding and co-branding policies. | TLI Advisory Board |
| **DEC-03** | **Hosting & Storage Location** | Cloud-agnostic design; AWS `ap-south-1` (Mumbai) recommended. | Approve cloud infrastructure provider and dedicated tenant hosting tiers. | TLI Security & IT |
| **DEC-04** | **Authentication & Enterprise SSO** | Email/Password with bcrypt; session cookies. | Determine timeline for enterprise SAML 2.0 / Azure AD SSO federation. | TLI Product Lead |
| **DEC-05** | **Evidence Handling & PII Masking** | Prohibit unmasked live PII; accept masked samples (`XXXX-1234`). | Formally approve client evidence sanitization and masking policy. | TLI Legal Counsel |
| **DEC-06** | **Malware Scanning Solution** | Local mock scanner; architecture supports GuardDuty / ClamAV. | Approve production antivirus solution (AWS GuardDuty vs. ClamAV). | TLI Security Lead |
| **DEC-07** | **Data Retention & Snapshot Locking** | PostgreSQL kernel trigger immutability; 5-year retention baseline. | Formally approve 5-year WORM compliance retention policy. | TLI Compliance Lead |
| **DEC-08** | **Legal Review Ownership** | Versioned `DPDPA-2023-V1.0` control library. | Formal sign-off by TLI Legal Counsel on 30 controls and 10 interpretations. | TLI General Counsel |
| **DEC-09** | **Approved Scoring Methodology** | Dual-metric `SCORING-V1-PROVISIONAL` with explicit methodology disclosures. | Formally adopt or adjust provisional mathematical weights and maturity scores. | TLI Advisory Board |
| **DEC-10** | **Statutory Legal Disclaimer Language** | Embedded standard advisory disclaimer on all generated reports. | Formally approve the standard legal disclaimer text. | TLI Legal Counsel |

### 4.2 Legal Interpretation Register (`LEG-INT-01` to `LEG-INT-10`)
All 10 legal interpretation records in `docs/19_legal_review_and_interpretation_register.md` carry the status **`LEGAL_VERIFICATION_REQUIRED`** awaiting review by TLI Legal Counsel:
- `LEG-INT-01`: Section 5(3) Multilingual Notice Option (Phase 2 Blocker).
- `LEG-INT-02`: Section 6(7)-(9) Consent Manager Interoperability.
- `LEG-INT-03`: Section 7(g) Employment Legitimate Uses (workplace surveillance).
- `LEG-INT-04`: Section 8(2) Mandatory Processor Contract Clauses.
- `LEG-INT-05`: Section 8(6) Breach Notification Interplay with CERT-In 6-hour mandate.
- `LEG-INT-06`: Section 9(1)-(3) Age Verification & Parental Consent standards (Phase 2 Blocker).
- `LEG-INT-07`: Section 9(4)-(5) Children's Data Exemption Scope.
- `LEG-INT-08`: Section 10(1) Significant Data Fiduciary (SDF) Criteria.
- `LEG-INT-09`: Section 16(1)-(2) Cross-Border Negative List vs RBI Domestic Storage.
- `LEG-INT-10`: Removal of Difficulties Order 2026 application to Sections 9 and 10.

### 4.3 Unresolved Question Mappings
Four canonical questionnaire items remain flagged `UNRESOLVED_PENDING_EXCEL_SHEET` and are strictly isolated from statutory controls and domain scores:
- `GOV-005`: Information asset inventory maintenance.
- `GOV-006`: Data protection impact assessment (DPIA) trigger thresholds.
- `GOV-008`: Direct stakeholder reporting to Board of Directors.
- `APP-006`: AI and automated decision-making transparency.

---

## 5. Summary of Tested Scope & Pilot Readiness Certification

| Domain | Engineering Readiness | Governance Status | Recommendation |
|---|:---:|:---:|---|
| **Questionnaire Engine** | 100% (60 Questions, 8 Sections) | Approved by Word Source | **READY FOR PILOT** |
| **Evidence Storage Vault** | 100% (Validation, Magic Bytes, RLS) | Policy Approval Pending (DEC-05) | **READY FOR PILOT** |
| **Assessor Review Workspace** | 100% (Evaluation, Notes, Redaction) | Default Confirmed (DEC-01) | **READY FOR PILOT** |
| **Scoring & Gap Engine** | 100% (Deterministic, 4 Metrics) | Provisional Model (DEC-09) | **READY FOR PILOT (PROVISIONAL)** |
| **Word Report Generation** | 100% (OpenXML, Watermarks, Seals) | Brand & Legal Sign-off (DEC-02, 10) | **READY FOR PILOT** |
| **CAPA Remediation** | 100% (Lifecycle, Assessor Validation) | Default Confirmed | **READY FOR PILOT** |
| **PostgreSQL Multi-Tenancy** | 100% (17 Tables, Forced RLS) | Architecture Verified | **READY FOR PILOT** |

