/**
 * CloudE5 — Deterministic Gap Analysis Engine
 *
 * Pure, side-effect-free calculation engine for compliance gap discovery,
 * explainable risk factor prioritization, and statutory domain rollups.
 *
 * Core Governance Standards:
 * 1. Factual Differentiation: Distinguishes observed gaps from legal conclusions.
 *    Does NOT declare legal violations solely from negative questionnaire answers.
 * 2. Strict Mapping Segregation: Preserves separation of 60 questions and 30 canonical controls.
 *    Questions GOV-005, GOV-006, GOV-008, APP-006 remain strictly unresolved and unmapped.
 * 3. Multi-Metric Separation: Completeness, Evidence Coverage, Readiness, and Gap Counts
 *    are computed and reported as independent measures.
 * 4. Explainability & Provenance: Each finding includes source question, option, client justification,
 *    evidence artifacts, mapped control, statutory provision, and rule rationale.
 */

import manifestData from "../../data/questionnaire_v1.json" with { type: "json" };
import controlsData from "../../data/dpdp_controls.json" with { type: "json" };
import { normalizeQuestionCode, calculateAssessmentScores } from "../scoring/engine.ts";
import {
  DEFAULT_PROVISIONAL_CONFIG,
  STATUTORY_LEGAL_DISCLAIMER,
} from "../scoring/config.ts";
import type {
  ScoringModelConfig,
  QuestionResponseInput,
  AssessorReviewInput,
  CanonicalResponseOption,
} from "../scoring/types.ts";
import type {
  ComplianceGapItem,
  GapType,
  GapSeverity,
  EvidenceStatus,
  FindingStage,
  AttachedEvidenceSummary,
  AssessorReviewSummary,
  ClarificationSummary,
  PotentialPenaltyCeiling,
  DomainGapSummary,
  SectionGapSummary,
  AssessmentTrendComparison,
  GapAnalysisSummary,
  GapAnalysisOutput,
} from "./types.ts";

export interface GapEngineInput {
  assessmentId: string;
  engagementCode?: string;
  tenantName?: string;
  assessmentTitle?: string;
  assessmentStatus?: string;
  frameworkName?: string;
  leadConsultantName?: string;
  isSdf?: boolean;
  responses: QuestionResponseInput[];
  assessorReviews?: AssessorReviewInput[];
  evidenceItems?: Array<{
    id: string;
    questionCode: string;
    fileName: string;
    fileSizeBytes?: number;
    status: string;
    uploadedAt?: string;
    verificationNotes?: string | null;
  }>;
  clarificationThreads?: Array<{
    id: string;
    questionCode: string;
    status: string;
    title: string;
    targetRole?: string | null;
    messageCount?: number;
  }>;
  priorAssessmentScores?: {
    id: string;
    engagementCode: string;
    calculatedAt: string;
    overallReadinessPct: number;
    overallMaturityScore: number;
    criticalGapsCount: number;
    totalGapsCount: number;
    completenessPct: number;
    questionResponses?: Record<string, string>;
  } | null;
}

function getPenaltyCeiling(
  domain: string | null,
  config: ScoringModelConfig
): PotentialPenaltyCeiling | null {
  if (!domain) return null;

  let tierKey: "TIER_1" | "TIER_2" | "TIER_3" | "TIER_4" | null = null;
  switch (domain) {
    case "SECURITY_SAFEGUARDS":
      tierKey = "TIER_1";
      break;
    case "BREACH_READINESS":
    case "CHILDREN_DISABLED_DATA":
      tierKey = "TIER_2";
      break;
    case "SDF_GOVERNANCE":
      tierKey = "TIER_3";
      break;
    default:
      tierKey = "TIER_4";
      break;
  }

  const tierConfig = config.penaltyTiers[tierKey];
  if (!tierConfig) return null;

  return {
    tier: tierKey,
    ceilingAmountInr: tierConfig.ceilingAmountInr,
    ceilingCrores: tierConfig.ceilingCrores,
    legalReference: tierConfig.legalReference,
    disclaimer: `Statutory penalty ceiling under ${tierConfig.legalReference} represents the maximum statutory exposure limit under Section 33(1), not an assessed fine. Any actual adjudication by the DPBI is subject to Section 28(2) mitigating factors.`,
  };
}

