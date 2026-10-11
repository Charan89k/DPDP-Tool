/**
 * TLI DPDP Compliance Gap Analysis Tool — Evidence Upload API Endpoint
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
import { ValidationError } from "@/lib/storage/validation";

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

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const assessmentId = (formData.get("assessmentId") as string) || "default-assessment";
    const controlCode = (formData.get("controlCode") as string) || "GENERIC";

    if (!file) {
      return NextResponse.json(
        { error: "Missing required file upload parameter." },
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
        },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    console.error("Evidence upload processing error:", err);
    return NextResponse.json(
      { error: "Internal server error occurred during evidence upload processing." },
      { status: 500 }
    );
  }
}

