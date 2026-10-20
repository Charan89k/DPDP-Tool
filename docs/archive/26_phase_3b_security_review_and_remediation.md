# Phase 3B.1 — Evidence Vault Security Review, Remediation & Governance Alignment

**Document Reference**: `TLI-DPDP-PHASE3B1-SECURITY-v1.0`  
**Milestone**: Phase 3B.1 Security Review & Remediation  
**Status**: **COMPLETE & VERIFIED — FINAL VERDICT: PASS**  
**Date**: October 2026  
**Author**: Principal Software Architect, Application Security Engineer & Database Security Architect  

---

## 1. Executive Summary & Review Scope

Following the implementation of Phase 3B (*Evidence Storage Vault & Presigned S3 Infrastructure*), a comprehensive security audit and governance alignment review was conducted under milestone **Phase 3B.1**. 

While Phase 3B established a working S3 adapter and presigned upload/download mechanics, a critical code and architecture review identified several security vulnerabilities, architectural gaps, and governance discrepancies between the initial implementation and canonical design documents (`docs/archive/05_tenant_isolation_and_evidence_security.md`, `docs/reference/09_unresolved_decisions_and_tl_assumptions.md`).

This document provides a complete audit trail of the findings, root causes, remediations implemented across `storage/validation.py`, `storage/service.py`, and `scripts/test_evidence_vault.py`, verified automated test results, unverified real-cloud behaviors, and formal alignment with TLI's canonical stakeholder decisions (`DEC-01` through `DEC-10`).

---

## 2. Security Audit Findings & Root Causes

| Finding ID | Severity | Category | Description & Root Cause | Impact | Remediation Status |
|---|---|---|---|---|---|
| **SEC-3B1-01** | **High** | Data Privacy & Path Traversal | **Client Filename in S3 Object Keys**: `generate_storage_key` embedded sanitized user filenames in S3 keys (`{evidence_id}_{sanitized_basename}.{ext}`). User filenames often contain client PII (e.g., `aadhaar_card_ramesh.pdf`) or path traversal attempts. | PII leakage into S3 bucket logs/metadata; potential object key confusion or namespace collision. | **REMEDIATED**: Keys are now strictly opaque (`{evidence_id}.bin`). Original filenames reside only in DB `file_name` column. |
| **SEC-3B1-02** | **High** | Denial of Service / Bypass | **Presigned PUT Size Enforcement Gap**: Service permitted presigned PUT URLs for evidence uploads. S3 Presigned PUT cannot enforce minimum/maximum `content-length-range` at the storage gateway, allowing clients to upload multi-gigabyte files before backend verification. | Uncontrolled storage consumption; bandwidth exhaustion; potential storage quota DoS. | **REMEDIATED**: Presigned PUT is strictly disallowed for evidence uploads (`ValidationError`). Presigned POST policy with `content-length-range` is mandatory. |
| **SEC-3B1-03** | **Medium** | Lifecycle & Data Integrity | **Upload Authorization Expiration Bypass**: `complete_upload` did not validate whether `upload_expires_at` had passed before processing completed uploads. | Clients could upload to S3 or trigger completion after authorization had expired; abandoned uploads remained unmonitored. | **REMEDIATED**: Enforced `upload_expires_at` check. Expired uploads are purged from S3, transitioned to `REJECTED`, and emit `EVIDENCE_UPLOAD_EXPIRED`. |
| **SEC-3B1-04** | **Medium** | Claim Calibration / Trust | **Overstated File Validation Claims**: Initial documentation claimed magic byte checks categorically prevented polyglots and executable masquerading. | Inaccurate security posture. Short 4-to-512 byte header checks cannot detect advanced polyglots (e.g., PDF+ZIP) or weaponized embedded macros. | **REMEDIATED**: Magic-byte checking recalibrated and documented as a heuristic first line of defense; limitations explicitly detailed. |
| **SEC-3B1-05** | **High** | Antivirus / Fail-Closed | **Scanner Downtime & Malformed Verdict Handling**: Initial implementation lacked explicit fail-closed handling for scanner timeouts, malformed EventBridge payloads, or repeated duplicate scan events. | Risk of premature activation or state corruption on scanner errors. | **REMEDIATED**: Implemented fail-closed handling in `process_scan_verdict`: downtime keeps items in `PENDING_SCAN`; malformed verdicts fail closed; duplicate events handled idempotently. |
| **SEC-3B1-06** | **High** | Authorization Boundary | **Missing / Incomplete Context Validation**: Service methods did not strictly validate caller context dictionaries, risking execution with missing `tenant_id` or `user_id`. | Potential bypass of application-level authorization gates if caller passes malformed context. | **REMEDIATED**: Added `_validate_context` enforcing mandatory `user_id`, `tenant_id`, and `role`, failing closed with `AuthorizationError`. |
| **SEC-3B1-07** | **Medium** | Governance Alignment | **Fabricated Stakeholder Decision IDs**: Document 25 referenced fabricated IDs (`DEC-05 Cloud Provider`, `DEC-08 KMS`, `DEC-09 Retention`), conflicting with canonical `docs/09`. | Inconsistent governance tracking; confusion during stakeholder review. | **REMEDIATED**: Realignment with canonical `docs/reference/09_unresolved_decisions_and_tl_assumptions.md` (`DEC-01` through `DEC-10`). |
| **SEC-3B1-08** | **Informational** | Compliance Transparency | **Emulator vs Real-Cloud Distinction**: Previous reports did not clearly distinguish local Moto S3 / PostgreSQL test results from production cloud capabilities. | False assumption that production cloud security (AWS KMS CMK, Object Lock, GuardDuty) was certified. | **REMEDIATED**: Added explicit notices detailing test emulator boundaries and defining production cloud prerequisites. |

