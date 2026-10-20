/**
 * CloudE5 — Evidence Upload API Endpoint
 *
 * POST /api/evidence/upload
 * Multi-tenant, server-authorized evidence upload endpoint writing directly to
 * the isolated local-disk vault. Validates session, role permissions, file metadata,
 * size bounds (100B–50MB), and binary magic byte signatures.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { canUploadEvidence } from "@/lib/auth/rbac";
import { EvidenceVaultService } from "@/lib/storage/service";
import { FileValidator, ValidationError } from "@/lib/storage/validation";
import { ScannerUnavailableError } from "@/lib/storage/malware_scanner";
import type { UploadedEvidence } from "@/lib/storage/upload_response";
import { StorageConfigurationError, STORAGE_NOT_CONFIGURED_MESSAGE } from "@/lib/storage/object_store";
import { DatabaseAuthorizationError } from "@/lib/db/rls";

/** Multipart overhead allowed on top of the largest permitted file before the body is read. */
const MULTIPART_OVERHEAD_BYTES = 1_048_576;
const MAX_UPLOAD_REQUEST_BYTES = FileValidator.DEFAULT_MAX_SIZE_BYTES + MULTIPART_OVERHEAD_BYTES;
const MAX_FIELD_LENGTH = { code: 64, category: 120, description: 2_000 } as const;

/** Reads an optional text field, rejecting values longer than the limit. */
function textField(formData: FormData, name: string, maxLength: number): string | null {
  const value = formData.get(name);
  if (value === null) return null;
  if (typeof value !== "string" || value.length > maxLength) {
    throw new ValidationError(`Field '${name}' must be text of at most ${maxLength} characters.`);
  }
  return value;
}

export async function POST(req: NextRequest) {
  const sessionUser = await getCurrentSession();

  if (!sessionUser) {
    return NextResponse.json(
      { error: "Authentication required to upload evidence." },
      { status: 401 }
    );
  }

  // RBAC gate: CLIENT_VIEWER cannot upload evidence
  if (!canUploadEvidence(sessionUser.role)) {
    return NextResponse.json(
      { error: "Forbidden: Your role does not have authorization to upload compliance evidence." },
      { status: 403 }
    );
  }

  // Refuse bodies declared larger than the limit before buffering them. Proxies may forward a body
  // without a length (chunked); the file size is checked again after parsing in every case.
  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_UPLOAD_REQUEST_BYTES) {
    return NextResponse.json({ error: "The file is larger than the 50 MB upload limit." }, { status: 413 });
  }

  try {
    const formData = await req.formData();
    const fileField = formData.get("file");
    const file = fileField instanceof File ? fileField : null;
    const assessmentId = (textField(formData, "assessmentId", MAX_FIELD_LENGTH.code) || "").trim();
    const controlCode = textField(formData, "controlCode", MAX_FIELD_LENGTH.code) || "GENERIC";
    const questionCode = textField(formData, "questionCode", MAX_FIELD_LENGTH.code) || controlCode;
    const evidenceCategory =
      textField(formData, "evidenceCategory", MAX_FIELD_LENGTH.category) ||
      textField(formData, "category", MAX_FIELD_LENGTH.category) ||
      "Policy / Procedure";
    const description = textField(formData, "description", MAX_FIELD_LENGTH.description) || "";

    if (!file) {
      return NextResponse.json(
        { error: "Missing required file upload parameter." },
        { status: 400 }
      );
    }

    if (!assessmentId) {
      return NextResponse.json(
        { error: "Missing required assessmentId parameter." },
        { status: 400 }
      );
    }

    if (!controlCode || !controlCode.trim()) {
      return NextResponse.json(
        { error: "Missing required controlCode parameter." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const vaultService = new EvidenceVaultService();
    const record = await vaultService.uploadEvidence({
      sessionUser,
      assessmentId,
      controlCode,
      questionCode,
      evidenceCategory,
      description,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      content: buffer,
    });

    // Return sanitized metadata. NEVER return local disk paths!
    return NextResponse.json(
      {
        success: true,
        evidence: {
          id: record.id,
          fileName: record.fileName,
          fileSizeBytes: record.fileSizeBytes,
          mimeType: record.mimeType,
          sha256: record.sha256,
          status: record.status,
          uploadedAt: record.createdAt,
          questionCode: record.questionCode ?? null,
          evidenceCategory: record.evidenceCategory ?? null,
          description: record.description ?? null,
        } satisfies UploadedEvidence,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (err instanceof StorageConfigurationError) {
      return NextResponse.json({ error: STORAGE_NOT_CONFIGURED_MESSAGE }, { status: 503 });
    }
    if (err instanceof ScannerUnavailableError) {
      console.error("Evidence upload refused:", err.message);
      return NextResponse.json(
        { error: "The virus scanner is unavailable, so uploads are paused. Please try again shortly." },
        { status: 503 }
      );
    }
    if (err instanceof DatabaseAuthorizationError) {
      return NextResponse.json(
        { error: "Your session is no longer authorized. Please sign in again." },
        { status: 403 }
      );
    }
    if (err instanceof ValidationError) {
      const isForbidden = err.message.includes("Access denied");
      return NextResponse.json({ error: err.message }, { status: isForbidden ? 403 : 400 });
    }

    console.error("Evidence upload processing error:", err);
    return NextResponse.json(
      { error: "Internal server error occurred during evidence upload processing." },
      { status: 500 }
    );
  }
}

