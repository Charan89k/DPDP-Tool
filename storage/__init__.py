"""
TLI DPDP Compliance Gap Analysis Tool — Evidence Storage Vault (Phase 3B)

This package implements a secure, provider-neutral, S3-compatible evidence storage
vault with pre-signed upload/download authorization, file signature validation,
fail-closed malware scanning integration, and forensic audit logging.
"""

from storage.interface import (
    StorageAdapter,
    UploadAuthorization,
    ObjectMetadata,
    ScanVerdict,
    ScanResult,
)
from storage.s3_adapter import S3StorageAdapter
from storage.validation import FileValidator
from storage.scanner import (
    MalwareScannerInterface,
    MockOrLocalScanner,
    ClamAVScanner,
    AWSGuardDutyEventScanner,
)
from storage.service import (
    EvidenceVaultService,
    RequestContext,
    StorageServiceError,
    AuthorizationError,
    ValidationError,
    LifecycleError,
)

__all__ = [
    "StorageAdapter",
    "UploadAuthorization",
    "ObjectMetadata",
    "ScanVerdict",
    "ScanResult",
    "S3StorageAdapter",
    "FileValidator",
    "MalwareScannerInterface",
    "MockOrLocalScanner",
    "ClamAVScanner",
    "AWSGuardDutyEventScanner",
    "EvidenceVaultService",
    "RequestContext",
    "StorageServiceError",
    "AuthorizationError",
    "ValidationError",
    "LifecycleError",
]

