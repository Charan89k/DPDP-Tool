import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { generateReportDocument, getIssuedReportDocument } from "@/lib/reports";
import type { DownloadableReport } from "@/lib/reports";
import { sessionErrorResponse } from "@/lib/http/session_errors";
import { isTliRole } from "@/lib/auth/rbac";
import { canAccessReportDocument, loadIssuedReport, PaymentError } from "@/lib/payments/service";
import { inSystemTransaction, writePaymentAudit } from "@/lib/payments/records";
import { requestMeta } from "@/lib/http/payment_routes";

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
    // Visibility first (tenant policy layer: other organisations' assessments are "not found"),
    // then the payment gate: customers get the report only after a verified payment.
    const assessment = await loadIssuedReport(session, id);
    if (!(await canAccessReportDocument(session, id))) {
      return NextResponse.json(
        { error: "This report is available once payment has been confirmed." },
        { status: 402 }
      );
    }

    const url = new URL(req.url);
    // Customers only ever receive the issued report; drafts are for TLI staff.
    const isDraft = isTliRole(session.role) ? url.searchParams.get("draft") !== "false" : false;

    // Once issued, the official report is the archived file, never a fresh rendering of live data.
    const issued = await getIssuedReportDocument(session, id);
    const report: DownloadableReport =
      issued ??
      (await generateReportDocument(session, id, isDraft).then((generated) => ({
        ...generated,
        datasetSha256: generated.data.auditTrail.datasetSha256,
      })));

    if (issued) {
      await inSystemTransaction((client) =>
        writePaymentAudit(client, {
          tenantId: assessment.tenantId,
          assessmentId: id,
          userId: session.userId,
          action: "REPORT_DOWNLOADED",
          details: { documentSha256: report.sha256, filename: report.filename },
          meta: requestMeta(req),
        })
      );
    }

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
    if (err instanceof PaymentError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("Report download error:", err);
    return NextResponse.json(
      { error: "Failed to generate report document" },
      { status: 500 }
    );
  }
}

