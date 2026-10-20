import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { calendarDateSchema } from "@/lib/http/dates";
import { getCurrentSession } from "@/lib/auth/session";
import { DatabaseAuthorizationError } from "@/lib/db/rls";
import {
  updateRemediationProgress,
  validateRemediationClosure,
  RemediationError,
} from "@/lib/remediation";

// Progress updates may only move a task through these; assessor decisions use the closure action path.
const PROGRESS_STATUSES = ["OPEN", "IN_REMEDIATION", "SUBMITTED_FOR_CLOSURE"] as const;
const isoDate = calendarDateSchema;

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

const closureSchema = z.object({
  action: z.enum(["VALIDATE_CLOSE", "REJECT_REOPEN"]),
  validationNotes: z.string().trim().max(5000).optional(),
});

const progressSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().max(5000).optional(),
  targetDate: isoDate.optional(),
  ownerUserId: z.string().uuid().optional(),
  status: z.enum(PROGRESS_STATUSES).optional(),
  closureSubmissionNotes: z.string().trim().max(5000).optional(),
});

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string; taskId: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: assessmentId, taskId } = await params;
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
    const isClosureDecision =
      typeof raw === "object" && raw !== null && "action" in raw && (raw as { action?: unknown }).action !== undefined;

    if (isClosureDecision) {
      const closure = closureSchema.safeParse(raw);
      if (!closure.success) {
        return NextResponse.json({ error: "Invalid closure decision." }, { status: 400 });
      }
      const task = await validateRemediationClosure(session, taskId, {
        assessmentId,
        action: closure.data.action,
        validationNotes: closure.data.validationNotes ?? "",
      });
      return NextResponse.json({ ok: true, task }, { status: 200 });
    }

    const progress = progressSchema.safeParse(raw);
    if (!progress.success) {
      return NextResponse.json(
        { error: "Please correct the highlighted fields.", details: progress.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const task = await updateRemediationProgress(session, taskId, { ...progress.data, assessmentId });

    return NextResponse.json({ ok: true, task }, { status: 200 });
  } catch (err) {
    return remediationErrorResponse(err, "Update remediation task");
  }
}

