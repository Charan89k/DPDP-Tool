"""
TLI DPDP Compliance Gap Analysis Tool — Storage Service Interface

Defines the abstract contract and data models for provider-neutral object storage.
All higher-level application services interact strictly with these interfaces,
preserving architectural independence from any single cloud vendor.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, Any, Optional
from datetime import datetime


class ScanVerdict(str, Enum):
    """Malware scanning result categories."""
    CLEAN = "CLEAN"
    INFECTED = "INFECTED"
    ERROR = "ERROR"
    UNAVAILABLE = "UNAVAILABLE"


@dataclass(frozen=True)
class ScanResult:
    """Outcome of an antivirus / malware scan inspection."""
    verdict: ScanVerdict
    provider: str
    scanner_version: str
    threat_name: Optional[str] = None
    error_message: Optional[str] = None
    scanned_at: datetime = field(default_factory=datetime.utcnow)


@dataclass(frozen=True)
class ObjectMetadata:
    """Object storage metadata returned by HEAD requests."""
    key: str
    size_bytes: int
    content_type: str
    etag: str
    last_modified: datetime


@dataclass(frozen=True)
class UploadAuthorization:
    """
    Client authorization parameters for pre-signed direct upload.
    Supports either pre-signed POST policy (with form fields and strict size policy)
    or pre-signed PUT (with exact Content-Length / Content-Type headers).
    """
    method: str  # 'POST' or 'PUT'
    url: str
    fields: Dict[str, str] = field(default_factory=dict)  # Required for POST policy
    headers: Dict[str, str] = field(default_factory=dict)  # Required for PUT
    s3_key: str = ""
    s3_bucket: str = ""
    expires_in_seconds: int = 600
    upload_expires_at: Optional[datetime] = None


class StorageAdapter(ABC):
    """
    Provider-neutral storage adapter interface.
    Implementations must translate these calls to AWS S3, MinIO, or compatible APIs.
    """

    @abstractmethod
    def generate_presigned_upload(
        self,
        bucket: str,
        key: str,
        content_type: str,
        min_size_bytes: int,
        max_size_bytes: int,
        expires_in_seconds: int = 600,
        mechanism: str = "post",
    ) -> UploadAuthorization:
        """
        Generates a short-lived, narrowly scoped upload authorization.
        If mechanism is 'post', returns a POST policy with content-length-range enforcement.
        If mechanism is 'put', returns a PUT URL with Content-Type and size restrictions.
        """
        pass

    @abstractmethod
    def generate_presigned_download(
        self,
        bucket: str,
        key: str,
        expires_in_seconds: int = 900,
        download_filename: Optional[str] = None,
    ) -> str:
        """
        Generates a short-lived (default 15 mins), read-only presigned GET URL
        scoped strictly to a single object with ResponseContentDisposition attachment.
        """
        pass

    @abstractmethod
    def head_object(self, bucket: str, key: str) -> Optional[ObjectMetadata]:
        """
        Queries object existence and metadata.
        Returns ObjectMetadata if exists, None if object is not found.
        """
        pass

    @abstractmethod
    def get_object_header(self, bucket: str, key: str, byte_count: int = 512) -> bytes:
        """
        Fetches the initial byte slice (e.g. 512 bytes) of an object
        to inspect magic file signatures without downloading the full payload.
        """
        pass

    @abstractmethod
    def get_object_hash(self, bucket: str, key: str) -> str:
        """
        Computes SHA-256 checksum of the stored object.
        """
        pass

    @abstractmethod
    def copy_object(
        self,
        source_bucket: str,
        source_key: str,
        target_bucket: str,
        target_key: str,
    ) -> None:
        """
        Copies an object within or between buckets (e.g. into quarantine prefix).
        """
        pass

    @abstractmethod
    def delete_object(self, bucket: str, key: str) -> bool:
        """
        Deletes an object from storage. Returns True if deleted or already absent.
        """
        pass

    @abstractmethod
    def object_exists(self, bucket: str, key: str) -> bool:
        """Checks whether an object exists in the target bucket."""
        pass

    @abstractmethod
    def upload_bytes(
        self,
        bucket: str,
        key: str,
        data: bytes,
        content_type: str,
    ) -> None:
        """
        Directly uploads binary data (used for test fixtures and quarantine moves).
        """
        pass

