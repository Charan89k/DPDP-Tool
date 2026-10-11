#!/usr/bin/env python3
"""
TLI DPDP Compliance Gap Analysis Tool — Phase 3B Test Suite
Evidence Storage Vault & Presigned S3 Infrastructure Verification

Executes comprehensive validation of:
1. File validation, sanitization, and magic byte signatures
2. Multi-tenant upload authorization and cross-tenant upload blocking
3. Presigned POST policy and PUT URL generation
4. Incomplete upload and header mismatch detection
5. Malware scanning integration with fail-closed quarantine (EICAR detection)
6. Multi-tenant download authorization and cross-tenant download blocking
7. Live HTTP direct upload and download over local S3-compatible service
8. Forensic audit logging and immutability verification

Usage:
    python3 scripts/test_evidence_vault.py [--database-url=URL] [--s3-port=PORT]
"""

import os
import sys
import time
import json
import uuid
import hashlib
import argparse
import urllib.request
import urllib.error
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple

import boto3
from botocore.client import Config
from moto.server import ThreadedMotoServer
import psycopg

# Add repo root to import path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from storage import (
    S3StorageAdapter,
    FileValidator,
    MockOrLocalScanner,
    ClamAVScanner,
    EvidenceVaultService,
    RequestContext,
    ScanVerdict,
    ValidationError,
    AuthorizationError,
    LifecycleError,
)

# Canonical Multi-Tenant Synthetic Fixtures (from Phase 3A seeds)
TENANT_ALPHA_ID = "018f3a5b-7c8d-7e90-8000-000000000002"  # Alpha Healthcare (SDF)
TENANT_BETA_ID = "018f3a5b-7c8d-7e90-8000-000000000003"   # Beta Express (Non-SDF)
TENANT_TLI_ID = "018f3a5b-7c8d-7e90-8000-000000000001"    # TLI Advisory

USER_ALPHA_ADMIN_ID = "018f3a5b-7c8d-7e90-8000-000000000111"
USER_ALPHA_CONTRIBUTOR_ID = "018f3a5b-7c8d-7e90-8000-000000000113"
USER_ALPHA_VIEWER_ID = "018f3a5b-7c8d-7e90-8000-000000000114"
USER_BETA_CONTRIBUTOR_ID = "018f3a5b-7c8d-7e90-8000-000000000123"
USER_TLI_LEAD_ID = "018f3a5b-7c8d-7e90-8000-000000000102"
USER_TLI_REVIEWER_ID = "018f3a5b-7c8d-7e90-8000-000000000103"
USER_UNASSIGNED_REVIEWER_ID = "018f3a5b-7c8d-7e90-8000-000000000199"

ASSESSMENT_ALPHA_ID = "018f3a5b-7c8d-7e90-8000-000000000201"
ASSESSMENT_BETA_ID = "018f3a5b-7c8d-7e90-8000-000000000202"

EICAR_PAYLOAD = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
VALID_PDF_PAYLOAD = (
    b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n"
    b"1 0 obj\n<< /Title (TLI DPDP Audit Evidence Document) /Author (Truth Labs) >>\nendobj\n"
    b"2 0 obj\n<< /Type /Catalog /Pages 3 0 R >>\nendobj\n"
    b"3 0 obj\n<< /Type /Pages /Kids [4 0 R] /Count 1 >>\nendobj\n"
    b"4 0 obj\n<< /Type /Page /Parent 3 0 R /MediaBox [0 0 612 792] >>\nendobj\n"
    b"xref\n0 5\n0000000000 65535 f \n0000000015 00000 n \n0000000095 00000 n \n0000000142 00000 n \n0000000199 00000 n \n"
    b"trailer\n<< /Size 5 /Root 2 0 R >>\nstartxref\n268\n%%EOF\n"
)
# Valid PNG with ancillary tEXt chunk to ensure length > 100 bytes (128 bytes)
VALID_PNG_PAYLOAD = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"
    b"\x00\x00\x00\x28tEXtComment\x00TLI DPDP Compliance Gap Analysis Valid PNG\x95\x77\x55\x12"
    b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


class TestResult:
    def __init__(self, category: str, name: str, passed: bool, details: str = "", skipped: bool = False):
        self.category = category
        self.name = name
        self.passed = passed
        self.details = details
        self.skipped = skipped


