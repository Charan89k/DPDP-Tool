import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { generateReportDocument } from "@/lib/reports";

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

    const report = await generateReportDocument(session, id, isDraft);

    return new NextResponse(new Uint8Array(report.buffer), {
      status: 200,
      headers: {
        "Content-Type": report.contentType,
        "Content-Disposition": `attachment; filename="${report.filename}"`,
        "Content-Length": report.buffer.length.toString(),
        "X-Dataset-SHA256": report.data.auditTrail.datasetSha256,
        "X-Document-SHA256": report.sha256,
      },
    });
  } catch (err: any) {
    console.error("Report download error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate report document" },
      { status: 500 }
    );
  }
}

