/**
 * TLI DPDP Compliance Gap Analysis Tool — Gap Analysis & Risk Prioritization Types
 *
 * Grounded in canonical questionnaire manifest (60 questions), 30 canonical controls,
 * 13 statutory domains, and non-compensatory dual-metric governance specifications (DEC-01, DEC-08, DEC-10).
 */

import type { CanonicalResponseOption } from "../questionnaire/types.ts";
import type { QuestionEvaluationDetail, StatutoryDeficitItem } from "../scoring/types.ts";

export type GapType =
  | "NEGATIVE_RESPONSE"        // Not implemented
  | "PARTIAL_RESPONSE"         // Partially implemented
  | "INFORMATION_UNCERTAINTY"  // Unknown / not verified
  | "UNAPPROVED_EXCLUSION"     // Not applicable without approved justification
  | "UNANSWERED"               // Unanswered question
  | "EVIDENCE_DEFICIENCY"      // Missing, rejected, or unvalidated evidence
  | "UNRESOLVED_MAPPING";      // GOV-005, GOV-006, GOV-008, APP-006

export type GapSeverity =
  | "CRITICAL_GAP"   // Missing safeguard on statutory mandate
  | "HIGH_DEFICIT"   // Partial safeguard on Tier 1/2 domain or rejected critical evidence
  | "MEDIUM_DEFICIT" // Partial safeguard on other domains or unapproved exclusion
  | "LOW_DEFICIT"    // Operational or documentation deficiency
  | "INFORMATIONAL"; // Unknown answer or unmapped question

export type EvidenceStatus =
  | "NO_EVIDENCE"
  | "EVIDENCE_PENDING_REVIEW"
  | "EVIDENCE_REJECTED"
  | "EVIDENCE_VERIFIED";

export type FindingStage =
  | "PROVISIONAL_OBSERVATION" // Automated finding from respondent answer
  | "ASSESSOR_REVIEWED"       // Assessor findings recorded
  | "APPROVED_FOR_REPORTING";  // Finalized / approved by lead consultant

export interface AttachedEvidenceSummary {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  status: string; // RECEIVED, REVIEWED, VERIFIED, REJECTED, QUARANTINED
  uploadedAt: string;
  verificationNotes?: string | null;
}

export interface AssessorReviewSummary {
  reviewedByUserId?: string | null;
  reviewedAt?: string | null;
  reviewStatus?: string | null;
  reviewFindings?: string | null;
  evidenceDeficiencyNotes?: string | null;
  requiresFurtherValidation: boolean;
}

export interface ClarificationSummary {
  threadId: string;
  status: string; // OPEN, RESOLVED
  title: string;
  targetRole?: string | null;
  messageCount: number;
}

export interface PotentialPenaltyCeiling {
  tier: "TIER_1" | "TIER_2" | "TIER_3" | "TIER_4" | null;
  ceilingAmountInr: number;
  ceilingCrores: number;
  legalReference: string;
  disclaimer: string;
}

export interface ComplianceGapItem {
  id: string; // e.g. GAP-GOV-001
  questionCode: string; // normalized e.g. GOV-001
  order: number;
  sectionCode: string; // e.g. GOV
  sectionTitle: string; // e.g. Governance and accountability
  questionText: string;
  selectedOption: CanonicalResponseOption | null;
  commentsAndJustification: string | null;
  hasValidJustification: boolean;
  
  // Mapping relationships
  mappedControlId: string | null; // e.g. TLI-DPDP-FID-01
  mappedControlTitle: string | null;
  sourceProvision: string | null; // e.g. Section 8(1)
  statutoryDomain: string | null; // e.g. FIDUCIARY_DUTIES
  isUnresolvedMapping: boolean;
  mappingNotes?: string | null;
  
  // Gap Classification
  gapType: GapType;
  gapSeverity: GapSeverity;
  findingStage: FindingStage;
  
  // Evidence & Clarification
  evidenceStatus: EvidenceStatus;
  evidenceItems: AttachedEvidenceSummary[];
  evidenceCount: number;
  
  assessorReview: AssessorReviewSummary | null;
  clarifications: ClarificationSummary[];
  
  // Potential exposure (provisional, non-automatic)
  potentialPenaltyCeiling: PotentialPenaltyCeiling | null;
  
  // Explainability
  factualObservation: string;
  explanation: string;
  remediationGuidance: string;
}

export interface DomainGapSummary {
  domainCode: string;
  domainTitle: string;
  statutoryProvision: string;
  domainWeight: number;
  totalQuestions: number;
  implementedCount: number;
  partiallyImplementedCount: number;
  notImplementedCount: number;
  unknownCount: number;
  excludedCount: number;
  unansweredCount: number;
  criticalGapsCount: number;
  totalGapsCount: number;
  completionPct: number;
  readinessPct: number;
}

export interface SectionGapSummary {
  sectionCode: string;
  sectionTitle: string;
  totalQuestions: number;
  answeredCount: number;
  unansweredCount: number;
  implementedCount: number;
  partiallyImplementedCount: number;
  notImplementedCount: number;
  unknownCount: number;
  excludedCount: number;
  totalGapsCount: number;
  completionPct: number;
}

export interface AssessmentTrendComparison {
  hasPriorAssessment: boolean;
  priorAssessmentId: string | null;
  priorEngagementCode: string | null;
  priorCalculatedAt: string | null;
  readinessPctDelta: number | null;
  maturityScoreDelta: number | null;
  completenessPctDelta: number | null;
  criticalGapsDelta: number | null;
  totalGapsDelta: number | null;
  remediatedQuestions: string[];
  regressedQuestions: string[];
  comparisonNotes: string;
}

export interface GapAnalysisSummary {
  totalQuestions: number; // 60
  answeredQuestions: number;
  unansweredQuestions: number;
  completenessPct: number;
  responseCoveragePct: number;
  evidenceCoveragePct: number;
  provisionalReadinessPct: number;
  provisionalMaturityScore: number;
  
  totalGapsCount: number;
  criticalGapsCount: number;
  highDeficitsCount: number;
  mediumDeficitsCount: number;
  lowDeficitsCount: number;
  unverifiedUnknownsCount: number;
  unapprovedExclusionsCount: number;
  evidenceDeficienciesCount: number;
  unresolvedMappingsCount: number;
  
  openClarificationsCount: number;
  requiresFurtherValidationCount: number;
  
  scoringModelCode: string;
  scoringModelVersion: string;
  methodologyStatus: string;
  calculationHash: string;
  calculatedAt: string;
  statutoryDisclaimer: string;
}

export interface GapAnalysisOutput {
  assessmentId: string;
  engagementCode: string;
  tenantName: string;
  assessmentTitle: string;
  assessmentStatus: string;
  frameworkName: string;
  leadConsultantName: string;
  isSdf: boolean;
  
  summary: GapAnalysisSummary;
  gaps: ComplianceGapItem[];
  sectionSummaries: SectionGapSummary[];
  domainSummaries: DomainGapSummary[];
  unresolvedMappingItems: ComplianceGapItem[];
  trendComparison: AssessmentTrendComparison;
  
  governanceNotes: string[];
}

