import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { serviceErrorResponse } from "@/lib/http/service_errors";
import { saveProposalDraft } from "@/lib/remediation-requests/service";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const schema = z.object({
  proposalId: z.string().max(64).optional(),
  scopeOfServices: z.string().max(5000),
  correctiveActivities: z.string().max(5000),
  deliverables: z.string().max(5000),
  estimatedTimeline: z.string().max(1000),
  targetCompletionDate: z.string(),
  commercialTerms: z.string().max(5000),
  feeAmountRupees: z.number().nonnegative().nullable(),
  validUntil: z.string(),
});

/** Create a new proposal version, or update the current draft (proposalId). */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Complete every proposal field." }, { status: 400 });
    const { proposalId, feeAmountRupees, ...rest } = parsed.data;
    const feeAmountPaise = feeAmountRupees === null ? null : Math.round(feeAmountRupees * 100);
    return NextResponse.json(await saveProposalDraft(session, id, { ...rest, feeAmountPaise }, proposalId), { status: proposalId ? 200 : 201 });
  } catch (err) {
    return serviceErrorResponse(err, "Saving the proposal");
  }
}
