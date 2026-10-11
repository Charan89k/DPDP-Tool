"""
TLI DPDP Compliance Gap Analysis Tool — File Validation Engine

Implements defense-in-depth file validation:
1. Strict MIME type and file extension allowlists.
2. File size boundaries (100 B to 50 MB).
3. Filename sanitization (preventing path traversal and control character injection).
4. Binary magic signature (magic bytes) verification to prevent disguised executables.
5. Deterministic, tenant-partitioned object key generation.
"""

import os
import re
from typing import Dict, Set, Tuple, Optional


class ValidationError(Exception):
    """Raised when file metadata or content violates validation rules."""
    pass


class FileValidator:
    """Validates files against TLI security and DPDP compliance standards."""

    # Default limits: 100 bytes to 50 MB
    DEFAULT_MIN_SIZE_BYTES = 100
    DEFAULT_MAX_SIZE_BYTES = 52_428_800  # 50 MB

    # Explicit allowlist of authorized MIME types mapped to permitted file extensions
    ALLOWED_MIME_TYPES: Dict[str, Set[str]] = {
        "application/pdf": {".pdf"},
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {".docx"},
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {".xlsx"},
        "image/png": {".png"},
        "image/jpeg": {".jpg", ".jpeg"},
    }

    # Binary magic byte signatures
    MAGIC_SIGNATURES: Dict[str, bytes] = {
        "application/pdf": b"%PDF-",
        "image/png": b"\x89PNG\r\n\x1a\n",
        "image/jpeg": b"\xff\xd8\xff",
        # OOXML documents (DOCX, XLSX) are ZIP archives
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": b"PK\x03\x04",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": b"PK\x03\x04",
    }

    # Dangerous signatures that are explicitly blocked even if masquerading
    DANGEROUS_SIGNATURES = [
        (b"MZ", "Windows PE executable / DLL"),
        (b"\x7fELF", "Linux ELF executable"),
        (b"<!DOCTYPE html", "HTML content (Stored XSS vector)"),
        (b"<html", "HTML content (Stored XSS vector)"),
        (b"<svg", "SVG XML (Stored XSS vector)"),
        (b"<?xml", "Raw XML document"),
        (b"#!/", "Shell script"),
    ]

    def __init__(
        self,
        min_size_bytes: int = DEFAULT_MIN_SIZE_BYTES,
        max_size_bytes: int = DEFAULT_MAX_SIZE_BYTES,
    ):
        self.min_size_bytes = min_size_bytes
        self.max_size_bytes = max_size_bytes

    def sanitize_filename(self, filename: str) -> str:
        r"""
        Sanitizes a client-provided filename:
        - Strips directory path traversal (/ and \)
        - Strips control characters and null bytes
        - Normalizes spaces to underscores
        - Replaces special non-alphanumeric characters
        - Ensures extension is retained
        """
        if not filename or not filename.strip():
            raise ValidationError("File name cannot be empty.")

        # Extract only the base name (prevent path traversal)
        base = os.path.basename(filename.strip().replace("\\", "/"))
        name, ext = os.path.splitext(base)

        # Normalize extension
        ext = ext.lower().strip()

        # Sanitize the base name: keep alphanumeric, hyphens, and underscores
        safe_name = re.sub(r"[^a-zA-Z0-9_\-]", "_", name)
        # Collapse multiple underscores
        safe_name = re.sub(r"_+", "_", safe_name).strip("_")

        if not safe_name:
            safe_name = "evidence_document"

        # Truncate overly long file names (limit base to 80 chars)
        safe_name = safe_name[:80]

        return f"{safe_name}{ext}"

    def validate_metadata(
        self,
        filename: str,
        mime_type: str,
        declared_size_bytes: int,
    ) -> Tuple[str, str]:
        """
        Validates client-declared upload intent metadata.
        Returns (sanitized_filename, normalized_mime_type).
        """
        if declared_size_bytes < self.min_size_bytes:
            raise ValidationError(
                f"File size ({declared_size_bytes} bytes) is below minimum allowed ({self.min_size_bytes} bytes)."
            )
        if declared_size_bytes > self.max_size_bytes:
            raise ValidationError(
                f"File size ({declared_size_bytes} bytes) exceeds maximum allowed ({self.max_size_bytes} bytes / 50 MB)."
            )

        sanitized_filename = self.sanitize_filename(filename)
        _, ext = os.path.splitext(sanitized_filename)

        normalized_mime = mime_type.strip().lower()
        if normalized_mime not in self.ALLOWED_MIME_TYPES:
            raise ValidationError(
                f"MIME type '{mime_type}' is not authorized. Permitted types: {list(self.ALLOWED_MIME_TYPES.keys())}"
            )

        allowed_exts = self.ALLOWED_MIME_TYPES[normalized_mime]
        if ext not in allowed_exts:
            raise ValidationError(
                f"File extension '{ext}' does not match declared MIME type '{normalized_mime}'. Expected: {allowed_exts}"
            )

        return sanitized_filename, normalized_mime

    def verify_magic_bytes(self, header_bytes: bytes, mime_type: str) -> None:
        """
        Inspects the initial bytes of an uploaded object to verify that
        the binary signature matches the declared MIME type.

        LIMITATION NOTICE:
        Magic-byte checking is a valuable preliminary validation layer that detects
        trivial file extension masquerading and forbidden binary headers. However,
        checking a short header prefix does NOT categorically guarantee freedom
        from advanced polyglots, weaponized office macros, or embedded exploits.
        Defense-in-depth requires subsequent antivirus scanning and forced attachment
        download disposition (ResponseContentDisposition: attachment).
        """
        if not header_bytes or len(header_bytes) < 4:
            raise ValidationError("File content is empty or too short to contain a valid file signature.")

        # Check for dangerous signatures first
        for sig, description in self.DANGEROUS_SIGNATURES:
            if header_bytes.startswith(sig):
                raise ValidationError(f"File rejected: Detected forbidden content signature ({description}).")

        expected_sig = self.MAGIC_SIGNATURES.get(mime_type)
        if not expected_sig:
            raise ValidationError(f"No magic signature configured for MIME type '{mime_type}'.")

        if not header_bytes.startswith(expected_sig):
            raise ValidationError(
                f"Binary signature mismatch: Uploaded file header does not match expected signature for '{mime_type}'."
            )

    @staticmethod
    def generate_storage_key(
        tenant_id: str,
        assessment_id: str,
        control_code: str,
        evidence_id: str,
    ) -> str:
        """
        Constructs a strictly opaque, server-generated S3 partition key:
        tenants/{tenant_id}/assessments/{assessment_id}/controls/{control_code}/{evidence_id}.bin

        SECURITY REQUIREMENT:
        User-supplied filenames (and any personal identifiers or confidential data they contain)
        are NEVER placed in storage object keys. The original filename is retained solely in
        protected database metadata and presented via ResponseContentDisposition on download.
        """
        clean_control = re.sub(r"[^a-zA-Z0-9_\-]", "_", control_code)
        return (
            f"tenants/{tenant_id}/assessments/{assessment_id}/controls/{clean_control}/"
            f"{evidence_id}.bin"
        )

    @staticmethod
    def generate_quarantine_key(
        tenant_id: str,
        evidence_id: str,
    ) -> str:
        """
        Generates an isolated, opaque quarantine storage key:
        quarantine/tenants/{tenant_id}/{evidence_id}.bin
        """
        return f"quarantine/tenants/{tenant_id}/{evidence_id}.bin"
