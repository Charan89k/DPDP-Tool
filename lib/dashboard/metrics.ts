/**
 * TLI DPDP Compliance Gap Analysis Tool — Dashboard Metrics
 *
 * Pure, deterministic aggregation of persisted assessment data for the home dashboard.
 * Every figure is derived from database rows the viewer is authorized to see; nothing is
 * hardcoded or estimated.
 */

import { calculateQuestionnaireProgress } from "../questionnaire/data.ts";
import type {
  CanonicalQuestionnaireSection,
  CanonicalResponseOption,
  RespondentQuestionResponse,
} from "../questionnaire/types.ts";

export type DashboardStatusBucket =
  | "IN_PROGRESS"
  | "PENDING_VALIDATION"
  | "REPORT_DRAFT"
  | "COMPLETED"
  | "CANCELLED";

/**
 * Maps the canonical 14-state lifecycle onto dashboard buckets.
 * DRAFT is the initial assessment state (not a report draft), so it counts as in progress.
 */
export function bucketAssessmentStatus(status: string): DashboardStatusBucket {
  switch (status) {
    case "DRAFT":
    case "SCOPING":
    case "SCOPE_LOCKED":
    case "DATA_GATHERING":
      return "IN_PROGRESS";
    case "SUBMITTED_FOR_REVIEW":
    case "UNDER_REVIEW":
    case "CLARIFICATION_PENDING":
      return "PENDING_VALIDATION";
    case "REVIEW_COMPLETED":
    case "DRAFT_REPORT_GENERATED":
      return "REPORT_DRAFT";
    case "LEAD_APPROVED":
    case "FINAL_ISSUED":
    case "REMEDIATION_ACTIVE":
    case "ARCHIVED":
      return "COMPLETED";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return "IN_PROGRESS";
  }
}

export interface StatusCounts {
  total: number;
  inProgress: number;
  pendingValidation: number;
  reportDraft: number;
  completed: number;
}

/** Counts assessments per bucket. Cancelled assessments are excluded from every figure. */
export function countAssessmentsByBucket(statuses: string[]): StatusCounts {
  const counts: StatusCounts = {
    total: 0,
    inProgress: 0,
    pendingValidation: 0,
    reportDraft: 0,
    completed: 0,
  };
  for (const status of statuses) {
    const bucket = bucketAssessmentStatus(status);
    if (bucket === "CANCELLED") continue;
    counts.total += 1;
    if (bucket === "IN_PROGRESS") counts.inProgress += 1;
    if (bucket === "PENDING_VALIDATION") counts.pendingValidation += 1;
    if (bucket === "REPORT_DRAFT") counts.reportDraft += 1;
    if (bucket === "COMPLETED") counts.completed += 1;
  }
  return counts;
}

export interface ResponseRow {
  assessment_id: string;
  question_code: string;
  selected_option: string | null;
  comments_and_justification: string | null;
}

export type ResponsesByAssessment = Map<string, Record<string, RespondentQuestionResponse>>;

/** Groups raw response rows by assessment into the questionnaire progress input shape. */
export function groupResponsesByAssessment(rows: ResponseRow[]): ResponsesByAssessment {
  const grouped: ResponsesByAssessment = new Map();
  for (const row of rows) {
    const responses = grouped.get(row.assessment_id) ?? {};
    responses[row.question_code] = {
      questionCode: row.question_code,
      selectedOption: (row.selected_option || undefined) as CanonicalResponseOption | undefined,
      commentsAndJustification: row.comments_and_justification || undefined,
    };
    grouped.set(row.assessment_id, responses);
  }
  return grouped;
}

export interface SectionCompletion {
  sectionCode: string;
  sectionTitle: string;
  completed: number;
  total: number;
  percentage: number;
}

export interface PortfolioProgress {
  completionByAssessment: Map<string, number>;
  sectionCompletion: SectionCompletion[];
  unansweredQuestions: number;
}

/**
 * Computes questionnaire progress across assessments using the canonical completion rule:
 * a question counts as complete when answered, or marked not applicable with a justification.
 */
export function summarizePortfolioProgress(
  sections: CanonicalQuestionnaireSection[],
  assessmentIds: string[],
  responsesByAssessment: ResponsesByAssessment
): PortfolioProgress {
  const completion = new Map<string, number>();
  const totals = new Map<string, SectionCompletion>(
    sections.map((section) => [
      section.code,
      { sectionCode: section.code, sectionTitle: section.title, completed: 0, total: 0, percentage: 0 },
    ])
  );
  let unansweredQuestions = 0;

  for (const id of assessmentIds) {
    const progress = calculateQuestionnaireProgress(sections, responsesByAssessment.get(id) ?? {});
    completion.set(id, progress.completionPercentage);
    unansweredQuestions += progress.totalUnanswered;
    for (const summary of progress.sectionSummaries) {
      const entry = totals.get(summary.sectionCode);
      if (!entry) continue;
      entry.completed += summary.answeredCount + summary.excludedCount;
      entry.total += summary.totalQuestions;
    }
  }

  const sectionCompletion = Array.from(totals.values()).map((entry) => ({
    ...entry,
    percentage: entry.total > 0 ? Math.round((entry.completed / entry.total) * 100) : 0,
  }));

  return { completionByAssessment: completion, sectionCompletion, unansweredQuestions };
}