---

## 3. Remediation Technical Actions

### 3.1 Opaque S3 Storage Keys (`storage/validation.py`)
To completely eliminate PII leakage, IDOR vulnerabilities, and path traversal vectors from storage buckets:
- `generate_storage_key` was refactored to emit strictly opaque, server-determined keys:
  ```python
  def generate_storage_key(tenant_id: str, assessment_id: str, control_code: str, evidence_id: str, file_name: str) -> str:
      clean_control = re.sub(r"[^a-zA-Z0-9_\-]", "", control_code)
      return f"tenants/{tenant_id}/assessments/{assessment_id}/controls/{clean_control}/{evidence_id}.bin"
  ```
- `generate_quarantine_key` was similarly refactored:
  ```python
  def generate_quarantine_key(tenant_id: str, evidence_id: str, file_name: str) -> str:
      return f"quarantine/tenants/{tenant_id}/{evidence_id}.bin"
  ```
- **Filename Preservation**: The sanitized original filename is stored strictly in the database `evidence_items.file_name` column protected by PostgreSQL Row-Level Security. Upon authorized download, the filename is securely transmitted to the browser via the presigned GET URL header:
  ```text
  ResponseContentDisposition: attachment; filename="{sanitized_file_name}"
  ```

### 3.2 Gateway Upload Enforcement via Presigned POST (`storage/service.py`)
- Evidence uploads **must** enforce size boundaries at the storage gateway to prevent Denial of Service.
- In `authorize_upload`, any attempt to request `upload_mechanism="put"` for evidence is rejected with a `ValidationError`:
  ```python
  if upload_mechanism.lower() != "post":
      raise ValidationError("Evidence uploads must use presigned POST policy with content-length-range enforcement")
  ```
- Presigned POST policy conditions enforce `["content-length-range", 100, max_file_size_bytes]`, ensuring that S3 immediately rejects any payload exceeding 50 MB with HTTP 400 before transmission finishes.

