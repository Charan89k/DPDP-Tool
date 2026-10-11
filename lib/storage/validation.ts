/**
 * TLI DPDP Compliance Gap Analysis Tool — Evidence Storage & File Validation Engine
 *
 * Implements strict defense-in-depth file validation:
 * 1. Strict MIME type and file extension allowlists.
 * 2. Strict file size boundaries (100 B to 50 MB / 52,428,800 bytes).
 * 3. Filename sanitization (stripping directory traversal, control characters, null bytes).
 * 4. Binary magic signature (magic bytes) verification to prevent disguised executables.
 * 5. Deterministic, opaque tenant-partitioned object key generation.
 * 6. Path traversal rejection for both filenames and object storage keys.
 */

import path from "node:path";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class FileValidator {
  // Default limits: 100 bytes to 50 MB
  public static readonly DEFAULT_MIN_SIZE_BYTES = 100;
  public static readonly DEFAULT_MAX_SIZE_BYTES = 52_428_800; // 50 MB

  // Explicit allowlist of authorized MIME types mapped to permitted file extensions
  public static readonly ALLOWED_MIME_TYPES: Record<string, string[]> = {
    "application/pdf": [".pdf"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    "image/png": [".png"],
    "image/jpeg": [".jpg", ".jpeg"],
  };

  // Binary magic byte signatures
  public static readonly MAGIC_SIGNATURES: Record<string, Buffer> = {
    "application/pdf": Buffer.from("%PDF-", "utf-8"),
    "image/png": Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // \x89PNG\r\n\x1a\n
    "image/jpeg": Buffer.from([0xff, 0xd8, 0xff]),
    // OOXML documents (DOCX, XLSX) are ZIP archives
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": Buffer.from([0x50, 0x4b, 0x03, 0x04]), // PK\x03\x04
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": Buffer.from([0x50, 0x4b, 0x03, 0x04]), // PK\x03\x04
  };

  // Dangerous signatures that are explicitly blocked even if masquerading
  public static readonly DANGEROUS_SIGNATURES: Array<{ signature: Buffer; description: string }> = [
    { signature: Buffer.from("MZ", "utf-8"), description: "Windows PE executable / DLL" },
    { signature: Buffer.from([0x7f, 0x45, 0x4c, 0x46]), description: "Linux ELF executable" },
    { signature: Buffer.from("<!DOCTYPE html", "utf-8"), description: "HTML content (Stored XSS vector)" },
    { signature: Buffer.from("<html", "utf-8"), description: "HTML content (Stored XSS vector)" },
    { signature: Buffer.from("<svg", "utf-8"), description: "SVG XML (Stored XSS vector)" },
    { signature: Buffer.from("<?xml", "utf-8"), description: "Raw XML document" },
    { signature: Buffer.from("#!/", "utf-8"), description: "Shell script" },
  ];

  private minSizeBytes: number;
  private maxSizeBytes: number;

  constructor(
    minSizeBytes: number = FileValidator.DEFAULT_MIN_SIZE_BYTES,
    maxSizeBytes: number = FileValidator.DEFAULT_MAX_SIZE_BYTES
  ) {
    this.minSizeBytes = minSizeBytes;
    this.maxSizeBytes = maxSizeBytes;
  }

  /**
   * Sanitizes a client-provided filename:
   * - Strips directory path traversal (/ and \)
   * - Strips control characters, null bytes, and dangerous characters
   * - Normalizes spaces and non-alphanumeric characters to underscores
   * - Retains and lowercases extension
   * - Limits base filename to 80 characters
   */
  public sanitizeFilename(filename: string): string {
    if (!filename || !filename.trim()) {
      throw new ValidationError("File name cannot be empty.");
    }

    // Strip any directory traversal paths
    const normalized = filename.trim().replace(/\\/g, "/");
    const base = path.basename(normalized);
    const ext = path.extname(base).toLowerCase().trim();
    const nameWithoutExt = path.basename(base, ext);

    // Sanitize the base name: keep alphanumeric, hyphens, and underscores
    let safeName = nameWithoutExt.replace(/[^a-zA-Z0-9_\-]/g, "_");
    // Collapse multiple underscores
    safeName = safeName.replace(/_+/g, "_").replace(/^_+|_+$/g, "");

    if (!safeName) {
      safeName = "evidence_document";
    }

    // Truncate overly long file names
    safeName = safeName.slice(0, 80);

    return `${safeName}${ext}`;
  }

  /**
   * Validates client-declared upload intent metadata.
   * Returns { sanitizedFilename, normalizedMime }.
   */
  public validateMetadata(
    filename: string,
    mimeType: string,
    declaredSizeBytes: number
  ): { sanitizedFilename: string; normalizedMime: string } {
    if (declaredSizeBytes < this.minSizeBytes) {
      throw new ValidationError(
        `File size (${declaredSizeBytes} bytes) is below minimum allowed (${this.minSizeBytes} bytes).`
      );
    }
    if (declaredSizeBytes > this.maxSizeBytes) {
      throw new ValidationError(
        `File size (${declaredSizeBytes} bytes) exceeds maximum allowed (${this.maxSizeBytes} bytes / 50 MB).`
      );
    }

    const sanitizedFilename = this.sanitizeFilename(filename);
    const ext = path.extname(sanitizedFilename).toLowerCase();

    const normalizedMime = (mimeType || "").trim().toLowerCase();
    if (!FileValidator.ALLOWED_MIME_TYPES[normalizedMime]) {
      throw new ValidationError(
        `MIME type '${mimeType}' is not authorized. Permitted types: ${Object.keys(
          FileValidator.ALLOWED_MIME_TYPES
        ).join(", ")}`
      );
    }

    const allowedExts = FileValidator.ALLOWED_MIME_TYPES[normalizedMime];
    if (!allowedExts.includes(ext)) {
      throw new ValidationError(
        `File extension '${ext}' does not match declared MIME type '${normalizedMime}'. Expected: ${allowedExts.join(
          ", "
        )}`
      );
    }

    return { sanitizedFilename, normalizedMime };
  }

  /**
   * Inspects the initial bytes of an uploaded object to verify that
   * the binary signature matches the declared MIME type and does not match
   * forbidden executable/script formats.
   */
  public verifyMagicBytes(headerBytes: Buffer | Uint8Array, mimeType: string): void {
    const buf = Buffer.isBuffer(headerBytes) ? headerBytes : Buffer.from(headerBytes);

    if (!buf || buf.length < 4) {
      throw new ValidationError("File content is empty or too short to contain a valid file signature.");
    }

    // Check for dangerous signatures first
    for (const { signature, description } of FileValidator.DANGEROUS_SIGNATURES) {
      if (buf.subarray(0, signature.length).equals(signature)) {
        throw new ValidationError(`File rejected: Detected forbidden content signature (${description}).`);
      }
    }

    const expectedSig = FileValidator.MAGIC_SIGNATURES[mimeType];
    if (!expectedSig) {
      throw new ValidationError(`No magic signature configured for MIME type '${mimeType}'.`);
    }

    if (!buf.subarray(0, expectedSig.length).equals(expectedSig)) {
      throw new ValidationError(
        `Binary signature mismatch: Uploaded file header does not match expected signature for '${mimeType}'.`
      );
    }
  }

  /**
   * Constructs an opaque, server-generated storage key:
   * tenants/{tenantId}/assessments/{assessmentId}/controls/{cleanControl}/{evidenceId}.bin
   *
   * SECURITY REQUIREMENT:
   * User-supplied filenames are NEVER placed in storage object keys to prevent
   * data leakage and path manipulation.
   */
  public static generateStorageKey(
    tenantId: string,
    assessmentId: string,
    controlCode: string,
    evidenceId: string
  ): string {
    const cleanTenant = tenantId.replace(/[^a-zA-Z0-9_\-]/g, "_");
    const cleanAssessment = assessmentId.replace(/[^a-zA-Z0-9_\-]/g, "_");
    const cleanControl = controlCode.replace(/[^a-zA-Z0-9_\-]/g, "_");
    const cleanEvidence = evidenceId.replace(/[^a-zA-Z0-9_\-]/g, "_");

    return `tenants/${cleanTenant}/assessments/${cleanAssessment}/controls/${cleanControl}/${cleanEvidence}.bin`;
  }

  /**
   * Generates an isolated quarantine storage key:
   * quarantine/tenants/{tenantId}/{evidenceId}.bin
   */
  public static generateQuarantineKey(tenantId: string, evidenceId: string): string {
    const cleanTenant = tenantId.replace(/[^a-zA-Z0-9_\-]/g, "_");
    const cleanEvidence = evidenceId.replace(/[^a-zA-Z0-9_\-]/g, "_");
    return `quarantine/tenants/${cleanTenant}/${cleanEvidence}.bin`;
  }

  /**
   * Defensive check to guarantee a resolved path stays inside the target base directory.
   */
  public static isSafePath(baseDir: string, targetPath: string): boolean {
    const resolvedBase = path.resolve(baseDir);
    const resolvedTarget = path.resolve(targetPath);
    return resolvedTarget.startsWith(resolvedBase + path.sep) || resolvedTarget === resolvedBase;
  }
}

