/**
 * TLI DPDP Compliance Gap Analysis Tool — Questionnaire Domain Types & Response Schema
 *
 * Grounded in the 13 canonical control domains and 30 canonical controls.
 * Strictly enforces that no questionnaire section contains more than 4 questions.
 */

export type MaturityLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type ResponseOptionKey =
  | "FULLY_IMPLEMENTED"
  | "PARTIALLY_IMPLEMENTED"
  | "PLANNED_AD_HOC"
  | "ABSENT";

export interface MCQOption {
  key: ResponseOptionKey;
  label: string;
  description: string;
  maturityScore: MaturityLevel;
  provisionalWeight: number; // e.g. 1.0, 0.5, 0.25, 0.0
}

export interface QuestionControl {
  controlId: string;
  controlVersion: string;
  title: string;
  objective: string;
  topic: string;
  sourceProvision: string;
  obligationType: string;
  assessmentQuestion: string;
  implementationExpectations: string;
  acceptableEvidence: string[];
  evidenceLimitations?: string;
  assessmentGuidance?: string;
  riskGuidance?: string;
  isSdfOnly?: boolean;
  penaltyTier?: string;
  options: MCQOption[];
}

export interface QuestionnaireSection {
  domainCode: string;
  domainTitle: string;
  domainWeight: number; // $W_D$ (1.00 to 1.50)
  statutoryFocus: string;
  questions: QuestionControl[]; // STRICT INVARIANT: questions.length <= 4
}

export interface AttachedEvidenceItem {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  sha256: string;
  status: string;
  uploadedAt: string;
}

export interface QuestionResponse {
  controlId: string;
  selectedOption?: ResponseOptionKey;
  selfMaturityScore?: MaturityLevel;
  notes?: string;
  isExcluded?: boolean;
  exclusionJustification?: string;
  evidenceItems?: AttachedEvidenceItem[];
}

export interface QuestionnaireState {
  assessmentId: string;
  responses: Record<string, QuestionResponse>;
  activeSectionIndex: number;
  isReviewStep: boolean;
}

export interface SectionProgressSummary {
  domainCode: string;
  domainTitle: string;
  totalQuestions: number;
  answeredCount: number;
  unansweredCount: number;
  excludedCount: number;
  isComplete: boolean;
  hasEvidencePending: boolean;
}