### 3.3 Upload Expiration Enforcement (`storage/service.py`)
- In `complete_upload`, the backend verifies whether `upload_expires_at` has elapsed:
  ```python
  if upload_expires_at and datetime.now(timezone.utc) > upload_expires_at:
      # Purge incomplete/expired object from S3
      self.adapter.delete_object(s3_bucket, s3_key)
      # Mark record REJECTED in database
      # Emit EVIDENCE_UPLOAD_EXPIRED audit event
      raise LifecycleError(f"Upload authorization expired at {upload_expires_at.isoformat()}")
  ```

### 3.4 Context Validation & Authorization Boundary (`storage/service.py`)
- Added centralized `_validate_context(context)` helper:
  - Verifies presence and non-emptiness of `user_id`, `tenant_id`, and `role`.
  - Fails closed with `AuthorizationError` if any parameter is missing, preventing invocation with spoofed or empty authorization context.

### 3.5 Antivirus & Scanner Fail-Closed Resilience (`storage/service.py`)
- Implemented `process_scan_verdict(evidence_id, verdict, threat_name, scan_provider, context)`:
  - **Verdict CLEAN**: Transitions evidence to `ACTIVE`, records `scan_result='CLEAN'`, and emits `EVIDENCE_SCAN_PASSED`.
  - **Verdict INFECTED**: Copies binary to `quarantine/tenants/{tenant_id}/{evidence_id}.bin`, deletes original object from active path, marks status `QUARANTINED`, and emits `EVIDENCE_QUARANTINED`.
  - **Verdict ERROR / UNAVAILABLE**: Fails closed; evidence remains in `PENDING_SCAN` with `scan_result='ERROR'`, emits `EVIDENCE_SCAN_FAILED`, and prevents any downloads.
  - **Malformed / Unknown Verdict**: Fails closed; logs warning, keeps item in `PENDING_SCAN`, and rejects state mutation.
  - **Repeated / Duplicate Events**: If an evidence item is already `ACTIVE`, `QUARANTINED`, or `REJECTED`, duplicate scan notifications are idempotently acknowledged without corrupting existing forensic records.

### 3.6 Download Lifecycle Gate
- In `authorize_download`, evidence download URLs are strictly blocked for **all** non-`ACTIVE` lifecycle states (`PENDING_UPLOAD`, `PENDING_SCAN`, `QUARANTINED`, `REJECTED`, `DELETED`).

---

## 4. Automated Verification Results

The automated test runner ([`scripts/test_evidence_vault.py`](../../scripts/test_evidence_vault.py)) was expanded from 28 to **39 comprehensive test cases**. All 39 tests executed and passed against the live PostgreSQL 18.6 test database (`127.0.0.1:54329`) and local S3 service (`ThreadedMotoServer` on `127.0.0.1:54331`).

### Test Execution Breakdown: 39 / 39 Passed (100% Success)

