import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { serviceErrorResponse } from "@/lib/http/service_errors";
import { downloadRemediationDocument } from "@/lib/remediation-requests/service";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Authenticated download; never rendered inline. */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const doc = await downloadRemediationDocument(session, id);
    return new NextResponse(new Uint8Array(doc.buffer), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${doc.fileName.replace(/["\\]/g, "_")}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return serviceErrorResponse(err, "Downloading the document");
  }
}
