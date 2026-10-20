/**
 * CloudE5 — Deterministic Scoring Engine
 *
 * Pure, side-effect-free calculation domain engine implementing the non-compensatory
 * dual-metric evaluation model.
 *
 * Core Governance Guarantees:
 * 1. Deterministic & Reproducible: Same inputs + config yields identical cryptographic hash and results.
 * 2. Non-Compensatory Dual Metric: Readiness percentage never obscures statutory deficits or gaps.
 * 3. 4 Independent Measures: Completeness, Response Coverage, Evidence Coverage, and Readiness Score.
 * 4. Explicit Treatment of Exceptions:
 *    - 'Unknown / not verified' is tracked unscored; never silently converted to 0 or 100.
 *    - 'Not applicable' requires non-empty written justification AND authorized assessor approval to be excluded.
 *    - Questions GOV-005, GOV-006, GOV-008, APP-006 remain strictly unresolved and unmapped to statutory controls.
 * 5. Safe Math: Zero division guarded, precision bounded (1 decimal for %, 2 for maturity).
 */

import crypto from "node:crypto";
import manifestData from "../../data/questionnaire_v1.json" with { type: "json" };
import controlsData from "../../data/dpdp_controls.json" with { type: "json" };
import {
  DEFAULT_PROVISIONAL_CONFIG,
  PROVISIONAL_ASSUMPTIONS,
  STATUTORY_DOMAIN_WEIGHTS,
} from "./config.ts";
import type {
  ScoringCalculationInput,
  ScoringModelConfig,
  ScoringEngineOutput,
  QuestionEvaluationDetail,
  SectionScoreDetail,
  StatutoryDomainScoreDetail,
  StatutoryDeficitItem,
  ScoringSummaryMetrics,
  ScoringCalculationMetadata,
  QuestionResponseInput,
  AssessorReviewInput,
  CanonicalResponseOption,
  QuestionEvaluationStatus,
} from "./types.ts";

/**
 * Normalizes question codes across 2-digit and 3-digit representations
 * e.g. "GOV-01" -> "GOV-001", "DAT-01" -> "DAT-001", "GOV-001" -> "GOV-001"
 */
export function normalizeQuestionCode(code: string): string {
  if (!code) return "";
  const trimmed = code.trim().toUpperCase();
  const match = trimmed.match(/^([A-Z]{3})-(\d{1,3})$/);
  if (match) {
    const prefix = match[1];
    const num = match[2].padStart(3, "0");
    return `${prefix}-${num}`;
  }
  return trimmed;
}

function roundTo1Decimal(val: number): number {
  return Math.round(val * 10) / 10;
}

function roundTo2Decimals(val: number): number {
  return Math.round(val * 100) / 100;
}

/**
 * Pure deterministic assessment scoring calculation.
 */