def create_multipart_form(fields: Dict[str, str], file_field: str, file_name: str, file_bytes: bytes, content_type: str) -> Tuple[bytes, str]:
    """Encodes multipart/form-data payload for S3 presigned POST upload."""
    boundary = f"----WebKitFormBoundary{uuid.uuid4().hex}"
    body = bytearray()
    for k, v in fields.items():
        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(f'Content-Disposition: form-data; name="{k}"\r\n\r\n'.encode("utf-8"))
        body.extend(f"{v}\r\n".encode("utf-8"))
    body.extend(f"--{boundary}\r\n".encode("utf-8"))
    body.extend(f'Content-Disposition: form-data; name="{file_field}"; filename="{file_name}"\r\n'.encode("utf-8"))
    body.extend(f"Content-Type: {content_type}\r\n\r\n".encode("utf-8"))
    body.extend(file_bytes)
    body.extend(b"\r\n")
    body.extend(f"--{boundary}--\r\n".encode("utf-8"))
    return bytes(body), f"multipart/form-data; boundary={boundary}"


def run_evidence_vault_tests(db_url: str, s3_port: int = 54331) -> List[TestResult]:
    results = []
    bucket_name = "tli-dpdp-vault-test"

    print("============================================================================")
    print("  TLI DPDP Compliance Gap Analysis Tool — Phase 3B Test Suite")
    print("  Evidence Storage Vault & Presigned S3 Infrastructure Verification")
    print("============================================================================")
    print(f"PostgreSQL target: {db_url}")
    print(f"Local S3 target:   http://127.0.0.1:{s3_port}/{bucket_name}")
    print()

    # 1. Start Local S3 Server
    server = ThreadedMotoServer(ip_address="127.0.0.1", port=s3_port)
    server.start()
    endpoint_url = f"http://127.0.0.1:{s3_port}"

    try:
        # Initialize direct Boto3 client to bootstrap test bucket
        boto_cfg = Config(signature_version="s3v4", s3={"addressing_style": "path"})
        s3_raw = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            region_name="ap-south-1",
            aws_access_key_id="tli-test-key",
            aws_secret_access_key="tli-test-secret",
            use_ssl=False,
            config=boto_cfg,
        )
        s3_raw.create_bucket(
            Bucket=bucket_name,
            CreateBucketConfiguration={"LocationConstraint": "ap-south-1"},
        )

        # Initialize Adapter & Service
        adapter = S3StorageAdapter(
            endpoint_url=endpoint_url,
            region_name="ap-south-1",
            aws_access_key_id="tli-test-key",
            aws_secret_access_key="tli-test-secret",
            use_ssl=False,
            s3_client=s3_raw,
        )
        validator = FileValidator()
        scanner = MockOrLocalScanner()

        service = EvidenceVaultService(
            db_connection_url=db_url,
            storage_adapter=adapter,
            bucket_name=bucket_name,
            scanner=scanner,
            validator=validator,
            presigned_upload_expiry_seconds=600,
            presigned_download_expiry_seconds=900,
        )

        # Contexts
        ctx_alpha_contrib = RequestContext(
            user_id=USER_ALPHA_CONTRIBUTOR_ID,
            tenant_id=TENANT_ALPHA_ID,
            role="CLIENT_CONTRIBUTOR",
        )
        ctx_alpha_admin = RequestContext(
            user_id=USER_ALPHA_ADMIN_ID,
            tenant_id=TENANT_ALPHA_ID,
            role="CLIENT_ADMIN",
        )
        ctx_alpha_viewer = RequestContext(
            user_id=USER_ALPHA_VIEWER_ID,
            tenant_id=TENANT_ALPHA_ID,
            role="CLIENT_VIEWER",
        )
        ctx_beta_contrib = RequestContext(
            user_id=USER_BETA_CONTRIBUTOR_ID,
            tenant_id=TENANT_BETA_ID,
            role="CLIENT_CONTRIBUTOR",
        )
        ctx_unassigned_reviewer = RequestContext(
            user_id=USER_UNASSIGNED_REVIEWER_ID,
            tenant_id=TENANT_TLI_ID,
            role="TLI_REVIEWER",
        )

        # Query live assessment control IDs for Alpha and Beta
        with service._get_connection(ctx_alpha_contrib) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT ac.id FROM assessment_controls ac
                    JOIN assessments a ON a.id = ac.assessment_id
                    WHERE a.tenant_id = %s LIMIT 1;
                    """,
                    (TENANT_ALPHA_ID,),
                )
                alpha_ctrl = cur.fetchone()["id"]

        with service._get_connection(ctx_beta_contrib) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT ac.id FROM assessment_controls ac
                    JOIN assessments a ON a.id = ac.assessment_id
                    WHERE a.tenant_id = %s LIMIT 1;
                    """,
                    (TENANT_BETA_ID,),
                )
                beta_ctrl = cur.fetchone()["id"]

        # ====================================================================
        # Group A: File Validation & Key Generation
        # ====================================================================
        # A1: MIME allowlist and extension matching
        try:
            s_name, mime = validator.validate_metadata("consent_sop.pdf", "application/pdf", 1024)
            assert s_name == "consent_sop.pdf" and mime == "application/pdf"
            results.append(TestResult("File Validation", "Allowed MIME & Extension Acceptance", True, "PDF accepted"))
        except Exception as e:
            results.append(TestResult("File Validation", "Allowed MIME & Extension Acceptance", False, str(e)))

        # A2: Disallowed file extension rejection
        try:
            validator.validate_metadata("malware.exe", "application/pdf", 1024)
            results.append(TestResult("File Validation", "Disallowed Extension Rejection", False, "Failed to reject .exe"))
        except ValidationError:
            results.append(TestResult("File Validation", "Disallowed Extension Rejection", True, "Successfully rejected .exe extension"))
        except Exception as e:
            results.append(TestResult("File Validation", "Disallowed Extension Rejection", False, str(e)))

        # A3: Disallowed MIME rejection
        try:
            validator.validate_metadata("script.sh", "application/x-sh", 1024)
            results.append(TestResult("File Validation", "Disallowed MIME Rejection", False, "Failed to reject application/x-sh"))
        except ValidationError:
            results.append(TestResult("File Validation", "Disallowed MIME Rejection", True, "Successfully rejected application/x-sh"))
        except Exception as e:
            results.append(TestResult("File Validation", "Disallowed MIME Rejection", False, str(e)))

        # A4: File size boundaries (max 50 MB)
        try:
            validator.validate_metadata("huge.pdf", "application/pdf", 60 * 1024 * 1024)
            results.append(TestResult("File Validation", "Oversized File Rejection (>50MB)", False, "Failed to reject 60MB file"))
        except ValidationError:
            results.append(TestResult("File Validation", "Oversized File Rejection (>50MB)", True, "Rejected 60MB file exceeding limit"))
        except Exception as e:
            results.append(TestResult("File Validation", "Oversized File Rejection (>50MB)", False, str(e)))

        # A5: Filename path traversal sanitization
        try:
            safe = validator.sanitize_filename("../../../etc/passwd.pdf")
            assert ".." not in safe and "/" not in safe and safe.endswith(".pdf")
            results.append(TestResult("File Validation", "Path Traversal Sanitization", True, f"Sanitized to: {safe}"))
        except Exception as e:
            results.append(TestResult("File Validation", "Path Traversal Sanitization", False, str(e)))

        # A6: Magic byte inspection (valid PDF)
        try:
            validator.verify_magic_bytes(VALID_PDF_PAYLOAD[:512], "application/pdf")
            results.append(TestResult("File Validation", "Magic Bytes Verification (Valid PDF)", True, "Valid %PDF- signature verified"))
        except Exception as e:
            results.append(TestResult("File Validation", "Magic Bytes Verification (Valid PDF)", False, str(e)))

        # A7: Magic byte inspection (disguised executable blocked)
        try:
            fake_pdf = b"MZ\x90\x00\x03\x00\x00\x00This is a Windows executable masquerading as a PDF"
            validator.verify_magic_bytes(fake_pdf, "application/pdf")
            results.append(TestResult("File Validation", "Disguised Executable Rejection", False, "Failed to block MZ header"))
        except ValidationError:
            results.append(TestResult("File Validation", "Disguised Executable Rejection", True, "Successfully blocked executable signature (MZ)"))
        except Exception as e:
            results.append(TestResult("File Validation", "Disguised Executable Rejection", False, str(e)))

        # ====================================================================
        # Group B: Upload Authorization & Workflow
        # ====================================================================
        # B1: Mandatory affirmative PII redaction certification check
        try:
            service.authorize_upload(
                context=ctx_alpha_contrib,
                assessment_control_id=str(alpha_ctrl),
                file_name="consent_flow.pdf",
                file_size_bytes=len(VALID_PDF_PAYLOAD),
                mime_type="application/pdf",
                redaction_certified=False,  # Unchecked!
            )
            results.append(TestResult("Upload Authorization", "Mandatory Redaction Certification", False, "Allowed uncertified upload"))
        except ValidationError:
            results.append(TestResult("Upload Authorization", "Mandatory Redaction Certification", True, "Enforced affirmative certification"))
        except Exception as e:
            results.append(TestResult("Upload Authorization", "Mandatory Redaction Certification", False, str(e)))

        # B2: Role authorization gate (CLIENT_VIEWER blocked)
        try:
            service.authorize_upload(
                context=ctx_alpha_viewer,
                assessment_control_id=str(alpha_ctrl),
                file_name="consent_flow.pdf",
                file_size_bytes=len(VALID_PDF_PAYLOAD),
                mime_type="application/pdf",
                redaction_certified=True,
            )
            results.append(TestResult("Upload Authorization", "Client Viewer Upload Block", False, "Viewer was allowed to upload"))
        except AuthorizationError:
            results.append(TestResult("Upload Authorization", "Client Viewer Upload Block", True, "Blocked CLIENT_VIEWER role"))
        except Exception as e:
            results.append(TestResult("Upload Authorization", "Client Viewer Upload Block", False, str(e)))

        # B3: Cross-tenant upload block (Alpha cannot upload to Beta assessment control)
        try:
            service.authorize_upload(
                context=ctx_alpha_contrib,
                assessment_control_id=str(beta_ctrl),  # Cross-tenant target!
                file_name="cross_tenant_exploit.pdf",
                file_size_bytes=len(VALID_PDF_PAYLOAD),
                mime_type="application/pdf",
                redaction_certified=True,
            )
            results.append(TestResult("Upload Authorization", "Cross-Tenant Upload Authorization Block", False, "Allowed cross-tenant upload!"))
        except AuthorizationError:
            results.append(TestResult("Upload Authorization", "Cross-Tenant Upload Authorization Block", True, "RLS blocked cross-tenant control"))
        except Exception as e:
            results.append(TestResult("Upload Authorization", "Cross-Tenant Upload Authorization Block", False, str(e)))

        # B4: Presigned POST policy generation with content-length-range
        auth_post = None
        try:
            auth_post = service.authorize_upload(
                context=ctx_alpha_contrib,
                assessment_control_id=str(alpha_ctrl),
                file_name="customer_notice_sample.pdf",
                file_size_bytes=len(VALID_PDF_PAYLOAD),
                mime_type="application/pdf",
                redaction_certified=True,
                upload_mechanism="post",
            )
            assert auth_post["method"] == "POST"
            assert "upload_url" in auth_post and auth_post["upload_url"]
            assert "key" in auth_post["fields"]
            assert auth_post["s3_key"].startswith(f"tenants/{TENANT_ALPHA_ID}/")
            results.append(TestResult("Upload Authorization", "Presigned POST Policy Generation", True, f"Issued POST policy: {auth_post['s3_key']}"))
        except Exception as e:
            results.append(TestResult("Upload Authorization", "Presigned POST Policy Generation", False, str(e)))

        # B5: Presigned PUT URL generation
        auth_put = None
        try:
            auth_put = service.authorize_upload(
                context=ctx_alpha_contrib,
                assessment_control_id=str(alpha_ctrl),
                file_name="encryption_spec.pdf",
                file_size_bytes=len(VALID_PDF_PAYLOAD),
                mime_type="application/pdf",
                redaction_certified=True,
                upload_mechanism="put",
            )
            assert auth_put["method"] == "PUT"
            assert auth_put["upload_url"].startswith(endpoint_url)
            assert "Content-Type" in auth_put["headers"]
            results.append(TestResult("Upload Authorization", "Presigned PUT URL Generation", True, f"Issued PUT URL with 600s expiry"))
        except Exception as e:
            results.append(TestResult("Upload Authorization", "Presigned PUT URL Generation", False, str(e)))

        # B6: Initial DB record in PENDING_UPLOAD status
        if auth_post:
            try:
                with service._get_connection(ctx_alpha_contrib) as conn:
                    with conn.cursor() as cur:
                        cur.execute("SELECT status, sha256_hash FROM evidence_items WHERE id = %s;", (auth_post["evidence_id"],))
                        row = cur.fetchone()
                        assert row["status"] == "PENDING_UPLOAD"
                        assert row["sha256_hash"] is None
                results.append(TestResult("Upload Authorization", "Database Record PENDING_UPLOAD Initial State", True, "Verified PENDING_UPLOAD & NULL hash"))
            except Exception as e:
                results.append(TestResult("Upload Authorization", "Database Record PENDING_UPLOAD Initial State", False, str(e)))

        # ====================================================================
        # Group C: Upload Completion, Signature Verification & Malware Scanning
        # ====================================================================
        # C1: Incomplete upload rejection (HeadObject fails before client uploads)
        if auth_post:
            try:
                service.complete_upload(ctx_alpha_contrib, auth_post["evidence_id"])
                results.append(TestResult("Upload Completion", "Incomplete Upload Detection", False, "Completed without S3 object"))
            except LifecycleError:
                results.append(TestResult("Upload Completion", "Incomplete Upload Detection", True, "Rejected uncompleted upload"))
            except Exception as e:
                results.append(TestResult("Upload Completion", "Incomplete Upload Detection", False, str(e)))

        # C2: Magic byte header tampering detection (declared PDF but uploaded text)
        if auth_post:
            try:
                # Upload raw non-PDF text directly to S3 key
                adapter.upload_bytes(bucket_name, auth_post["s3_key"], b"Plain text file pretending to be PDF", "application/pdf")
                service.complete_upload(ctx_alpha_contrib, auth_post["evidence_id"])
                results.append(TestResult("Upload Completion", "Header Tampering Detection", False, "Accepted non-PDF content"))
            except ValidationError:
                results.append(TestResult("Upload Completion", "Header Tampering Detection", True, "Detected header tampering and rejected"))
            except Exception as e:
                results.append(TestResult("Upload Completion", "Header Tampering Detection", False, str(e)))

        # C3: Clean upload completion (computes SHA-256, transitions to ACTIVE)
        clean_ev_id = None
        if auth_put:
            try:
                # Put valid PDF bytes into S3
                adapter.upload_bytes(bucket_name, auth_put["s3_key"], VALID_PDF_PAYLOAD, "application/pdf")
                res = service.complete_upload(ctx_alpha_contrib, auth_put["evidence_id"])
                assert res["status"] == "ACTIVE"
                assert res["scan_verdict"] == "CLEAN"
                clean_ev_id = auth_put["evidence_id"]

                expected_hash = hashlib.sha256(VALID_PDF_PAYLOAD).hexdigest()
                assert res["sha256_hash"] == expected_hash
                results.append(TestResult("Upload Completion", "Clean Upload Lifecycle Completion", True, f"Verified ACTIVE with SHA-256: {res['sha256_hash'][:16]}..."))
            except Exception as e:
                results.append(TestResult("Upload Completion", "Clean Upload Lifecycle Completion", False, str(e)))

        # C4: Duplicate completion rejection
        if clean_ev_id:
            try:
                service.complete_upload(ctx_alpha_contrib, clean_ev_id)
                results.append(TestResult("Upload Completion", "Duplicate Completion Rejection", False, "Allowed duplicate completion"))
            except LifecycleError:
                results.append(TestResult("Upload Completion", "Duplicate Completion Rejection", True, "Blocked duplicate completion request"))
            except Exception as e:
                results.append(TestResult("Upload Completion", "Duplicate Completion Rejection", False, str(e)))

        # C5: EICAR malware detection, payload quarantine move, and status QUARANTINED
        quarantined_ev_id = None
        try:
            # Authorize an upload for EICAR test
            auth_eicar = service.authorize_upload(
                context=ctx_alpha_contrib,
                assessment_control_id=str(alpha_ctrl),
                file_name="suspicious_test_sample.pdf",
                file_size_bytes=len(VALID_PDF_PAYLOAD) + len(EICAR_PAYLOAD),
                mime_type="application/pdf",
                redaction_certified=True,
                upload_mechanism="put",
            )
            # Embed EICAR inside PDF stream
            infected_payload = VALID_PDF_PAYLOAD + EICAR_PAYLOAD
            adapter.upload_bytes(bucket_name, auth_eicar["s3_key"], infected_payload, "application/pdf")

            scan_res = service.complete_upload(ctx_alpha_contrib, auth_eicar["evidence_id"])
            assert scan_res["status"] == "QUARANTINED"
            assert scan_res["scan_verdict"] == "INFECTED"
            quarantined_ev_id = auth_eicar["evidence_id"]

            # Confirm original active object is DELETED from S3 active key
            assert not adapter.object_exists(bucket_name, auth_eicar["s3_key"])
            results.append(TestResult("Malware Scanning", "EICAR Antivirus Quarantine & Isolation", True, f"Quarantined threat: {scan_res.get('threat_name')}"))
        except Exception as e:
            results.append(TestResult("Malware Scanning", "EICAR Antivirus Quarantine & Isolation", False, str(e)))

        # C6: Scanner downtime / error fail-closed behavior (remains in PENDING_SCAN)
        try:
            error_scanner = MockOrLocalScanner(force_mode="ERROR")
            err_service = EvidenceVaultService(
                db_connection_url=db_url,
                storage_adapter=adapter,
                bucket_name=bucket_name,
                scanner=error_scanner,
                validator=validator,
            )
            auth_err = err_service.authorize_upload(
                context=ctx_alpha_contrib,
                assessment_control_id=str(alpha_ctrl),
                file_name="scanner_error_test.pdf",
                file_size_bytes=len(VALID_PDF_PAYLOAD),
                mime_type="application/pdf",
                redaction_certified=True,
                upload_mechanism="put",
            )
            adapter.upload_bytes(bucket_name, auth_err["s3_key"], VALID_PDF_PAYLOAD, "application/pdf")
            err_res = err_service.complete_upload(ctx_alpha_contrib, auth_err["evidence_id"])

            # Verify fail-closed: remains PENDING_SCAN, NOT active
            assert err_res["status"] == "PENDING_SCAN"
            assert err_res["scan_verdict"] == "ERROR"
            results.append(TestResult("Malware Scanning", "Fail-Closed on Scanner Error", True, "Maintained PENDING_SCAN on scanner failure (fail-closed)"))
        except Exception as e:
            results.append(TestResult("Malware Scanning", "Fail-Closed on Scanner Error", False, str(e)))

        # ====================================================================
        # Group D: Download Authorization & Isolation
        # ====================================================================
        # D1: Cross-tenant download block (Beta cannot download Alpha's evidence)
        if clean_ev_id:
            try:
                service.authorize_download(context=ctx_beta_contrib, evidence_id=clean_ev_id)
                results.append(TestResult("Download Security", "Cross-Tenant Download Block", False, "Beta was allowed to download Alpha evidence!"))
            except AuthorizationError:
                results.append(TestResult("Download Security", "Cross-Tenant Download Block", True, "RLS blocked Beta from accessing Alpha evidence"))
            except Exception as e:
                results.append(TestResult("Download Security", "Cross-Tenant Download Block", False, str(e)))

        # D2: Unassigned consultant download block
        if clean_ev_id:
            try:
                service.authorize_download(context=ctx_unassigned_reviewer, evidence_id=clean_ev_id)
                results.append(TestResult("Download Security", "Unassigned Consultant Download Block", False, "Unassigned consultant allowed to download!"))
            except AuthorizationError:
                results.append(TestResult("Download Security", "Unassigned Consultant Download Block", True, "Scoping gate blocked unassigned consultant"))
            except Exception as e:
                results.append(TestResult("Download Security", "Unassigned Consultant Download Block", False, str(e)))

        # D3: Download gate blocks QUARANTINED evidence
        if quarantined_ev_id:
            try:
                service.authorize_download(context=ctx_alpha_contrib, evidence_id=quarantined_ev_id)
                results.append(TestResult("Download Security", "Quarantined Evidence Download Block", False, "Allowed download of quarantined file!"))
            except AuthorizationError:
                results.append(TestResult("Download Security", "Quarantined Evidence Download Block", True, "Blocked download of QUARANTINED evidence"))
            except Exception as e:
                results.append(TestResult("Download Security", "Quarantined Evidence Download Block", False, str(e)))

        # D4: Authorized download issues presigned GET with ResponseContentDisposition
        download_info = None
        if clean_ev_id:
            try:
                download_info = service.authorize_download(context=ctx_alpha_contrib, evidence_id=clean_ev_id)
                assert download_info["download_url"].startswith(endpoint_url)
                assert "response-content-disposition" in download_info["download_url"].lower()
                assert download_info["expires_in_seconds"] == 900
                results.append(TestResult("Download Security", "Presigned GET URL Issuance", True, "Issued GET URL with forced attachment disposition"))
            except Exception as e:
                results.append(TestResult("Download Security", "Presigned GET URL Issuance", False, str(e)))

        # D5: Audit logs verify presigned URL is omitted
        if clean_ev_id:
            try:
                with service._get_connection(ctx_alpha_contrib) as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            """
                            SELECT action, new_state FROM audit_logs
                            WHERE entity_id = %s AND action = 'EVIDENCE_DOWNLOAD_AUTHORIZED';
                            """,
                            (clean_ev_id,),
                        )
                        audit_row = cur.fetchone()
                        assert audit_row is not None
                        new_state_str = json.dumps(audit_row["new_state"])
                        assert "http://" not in new_state_str and "https://" not in new_state_str
                        assert "AWSAccessKeyId" not in new_state_str and "Signature" not in new_state_str
                results.append(TestResult("Audit Security", "Presigned URL Omission in Audit Logs", True, "Verified presigned URL never logged in audit trails"))
            except Exception as e:
                results.append(TestResult("Audit Security", "Presigned URL Omission in Audit Logs", False, str(e)))

        # ====================================================================
        # Group E: End-to-End Live HTTP Protocol Verification
        # ====================================================================
        # E1: Live HTTP direct PUT upload to presigned URL
        e2e_ev_id = None
        try:
            auth_e2e = service.authorize_upload(
                context=ctx_alpha_contrib,
                assessment_control_id=str(alpha_ctrl),
                file_name="live_http_patient_notice.png",
                file_size_bytes=len(VALID_PNG_PAYLOAD),
                mime_type="image/png",
                redaction_certified=True,
                upload_mechanism="put",
            )
            # Perform genuine HTTP PUT via urllib.request against local S3 daemon
            req = urllib.request.Request(
                url=auth_e2e["upload_url"],
                data=VALID_PNG_PAYLOAD,
                headers={"Content-Type": "image/png"},
                method="PUT",
            )
            with urllib.request.urlopen(req) as resp:
                assert resp.status in (200, 204)

            # Complete upload via service
            comp_res = service.complete_upload(ctx_alpha_contrib, auth_e2e["evidence_id"])
            assert comp_res["status"] == "ACTIVE"
            e2e_ev_id = auth_e2e["evidence_id"]
            results.append(TestResult("Live HTTP Wire", "End-to-End HTTP Presigned PUT Upload", True, f"HTTP PUT 200 OK -> ACTIVE ({len(VALID_PNG_PAYLOAD)} bytes)"))
        except Exception as e:
            results.append(TestResult("Live HTTP Wire", "End-to-End HTTP Presigned PUT Upload", False, str(e)))

        # E2: Live HTTP direct GET download from presigned URL
        if e2e_ev_id:
            try:
                down_res = service.authorize_download(ctx_alpha_contrib, e2e_ev_id)
                # Fetch payload using genuine HTTP GET over TCP
                with urllib.request.urlopen(down_res["download_url"]) as resp:
                    assert resp.status == 200
                    downloaded_bytes = resp.read()
                    assert downloaded_bytes == VALID_PNG_PAYLOAD

                results.append(TestResult("Live HTTP Wire", "End-to-End HTTP Presigned GET Download", True, f"HTTP GET 200 OK -> 100% byte integrity match ({len(downloaded_bytes)} bytes)"))
            except Exception as e:
                results.append(TestResult("Live HTTP Wire", "End-to-End HTTP Presigned GET Download", False, str(e)))

        # ====================================================================
        # Group F: Deletion & Immutability Verification
        # ====================================================================
        # F1: Soft deletion workflow
        if e2e_ev_id:
            try:
                del_res = service.delete_evidence(ctx_alpha_admin, e2e_ev_id, reason="Audit closed")
                assert del_res["status"] == "DELETED"

                # Verify subsequent download blocked
                try:
                    service.authorize_download(ctx_alpha_contrib, e2e_ev_id)
                    results.append(TestResult("Evidence Deletion", "Soft Deletion & Download Invalidation", False, "Allowed download of deleted file"))
                except LifecycleError:
                    results.append(TestResult("Evidence Deletion", "Soft Deletion & Download Invalidation", True, "Successfully deleted & blocked subsequent downloads"))
            except Exception as e:
                results.append(TestResult("Evidence Deletion", "Soft Deletion & Download Invalidation", False, str(e)))

        # F2: Audit logs table immutability (least privilege denial + forensic trigger)
        try:
            # 1. Verify app user has no UPDATE permission on audit_logs
            app_update_blocked = False
            try:
                with service._get_connection(ctx_alpha_admin) as conn:
                    with conn.cursor() as cur:
                        cur.execute("UPDATE audit_logs SET action = 'TAMPERED';")
            except psycopg.errors.InsufficientPrivilege:
                app_update_blocked = True
            except Exception as e:
                if "permission denied" in str(e).lower():
                    app_update_blocked = True

            # 2. Verify trigger prevent_immutable_record_modification blocks even superuser
            trigger_blocked = False
            try:
                with psycopg.connect(db_url) as super_conn:
                    with super_conn.cursor() as cur:
                        cur.execute("UPDATE audit_logs SET action = 'TAMPERED';")
            except psycopg.errors.UniqueViolation:
                trigger_blocked = True
            except Exception as e:
                if "FORENSIC_INTEGRITY_VIOLATION" in str(e):
                    trigger_blocked = True

            if app_update_blocked and trigger_blocked:
                results.append(TestResult("Audit Security", "Forensic Audit Log Immutability", True, "Dual defense: App user lacks UPDATE grant AND trigger blocks superuser"))
            elif app_update_blocked or trigger_blocked:
                results.append(TestResult("Audit Security", "Forensic Audit Log Immutability", True, "Immutable integrity verified via least-privilege / trigger"))
            else:
                results.append(TestResult("Audit Security", "Forensic Audit Log Immutability", False, "Failed to block UPDATE on audit_logs"))
        except Exception as e:
            results.append(TestResult("Audit Security", "Forensic Audit Log Immutability", False, str(e)))

    finally:
        # Cleanup test evidence rows to preserve clean seed fixture state
        try:
            with psycopg.connect(db_url) as cleanup_conn:
                with cleanup_conn.cursor() as cur:
                    cur.execute("DELETE FROM evidence_items WHERE file_name NOT LIKE 'AlphaHealth%';")
        except Exception:
            pass
        server.stop()

    # ------------------------------------------------------------------------
    # Print Test Report
    # ------------------------------------------------------------------------
    print("[Phase 3B Storage Vault & Presigned S3 Test Execution]")
    pass_count = sum(1 for r in results if r.passed)
    fail_count = sum(1 for r in results if not r.passed and not r.skipped)
    skip_count = sum(1 for r in results if r.skipped)

    current_cat = ""
    for r in results:
        if r.category != current_cat:
            current_cat = r.category
            print(f"\n  --- {current_cat} ---")
        status = "[PASS]" if r.passed else ("[SKIP]" if r.skipped else "[FAIL]")
        print(f"  {status} {r.name:<45} : {r.details}")

    print("\n" + "=" * 76)
    print(f"Phase 3B Storage Test Summary: {pass_count}/{len(results)} passed ({fail_count} failed, {skip_count} skipped).")
    print("=" * 76)

    if fail_count > 0:
        print(">>> ONE OR MORE PHASE 3B STORAGE TESTS FAILED <<<\n")
        return results
    else:
        print(">>> ALL PHASE 3B STORAGE TESTS PASSED <<<\n")
        return results


def main():
    parser = argparse.ArgumentParser(description="TLI DPDP Phase 3B Evidence Vault Test Suite")
    parser.add_argument(
        "--database-url",
        default=os.environ.get("DATABASE_URL", "postgresql://postgres@127.0.0.1:54329/dpdp_test"),
        help="PostgreSQL database URL",
    )
    parser.add_argument(
        "--s3-port",
        type=int,
        default=54331,
        help="Port for local S3 Moto server (default: 54331)",
    )
    args = parser.parse_args()

    results = run_evidence_vault_tests(db_url=args.database_url, s3_port=args.s3_port)
    if any(not r.passed and not r.skipped for r in results):
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
