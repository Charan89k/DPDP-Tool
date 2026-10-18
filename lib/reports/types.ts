/**
 * CloudE5 — Reporting Types & Schemas
 *
 * Provides type contracts for compiled report data, Word (.docx) generation,
 * cryptographic seals, and immutable report snapshots.
 */

import type { GapSeverity, GapType } from "../gaps/types.ts";

export type ReportFormat = "DOCX" | "PDF" | "XLSX";

export interface DomainFindingReportItem {
  domainCode: string;
  domainTitle: string;
  statutoryProvision: string;
  domainWeight: number;
  mappedQuestionsCount: number;
  answeredCount: number;
  criticalGapsCount: number;
  highGapsCount: number;
  readinessPct: number;
}

export interface QuestionFindingReportItem {
  questionCode: string;
  sectionTitle: string;
  questionText: string;
  selectedOption: string | null;
  commentsAndJustification: string | null;
  mappedControlId: string | null;
  controlTitle?: string;
  sourceProvision: string;
  statutoryDomain: string;
  gapType: GapType | "COMPLIANT_NO_GAP";
  gapSeverity: GapSeverity | "NONE";
  potentialPenaltyTier: string | null;
  potentialPenaltyCrores: number | null;
  evidenceReferences: string[];
  assessorFindings: string | null; // Censors for client roles
  recommendedRemediation: string;
  isUnresolvedMapping: boolean;
}

export interface UnresolvedQuestionReportItem {
  questionCode: string;
  sectionTitle: string;
  questionText: string;
  selectedOption: string | null;
  unresolvedReason: string;
}

export interface RemediationReportItem {
  id: string;
  questionCode: string | null;
  title: string;
  description: string;
  priority: string;
  targetDate: string;
  status: string;
  ownerName: string | null;
}

export interface ReportDocumentData {
  assessment: {
    id: string;
    engagementCode: string;
    title: string;
    status: string;
    targetFramework: string;
    startDate: string;
    targetCompletionDate: string | null;
    tenantId: string;
    tenantName: string;
    tenantSlug: string;
    industry: string | null;
    isSdf: boolean;
    dpoContactName: string | null;
    leadConsultantName: string | null;
    leadConsultantId: string | null;
    submittedAt: string | null;
    reviewedAt: string | null;
    approvedAt: string | null;
    issuedAt: string | null;
  };
  executiveSummary: {
    completenessPct: number;
    evidenceCoveragePct: number;
    provisionalReadinessPct: number;
    provisionalMaturityScore: number;
    criticalGapsCount: number;
    highGapsCount: number;
    mediumGapsCount: number;
    lowGapsCount: number;
    unresolvedGapsCount: number;
    totalGapsCount: number;
  };
  statutoryPenaltyExposure: {
    tier1Count: number;
    tier2Count: number;
    tier3Count: number;
    tier4Count: number;
    maxExposureCrores: number;
    disclaimer: string;
  };
  domainFindings: DomainFindingReportItem[];
  questionFindings: QuestionFindingReportItem[];
  unresolvedQuestions: UnresolvedQuestionReportItem[];
  remediationTasks: RemediationReportItem[];
  methodologyDisclosures: {
    scoringStatus: "PROVISIONAL_PENDING_APPROVAL";
    provisionalModel: "SCORING-V1-PROVISIONAL";
    governanceReference: string;
    nonCompensatoryDisclaimer: string;
    statutoryCeilingDisclaimer: string;
  };
  auditTrail: {
    reportTemplateVersion: string;
    isDraft: boolean;
    draftWatermarkNotice: string;
    generatedAt: string;
    generatedByUserId: string;
    generatedByUserName: string;
    approvedByUserId: string | null;
    approvedByUserName: string | null;
    approvedAt: string | null;
    datasetSha256: string;
    documentSha256?: string;
  };
}

export interface ReportSnapshotRecord {
  id: string;
  assessmentId: string;
  tenantId: string;
  reportType: ReportFormat;
  versionLabel: string;
  s3Key: string;
  fileSha256Hash: string;
  datasetSha256Hash: string;
  generatedByUserId: string;
  generatedByName?: string;
  leadApproverId: string;
  leadApproverName?: string;
  approvedAt: string;
  createdAt: string;
  isDraft: boolean;
  summaryMetadata: Record<string, unknown>;
}