export function calculateAssessmentScores(
  input: ScoringCalculationInput,
  config: ScoringModelConfig = DEFAULT_PROVISIONAL_CONFIG
): ScoringEngineOutput {
  // 1. Index responses by normalized question code
  const responseMap = new Map<string, QuestionResponseInput>();
  if (Array.isArray(input.responses)) {
    for (const r of input.responses) {
      if (r && r.questionCode) {
        responseMap.set(normalizeQuestionCode(r.questionCode), r);
      }
    }
  } else if (input.responses && typeof input.responses === "object") {
    for (const [key, val] of Object.entries(input.responses)) {
      responseMap.set(normalizeQuestionCode(val.questionCode || key), val);
    }
  }

  // 2. Index assessor reviews by normalized question code
  const reviewMap = new Map<string, AssessorReviewInput>();
  if (Array.isArray(input.assessorReviews)) {
    for (const rev of input.assessorReviews) {
      if (rev && rev.questionCode) {
        reviewMap.set(normalizeQuestionCode(rev.questionCode), rev);
      }
    }
  } else if (input.assessorReviews && typeof input.assessorReviews === "object") {
    for (const [key, val] of Object.entries(input.assessorReviews)) {
      reviewMap.set(normalizeQuestionCode(val.questionCode || key), val);
    }
  }

  // 3. Index evidence coverage by normalized question code. Only canonical questions count: evidence
  //    filed under a control code or "GENERIC" must not inflate coverage.
  const canonicalCodes = new Set(manifestData.questions.map((q) => normalizeQuestionCode(q.code)));
  const evidenceCodeSet = new Set<string>();
  if (input.evidenceCoverage?.questionsWithEvidence) {
    for (const c of input.evidenceCoverage.questionsWithEvidence) {
      const code = normalizeQuestionCode(c);
      if (canonicalCodes.has(code)) evidenceCodeSet.add(code);
    }
  }

  // 4. Build canonical control-to-domain map from authoritative data/dpdp_controls.json
  const controlDomainMap = new Map<string, { topic: string; title: string }>();
  for (const c of controlsData) {
    controlDomainMap.set(c.control_id, {
      topic: c.topic,
      title: c.title,
    });
  }

  // 5. Evaluate all 60 canonical questions in deterministic sequence
  const questionEvaluations: QuestionEvaluationDetail[] = [];
  const unmappedQuestions: QuestionEvaluationDetail[] = [];
  const deficits: StatutoryDeficitItem[] = [];

  let totalAnswered = 0;
  let totalApprovedExcluded = 0;
  let totalUnapprovedNa = 0;
  let totalUnknowns = 0;
  let totalConclusive = 0;
  let totalScored = 0;
  let totalUnanswered = 0;
  let implementedCount = 0;
  let partiallyImplementedCount = 0;
  let notImplementedCount = 0;
  let sumOfRawPoints = 0;

  for (const q of manifestData.questions) {
    const normCode = normalizeQuestionCode(q.code);
    const resp = responseMap.get(normCode);
    const rev = reviewMap.get(normCode);
    const hasEvidence = evidenceCodeSet.has(normCode);

    const isUnresolvedMapping =
      q.mapping_status === "UNRESOLVED_PENDING_EXCEL_SHEET" ||
      config.unmappedQuestionCodes.includes(normCode);

    const canonicalControlId = isUnresolvedMapping ? null : q.canonical_control_id;
    const ctrlInfo = canonicalControlId ? controlDomainMap.get(canonicalControlId) : null;
    const statutoryDomain = ctrlInfo?.topic || null;

    let selectedOption: CanonicalResponseOption | null = null;
    if (resp?.selectedOption) {
      const optStr = String(resp.selectedOption).trim();
      const matched = q.options.find(
        (o) => o.toLowerCase() === optStr.toLowerCase()
      );
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

    const isAssessorApprovedExclusion = Boolean(
      rev?.isExclusionApproved === true || rev?.reviewStatus === "EXCLUSION_VERIFIED"
    );

    let evaluationStatus: QuestionEvaluationStatus = "UNANSWERED";
    let isScored = false;
    let isConclusive = false;
    let isExcluded = false;
    let rawPoints: number | null = null;
    let maxPoints: number | null = null;
    let maturityLevel: number | null = null;
    let explanation = "";

    if (!selectedOption) {
      evaluationStatus = "UNANSWERED";
      totalUnanswered++;
      explanation = "Question has not been answered by respondent.";
    } else {
      totalAnswered++;

      switch (selectedOption) {
        case "Implemented":
          evaluationStatus = "SCORED";
          isScored = true;
          isConclusive = true;
          rawPoints = config.optionValues.IMPLEMENTED; // 100
          maxPoints = 100;
          maturityLevel = 5.0;
          implementedCount++;
          sumOfRawPoints += rawPoints;
          totalScored++;
          totalConclusive++;
          explanation = `Fully implemented compliance safeguard (${rawPoints} points).`;
          break;

        case "Partially implemented":
          evaluationStatus = "SCORED";
          isScored = true;
          isConclusive = true;
          rawPoints = config.optionValues.PARTIALLY_IMPLEMENTED; // 50
          maxPoints = 100;
          maturityLevel = 2.5;
          partiallyImplementedCount++;
          sumOfRawPoints += rawPoints;
          totalScored++;
          totalConclusive++;
          explanation = `Partially implemented safeguard (${rawPoints} points). Operational deficit noted.`;

          deficits.push({
            questionCode: normCode,
            sectionCode: q.section_code,
            canonicalControlId,
            statutoryDomain,
            severity: "PARTIAL_DEFICIT",
            selectedOption,
            potentialPenaltyCeiling: getPenaltyCeilingForDomain(statutoryDomain, config),
            description: `Partially implemented safeguard on question ${normCode} (${q.section_title}).`,
            remediationSummary:
              "Complete technical implementation and establish formal operational verification.",
          });
          break;

        case "Not implemented":
          evaluationStatus = "SCORED";
          isScored = true;
          isConclusive = true;
          rawPoints = config.optionValues.NOT_IMPLEMENTED; // 0
          maxPoints = 100;
          maturityLevel = 0.0;
          notImplementedCount++;
          sumOfRawPoints += rawPoints;
          totalScored++;
          totalConclusive++;
          explanation = `Safeguard absent / not implemented (${rawPoints} points). Critical compliance gap.`;

          deficits.push({
            questionCode: normCode,
            sectionCode: q.section_code,
            canonicalControlId,
            statutoryDomain,
            severity: "CRITICAL_GAP",
            selectedOption,
            potentialPenaltyCeiling: getPenaltyCeilingForDomain(statutoryDomain, config),
            description: `Absent safeguard on question ${normCode}: ${q.text.slice(0, 90)}...`,
            remediationSummary:
              "Prioritize remediation: design policy, implement technical safeguards, and attach verification evidence.",
          });
          break;

        case "Unknown / not verified":
          evaluationStatus = "UNSCORED_UNKNOWN";
          totalUnknowns++;
          explanation =
            "Unscored pending review. Question answered as 'Unknown / not verified'; not converted to zero or implemented.";

          deficits.push({
            questionCode: normCode,
            sectionCode: q.section_code,
            canonicalControlId,
            statutoryDomain,
            severity: "UNVERIFIED_RISK",
            selectedOption,
            potentialPenaltyCeiling: getPenaltyCeilingForDomain(statutoryDomain, config),
            description: `Unverified compliance posture on question ${normCode}.`,
            remediationSummary:
              "Conduct internal discovery to ascertain current implementation state before final audit sign-off.",
          });
          break;

        case "Not applicable — justification required":
          if (hasValidJustification && isAssessorApprovedExclusion) {
            evaluationStatus = "EXCLUDED_APPROVED";
            isExcluded = true;
            totalApprovedExcluded++;
            explanation =
              "Excluded from applicable scope: valid written justification provided and approved by authorized assessor.";
          } else {
            evaluationStatus = "UNAPPROVED_NA";
            totalUnapprovedNa++;
            explanation = !hasValidJustification
              ? "Unapproved exclusion: 'Not applicable' chosen without mandatory non-empty written justification. Remains in applicable scope."
              : "Unapproved exclusion: 'Not applicable' with justification awaiting authorized assessor verification. Remains in applicable scope.";

            deficits.push({
              questionCode: normCode,
              sectionCode: q.section_code,
              canonicalControlId,
              statutoryDomain,
              severity: "UNAPPROVED_EXCLUSION",
              selectedOption,
              potentialPenaltyCeiling: getPenaltyCeilingForDomain(statutoryDomain, config),
              description: `Unapproved exclusion on question ${normCode}: ${explanation}`,
              remediationSummary: !hasValidJustification
                ? "Provide detailed written factual justification explaining why this statutory requirement does not apply."
                : "Submit to assigned Lead Consultant for exclusion verification review.",
            });
          }
          break;
      }
    }

    const evalDetail: QuestionEvaluationDetail = {
      questionCode: normCode,
      order: q.order,
      sectionCode: q.section_code,
      sectionTitle: q.section_title,
      canonicalControlId,
      mappingStatus: isUnresolvedMapping ? "UNRESOLVED_PENDING_EXCEL_SHEET" : "MAPPED_PRIMARY",
      isUnresolvedMapping,
      selectedOption,
      commentsAndJustification,
      hasValidJustification,
      isAssessorApprovedExclusion,
      evaluationStatus,
      isScored,
      isConclusive,
      isExcluded,
      rawPoints,
      maxPoints,
      maturityLevel,
      statutoryDomain,
      hasEvidenceAttached: hasEvidence,
      explanation,
    };

    questionEvaluations.push(evalDetail);

    if (isUnresolvedMapping) {
      unmappedQuestions.push(evalDetail);
    }
  }

  // 6. Compute Strictly Separated Metrics
  const totalCanonicalQuestions = 60;
  const totalApplicable = Math.max(0, totalCanonicalQuestions - totalApprovedExcluded);
  const questionsWithEvidenceCount = evidenceCodeSet.size;

  const assessmentCompletenessPct = roundTo1Decimal(
    (totalAnswered / totalCanonicalQuestions) * 100
  );

  const responseCoveragePct =
    totalApplicable > 0
      ? roundTo1Decimal((totalConclusive / totalApplicable) * 100)
      : 100.0;

  const evidenceCoveragePct = roundTo1Decimal(
    (Math.min(60, questionsWithEvidenceCount) / totalCanonicalQuestions) * 100
  );

  const indicativeReadinessPercentage =
    totalScored > 0 ? roundTo1Decimal(sumOfRawPoints / totalScored) : null;

  const indicativeMaturityScore =
    indicativeReadinessPercentage !== null
      ? roundTo2Decimals((indicativeReadinessPercentage / 100) * 5.0)
      : null;

  const conservativeReadinessPercentage =
    totalApplicable > 0
      ? roundTo1Decimal(sumOfRawPoints / totalApplicable)
      : null;

  const isComplete = totalAnswered === totalCanonicalQuestions;
  const isIncomplete = !isComplete;
  const hasUnknowns = totalUnknowns > 0;
  const hasUnapprovedExclusions = totalUnapprovedNa > 0;
  const hasUnresolvedMappings = unmappedQuestions.length > 0;
  const hasZeroScorableQuestions = totalScored === 0;

  const metrics: ScoringSummaryMetrics = {
    totalCanonicalQuestions,
    totalAnswered,
    totalApplicable,
    totalConclusive,
    totalScored,
    totalUnknowns,
    totalApprovedExcluded,
    totalUnapprovedNa,
    totalUnanswered,
    totalUnresolvedMappings: unmappedQuestions.length,
    implementedCount,
    partiallyImplementedCount,
    notImplementedCount,
    assessmentCompletenessPct,
    responseCoveragePct,
    evidenceCoveragePct,
    indicativeReadinessPercentage,
    indicativeMaturityScore,
    conservativeReadinessPercentage,
    isComplete,
    isIncomplete,
    hasUnknowns,
    hasUnapprovedExclusions,
    hasUnresolvedMappings,
    hasZeroScorableQuestions,
  };

  // 7. Calculate Section Breakdown (8 canonical sections)
  const sectionBreakdown: SectionScoreDetail[] = manifestData.sections.map((s) => {
    const qInSec = questionEvaluations.filter((qe) => qe.sectionCode === s.code);
    const secAnswered = qInSec.filter((qe) => qe.evaluationStatus !== "UNANSWERED").length;
    const secConclusive = qInSec.filter((qe) => qe.isConclusive).length;
    const secScored = qInSec.filter((qe) => qe.isScored);
    const secUnknowns = qInSec.filter((qe) => qe.evaluationStatus === "UNSCORED_UNKNOWN").length;
    const secApprovedExcluded = qInSec.filter((qe) => qe.evaluationStatus === "EXCLUDED_APPROVED").length;
    const secUnapprovedNa = qInSec.filter((qe) => qe.evaluationStatus === "UNAPPROVED_NA").length;
    const secUnanswered = qInSec.filter((qe) => qe.evaluationStatus === "UNANSWERED").length;
    const secImpl = qInSec.filter((qe) => qe.rawPoints === 100).length;
    const secPart = qInSec.filter((qe) => qe.rawPoints === 50).length;
    const secNot = qInSec.filter((qe) => qe.rawPoints === 0).length;
    const secUnres = qInSec.filter((qe) => qe.isUnresolvedMapping).length;

    let secPercentage: number | null = null;
    let secMaturity: number | null = null;

    if (secScored.length > 0) {
      const secPointsSum = secScored.reduce((acc, curr) => acc + (curr.rawPoints || 0), 0);
      secPercentage = roundTo1Decimal(secPointsSum / secScored.length);
      secMaturity = roundTo2Decimals((secPercentage / 100) * 5.0);
    }

    return {
      sectionCode: s.code,
      sectionTitle: s.title,
      totalQuestions: qInSec.length,
      answeredQuestions: secAnswered,
      conclusiveQuestions: secConclusive,
      scoredQuestions: secScored.length,
      unknownCount: secUnknowns,
      approvedExcludedCount: secApprovedExcluded,
      unapprovedNaCount: secUnapprovedNa,
      unansweredCount: secUnanswered,
      implementedCount: secImpl,
      partiallyImplementedCount: secPart,
      notImplementedCount: secNot,
      unresolvedMappingCount: secUnres,
      indicativePercentage: secPercentage,
      indicativeMaturityScore: secMaturity,
      isComplete: secAnswered === qInSec.length,
    };
  });

  // 8. Calculate Statutory Domain Breakdown (13 canonical domains)
  const domainBreakdown: StatutoryDomainScoreDetail[] = Object.entries(
    STATUTORY_DOMAIN_WEIGHTS
  ).map(([domainCode, weight]) => {
    const qInDomain = questionEvaluations.filter(
      (qe) => qe.statutoryDomain === domainCode
    );

    const scoredInDomain = qInDomain.filter((qe) => qe.isScored);
    const gaps = qInDomain.filter((qe) => qe.rawPoints === 0).length;
    const partials = qInDomain.filter((qe) => qe.rawPoints === 50).length;
    const approvedExcluded = qInDomain.filter(
      (qe) => qe.evaluationStatus === "EXCLUDED_APPROVED"
    ).length;

    const isExcluded =
      qInDomain.length > 0 && approvedExcluded === qInDomain.length;

    let domainPercentage: number | null = null;
    let domainMaturity: number | null = null;

    if (scoredInDomain.length > 0) {
      const domainPointsSum = scoredInDomain.reduce(
        (acc, curr) => acc + (curr.rawPoints || 0),
        0
      );
      domainPercentage = roundTo1Decimal(domainPointsSum / scoredInDomain.length);
      domainMaturity = roundTo2Decimals((domainPercentage / 100) * 5.0);
    }

    return {
      domainCode,
      domainTitle: formatDomainTitle(domainCode),
      statutoryWeight: weight,
      mappedQuestionsCount: qInDomain.length,
      scoredQuestionsCount: scoredInDomain.length,
      gapCount: gaps,
      partialCount: partials,
      approvedExcludedCount: approvedExcluded,
      indicativeDomainPercentage: domainPercentage,
      domainMaturityScore: domainMaturity,
      potentialPenaltyCeiling: getPenaltyCeilingForDomain(domainCode, config),
      isExcluded,
    };
  });

  // 9. Generate Contextual Governance Notices
  const notices: string[] = [];

  if (config.methodologyStatus === "PROVISIONAL_PENDING_APPROVAL") {
    notices.push(
      "PROVISIONAL METHODOLOGY: Scoring values (Implemented=100, Partially=50, Not Implemented=0) represent an unratified engineering baseline pending formal methodology sign-off (DEC-08, DEC-09). Results are indicative diagnostic measures and NOT an official statutory compliance rating."
    );
  }

  if (isIncomplete) {
    notices.push(
      `INCOMPLETE ASSESSMENT: Overall assessment completeness is ${assessmentCompletenessPct}%. Only ${totalAnswered} of 60 questions have been answered. Unassessed areas represent unknown compliance risks.`
    );
  }

  if (hasUnknowns) {
    notices.push(
      `UNVERIFIED ITEMS: ${totalUnknowns} questions are recorded as 'Unknown / not verified'. These items remain unscored pending verification and depress response coverage.`
    );
  }

  if (hasUnapprovedExclusions) {
    notices.push(
      `UNAPPROVED EXCLUSIONS: ${totalUnapprovedNa} questions marked 'Not applicable' lack required justification or authorized assessor verification and remain in the applicable scope.`
    );
  }

  if (hasUnresolvedMappings) {
    notices.push(
      `UNRESOLVED MAPPINGS: 4 questions (${config.unmappedQuestionCodes.join(", ")}) remain unresolved pending official Excel build sheet mappings and do not roll up into statutory controls.`
    );
  }

  // 10. Generate Deterministic Calculation Hash for Reproducibility Audit
  const inputHashPayload = JSON.stringify({
    modelCode: config.modelCode,
    modelVersion: config.modelVersion,
    inputRevision: input.inputRevision || "rev-1",
    responses: questionEvaluations.map((qe) => ({
      c: qe.questionCode,
      o: qe.selectedOption,
      j: qe.hasValidJustification,
      a: qe.isAssessorApprovedExclusion,
    })),
  });
  const calculationHash = crypto
    .createHash("sha256")
    .update(inputHashPayload)
    .digest("hex");

  const metadata: ScoringCalculationMetadata = {
    scoringModelCode: config.modelCode,
    scoringModelVersion: config.modelVersion,
    methodologyStatus: config.methodologyStatus,
    isOfficialScore: false,
    inputRevision: input.inputRevision || "rev-1",
    calculatedAt: new Date().toISOString(),
    calculationHash,
    assumptions: PROVISIONAL_ASSUMPTIONS,
    disclaimer: config.statutoryDisclaimer,
    notices,
  };

  return {
    metrics,
    questionEvaluations,
    sectionBreakdown,
    domainBreakdown,
    unmappedQuestions,
    statutoryDeficits: deficits,
    metadata,
  };
}

function getPenaltyCeilingForDomain(
  domainCode: string | null,
  config: ScoringModelConfig
): string {
  if (!domainCode) return "General Statutory Provisions (Schedule Item 6 — Up to ₹50 Crores)";

  switch (domainCode) {
    case "SECURITY_SAFEGUARDS":
      return `Tier 1: Reasonable Security Safeguards (Sec 8(5) / Schedule Item 1 — Up to ₹${config.penaltyTiers.TIER_1.ceilingCrores} Crores statutory ceiling)`;
    case "BREACH_READINESS":
      return `Tier 2: Personal Data Breach Notification (Sec 8(6) / Schedule Item 2 — Up to ₹${config.penaltyTiers.TIER_2.ceilingCrores} Crores statutory ceiling)`;
    case "CHILDREN_DISABLED_DATA":
      return `Tier 2: Obligations in Respect of Children (Sec 9 / Schedule Item 3 — Up to ₹${config.penaltyTiers.TIER_2.ceilingCrores} Crores statutory ceiling)`;
    case "SDF_GOVERNANCE":
      return `Tier 3: Significant Data Fiduciary Obligations (Sec 10 / Schedule Item 4 — Up to ₹${config.penaltyTiers.TIER_3.ceilingCrores} Crores statutory ceiling)`;
    default:
      return `Tier 4: General Statutory Breaches (Schedule Item 6 — Up to ₹${config.penaltyTiers.TIER_4.ceilingCrores} Crores statutory ceiling)`;
  }
}

function formatDomainTitle(domainCode: string): string {
  const titles: Record<string, string> = {
    NOTICE_TRANSPARENCY: "Notice & Transparency Architecture",
    LEGITIMATE_USES: "Legitimate Uses & Legal Grounds",
    CONSENT_MANAGEMENT: "Consent Architecture & Consent Managers",
    FIDUCIARY_DUTIES: "Data Fiduciary General Obligations",
    PROCESSOR_OVERSIGHT: "Data Processor Oversight & Contracts",
    SECURITY_SAFEGUARDS: "Security Safeguards & Technical Measures",
    BREACH_READINESS: "Personal Data Breach Readiness & Notification",
    RETENTION_ERASURE: "Data Retention & Purpose Erasure",
    DATA_PRINCIPAL_RIGHTS: "Data Principal Rights & Grievance Redressal",
    CHILDREN_DISABLED_DATA: "Children & Persons with Disabilities Safeguards",
    SDF_GOVERNANCE: "Significant Data Fiduciary (SDF) Governance",
    CROSS_BORDER_TRANSFERS: "Cross-Border Personal Data Transfers",
    PENALTY_READINESS: "Statutory Penalties & Adjudication Readiness",
  };
  return titles[domainCode] || domainCode.replace(/_/g, " ");
}
