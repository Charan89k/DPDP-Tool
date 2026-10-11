"""
TLI DPDP Compliance Gap Analysis Tool — S3 Storage Adapter

Provider-neutral, S3-compatible storage adapter using the official AWS Boto3 SDK.
Supports AWS S3, MinIO, Ceph, Cloudflare R2, and local test servers (Moto).
Strictly adheres to AWS Signature Version 4 (SigV4) for all pre-signed operations.
"""

import hashlib
from datetime import datetime, timezone
from typing import Optional, Dict, Any

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from storage.interface import (
    StorageAdapter,
    UploadAuthorization,
    ObjectMetadata,
)


class S3StorageAdapter(StorageAdapter):
    """
    S3-compatible implementation of the StorageAdapter interface.
    Uses official Boto3 client without manual crypto signing.
    """

    def __init__(
        self,
        endpoint_url: Optional[str] = None,
        region_name: str = "ap-south-1",
        aws_access_key_id: Optional[str] = None,
        aws_secret_access_key: Optional[str] = None,
        use_ssl: bool = True,
        s3_client: Optional[Any] = None,
    ):
        """
        Initializes the S3 adapter. If an existing s3_client is passed,
        it is used directly (ideal for unit testing or dependency injection).
        """
        if s3_client is not None:
            self._client = s3_client
        else:
            # Configure SigV4 and path-style addressing for provider neutrality
            config = Config(
                signature_version="s3v4",
                s3={"addressing_style": "path"},
                retries={"max_attempts": 3, "mode": "standard"},
            )
            self._client = boto3.client(
                "s3",
                endpoint_url=endpoint_url,
                region_name=region_name,
                aws_access_key_id=aws_access_key_id,
                aws_secret_access_key=aws_secret_access_key,
                use_ssl=use_ssl,
                config=config,
            )

    @property
    def client(self) -> Any:
        """Returns the underlying boto3 S3 client."""
        return self._client

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
        Generates a short-lived presigned upload authorization.
        Default mechanism is 'post' which enforces content-length-range in S3 policy.
        """
        if mechanism.lower() == "post":
            fields = {"Content-Type": content_type}
            conditions = [
                ["content-length-range", min_size_bytes, max_size_bytes],
                {"Content-Type": content_type},
                {"key": key},
            ]
            response = self._client.generate_presigned_post(
                Bucket=bucket,
                Key=key,
                Fields=fields,
                Conditions=conditions,
                ExpiresIn=expires_in_seconds,
            )
            return UploadAuthorization(
                method="POST",
                url=response["url"],
                fields=response["fields"],
                headers={},
                s3_key=key,
                s3_bucket=bucket,
                expires_in_seconds=expires_in_seconds,
            )
        elif mechanism.lower() == "put":
            url = self._client.generate_presigned_url(
                ClientMethod="put_object",
                Params={
                    "Bucket": bucket,
                    "Key": key,
                    "ContentType": content_type,
                },
                ExpiresIn=expires_in_seconds,
            )
            return UploadAuthorization(
                method="PUT",
                url=url,
                fields={},
                headers={"Content-Type": content_type},
                s3_key=key,
                s3_bucket=bucket,
                expires_in_seconds=expires_in_seconds,
            )
        else:
            raise ValueError(f"Unsupported upload mechanism: {mechanism}. Must be 'post' or 'put'.")

    def generate_presigned_download(
        self,
        bucket: str,
        key: str,
        expires_in_seconds: int = 900,
        download_filename: Optional[str] = None,
    ) -> str:
        """
        Generates a short-lived, read-only presigned GET URL with
        forced attachment disposition to prevent inline browser execution.
        """
        params: Dict[str, Any] = {"Bucket": bucket, "Key": key}
        if download_filename:
            # Force download attachment with sanitized filename
            safe_filename = download_filename.replace('"', "").replace("\r", "").replace("\n", "")
            params["ResponseContentDisposition"] = f'attachment; filename="{safe_filename}"'

        url = self._client.generate_presigned_url(
            ClientMethod="get_object",
            Params=params,
            ExpiresIn=expires_in_seconds,
        )
        return url

    def head_object(self, bucket: str, key: str) -> Optional[ObjectMetadata]:
        """Queries object existence and metadata via HEAD request."""
        try:
            resp = self._client.head_object(Bucket=bucket, Key=key)
            return ObjectMetadata(
                key=key,
                size_bytes=resp.get("ContentLength", 0),
                content_type=resp.get("ContentType", "application/octet-stream"),
                etag=resp.get("ETag", "").strip('"'),
                last_modified=resp.get("LastModified", datetime.now(timezone.utc)),
            )
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")
            if error_code in ("404", "NoSuchKey", "NotFound"):
                return None
            raise

    def get_object_header(self, bucket: str, key: str, byte_count: int = 512) -> bytes:
        """Fetches initial byte slice to verify file magic signatures."""
        try:
            resp = self._client.get_object(
                Bucket=bucket,
                Key=key,
                Range=f"bytes=0-{byte_count - 1}",
            )
            return resp["Body"].read()
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")
            if error_code in ("404", "NoSuchKey", "NotFound"):
                raise FileNotFoundError(f"Storage object not found: s3://{bucket}/{key}")
            raise

    def get_object_hash(self, bucket: str, key: str) -> str:
        """Streams stored object bytes and computes SHA-256 digest."""
        hasher = hashlib.sha256()
        try:
            resp = self._client.get_object(Bucket=bucket, Key=key)
            body = resp["Body"]
            while chunk := body.read(65536):
                hasher.update(chunk)
            return hasher.hexdigest()
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")
            if error_code in ("404", "NoSuchKey", "NotFound"):
                raise FileNotFoundError(f"Storage object not found: s3://{bucket}/{key}")
            raise

    def copy_object(
        self,
        source_bucket: str,
        source_key: str,
        target_bucket: str,
        target_key: str,
    ) -> None:
        """Copies an object (e.g. from active bucket/prefix to quarantine)."""
        copy_source = {"Bucket": source_bucket, "Key": source_key}
        self._client.copy_object(
            Bucket=target_bucket,
            Key=target_key,
            CopySource=copy_source,
        )

    def delete_object(self, bucket: str, key: str) -> bool:
        """Deletes an object from storage."""
        try:
            self._client.delete_object(Bucket=bucket, Key=key)
            return True
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")
            if error_code in ("404", "NoSuchKey", "NotFound"):
                return True
            raise

    def object_exists(self, bucket: str, key: str) -> bool:
        """Checks if object exists in target bucket."""
        return self.head_object(bucket, key) is not None

    def upload_bytes(
        self,
        bucket: str,
        key: str,
        data: bytes,
        content_type: str,
    ) -> None:
        """Directly puts binary bytes into storage."""
        self._client.put_object(
            Bucket=bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
        )

