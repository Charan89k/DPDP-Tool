import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { generateReportDocument, getIssuedReportDocument } from "@/lib/reports";
import type { DownloadableReport } from "@/lib/reports";
import { sessionErrorResponse } from "@/lib/http/session_errors";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const url = new URL(req.url);
    const isDraftParam = url.searchParams.get("draft");
    const isDraft = isDraftParam === "false" ? false : true;

    // Once issued, the official report is the archived file, never a fresh rendering of live data.
    const report: DownloadableReport =
      (await getIssuedReportDocument(session, id)) ??
      (await generateReportDocument(session, id, isDraft).then((generated) => ({
        ...generated,
        datasetSha256: generated.data.auditTrail.datasetSha256,
      })));

    return new NextResponse(new Uint8Array(report.buffer), {
      status: 200,
      headers: {
        "Content-Type": report.contentType,
        "Content-Disposition": `attachment; filename="${report.filename}"`,
        "Content-Length": report.buffer.length.toString(),
        "X-Dataset-SHA256": report.datasetSha256,
        "X-Document-SHA256": report.sha256,
      },
    });
  } catch (err) {
    const sessionError = sessionErrorResponse(err);
    if (sessionError) return sessionError;
    console.error("Report download error:", err);
    return NextResponse.json(
      { error: "Failed to generate report document" },
      { status: 500 }
    );
  }
}

