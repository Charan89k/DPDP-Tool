"""
TLI DPDP Compliance Gap Analysis Tool — Evidence Vault Service

Orchestrates server-side evidence upload authorization, completion verification,
file signature validation, malware scanning integration, and presigned download issuance.
Enforces multi-tenant isolation, database RLS session binding, and forensic audit logging.
"""

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, Tuple
import uuid

import psycopg
from psycopg.rows import dict_row

from storage.interface import (
    StorageAdapter,
    UploadAuthorization,
    ScanVerdict,
    ScanResult,
)
from storage.validation import FileValidator, ValidationError
from storage.scanner import MalwareScannerInterface, MockOrLocalScanner

logger = logging.getLogger(__name__)


# ----------------------------------------------------------------------------
# Exceptions
# ----------------------------------------------------------------------------

class StorageServiceError(Exception):
    """Base exception for storage vault errors."""
    pass


class AuthorizationError(StorageServiceError):
    """Raised when caller lacks required tenant or assessment permissions."""
    pass


class LifecycleError(StorageServiceError):
    """Raised when an operation violates the evidence lifecycle state machine."""
    pass


# ----------------------------------------------------------------------------
# Caller Request Context
# ----------------------------------------------------------------------------

@dataclass(frozen=True)
class RequestContext:
    """Authenticated request security context."""
    user_id: str
    tenant_id: str
    role: str
    client_ip: Optional[str] = "127.0.0.1"
    user_agent: Optional[str] = "TLI-DPDP-Client/1.0"


# ----------------------------------------------------------------------------
# Evidence Vault Service
# ----------------------------------------------------------------------------

