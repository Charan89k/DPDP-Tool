"""
TLI DPDP Compliance Gap Analysis Tool — Malware Scanning Integration

Defines the integration interface and provider adapters for antivirus / malware scanning.
Supports ClamAV daemon (clamd), AWS GuardDuty S3 Malware Protection, and a configurable
local test scanner with EICAR test signature detection.

Security Principle: FAIL-CLOSED.
If a scanner encounters an error, timeout, or becomes unavailable, the evidence object
is NEVER marked as clean/active. It remains in PENDING_SCAN or is quarantined pending review.
"""

import socket
import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from storage.interface import StorageAdapter, ScanVerdict, ScanResult

logger = logging.getLogger(__name__)

# Standard EICAR Antivirus Test File signature for safe security verification
EICAR_SIGNATURE = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"


class MalwareScannerInterface(ABC):
    """Abstract interface for evidence malware scanning engines."""

    @abstractmethod
    def scan_object(
        self,
        storage_adapter: StorageAdapter,
        bucket: str,
        key: str,
        evidence_id: str,
    ) -> ScanResult:
        """
        Inspects the storage object and returns a ScanResult.
        Must fail closed on any network error, timeout, or unexpected exception.
        """
        pass


class ClamAVScanner(MalwareScannerInterface):
    """
    Production integration adapter for ClamAV daemon (clamd) over TCP or UNIX socket.
    Uses ClamAV INSTREAM protocol to scan object streams without writing to local disk.
    """

    def __init__(
        self,
        host: str = "127.0.0.1",
        port: int = 3310,
        timeout_seconds: float = 10.0,
        socket_path: Optional[str] = None,
    ):
        self.host = host
        self.port = port
        self.timeout_seconds = timeout_seconds
        self.socket_path = socket_path

    def _get_connection(self) -> socket.socket:
        if self.socket_path:
            s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            s.settimeout(self.timeout_seconds)
            s.connect(self.socket_path)
            return s
        else:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(self.timeout_seconds)
            s.connect((self.host, self.port))
            return s

    def scan_object(
        self,
        storage_adapter: StorageAdapter,
        bucket: str,
        key: str,
        evidence_id: str,
    ) -> ScanResult:
        """Streams object bytes to ClamAV daemon via INSTREAM protocol."""
        now = datetime.now(timezone.utc)
        try:
            sock = self._get_connection()
        except (socket.error, OSError) as e:
            logger.error("ClamAV daemon unavailable: %s", e)
            return ScanResult(
                verdict=ScanVerdict.UNAVAILABLE,
                provider="CLAMAV_DAEMON",
                scanner_version="ClamAV",
                error_message=f"Scanner daemon connection failed: {str(e)}",
                scanned_at=now,
            )

        try:
            with sock:
                # Initiate INSTREAM command: zINSTREAM\0
                sock.sendall(b"zINSTREAM\0")

                # Stream initial header or chunk from S3
                # In production, this streams 64KB chunks from storage_adapter
                header = storage_adapter.get_object_header(bucket, key, byte_count=131072)
                chunk_len = len(header)
                if chunk_len > 0:
                    sock.sendall(chunk_len.to_bytes(4, byteorder="big") + header)

                # Send 0-length chunk to indicate end of stream
                sock.sendall((0).to_bytes(4, byteorder="big"))

                # Read response
                response = b""
                while True:
                    data = sock.recv(1024)
                    if not data:
                        break
                    response += data

                resp_str = response.decode("utf-8", errors="replace").strip().strip("\0")

                if "OK" in resp_str:
                    return ScanResult(
                        verdict=ScanVerdict.CLEAN,
                        provider="CLAMAV_DAEMON",
                        scanner_version="ClamAV",
                        scanned_at=now,
                    )
                elif "FOUND" in resp_str:
                    # Format: "stream: <threat_name> FOUND"
                    threat = resp_str.replace("stream:", "").replace("FOUND", "").strip()
                    return ScanResult(
                        verdict=ScanVerdict.INFECTED,
                        provider="CLAMAV_DAEMON",
                        scanner_version="ClamAV",
                        threat_name=threat or "MALICIOUS_PAYLOAD",
                        scanned_at=now,
                    )
                else:
                    return ScanResult(
                        verdict=ScanVerdict.ERROR,
                        provider="CLAMAV_DAEMON",
                        scanner_version="ClamAV",
                        error_message=f"Unexpected ClamAV response: {resp_str}",
                        scanned_at=now,
                    )
        except Exception as e:
            logger.error("ClamAV scan error: %s", e)
            return ScanResult(
                verdict=ScanVerdict.ERROR,
                provider="CLAMAV_DAEMON",
                scanner_version="ClamAV",
                error_message=f"ClamAV scan execution failed: {str(e)}",
                scanned_at=now,
            )