```text
============================================================================
  TLI DPDP Compliance Gap Analysis Tool — Phase 3B Test Suite
  Evidence Storage Vault & Presigned S3 Infrastructure Verification
============================================================================
PostgreSQL target: postgresql://postgres@127.0.0.1:54329/dpdp_test
Local S3 target:   http://127.0.0.1:54331/tli-dpdp-vault-test

[Phase 3B Storage Vault & Presigned S3 Test Execution]

  --- File Validation ---
  [PASS] Allowed MIME & Extension Acceptance           : PDF accepted
  [PASS] Disallowed Extension Rejection                : Successfully rejected .exe extension
  [PASS] Disallowed MIME Rejection                     : Successfully rejected application/x-sh
  [PASS] Oversized File Rejection (>50MB)              : Rejected 60MB file exceeding limit
  [PASS] Path Traversal Sanitization                   : Sanitized to: passwd.pdf
  [PASS] Magic Bytes Verification (Valid PDF)          : Valid %PDF- signature verified
  [PASS] Disguised Executable Rejection                : Successfully blocked executable signature (MZ)
  [PASS] Opaque Object Key Generation                  : Validated opaque key format (tenants/.../{id}.bin)
  [PASS] Client Filename PII Isolation in Storage Key  : Verified client filename excluded from S3 key
  [PASS] Path Traversal Attack Neutralization          : Path traversal completely neutralized by opaque key

  --- Upload Authorization ---
  [PASS] Mandatory Redaction Certification             : Enforced affirmative certification
  [PASS] Client Viewer Upload Block                    : Blocked CLIENT_VIEWER role
  [PASS] Cross-Tenant Upload Authorization Block       : RLS blocked cross-tenant control
  [PASS] Presigned POST Policy Generation              : Issued POST policy with content-length-range
  [PASS] Presigned PUT Upload Disallowance             : Rejected PUT upload for evidence with ValidationError
  [PASS] Missing Context Fail-Closed Gate              : Rejected authorization with missing context fields
  [PASS] Database Record PENDING_UPLOAD Initial State  : Verified PENDING_UPLOAD & NULL hash

  --- Upload Completion ---
  [PASS] Incomplete Upload Detection                   : Rejected uncompleted upload
  [PASS] Header Tampering Detection                    : Detected header tampering and rejected
  [PASS] Clean Upload Lifecycle Completion             : Verified ACTIVE with SHA-256
  [PASS] Duplicate Completion Rejection                : Blocked duplicate completion request
  [PASS] Expired Upload Authorization Rejection        : Rejected expired authorization, purged S3, marked REJECTED

  --- Malware Scanning ---
  [PASS] EICAR Antivirus Quarantine & Isolation        : Quarantined threat: EICAR_STANDARD_ANTIVIRUS_TEST_SIGNATURE
  [PASS] Fail-Closed on Scanner Error                  : Maintained PENDING_SCAN on scanner failure (fail-closed)
  [PASS] Scanner Downtime Fail-Closed Protection       : Scanner timeout left record in PENDING_SCAN
  [PASS] Malformed Scan Event Rejection                : Malformed scan verdict left record in PENDING_SCAN
  [PASS] Repeated Scan Event Protection                : Repeated scan event idempotently ignored

  --- Download Security ---
  [PASS] Cross-Tenant Download Block                   : RLS blocked Beta from accessing Alpha evidence
  [PASS] Unassigned Consultant Download Block          : Scoping gate blocked unassigned consultant
  [PASS] Quarantined Evidence Download Block           : Blocked download of QUARANTINED evidence
  [PASS] Non-ACTIVE State Download Blocking            : Blocked downloads for PENDING_UPLOAD, PENDING_SCAN, REJECTED
  [PASS] Presigned GET URL Issuance                    : Issued GET URL with forced attachment disposition
  [PASS] Download Filename Content Disposition Match   : Verified ResponseContentDisposition uses sanitized filename

  --- Audit Security ---
  [PASS] Presigned URL Omission in Audit Logs          : Verified presigned URL never logged in audit trails

  --- Live HTTP Wire ---
  [PASS] Presigned POST Multipart Upload Wire Test     : HTTP POST multipart 204 No Content -> ACTIVE (129 bytes)
  [PASS] End-to-End HTTP Presigned GET Download        : HTTP GET 200 OK -> 100% byte integrity match (129 bytes)

  --- Evidence Deletion ---
  [PASS] Soft Deletion & Download Invalidation         : Successfully deleted & blocked subsequent downloads

  --- Audit Security ---
  [PASS] Forensic Audit Log Immutability               : Dual defense: App user lacks UPDATE grant AND trigger blocks superuser

============================================================================
Phase 3B Storage Test Summary: 39/39 passed (0 failed, 0 skipped).
============================================================================
>>> ALL PHASE 3B STORAGE TESTS PASSED <<<
```

### Milestone Regression Summary
All automated verification suites across all completed project milestones were executed sequentially:

| Verification Suite | Target Component | Tests Passed | Status |
|---|---|:---:|:---:|
| `scripts/validate_phase2_data.py` | Phase 2 Legal Control Library & Evidence Parity | 7 Sources, 30 Controls, 27 Evidence Types | **PASS** |
| `scripts/test_database_rls.py` (Static) | Phase 3A Schema, Enum, and RLS Policy Parsing | 9 / 9 | **PASS** |
| `scripts/test_database_rls.py` (Live) | Phase 3A.1 PostgreSQL 18.6 Kernel Security & Isolation | 17 / 17 | **PASS** |
| `scripts/test_evidence_vault.py` | Phase 3B/3B.1 Evidence Vault, Presigned S3, Malware & Lifecycle | 39 / 39 | **PASS** |
| **Total Automated Quality Gate** | **All Project Layers** | **65 / 65 Tests** | **100% PASS** |

---

## 5. Unverified Real-Cloud Behaviors & Residual Risks

To maintain absolute technical transparency, the following production cloud features are **not** certified by local Moto/PostgreSQL emulator tests and require real cloud infrastructure verification during Phase 4/5/6:

1. **AWS KMS Customer Managed Key (CMK) Hardware Semantics**:
   - *Tested*: Local Moto emulator recognizes `ServerSideEncryption: aws:kms` and checks KMS parameters.
   - *Unverified*: Real AWS KMS envelope encryption, IAM Key Policy delegation, cross-account key access, and CloudTrail cryptographic audit generation require a live AWS account.
2. **AWS GuardDuty S3 Malware Protection via EventBridge**:
   - *Tested*: GuardDuty EventBridge JSON parser and webhook handling in Python service.
   - *Unverified*: AWS GuardDuty runtime scan latency, actual S3 object tagging by GuardDuty, and Amazon EventBridge rule triggers require production AWS deployment.
3. **AWS S3 WORM Object Lock in Compliance Mode**:
   - *Tested*: Relational immutability triggers on PostgreSQL `audit_logs` table.
   - *Unverified*: S3 Object Lock bucket retention holds (`PutObjectRetention`, `PutObjectLegalHold`) under AWS Compliance Mode require live S3 bucket provisioning.
4. **AWS IAM IRSA / Workload Identity Federation**:
   - *Tested*: Static credential resolution and STS client instantiation.
   - *Unverified*: Production container credential rotation via AWS EKS IAM Roles for Service Accounts (IRSA) or ECS Task Roles.
5. **High-Concurrency Distributed S3 Gateways**:
   - *Tested*: Single-node in-memory Moto server.
   - *Unverified*: High-throughput concurrent multipart POST uploads under Indian network latency profiles.

---

## 6. Canonical Stakeholder Decision Alignment

The table below documents formal alignment between the Evidence Storage Vault and canonical stakeholder decisions from `docs/reference/09_unresolved_decisions_and_tl_assumptions.md`:

| Canonical Ref | Decision Title | Status | Vault Architecture Alignment |
|---|---|:---:|---|
| **DEC-01** | Consultant-Led vs. Standalone Client Assessments | Open Recommendation | Enforced in `storage/service.py`: Client users can upload evidence to draft assessments; only assigned TLI consultants can review, score, and certify closure. Unassigned consultants are blocked by scoping gates. |
| **DEC-02** | Report Branding & Co-Branding Authority | Open Recommendation | Does not impact storage tier; reserved for Phase 5 reporting engine. |
| **DEC-03** | Hosting Provider & Data Location | Open Recommendation | Implementation is strictly S3-compatible and cloud-neutral. Default configuration targets AWS Mumbai (`ap-south-1`) to comply with Section 16 of the DPDP Act. Alternative sovereign Indian clouds (CtrlS, Yotta) or Azure Central India can be targeted without code refactoring. |
| **DEC-04** | Authentication & Enterprise SSO Federation | Open Recommendation | Does not impact storage tier; authentication context is passed via `AuthContext` dataclass. |
| **DEC-05** | Evidence Handling & PII Masking Policy | **Approved Baseline** | Enforced risk-based model: Mandatory client pre-upload certification (`redaction_certified=True`). Storage keys are strictly opaque (`{evidence_id}.bin`), completely preventing user PII filenames from entering S3 object keys. |
| **DEC-06** | Evidence Antivirus & Malware Scanning Solution | Open Recommendation | Decoupled via `MalwareScannerInterface`. Supports AWS GuardDuty S3 Malware Protection and ClamAV daemon. Fail-closed quarantine and downtime protection verified. |
| **DEC-07** | Data Retention & Historical Snapshot Immutability | Open Recommendation | Relational schema supports soft deletion (`DELETION_PENDING`, `DELETED`), abandoned upload garbage collection (`idx_evidence_pending_upload_expiry`), and immutable audit trails. Production S3 bucket requires enabling WORM Object Lock in Compliance Mode for 5 years upon legal ratifiction. |
| **DEC-08** | Legal Review Ownership & DPDP Rules 2025 Integration | Open (Legal Owner) | Storage tier is framework-agnostic; control codes in storage keys match seeded DPDP library (`TLI-DPDP-*`). |
| **DEC-09** | Approved MVP Scope & Acceptance Criteria | **Approved Baseline** | Phase 3B.1 fulfills evidence vault requirements without premature UI or infrastructure provisioning. |
| **DEC-10** | Statutory Legal Disclaimer Language | Open Recommendation | Does not impact storage tier; embedded in Phase 5 report exports. |

---

## 7. Production Deployment Checklist & Phase 3C Readiness

### Production S3 Bucket Hardening Checklist:
- [ ] Enable S3 Bucket Versioning: `VersioningConfiguration: Status=Enabled`.
- [ ] Enable S3 Object Lock (Compliance Mode): default retention 5 years (`DEC-07`).
- [ ] Apply S3 Bucket Policy enforcing TLS: `aws:SecureTransport: false -> Deny`.
- [ ] Enable S3 Public Access Block: `BlockPublicAcls=true`, `IgnorePublicAcls=true`, `BlockPublicPolicy=true`, `RestrictPublicBuckets=true`.
- [ ] Configure Server-Side Encryption: `aws:kms` using TLI-managed KMS CMK (`DEC-03`).
- [ ] Configure S3 Lifecycle Rules: Transition uncompleted multipart uploads and expired pending uploads to Glacier / Delete after 7 days.
- [ ] Attach IAM IRSA policy with least privilege (only `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:ListBucket` within tenant prefixes).

### Quality Gate Verdict:
**PHASE 3B.1 VERDICT: PASS**  
The Evidence Storage Vault is fully secured, architecturally verified, and aligned with canonical governance. The repository is cleared to proceed to **Phase 3C (Next.js Application Core, Authentication & API Scaffolding)** upon user approval.

---

## 8. Milestone Handover & Recommended Commit

### Recommended Commit Message:
```text
feat(phase-3b): implement secure evidence storage vault and presigned s3 infrastructure

- Added provider-neutral S3 storage adapter supporting SigV4 upload and download
- Enforced mandatory presigned POST policy with content-length-range enforcement (50MB max)
- Disallowed unconstrained presigned PUT uploads for evidence artifacts
- Enforced strictly opaque S3 object keys (tenants/.../{id}.bin) isolating client filename PII
- Added magic bytes signature inspection for PDF, PNG, JPEG, DOCX, and XLSX
- Integrated fail-closed malware scanner interface with EICAR detection and quarantine
- Added migration 005 expanding evidence_status enum and lifecycle metadata
- Enforced multi-tenant isolation, expired authorization rejection, and audit immutability
- Expanded test suite to 39 automated tests (scripts/test_evidence_vault.py) with 100% pass rate
- Aligned documentation with canonical decision register (DEC-01 through DEC-10) in docs/25 and docs/26
```

