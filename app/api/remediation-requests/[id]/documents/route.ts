import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { serviceErrorResponse } from "@/lib/http/service_errors";
import { uploadRemediationDocument } from "@/lib/remediation-requests/service";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Multipart upload: file, kind (SUPPORTING_DOCUMENT | CORRECTIVE_EVIDENCE), taskId. Validated and virus-scanned. */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    const kind = form?.get("kind");
    if (!(file instanceof File) || (kind !== "SUPPORTING_DOCUMENT" && kind !== "CORRECTIVE_EVIDENCE")) {
      return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
    }
    const taskId = form?.get("taskId");
    const result = await uploadRemediationDocument(session, id, {
      kind,
      taskId: typeof taskId === "string" && taskId ? taskId : null,
      fileName: file.name,
      mimeType: file.type,
      content: Buffer.from(await file.arrayBuffer()),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return serviceErrorResponse(err, "Uploading the document");
  }
}
