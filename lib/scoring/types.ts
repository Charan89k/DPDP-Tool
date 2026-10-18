/**
 * CloudE5 — Deterministic Scoring Engine Types
 *
 * Grounded in canonical questionnaire manifest (60 questions), 13 statutory domains,
 * and non-compensatory dual-metric governance specifications (DEC-01, DEC-08, DEC-10).
 */

import type { CanonicalResponseOption } from "../questionnaire/types.ts";
export type { CanonicalResponseOption };

export type MethodologyApprovalStatus =
  | "PROVISIONAL_PENDING_APPROVAL"
  | "FORMALLY_APPROVED";

export type QuestionEvaluationStatus =
  | "SCORED"
  | "UNSCORED_UNKNOWN"
  | "EXCLUDED_APPROVED"
  | "UNAPPROVED_NA"
  | "UNANSWERED";

export interface QuestionResponseInput {
  questionCode: string;
  selectedOption?: CanonicalResponseOption | string | null;
  commentsAndJustification?: string | null;
  updatedAt?: string | null;
}

export interface AssessorReviewInput {
  questionCode: string;
  reviewStatus?: string | null; // e.g. 'EXCLUSION_VERIFIED', 'VERIFIED_COMPLIANT', etc.
  isExclusionApproved?: boolean;
  reviewFindings?: string | null;
  evidenceDeficiencyNotes?: string | null;
  requiresFurtherValidation?: boolean;
}

export interface EvidenceCoverageInput {
  totalEvidenceItems?: number;
  questionsWithEvidence?: string[]; // questionCodes with active/verified evidence
}

export interface ScoringCalculationInput {
  assessmentId?: string;
  engagementCode?: string;
  assessmentStatus?: string;
  responses: Record<string, QuestionResponseInput> | QuestionResponseInput[];
  assessorReviews?: Record<string, AssessorReviewInput> | AssessorReviewInput[];
  evidenceCoverage?: EvidenceCoverageInput;
  inputRevision?: string;
}

export interface ScoringOptionValues {
  readonly IMPLEMENTED: number; // 100
  readonly PARTIALLY_IMPLEMENTED: number; // 50
  readonly NOT_IMPLEMENTED: number; // 0
}

export interface PenaltyTierConfig {
  readonly ceilingAmountInr: number;
  readonly ceilingCrores: number;
  readonly legalReference: string;
  readonly triggeringTopic: string;
}

export interface ScoringModelConfig {
  readonly modelCode: string;
  readonly modelVersion: string;
  readonly methodologyStatus: MethodologyApprovalStatus;
  readonly isOfficialScore: boolean;
  readonly optionValues: ScoringOptionValues;
  readonly unmappedQuestionCodes: readonly string[];
  readonly domainWeights: Readonly<Record<string, number>>;
  readonly penaltyTiers: Readonly<Record<string, PenaltyTierConfig>>;
  readonly statutoryDisclaimer: string;
}

export interface QuestionEvaluationDetail {
  questionCode: string;
  order: number;
  sectionCode: string;
  sectionTitle: string;
  canonicalControlId: string | null;
  mappingStatus: "MAPPED_PRIMARY" | "UNRESOLVED_PENDING_EXCEL_SHEET";
  isUnresolvedMapping: boolean;
  selectedOption: CanonicalResponseOption | null;
  commentsAndJustification: string | null;
  hasValidJustification: boolean;
  isAssessorApprovedExclusion: boolean;
  evaluationStatus: QuestionEvaluationStatus;
  isScored: boolean;
  isConclusive: boolean;
  isExcluded: boolean;
  rawPoints: number | null; // 100, 50, 0, or null
  maxPoints: number | null; // 100 or null
  maturityLevel: number | null; // 5.0, 2.5, 0.0 or null
  statutoryDomain: string | null;
  hasEvidenceAttached: boolean;
  explanation: string;
}

export interface SectionScoreDetail {
  sectionCode: string;
  sectionTitle: string;
  totalQuestions: number;
  answeredQuestions: number;
  conclusiveQuestions: number;
  scoredQuestions: number;
  unknownCount: number;
  approvedExcludedCount: number;
  unapprovedNaCount: number;
  unansweredCount: number;
  implementedCount: number;
  partiallyImplementedCount: number;
  notImplementedCount: number;
  unresolvedMappingCount: number;
  indicativePercentage: number | null; // e.g. 75.0%
  indicativeMaturityScore: number | null; // 0.00 to 5.00
  isComplete: boolean;
}

export interface StatutoryDomainScoreDetail {
  domainCode: string;
  domainTitle: string;
  statutoryWeight: number;
  mappedQuestionsCount: number;
  scoredQuestionsCount: number;
  gapCount: number;
  partialCount: number;
  approvedExcludedCount: number;
  indicativeDomainPercentage: number | null;
  domainMaturityScore: number | null; // 0.00 to 5.00
  potentialPenaltyCeiling: string | null;
  isExcluded: boolean;
}

export interface StatutoryDeficitItem {
  questionCode: string;
  sectionCode: string;
  canonicalControlId: string | null;
  statutoryDomain: string | null;
  severity: "CRITICAL_GAP" | "PARTIAL_DEFICIT" | "UNAPPROVED_EXCLUSION" | "UNVERIFIED_RISK";
  selectedOption: string;
  potentialPenaltyCeiling: string;
  description: string;
  remediationSummary: string;
}

export interface ScoringSummaryMetrics {
  totalCanonicalQuestions: number; // exactly 60
  totalAnswered: number;
  totalApplicable: number; // 60 - approvedExcluded
  totalConclusive: number; // Implemented + Partially implemented + Not implemented
  totalScored: number;
  totalUnknowns: number;
  totalApprovedExcluded: number;
  totalUnapprovedNa: number;
  totalUnanswered: number;
  totalUnresolvedMappings: number; // exactly 4
  implementedCount: number;
  partiallyImplementedCount: number;
  notImplementedCount: number; // Gaps

  // 4 STRICTLY SEPARATE MEASURES
  assessmentCompletenessPct: number; // (Answered / 60) * 100
  responseCoveragePct: number; // (Conclusive / Applicable) * 100
  evidenceCoveragePct: number; // (Questions with evidence / 60) * 100
  indicativeReadinessPercentage: number | null; // Average of scored questions (0.0 - 100.0)
  indicativeMaturityScore: number | null; // Normalized 0.00 - 5.00
  conservativeReadinessPercentage: number | null; // Treating unassessed/unknown as 0

  // Governance lifecycle flags
  isComplete: boolean;
  isIncomplete: boolean;
  hasUnknowns: boolean;
  hasUnapprovedExclusions: boolean;
  hasUnresolvedMappings: boolean;
  hasZeroScorableQuestions: boolean;
}

export interface ScoringCalculationMetadata {
  scoringModelCode: string;
  scoringModelVersion: string;
  methodologyStatus: MethodologyApprovalStatus;
  isOfficialScore: boolean;
  inputRevision: string;
  calculatedAt: string;
  calculationHash: string;
  assumptions: readonly string[];
  disclaimer: string;
  notices: readonly string[];
}

export interface ScoringEngineOutput {
  metrics: ScoringSummaryMetrics;
  questionEvaluations: QuestionEvaluationDetail[];
  sectionBreakdown: SectionScoreDetail[];
  domainBreakdown: StatutoryDomainScoreDetail[];
  unmappedQuestions: QuestionEvaluationDetail[];
  statutoryDeficits: StatutoryDeficitItem[];
  metadata: ScoringCalculationMetadata;
}

