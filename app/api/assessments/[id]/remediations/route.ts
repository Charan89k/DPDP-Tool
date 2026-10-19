import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { DatabaseAuthorizationError } from "@/lib/db/rls";
import { parseBody } from "@/lib/http/account_routes";
import {
  getAssessmentRemediations,
  createRemediationTask,
  RemediationError,
} from "@/lib/remediation";

const PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFORMATIONAL"] as const;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");

function remediationErrorResponse(err: unknown, context: string) {
  if (err instanceof RemediationError) {
    return NextResponse.json({ error: err.message }, { status: err.statusCode });
  }
  if (err instanceof DatabaseAuthorizationError) {
    return NextResponse.json({ error: "Your session is no longer valid. Please sign in again." }, { status: 401 });
  }
  console.error(`${context}:`, err);
  return NextResponse.json({ error: `Failed to ${context.toLowerCase()}.` }, { status: 500 });
}

const createSchema = z.object({
  questionCode: z.string().trim().regex(/^[A-Z]{3}-\d{2,3}$/).optional().nullable(),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000).default(""),
  priority: z.enum(PRIORITIES).optional(),
  targetDate: isoDate,
  ownerUserId: z.string().uuid().optional().nullable(),
});

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const remediations = await getAssessmentRemediations(session, id);

    return NextResponse.json({ ok: true, remediations }, { status: 200 });
  } catch (err) {
    return remediationErrorResponse(err, "Load remediation tasks");
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const parsed = await parseBody(req, createSchema);
    if ("response" in parsed) return parsed.response;
    const body = parsed.data;

    const task = await createRemediationTask(session, {
      assessmentId: id,
      questionCode: body.questionCode ?? undefined,
      title: body.title,
      description: body.description ?? "",
      priority: body.priority ?? "HIGH",
      targetDate: body.targetDate,
      ownerUserId: body.ownerUserId ?? undefined,
    });

    return NextResponse.json({ ok: true, task }, { status: 201 });
  } catch (err) {
    return remediationErrorResponse(err, "Create remediation task");
  }
}