class EvidenceVaultService:
    """
    Core business service for evidence vault operations.
    Connects database RLS sessions with S3-compatible storage.
    """

    def __init__(
        self,
        db_connection_url: str,
        storage_adapter: StorageAdapter,
        bucket_name: str,
        scanner: Optional[MalwareScannerInterface] = None,
        validator: Optional[FileValidator] = None,
        presigned_upload_expiry_seconds: int = 600,     # 10 minutes
        presigned_download_expiry_seconds: int = 900,   # 15 minutes
    ):
        self.db_url = db_connection_url
        self.storage = storage_adapter
        self.bucket_name = bucket_name
        self.scanner = scanner or MockOrLocalScanner()
        self.validator = validator or FileValidator()
        self.upload_expiry = presigned_upload_expiry_seconds
        self.download_expiry = presigned_download_expiry_seconds

    def _get_connection(self, context: RequestContext) -> psycopg.Connection:
        """
        Creates a database connection with dpdp_app_user role and session context variables.
        Ensures Row-Level Security policies are actively enforced.
        """
        conn = psycopg.connect(self.db_url, row_factory=dict_row)
        with conn.cursor() as cur:
            cur.execute("SET ROLE dpdp_app_user;")
            if context.tenant_id:
                cur.execute("SELECT set_config('app.current_tenant_id', %s, false);", (context.tenant_id,))
            if context.user_id:
                cur.execute("SELECT set_config('app.current_user_id', %s, false);", (context.user_id,))
            if context.role:
                cur.execute("SELECT set_config('app.current_user_role', %s, false);", (context.role,))
        return conn

    def _emit_audit_log(
        self,
        cur: psycopg.Cursor,
        context: RequestContext,
        action: str,
        entity_id: str,
        previous_state: Optional[Dict[str, Any]] = None,
        new_state: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Appends an immutable entry to audit_logs.
        Fails closed: If audit logging fails, the transaction is rolled back.
        NEVER logs presigned URLs, credentials, or confidential file contents.
        """
        sql = """
        INSERT INTO audit_logs (
            tenant_id, user_id, action, entity_type, entity_id,
            ip_address, user_agent, previous_state, new_state
        ) VALUES (
            %s, %s, %s, 'evidence_items', %s,
            %s, %s, %s, %s
        );
        """
        prev_json = json.dumps(previous_state) if previous_state else None
        new_json = json.dumps(new_state) if new_state else None
        cur.execute(
            sql,
            (
                context.tenant_id,
                context.user_id,
                action,
                entity_id,
                context.client_ip,
                context.user_agent,
                prev_json,
                new_json,
            ),
        )

    # ------------------------------------------------------------------------
    # Upload Workflow
    # ------------------------------------------------------------------------

    def authorize_upload(
        self,
        context: RequestContext,
        assessment_control_id: str,
        file_name: str,
        file_size_bytes: int,
        mime_type: str,
        redaction_certified: bool,
        evidence_type_id: Optional[str] = None,
        upload_mechanism: str = "post",
    ) -> Dict[str, Any]:
        """
        Stage 1 of Upload Workflow:
        1. Validates affirmative client PII redaction certification.
        2. Validates caller permissions and assessment control scope via RLS.
        3. Validates file metadata against MIME allowlist and size limits.
        4. Generates unpredictable UUID evidence_id and deterministic S3 key.
        5. Inserts PENDING_UPLOAD record into evidence_items.
        6. Issues short-lived presigned upload authorization (POST policy or PUT URL).
        7. Records immutable audit log.
        """
        # 1. Affirmative Redaction Certification
        if not redaction_certified:
            raise ValidationError(
                "Client affirmative certification is mandatory: You must certify that the evidence contains "
                "no unmasked direct personal identifiers (such as unmasked Aadhaar, PAN, voter ID, passport) "
                "in accordance with Section 4 of TLI Evidence Standards."
            )

        # 2. Role Authorization Gate
        disallowed_roles = {"CLIENT_VIEWER"}
        if context.role in disallowed_roles:
            raise AuthorizationError(f"Role '{context.role}' does not have permission to upload evidence.")

        # 3. File Metadata Validation
        sanitized_filename, normalized_mime = self.validator.validate_metadata(
            filename=file_name,
            mime_type=mime_type,
            declared_size_bytes=file_size_bytes,
        )

        with self._get_connection(context) as conn:
            with conn.cursor() as cur:
                # 4. Assessment Control & Scoping Lookup (Guarded by RLS)
                query = """
                SELECT 
                    ac.id AS control_id,
                    ac.assessment_id,
                    a.tenant_id AS assessment_tenant_id,
                    a.status AS assessment_status,
                    c.code AS control_code
                FROM assessment_controls ac
                JOIN assessments a ON a.id = ac.assessment_id
                JOIN controls c ON c.id = ac.control_id
                WHERE ac.id = %s;
                """
                cur.execute(query, (assessment_control_id,))
                row = cur.fetchone()

                if not row:
                    raise AuthorizationError(
                        f"Assessment control '{assessment_control_id}' not found or access denied by tenant policy."
                    )

                # Check assessment status allows data gathering
                disallowed_assessment_statuses = {"DRAFT", "SCOPING", "SCOPE_LOCKED", "CANCELLED", "ARCHIVED"}
                if row["assessment_status"] in disallowed_assessment_statuses:
                    raise LifecycleError(
                        f"Assessment is in '{row['assessment_status']}' status. "
                        "Evidence uploads are permitted only during active gathering or remediation phases."
                    )

                assessment_id = str(row["assessment_id"])
                control_code = row["control_code"]

                # 5. Generate Server-Side Identity & Storage Key
                evidence_id = str(uuid.uuid4())
                s3_key = self.validator.generate_storage_key(
                    tenant_id=context.tenant_id,
                    assessment_id=assessment_id,
                    control_code=control_code,
                    evidence_id=evidence_id,
                    sanitized_filename=sanitized_filename,
                )

                now = datetime.now(timezone.utc)
                upload_expires_at = now + timedelta(seconds=self.upload_expiry)

                # 6. Insert evidence_items in PENDING_UPLOAD status
                insert_sql = """
                INSERT INTO evidence_items (
                    id, tenant_id, assessment_control_id, evidence_type_id,
                    uploaded_by_user_id, file_name, file_size_bytes, mime_type,
                    s3_key, s3_bucket, sha256_hash, status,
                    redaction_certified_by_client, upload_expires_at, created_at
                ) VALUES (
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, NULL, 'PENDING_UPLOAD',
                    %s, %s, %s
                );
                """
                cur.execute(
                    insert_sql,
                    (
                        evidence_id,
                        context.tenant_id,
                        assessment_control_id,
                        evidence_type_id,
                        context.user_id,
                        sanitized_filename,
                        file_size_bytes,
                        normalized_mime,
                        s3_key,
                        self.bucket_name,
                        True,
                        upload_expires_at,
                        now,
                    ),
                )

                # 7. Generate Pre-signed Upload Authorization
                auth: UploadAuthorization = self.storage.generate_presigned_upload(
                    bucket=self.bucket_name,
                    key=s3_key,
                    content_type=normalized_mime,
                    min_size_bytes=self.validator.min_size_bytes,
                    max_size_bytes=self.validator.max_size_bytes,
                    expires_in_seconds=self.upload_expiry,
                    mechanism=upload_mechanism,
                )

                # 8. Record Immutable Audit Log
                self._emit_audit_log(
                    cur=cur,
                    context=context,
                    action="EVIDENCE_UPLOAD_AUTHORIZED",
                    entity_id=evidence_id,
                    new_state={
                        "assessment_control_id": assessment_control_id,
                        "file_name": sanitized_filename,
                        "file_size_bytes": file_size_bytes,
                        "mime_type": normalized_mime,
                        "s3_key": s3_key,
                        "status": "PENDING_UPLOAD",
                        "upload_mechanism": upload_mechanism,
                        "expires_in_seconds": self.upload_expiry,
                    },
                )

                conn.commit()

        return {
            "evidence_id": evidence_id,
            "method": auth.method,
            "upload_url": auth.url,
            "fields": auth.fields,
            "headers": auth.headers,
            "s3_key": s3_key,
            "s3_bucket": self.bucket_name,
            "expires_in_seconds": self.upload_expiry,
            "upload_expires_at": upload_expires_at.isoformat(),
        }

    def complete_upload(
        self,
        context: RequestContext,
        evidence_id: str,
    ) -> Dict[str, Any]:
        """
        Stage 2 of Upload Workflow:
        1. Validates caller and evidence ownership via RLS.
        2. Verifies status is PENDING_UPLOAD (prevents duplicate completion).
        3. Confirms object exists in S3 via HeadObject.
        4. Verifies actual byte size against policy limits.
        5. Verifies magic bytes signature matches declared MIME type.
        6. Computes SHA-256 hash from storage object.
        7. Transitions status to PENDING_SCAN.
        8. Executes malware scanning:
           - CLEAN -> transitions to ACTIVE.
           - INFECTED -> quarantines object, transitions to QUARANTINED.
           - ERROR / UNAVAILABLE -> fails closed (remains PENDING_SCAN).
        9. Records immutable audit logs for completion and scan verdict.
        """
        with self._get_connection(context) as conn:
            with conn.cursor() as cur:
                # 1. Lookup Evidence Record (RLS enforced)
                cur.execute(
                    """
                    SELECT id, tenant_id, file_name, file_size_bytes, mime_type,
                           s3_key, s3_bucket, status, upload_expires_at
                    FROM evidence_items
                    WHERE id = %s;
                    """,
                    (evidence_id,),
                )
                item = cur.fetchone()

                if not item:
                    raise AuthorizationError(f"Evidence '{evidence_id}' not found or access denied.")

                current_status = item["status"]
                if current_status != "PENDING_UPLOAD":
                    raise LifecycleError(
                        f"Cannot complete upload: Evidence status is '{current_status}'. "
                        "Completion is permitted only from 'PENDING_UPLOAD'."
                    )

                s3_key = item["s3_key"]
                s3_bucket = item["s3_bucket"]
                declared_mime = item["mime_type"]
                sanitized_name = item["file_name"]

                # 2. Check S3 Object Existence & Metadata
                obj_meta = self.storage.head_object(s3_bucket, s3_key)
                if not obj_meta:
                    raise LifecycleError(
                        f"Object '{s3_key}' not found in storage bucket '{s3_bucket}'. "
                        "Client upload to S3 may have failed or was not completed."
                    )

                actual_size = obj_meta.size_bytes
                if actual_size < self.validator.min_size_bytes or actual_size > self.validator.max_size_bytes:
                    # Enforceable rejection: delete invalid object
                    self.storage.delete_object(s3_bucket, s3_key)
                    cur.execute(
                        "UPDATE evidence_items SET status = 'REJECTED' WHERE id = %s;",
                        (evidence_id,),
                    )
                    self._emit_audit_log(
                        cur, context, "EVIDENCE_UPLOAD_REJECTED", evidence_id,
                        previous_state={"status": "PENDING_UPLOAD"},
                        new_state={"status": "REJECTED", "reason": f"Size violation: {actual_size} bytes"},
                    )
                    conn.commit()
                    raise ValidationError(
                        f"Uploaded file size ({actual_size} bytes) violates policy boundaries."
                    )

                # 3. Magic Bytes Inspection
                header_bytes = self.storage.get_object_header(s3_bucket, s3_key, byte_count=512)
                try:
                    self.validator.verify_magic_bytes(header_bytes, declared_mime)
                except ValidationError as e:
                    self.storage.delete_object(s3_bucket, s3_key)
                    cur.execute(
                        "UPDATE evidence_items SET status = 'REJECTED' WHERE id = %s;",
                        (evidence_id,),
                    )
                    self._emit_audit_log(
                        cur, context, "EVIDENCE_UPLOAD_REJECTED", evidence_id,
                        previous_state={"status": "PENDING_UPLOAD"},
                        new_state={"status": "REJECTED", "reason": str(e)},
                    )
                    conn.commit()
                    raise

                # 4. Compute SHA-256 Digest
                actual_hash = self.storage.get_object_hash(s3_bucket, s3_key)

                # 5. Transition to PENDING_SCAN
                cur.execute(
                    """
                    UPDATE evidence_items
                    SET status = 'PENDING_SCAN',
                        file_size_bytes = %s,
                        sha256_hash = %s
                    WHERE id = %s;
                    """,
                    (actual_size, actual_hash, evidence_id),
                )
                self._emit_audit_log(
                    cur, context, "EVIDENCE_UPLOAD_COMPLETED", evidence_id,
                    previous_state={"status": "PENDING_UPLOAD"},
                    new_state={"status": "PENDING_SCAN", "sha256_hash": actual_hash, "file_size_bytes": actual_size},
                )
                conn.commit()

        # 6. Execute Malware Scan
        scan_result = self.scanner.scan_object(self.storage, s3_bucket, s3_key, evidence_id)
        now = datetime.now(timezone.utc)

        with self._get_connection(context) as conn:
            with conn.cursor() as cur:
                if scan_result.verdict == ScanVerdict.CLEAN:
                    # Clean: Transition to ACTIVE
                    cur.execute(
                        """
                        UPDATE evidence_items
                        SET status = 'ACTIVE',
                            scan_provider = %s,
                            scan_result = 'CLEAN',
                            scanned_at = %s
                        WHERE id = %s;
                        """,
                        (scan_result.provider, now, evidence_id),
                    )
                    self._emit_audit_log(
                        cur, context, "EVIDENCE_SCAN_PASSED", evidence_id,
                        previous_state={"status": "PENDING_SCAN"},
                        new_state={"status": "ACTIVE", "scan_provider": scan_result.provider, "result": "CLEAN"},
                    )
                    conn.commit()
                    return {
                        "evidence_id": evidence_id,
                        "status": "ACTIVE",
                        "file_size_bytes": actual_size,
                        "sha256_hash": actual_hash,
                        "scan_verdict": "CLEAN",
                    }

                elif scan_result.verdict == ScanVerdict.INFECTED:
                    # Infected: Quarantine payload and update record
                    quarantine_key = self.validator.generate_quarantine_key(
                        tenant_id=context.tenant_id,
                        evidence_id=evidence_id,
                        sanitized_filename=sanitized_name,
                    )
                    # Copy to quarantine prefix and delete from active prefix
                    self.storage.copy_object(s3_bucket, s3_key, s3_bucket, quarantine_key)
                    self.storage.delete_object(s3_bucket, s3_key)

                    cur.execute(
                        """
                        UPDATE evidence_items
                        SET status = 'QUARANTINED',
                            quarantined_at = %s,
                            quarantine_reason = %s,
                            quarantined_s3_key = %s,
                            scan_provider = %s,
                            scan_result = 'INFECTED',
                            scanned_at = %s
                        WHERE id = %s;
                        """,
                        (
                            now,
                            scan_result.threat_name or "MALICIOUS_THREAT_DETECTED",
                            quarantine_key,
                            scan_result.provider,
                            now,
                            evidence_id,
                        ),
                    )
                    self._emit_audit_log(
                        cur, context, "EVIDENCE_QUARANTINED", evidence_id,
                        previous_state={"status": "PENDING_SCAN"},
                        new_state={
                            "status": "QUARANTINED",
                            "threat": scan_result.threat_name,
                            "quarantine_key": quarantine_key,
                        },
                    )
                    conn.commit()
                    return {
                        "evidence_id": evidence_id,
                        "status": "QUARANTINED",
                        "scan_verdict": "INFECTED",
                        "threat_name": scan_result.threat_name,
                    }

                else:
                    # Scan ERROR or UNAVAILABLE: Fail-closed (remains PENDING_SCAN)
                    cur.execute(
                        """
                        UPDATE evidence_items
                        SET scan_provider = %s,
                            scan_result = %s,
                            scanned_at = %s,
                            verification_notes = %s
                        WHERE id = %s;
                        """,
                        (
                            scan_result.provider,
                            scan_result.verdict.value,
                            now,
                            f"Scan incomplete: {scan_result.error_message}",
                            evidence_id,
                        ),
                    )
                    self._emit_audit_log(
                        cur, context, "EVIDENCE_SCAN_FAILED", evidence_id,
                        previous_state={"status": "PENDING_SCAN"},
                        new_state={
                            "status": "PENDING_SCAN",
                            "verdict": scan_result.verdict.value,
                            "error": scan_result.error_message,
                        },
                    )
                    conn.commit()
                    return {
                        "evidence_id": evidence_id,
                        "status": "PENDING_SCAN",
                        "scan_verdict": scan_result.verdict.value,
                        "notice": "Scanner failed or unavailable. File kept unverified (fail-closed).",
                    }

    # ------------------------------------------------------------------------
    # Download Workflow
    # ------------------------------------------------------------------------

    def authorize_download(
        self,
        context: RequestContext,
        evidence_id: str,
    ) -> Dict[str, Any]:
        """
        Server-Authorized Download Workflow:
        1. Queries evidence record via RLS (enforces tenant match & consultant scoping).
        2. Validates evidence is strictly in ACTIVE status.
           Blocks PENDING_UPLOAD, PENDING_SCAN, QUARANTINED, REJECTED, and DELETED.
        3. Resolves S3 key from authoritative DB record (never trusts client key).
        4. Issues short-lived presigned GET URL (ResponseContentDisposition attachment).
        5. Records immutable audit log (NEVER logs full presigned URL).
        6. Returns download URL.
        """
        with self._get_connection(context) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, tenant_id, file_name, s3_key, s3_bucket, status,
                           sha256_hash, file_size_bytes, mime_type
                    FROM evidence_items
                    WHERE id = %s;
                    """,
                    (evidence_id,),
                )
                item = cur.fetchone()

                if not item:
                    raise AuthorizationError(
                        f"Evidence record '{evidence_id}' not found or access denied by tenant policy."
                    )

                status = item["status"]

                # Lifecycle Download Gates
                if status == "PENDING_UPLOAD":
                    raise LifecycleError("Evidence has not been uploaded yet.")
                elif status == "PENDING_SCAN":
                    raise LifecycleError("Evidence is awaiting malware security scanning.")
                elif status == "QUARANTINED":
                    raise AuthorizationError("Evidence is quarantined due to detected security threats.")
                elif status == "REJECTED":
                    raise LifecycleError("Evidence was rejected and cannot be inspected.")
                elif status in ("DELETION_PENDING", "DELETED"):
                    raise LifecycleError("Evidence has been deleted.")
                elif status not in ("ACTIVE", "SUPERSEDED"):
                    raise LifecycleError(f"Evidence in status '{status}' is not eligible for inspection.")

                s3_key = item["s3_key"]
                s3_bucket = item["s3_bucket"]
                file_name = item["file_name"]

                # Generate Presigned GET URL
                download_url = self.storage.generate_presigned_download(
                    bucket=s3_bucket,
                    key=s3_key,
                    expires_in_seconds=self.download_expiry,
                    download_filename=file_name,
                )

                # Record Immutable Audit Event
                self._emit_audit_log(
                    cur=cur,
                    context=context,
                    action="EVIDENCE_DOWNLOAD_AUTHORIZED",
                    entity_id=evidence_id,
                    new_state={
                        "file_name": file_name,
                        "file_size_bytes": item["file_size_bytes"],
                        "mime_type": item["mime_type"],
                        "expires_in_seconds": self.download_expiry,
                    },
                )
                conn.commit()

        return {
            "evidence_id": evidence_id,
            "download_url": download_url,
            "file_name": file_name,
            "expires_in_seconds": self.download_expiry,
        }

    # ------------------------------------------------------------------------
    # Deletion Workflow
    # ------------------------------------------------------------------------

    def delete_evidence(
        self,
        context: RequestContext,
        evidence_id: str,
        reason: str = "Client requested deletion",
    ) -> Dict[str, Any]:
        """
        Soft-deletes evidence item with audit trail.
        Permitted only for authorized roles (CLIENT_ADMIN, TLI_LEAD_CONSULTANT, TLI_SUPER_ADMIN).
        """
        authorized_roles = {"CLIENT_ADMIN", "TLI_LEAD_CONSULTANT", "TLI_SUPER_ADMIN"}
        if context.role not in authorized_roles:
            raise AuthorizationError(f"Role '{context.role}' is not authorized to delete evidence.")

        with self._get_connection(context) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, status, s3_key, s3_bucket FROM evidence_items WHERE id = %s;",
                    (evidence_id,),
                )
                item = cur.fetchone()
                if not item:
                    raise AuthorizationError(f"Evidence record '{evidence_id}' not found or access denied.")

                now = datetime.now(timezone.utc)
                cur.execute(
                    """
                    UPDATE evidence_items
                    SET status = 'DELETED',
                        deleted_at = %s,
                        deleted_by_user_id = %s
                    WHERE id = %s;
                    """,
                    (now, context.user_id, evidence_id),
                )

                self._emit_audit_log(
                    cur, context, "EVIDENCE_DELETED", evidence_id,
                    previous_state={"status": item["status"]},
                    new_state={"status": "DELETED", "reason": reason, "deleted_at": now.isoformat()},
                )
                conn.commit()

        return {"evidence_id": evidence_id, "status": "DELETED"}