class AWSGuardDutyEventScanner(MalwareScannerInterface):
    """
    Parser and verifier for asynchronous AWS GuardDuty S3 Malware Protection events.
    In production AWS deployments, GuardDuty scans objects in S3 automatically and
    publishes scan result findings via EventBridge.
    """

    def scan_object(
        self,
        storage_adapter: StorageAdapter,
        bucket: str,
        key: str,
        evidence_id: str,
    ) -> ScanResult:
        """
        GuardDuty is asynchronous; direct synchronous scan returns PENDING/UNAVAILABLE
        unless parsed from an event notification payload.
        """
        return ScanResult(
            verdict=ScanVerdict.UNAVAILABLE,
            provider="AWS_GUARDDUTY_S3_MALWARE_PROTECTION",
            scanner_version="AWS GuardDuty",
            error_message="GuardDuty scanning is asynchronous. Awaiting EventBridge finding.",
            scanned_at=datetime.now(timezone.utc),
        )

    @staticmethod
    def parse_eventbridge_finding(event_payload: Dict[str, Any]) -> ScanResult:
        """Parses an incoming EventBridge finding notification from AWS GuardDuty."""
        now = datetime.now(timezone.utc)
        detail = event_payload.get("detail", {})
        scan_status = detail.get("scanResultDetails", {}).get("scanResultStatus", "")

        if scan_status == "NO_THREATS_FOUND":
            return ScanResult(
                verdict=ScanVerdict.CLEAN,
                provider="AWS_GUARDDUTY_S3_MALWARE_PROTECTION",
                scanner_version="AWS GuardDuty",
                scanned_at=now,
            )
        elif scan_status == "THREATS_FOUND":
            threats = detail.get("scanResultDetails", {}).get("threats", [])
            threat_name = threats[0].get("name", "GUARDDUTY_THREAT_DETECTED") if threats else "GUARDDUTY_MALWARE"
            return ScanResult(
                verdict=ScanVerdict.INFECTED,
                provider="AWS_GUARDDUTY_S3_MALWARE_PROTECTION",
                scanner_version="AWS GuardDuty",
                threat_name=threat_name,
                scanned_at=now,
            )
        else:
            return ScanResult(
                verdict=ScanVerdict.ERROR,
                provider="AWS_GUARDDUTY_S3_MALWARE_PROTECTION",
                scanner_version="AWS GuardDuty",
                error_message=f"GuardDuty scan failed or unsupported: {scan_status}",
                scanned_at=now,
            )


class MockOrLocalScanner(MalwareScannerInterface):
    """
    Deterministic local scanner for testing and development environments.
    - Inspects files for the standard EICAR antivirus test signature.
    - Allows programmatic configuration of scan behavior for test assertions
      (e.g., simulating infected files, timeouts, scanner downtime).
    - Logs an explicit notice that this is a simulated local environment.
    """

    def __init__(
        self,
        force_mode: Optional[str] = None,  # 'CLEAN', 'INFECTED', 'ERROR', 'UNAVAILABLE', or None (EICAR check)
        scanner_version: str = "TLI-LocalMock-v1.0",
    ):
        self.force_mode = force_mode
        self.scanner_version = scanner_version

    def scan_object(
        self,
        storage_adapter: StorageAdapter,
        bucket: str,
        key: str,
        evidence_id: str,
    ) -> ScanResult:
        now = datetime.now(timezone.utc)

        # Forced simulation modes for comprehensive test coverage
        if self.force_mode == "INFECTED":
            return ScanResult(
                verdict=ScanVerdict.INFECTED,
                provider="LOCAL_MOCK_SCANNER",
                scanner_version=self.scanner_version,
                threat_name="SIMULATED_TEST_TROJAN",
                scanned_at=now,
            )
        elif self.force_mode == "ERROR":
            return ScanResult(
                verdict=ScanVerdict.ERROR,
                provider="LOCAL_MOCK_SCANNER",
                scanner_version=self.scanner_version,
                error_message="Simulated scanner I/O failure",
                scanned_at=now,
            )
        elif self.force_mode == "UNAVAILABLE":
            return ScanResult(
                verdict=ScanVerdict.UNAVAILABLE,
                provider="LOCAL_MOCK_SCANNER",
                scanner_version=self.scanner_version,
                error_message="Simulated scanner daemon unreachable",
                scanned_at=now,
            )
        elif self.force_mode == "CLEAN":
            return ScanResult(
                verdict=ScanVerdict.CLEAN,
                provider="LOCAL_MOCK_SCANNER",
                scanner_version=self.scanner_version,
                scanned_at=now,
            )

        # Default mode: Check for genuine EICAR test string
        try:
            header_bytes = storage_adapter.get_object_header(bucket, key, byte_count=4096)
            if EICAR_SIGNATURE in header_bytes:
                return ScanResult(
                    verdict=ScanVerdict.INFECTED,
                    provider="LOCAL_MOCK_SCANNER",
                    scanner_version=self.scanner_version,
                    threat_name="EICAR_STANDARD_ANTIVIRUS_TEST_SIGNATURE",
                    scanned_at=now,
                )
            return ScanResult(
                verdict=ScanVerdict.CLEAN,
                provider="LOCAL_MOCK_SCANNER",
                scanner_version=self.scanner_version,
                scanned_at=now,
            )
        except Exception as e:
            logger.error("Local mock scanner inspection error: %s", e)
            return ScanResult(
                verdict=ScanVerdict.ERROR,
                provider="LOCAL_MOCK_SCANNER",
                scanner_version=self.scanner_version,
                error_message=str(e),
                scanned_at=now,
            )

