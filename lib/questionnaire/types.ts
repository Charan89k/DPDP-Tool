/**
 * CloudE5 — Questionnaire Domain Types & Response Schema
 *
 * Grounded in the authoritative 60-question questionnaire extracted from
 * Truth_Labs_DPDP_60_Question_MS_Forms_Quick_Import_v1.docx.
 *
 * Preserves exact canonical options, follow-up prompt, and section structure.
 */

export type CanonicalResponseOption =
  | "Implemented"
  | "Partially implemented"
  | "Not implemented"
  | "Unknown / not verified"
  | "Not applicable — justification required";

export type MappingStatus = "MAPPED_PRIMARY" | "UNRESOLVED_PENDING_EXCEL_SHEET";

export interface CanonicalQuestion {
  code: string;
  order: number;
  sectionCode: string;
  sectionTitle: string;
  text: string;
  options: readonly CanonicalResponseOption[];
  followUpPrompt: string;
  canonicalControlId: string | null;
  mappingStatus: MappingStatus;
  mappingNotes: string;
}

export interface CanonicalQuestionnaireSection {
  code: string;
  title: string;
  heading: string;
  questions: CanonicalQuestion[];
}

export interface RespondentQuestionResponse {
  questionCode: string;
  selectedOption?: CanonicalResponseOption;
  commentsAndJustification?: string;
  updatedAt?: string;
}

export interface SectionProgressSummary {
  sectionCode: string;
  sectionTitle: string;
  totalQuestions: number;
  answeredCount: number;
  unansweredCount: number;
  excludedCount: number; // Selected 'Not applicable' with valid justification
  isComplete: boolean;
  missingJustificationCount: number;
}

export interface QuestionnaireProgress {
  totalQuestions: number;
  totalAnswered: number;
  totalUnanswered: number;
  totalExcluded: number;
  completionPercentage: number;
  hasErrors: boolean;
  sectionSummaries: SectionProgressSummary[];
}

// Backwards-compatible aliases for existing components
export type QuestionControl = CanonicalQuestion;
export type QuestionnaireSection = CanonicalQuestionnaireSection;
export type QuestionResponse = RespondentQuestionResponse;
