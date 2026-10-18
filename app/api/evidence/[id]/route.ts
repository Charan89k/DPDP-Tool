/**
 * TLI DPDP Compliance Gap Analysis Tool — Evidence Item Management API Endpoint
 *
 * GET /api/evidence/[id] — Retrieve evidence metadata
 * PATCH /api/evidence/[id] — Record reviewer decision (VERIFIED / REJECTED) with audit trail
 * DELETE /api/evidence/[id] — Soft-delete evidence item with retention & attribution
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { EvidenceVaultService } from "@/lib/storage/service";
import { ValidationError } from "@/lib/storage/validation";
import { StorageConfigurationError, STORAGE_NOT_CONFIGURED_MESSAGE } from "@/lib/storage/object_store";
import { DatabaseAuthorizationError } from "@/lib/db/rls";
import { canReviewAssessment } from "@/lib/auth/rbac";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  req: NextRequest,
  { params }: RouteParams
) {
  const sessionUser = await getCurrentSession();

  if (!sessionUser) {
    return NextResponse.json(
      { error: "Authentication required to view evidence metadata." },
      { status: 401 }
    );
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { error: "Missing required evidence ID parameter." },
      { status: 400 }
    );
  }

  try {
    const vaultService = new EvidenceVaultService();
    // getEvidenceForDownload validates tenant isolation and status
    const { record } = await vaultService.getEvidenceForDownload(sessionUser, id);

    return NextResponse.json({
      success: true,
      evidence: {
        id: record.id,
        assessmentId: record.assessmentId,
        questionCode: record.questionCode,
        category: record.evidenceCategory,
        description: record.description,
        fileName: record.fileName,
        fileSizeBytes: record.fileSizeBytes,
        mimeType: record.mimeType,
        sha256: record.sha256,
        status: record.status,
        uploadedByUserId: record.uploadedByUserId,
        verifiedByReviewerId: record.verifiedByReviewerId,
        verificationNotes: record.verificationNotes,
        verifiedAt: record.verifiedAt,
        createdAt: record.createdAt,
      },
    });
  } catch (err: unknown) {
    if (err instanceof StorageConfigurationError) {
      return NextResponse.json({ error: STORAGE_NOT_CONFIGURED_MESSAGE }, { status: 503 });
    }
    if (err instanceof DatabaseAuthorizationError) {
      return NextResponse.json(
        { error: "Your session is no longer authorized. Please sign in again." },
        { status: 403 }
      );
    }
    if (err instanceof ValidationError) {
      const isForbidden = err.message.includes("Access denied");
      return NextResponse.json(
        { error: err.message },
        { status: isForbidden ? 403 : 404 }
      );
    }

    console.error("Evidence retrieval error:", err);
    return NextResponse.json(
      { error: "Failed to retrieve evidence record." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: RouteParams
) {
  const sessionUser = await getCurrentSession();

  if (!sessionUser) {
    return NextResponse.json(
      { error: "Authentication required to review evidence." },
      { status: 401 }
    );
  }

  // Assessors only can record review decisions
  if (!canReviewAssessment(sessionUser.role)) {
    return NextResponse.json(
      { error: "Forbidden: Only authorized TLI assessors can record evidence review decisions." },
      { status: 403 }
    );
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { error: "Missing required evidence ID parameter." },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();
    const { status, verificationNotes } = body;

    const allowedStatuses = ["VERIFIED", "REJECTED", "ACTIVE", "SUPERSEDED", "QUARANTINED"];
    if (!status || !allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${allowedStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const vaultService = new EvidenceVaultService();
    const updated = await vaultService.reviewEvidence({
      sessionUser,
      evidenceId: id,
      status,
      verificationNotes,
    });

    return NextResponse.json({
      success: true,
      evidence: updated,
    });
  } catch (err: unknown) {
    if (err instanceof StorageConfigurationError) {
      return NextResponse.json({ error: STORAGE_NOT_CONFIGURED_MESSAGE }, { status: 503 });
    }
    if (err instanceof DatabaseAuthorizationError) {
      return NextResponse.json(
        { error: "Your session is no longer authorized. Please sign in again." },
        { status: 403 }
      );
    }
    if (err instanceof ValidationError) {
      const isForbidden = err.message.includes("Access denied");
      return NextResponse.json(
        { error: err.message },
        { status: isForbidden ? 403 : 400 }
      );
    }

    console.error("Evidence review decision error:", err);
    return NextResponse.json(
      { error: "Internal server error occurred while updating evidence review decision." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: RouteParams
) {
  const sessionUser = await getCurrentSession();

  if (!sessionUser) {
    return NextResponse.json(
      { error: "Authentication required to delete evidence." },
      { status: 401 }
    );
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { error: "Missing required evidence ID parameter." },
      { status: 400 }
    );
  }

  try {
    const vaultService = new EvidenceVaultService();
    const result = await vaultService.deleteEvidence({
      sessionUser,
      evidenceId: id,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err: unknown) {
    if (err instanceof StorageConfigurationError) {
      return NextResponse.json({ error: STORAGE_NOT_CONFIGURED_MESSAGE }, { status: 503 });
    }
    if (err instanceof DatabaseAuthorizationError) {
      return NextResponse.json(
        { error: "Your session is no longer authorized. Please sign in again." },
        { status: 403 }
      );
    }
    if (err instanceof ValidationError) {
      const isForbidden = err.message.includes("Access denied");
      return NextResponse.json(
        { error: err.message },
        { status: isForbidden ? 403 : 400 }
      );
    }

    console.error("Evidence deletion error:", err);
    return NextResponse.json(
      { error: "Internal server error occurred while deleting evidence." },
      { status: 500 }
    );
  }
}