/**
 * Pure deterministic gap analysis and risk factor calculation.
 */
export function evaluateAssessmentGaps(
  input: GapEngineInput,
  config: ScoringModelConfig = DEFAULT_PROVISIONAL_CONFIG
): GapAnalysisOutput {
  // 1. Build lookup maps for responses, reviews, evidence, and clarifications
  const responseMap = new Map<string, QuestionResponseInput>();
  for (const r of input.responses || []) {
    if (r && r.questionCode) {
      responseMap.set(normalizeQuestionCode(r.questionCode), r);
    }
  }

  const reviewMap = new Map<string, AssessorReviewInput>();
  for (const rev of input.assessorReviews || []) {
    if (rev && rev.questionCode) {
      reviewMap.set(normalizeQuestionCode(rev.questionCode), rev);
    }
  }

  const evidenceMap = new Map<string, AttachedEvidenceSummary[]>();
  for (const ev of input.evidenceItems || []) {
    if (ev && ev.questionCode) {
      const code = normalizeQuestionCode(ev.questionCode);
      const list = evidenceMap.get(code) || [];
      list.push({
        id: ev.id,
        fileName: ev.fileName,
        fileSizeBytes: Number(ev.fileSizeBytes || 0),
        status: ev.status,
        uploadedAt: ev.uploadedAt || new Date().toISOString(),
        verificationNotes: ev.verificationNotes || null,
      });
      evidenceMap.set(code, list);
    }
  }

  const clarificationMap = new Map<string, ClarificationSummary[]>();
  for (const ct of input.clarificationThreads || []) {
    if (ct && ct.questionCode) {
      const code = normalizeQuestionCode(ct.questionCode);
      const list = clarificationMap.get(code) || [];
      list.push({
        threadId: ct.id,
        status: ct.status,
        title: ct.title,
        targetRole: ct.targetRole || null,
        messageCount: ct.messageCount || 1,
      });
      clarificationMap.set(code, list);
    }
  }

  // 2. Build canonical control metadata lookup from data/dpdp_controls.json
  const controlMap = new Map<string, (typeof controlsData)[0]>();
  for (const c of controlsData) {
    controlMap.set(c.control_id, c);
  }

  // 3. Delegate pure numeric scoring to Phase 3D.4 scoring engine
  const scoringOutput = calculateAssessmentScores(
    {
      assessmentId: input.assessmentId,
      engagementCode: input.engagementCode,
      assessmentStatus: input.assessmentStatus,
      responses: input.responses,
      assessorReviews: input.assessorReviews,
      evidenceCoverage: {
        totalEvidenceItems: input.evidenceItems?.length || 0,
        // Same rule as the scores endpoint (lib/scoring/service.ts): quarantined files never count.
        questionsWithEvidence: Array.from(evidenceMap.entries())
          .filter(([, items]) => items.some((item) => item.status !== "QUARANTINED"))
          .map(([code]) => code),
      },
    },
    config
  );

  // 4. Determine overall finding lifecycle stage
  const isFinalized =
    input.assessmentStatus === "LEAD_APPROVED" ||
    input.assessmentStatus === "FINAL_ISSUED" ||
    input.assessmentStatus === "REMEDIATION_ACTIVE" ||
    input.assessmentStatus === "ARCHIVED";

  // 5. Evaluate all 60 canonical questions for gaps
  const allGaps: ComplianceGapItem[] = [];
  const unresolvedGaps: ComplianceGapItem[] = [];

  let answeredCount = 0;
  let unansweredCount = 0;
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;
  let unapprovedNaCount = 0;
  let unknownCount = 0;
  let evidenceDeficiencyCount = 0;
  let openClarificationsCount = 0;
  let requiresValidationCount = 0;

  for (const q of manifestData.questions) {
    const normCode = normalizeQuestionCode(q.code);
    const resp = responseMap.get(normCode);
    const rev = reviewMap.get(normCode);
    const evList = evidenceMap.get(normCode) || [];
    const threadList = clarificationMap.get(normCode) || [];

    const isUnresolvedMapping =
      q.mapping_status === "UNRESOLVED_PENDING_EXCEL_SHEET" ||
      config.unmappedQuestionCodes.includes(normCode);

    const canonicalControlId = isUnresolvedMapping ? null : q.canonical_control_id;
    const ctrl = canonicalControlId ? controlMap.get(canonicalControlId) : null;
    const statutoryDomain = ctrl?.topic || null;
    const sourceProvision = ctrl?.source_provision || null;

    let selectedOption: CanonicalResponseOption | null = null;
    if (resp?.selectedOption) {
      const optStr = String(resp.selectedOption).trim();
      const matched = q.options.find((o) => o.toLowerCase() === optStr.toLowerCase());
      if (matched) {
        selectedOption = matched as CanonicalResponseOption;
      }
    }

    const commentsAndJustification = resp?.commentsAndJustification
      ? String(resp.commentsAndJustification).trim()
      : null;
    const hasValidJustification = Boolean(
      commentsAndJustification && commentsAndJustification.length > 0
    );

    const isExclusionApproved = Boolean(
      rev?.isExclusionApproved === true || rev?.reviewStatus === "EXCLUSION_VERIFIED"
    );

    // Assess Evidence Status
    let evidenceStatus: EvidenceStatus = "NO_EVIDENCE";
    if (evList.length > 0) {
      const hasRejected = evList.some(
        (e) => e.status === "REJECTED" || e.status === "QUARANTINED"
      );
      const allVerified = evList.every((e) => e.status === "VERIFIED");
      if (hasRejected) {
        evidenceStatus = "EVIDENCE_REJECTED";
      } else if (allVerified) {
        evidenceStatus = "EVIDENCE_VERIFIED";
      } else {
        evidenceStatus = "EVIDENCE_PENDING_REVIEW";
      }
    }

    // Assessor review details
    let assessorReviewSummary: AssessorReviewSummary | null = null;
    if (rev) {
      assessorReviewSummary = {
        reviewStatus: rev.reviewStatus || null,
        reviewFindings: rev.reviewFindings || null,
        evidenceDeficiencyNotes: rev.evidenceDeficiencyNotes || null,
        requiresFurtherValidation: Boolean(rev.requiresFurtherValidation),
      };
      if (rev.requiresFurtherValidation) {
        requiresValidationCount++;
      }
    }

    // Clarifications
    const openThreads = threadList.filter((t) => t.status === "OPEN");
    if (openThreads.length > 0) {
      openClarificationsCount += openThreads.length;
    }

    // Determine Finding Stage
    let findingStage: FindingStage = "PROVISIONAL_OBSERVATION";
    if (isFinalized) {
      findingStage = "APPROVED_FOR_REPORTING";
    } else if (rev && (rev.reviewStatus || rev.reviewFindings)) {
      findingStage = "ASSESSOR_REVIEWED";
    }

    const penaltyCeiling = getPenaltyCeiling(statutoryDomain, config);

    // Evaluate Gaps
    let isGap = false;
    let gapType: GapType = "UNANSWERED";
    let gapSeverity: GapSeverity = "INFORMATIONAL";
    let factualObservation = "";
    let explanation = "";
    let remediationGuidance = "";

    if (!selectedOption) {
      unansweredCount++;
      isGap = true;
      gapType = "UNANSWERED";
      gapSeverity = "MEDIUM_DEFICIT";
      mediumCount++;
      factualObservation = "Question has not been answered by the respondent.";
      explanation = `Section ${q.section_title}: No operational response furnished for ${normCode}. Incomplete assessment item.`;
      remediationGuidance =
        "Assign question to relevant business unit owner and capture current operational state.";
    } else {
      answeredCount++;

      switch (selectedOption) {
        case "Not implemented":
          isGap = true;
          gapType = "NEGATIVE_RESPONSE";
          if (
            statutoryDomain === "SECURITY_SAFEGUARDS" ||
            statutoryDomain === "BREACH_READINESS" ||
            statutoryDomain === "CHILDREN_DISABLED_DATA"
          ) {
            gapSeverity = "CRITICAL_GAP";
            criticalCount++;
          } else {
            gapSeverity = "HIGH_DEFICIT";
            highCount++;
          }
          factualObservation = `Respondent recorded safeguard as 'Not implemented'.`;
          explanation = `Absent safeguard on question ${normCode} (${q.section_title}). Operating without this safeguard represents a material exposure under ${
            sourceProvision || "statutory provisions"
          }.`;
          remediationGuidance =
            ctrl?.suggested_remediation ||
            "Develop policy, deploy technical safeguards, and document operational enforcement.";
          break;

        case "Partially implemented":
          isGap = true;
          gapType = "PARTIAL_RESPONSE";
          if (
            statutoryDomain === "SECURITY_SAFEGUARDS" ||
            statutoryDomain === "BREACH_READINESS"
          ) {
            gapSeverity = "HIGH_DEFICIT";
            highCount++;
          } else {
            gapSeverity = "MEDIUM_DEFICIT";
            mediumCount++;
          }
          factualObservation = `Respondent recorded safeguard as 'Partially implemented'.`;
          explanation = `Partial implementation on question ${normCode}. Incomplete operationalization or lack of systematic verification under ${
            sourceProvision || "statutory obligations"
          }.`;
          remediationGuidance =
            ctrl?.suggested_remediation ||
            "Close operational deficiencies, establish standard operating procedures, and verify technical controls.";
          break;

        case "Unknown / not verified":
          isGap = true;
          unknownCount++;
          gapType = "INFORMATION_UNCERTAINTY";
          gapSeverity = "INFORMATIONAL";
          factualObservation = `Respondent recorded posture as 'Unknown / not verified'.`;
          explanation = `Uncertainty gap on question ${normCode}. Factual discovery required to determine whether safeguards exist.`;
          remediationGuidance =
            "Conduct internal interviews with IT/Security/Legal stakeholders to ascertain factual status.";
          break;

        case "Not applicable — justification required":
          if (hasValidJustification && isExclusionApproved) {
            // Approved exclusion: NOT a gap
            isGap = false;
          } else if (!hasValidJustification) {
            isGap = true;
            unapprovedNaCount++;
            gapType = "UNAPPROVED_EXCLUSION";
            gapSeverity = "HIGH_DEFICIT";
            highCount++;
            factualObservation = `Selected 'Not applicable' without mandatory non-empty written justification.`;
            explanation = `Unsubstantiated exclusion on question ${normCode}. Under DPDPA rules, statutory requirements cannot be excluded without documented factual rationale.`;
            remediationGuidance =
              "Provide documented factual rationale explaining why this obligation does not apply to the data fiduciary.";
          } else {
            // Justification provided, awaiting assessor approval
            isGap = true;
            unapprovedNaCount++;
            gapType = "UNAPPROVED_EXCLUSION";
            gapSeverity = "MEDIUM_DEFICIT";
            mediumCount++;
            factualObservation = `Selected 'Not applicable' with written justification awaiting authorized assessor verification.`;
            explanation = `Provisional exclusion on question ${normCode}. Awaiting lead consultant verification under DEC-01. Remains in applicable scope until reviewed.`;
            remediationGuidance =
              "Submit exclusion rationale and supporting evidence to assigned lead consultant for validation.";
          }
          break;

        case "Implemented":
          // Check for evidence deficiency
          if (evList.length === 0) {
            isGap = true;
            evidenceDeficiencyCount++;
            gapType = "EVIDENCE_DEFICIENCY";
            gapSeverity =
              statutoryDomain === "SECURITY_SAFEGUARDS" ||
              statutoryDomain === "BREACH_READINESS"
                ? "HIGH_DEFICIT"
                : "LOW_DEFICIT";
            if (gapSeverity === "HIGH_DEFICIT") highCount++;
            else lowCount++;
            factualObservation = `Respondent marked 'Implemented', but no supporting documentary evidence has been uploaded.`;
            explanation = `Substantiation deficit on question ${normCode}. Self-attestation is unverified without documentary artifacts.`;
            remediationGuidance =
              ctrl?.implementation_expectations ||
              "Upload policies, technical architecture screenshots, or operational audit logs to verify safeguard.";
          } else if (evidenceStatus === "EVIDENCE_REJECTED") {
            isGap = true;
            evidenceDeficiencyCount++;
            gapType = "EVIDENCE_DEFICIENCY";
            gapSeverity = "HIGH_DEFICIT";
            highCount++;
            factualObservation = `Evidence submitted for 'Implemented' status was inspected and rejected by CloudE5 assessor.`;
            // Assessor deficiency notes are internal working papers (redacted for customers), so
            // the customer-visible explanation never copies them.
            explanation = `Assessor rejected attached evidence due to deficiencies or insufficient proof.`;
            remediationGuidance =
              "Review assessor deficiency notes and upload corrected, unmasked, verifiable artifacts.";
          }
          break;
      }
    }

    const gapItem: ComplianceGapItem = {
      id: `GAP-${normCode}`,
      questionCode: normCode,
      order: q.order,
      sectionCode: q.section_code,
      sectionTitle: q.section_title,
      questionText: q.text,
      selectedOption,
      commentsAndJustification,
      hasValidJustification,
      mappedControlId: canonicalControlId,
      mappedControlTitle: ctrl?.title || null,
      sourceProvision,
      statutoryDomain,
      isUnresolvedMapping,
      mappingNotes: q.mapping_notes || null,
      gapType,
      gapSeverity,
      findingStage,
      evidenceStatus,
      evidenceItems: evList,
      evidenceCount: evList.length,
      assessorReview: assessorReviewSummary,
      clarifications: threadList,
      potentialPenaltyCeiling: penaltyCeiling,
      factualObservation,
      explanation,
      remediationGuidance,
    };

    if (isUnresolvedMapping) {
      unresolvedGaps.push(gapItem);
    }

    if (isGap) {
      allGaps.push(gapItem);
    }
  }

  // 6. Compute Section Gap Summaries across all 8 canonical sections
  const sectionSummaries: SectionGapSummary[] = manifestData.sections.map((sec) => {
    const secQuestions = manifestData.questions.filter((q) => q.section_code === sec.code);
    let secAnswered = 0;
    let secUnanswered = 0;
    let secImplemented = 0;
    let secPartially = 0;
    let secNotImplemented = 0;
    let secUnknown = 0;
    let secExcluded = 0;
    let secGaps = 0;

    for (const q of secQuestions) {
      const normCode = normalizeQuestionCode(q.code);
      const resp = responseMap.get(normCode);
      const rev = reviewMap.get(normCode);

      if (!resp?.selectedOption) {
        secUnanswered++;
      } else {
        secAnswered++;
        const opt = String(resp.selectedOption).toLowerCase();
        if (opt.startsWith("implemented")) secImplemented++;
        else if (opt.startsWith("partially")) secPartially++;
        else if (opt.startsWith("not implemented")) secNotImplemented++;
        else if (opt.startsWith("unknown")) secUnknown++;
        else if (opt.startsWith("not applicable")) {
          const isAppr = Boolean(rev?.isExclusionApproved || rev?.reviewStatus === "EXCLUSION_VERIFIED");
          if (isAppr) secExcluded++;
        }
      }

      if (allGaps.some((g) => g.questionCode === normCode)) {
        secGaps++;
      }
    }

    const denom = secQuestions.length > 0 ? secQuestions.length : 1;
    const completionPct = Math.round((secAnswered / denom) * 1000) / 10;

    return {
      sectionCode: sec.code,
      sectionTitle: sec.title,
      totalQuestions: secQuestions.length,
      answeredCount: secAnswered,
      unansweredCount: secUnanswered,
      implementedCount: secImplemented,
      partiallyImplementedCount: secPartially,
      notImplementedCount: secNotImplemented,
      unknownCount: secUnknown,
      excludedCount: secExcluded,
      totalGapsCount: secGaps,
      completionPct,
    };
  });

  // 7. Compute Domain Gap Summaries across 13 statutory domains
  const domainSummaries: DomainGapSummary[] = scoringOutput.domainBreakdown.map((ds) => {
    const domainGaps = allGaps.filter((g) => g.statutoryDomain === ds.domainCode);
    const criticalDomainGaps = domainGaps.filter((g) => g.gapSeverity === "CRITICAL_GAP");
    const domainCtrl = controlsData.find((c) => c.topic === ds.domainCode);
    const statutoryProvision = domainCtrl?.source_provision || "DPDPA 2023";

    let implementedCount = 0;
    let partiallyCount = 0;
    let notImplementedCount = 0;
    let unknownCount = 0;
    let unansweredCount = 0;

    for (const q of manifestData.questions) {
      if (q.canonical_control_id) {
        const c = controlMap.get(q.canonical_control_id);
        if (c?.topic === ds.domainCode) {
          const norm = normalizeQuestionCode(q.code);
          const resp = responseMap.get(norm);
          if (!resp?.selectedOption) {
            unansweredCount++;
          } else {
            const opt = String(resp.selectedOption).toLowerCase();
            if (opt.startsWith("implemented")) implementedCount++;
            else if (opt.startsWith("partially")) partiallyCount++;
            else if (opt.startsWith("not implemented")) notImplementedCount++;
            else if (opt.startsWith("unknown")) unknownCount++;
          }
        }
      }
    }

    const answered = ds.mappedQuestionsCount - unansweredCount;
    const completionPct =
      ds.mappedQuestionsCount > 0
        ? Math.round((answered / ds.mappedQuestionsCount) * 1000) / 10
        : 100;

    return {
      domainCode: ds.domainCode,
      domainTitle: ds.domainTitle,
      statutoryProvision,
      domainWeight: ds.statutoryWeight,
      totalQuestions: ds.mappedQuestionsCount,
      implementedCount,
      partiallyImplementedCount: partiallyCount,
      notImplementedCount,
      unknownCount,
      excludedCount: ds.approvedExcludedCount,
      unansweredCount,
      criticalGapsCount: criticalDomainGaps.length,
      totalGapsCount: domainGaps.length,
      completionPct,
      readinessPct: ds.indicativeDomainPercentage ?? 0,
    };
  });

  // 8. Compute Assessment Trend Comparison
  let trendComparison: AssessmentTrendComparison = {
    hasPriorAssessment: false,
    priorAssessmentId: null,
    priorEngagementCode: null,
    priorCalculatedAt: null,
    readinessPctDelta: null,
    maturityScoreDelta: null,
    completenessPctDelta: null,
    criticalGapsDelta: null,
    totalGapsDelta: null,
    remediatedQuestions: [],
    regressedQuestions: [],
    comparisonNotes: "No prior baseline assessment cycle found for comparison.",
  };

  if (input.priorAssessmentScores) {
    const prior = input.priorAssessmentScores;
    const curReadiness = scoringOutput.metrics.indicativeReadinessPercentage ?? 0;
    const curMaturity = scoringOutput.metrics.indicativeMaturityScore ?? 0;
    const curCompleteness = scoringOutput.metrics.assessmentCompletenessPct;
    const curCritical = criticalCount;
    const curTotalGaps = allGaps.length;

    const readinessDelta = Math.round((curReadiness - prior.overallReadinessPct) * 10) / 10;
    const maturityDelta = Math.round((curMaturity - prior.overallMaturityScore) * 100) / 100;
    const completenessDelta = Math.round((curCompleteness - prior.completenessPct) * 10) / 10;
    const criticalDelta = curCritical - prior.criticalGapsCount;
    const totalGapsDelta = curTotalGaps - prior.totalGapsCount;

    const remediated: string[] = [];
    const regressed: string[] = [];

    if (prior.questionResponses) {
      for (const [code, priorOpt] of Object.entries(prior.questionResponses)) {
        const norm = normalizeQuestionCode(code);
        const curResp = responseMap.get(norm);
        const curOpt = curResp?.selectedOption;
        if (priorOpt === "Not implemented" && curOpt === "Implemented") {
          remediated.push(norm);
        } else if (priorOpt === "Implemented" && curOpt === "Not implemented") {
          regressed.push(norm);
        }
      }
    }

    trendComparison = {
      hasPriorAssessment: true,
      priorAssessmentId: prior.id,
      priorEngagementCode: prior.engagementCode,
      priorCalculatedAt: prior.calculatedAt,
      readinessPctDelta: readinessDelta,
      maturityScoreDelta: maturityDelta,
      completenessPctDelta: completenessDelta,
      criticalGapsDelta: criticalDelta,
      totalGapsDelta: totalGapsDelta,
      remediatedQuestions: remediated,
      regressedQuestions: regressed,
      comparisonNotes: `Comparative evaluation against baseline ${prior.engagementCode}: Readiness shifted by ${
        readinessDelta >= 0 ? "+" : ""
      }${readinessDelta}%, Critical Gaps delta: ${criticalDelta >= 0 ? "+" : ""}${criticalDelta}.`,
    };
  }

  // 9. Construct summary metrics
  const summary: GapAnalysisSummary = {
    totalQuestions: manifestData.total_questions,
    answeredQuestions: answeredCount,
    unansweredQuestions: unansweredCount,
    completenessPct: scoringOutput.metrics.assessmentCompletenessPct,
    responseCoveragePct: scoringOutput.metrics.responseCoveragePct,
    evidenceCoveragePct: scoringOutput.metrics.evidenceCoveragePct,
    provisionalReadinessPct: scoringOutput.metrics.indicativeReadinessPercentage ?? 0,
    provisionalMaturityScore: scoringOutput.metrics.indicativeMaturityScore ?? 0,
    totalGapsCount: allGaps.length,
    criticalGapsCount: criticalCount,
    highDeficitsCount: highCount,
    mediumDeficitsCount: mediumCount,
    lowDeficitsCount: lowCount,
    unverifiedUnknownsCount: unknownCount,
    unapprovedExclusionsCount: unapprovedNaCount,
    evidenceDeficienciesCount: evidenceDeficiencyCount,
    unresolvedMappingsCount: unresolvedGaps.length,
    openClarificationsCount,
    requiresFurtherValidationCount: requiresValidationCount,
    scoringModelCode: scoringOutput.metadata.scoringModelCode,
    scoringModelVersion: scoringOutput.metadata.scoringModelVersion,
    methodologyStatus: scoringOutput.metadata.methodologyStatus,
    calculationHash: scoringOutput.metadata.calculationHash,
    calculatedAt: scoringOutput.metadata.calculatedAt,
    statutoryDisclaimer: STATUTORY_LEGAL_DISCLAIMER,
  };

  return {
    assessmentId: input.assessmentId,
    engagementCode: input.engagementCode || "DPDP-ENG-001",
    tenantName: input.tenantName || "Client Organization",
    assessmentTitle: input.assessmentTitle || "DPDP Compliance Gap Assessment",
    assessmentStatus: input.assessmentStatus || "IN_PROGRESS",
    frameworkName: input.frameworkName || "DPDPA-2023-V1.0",
    leadConsultantName: input.leadConsultantName || "CloudE5 Lead",
    isSdf: Boolean(input.isSdf),
    summary,
    gaps: allGaps,
    sectionSummaries,
    domainSummaries,
    unresolvedMappingItems: unresolvedGaps,
    trendComparison,
    governanceNotes: [
      "1. Factual Gap Separation: Observed deficiencies reflect respondent declarations and evidence state, not judicial compliance determinations.",
      "2. Provisional Methodology Notice: Scoring values and weights operate under SCORING-V1-PROVISIONAL pending formal methodology approval (DEC-08, DEC-09).",
      "3. Statutory Exposure Limits: Penalty tier amounts represent maximum statutory limits under Section 33(1), subject to Section 28(2) mitigation factors.",
      "4. Unresolved Mappings: Questions GOV-005, GOV-006, GOV-008, APP-006 remain isolated from statutory controls pending official Excel build sheet mappings.",
    ],
  };
}

