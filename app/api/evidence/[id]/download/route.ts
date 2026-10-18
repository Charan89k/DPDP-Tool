/**
 * CloudE5 — Evidence Download API Endpoint
 *
 * GET /api/evidence/[id]/download
 * Enforces tenant boundary isolation, fail-closed scan status validation,
 * and safe binary attachment disposition.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { EvidenceVaultService } from "@/lib/storage/service";
import { ValidationError } from "@/lib/storage/validation";
import { StorageConfigurationError, STORAGE_NOT_CONFIGURED_MESSAGE } from "@/lib/storage/object_store";
import { DatabaseAuthorizationError } from "@/lib/db/rls";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const sessionUser = await getCurrentSession();

  if (!sessionUser) {
    return NextResponse.json(
      { error: "Authentication required to download evidence." },
      { status: 401 }
    );
  }

  const { id } = await context.params;

  if (!id) {
    return NextResponse.json(
      { error: "Missing required evidence ID parameter." },
      { status: 400 }
    );
  }

  try {
    const vaultService = new EvidenceVaultService();
    const { record, content } = await vaultService.getEvidenceForDownload(sessionUser, id);

    // Return binary file with strict security download headers
    return new NextResponse(new Uint8Array(content), {
      status: 200,
      headers: {
        "Content-Type": record.mimeType,
        "Content-Disposition": `attachment; filename="${record.fileName}"`,
        "Content-Length": record.fileSizeBytes.toString(),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
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

    console.error("Evidence download retrieval error:", err);
    return NextResponse.json(
      { error: "Unable to retrieve evidence file from vault." },
      { status: 500 }
    );
  }
}
