/**
 * TLI DPDP Compliance Gap Analysis Tool — Canonical Questionnaire Library
 *
 * Grounded in the authoritative 60-question questionnaire extracted from
 * Truth_Labs_DPDP_60_Question_MS_Forms_Quick_Import_v1.docx.
 *
 * Implements:
 * 1. Exactly 8 canonical sections (GOV, DAT, NOT, RGT, SEC, RET, TPR, APP).
 * 2. Exactly 60 questions with exact wording, codes, and ordering.
 * 3. Exactly 5 response options per question.
 * 4. Exact follow-up comment/justification field prompt.
 * 5. Preservation of 13 statutory domains for statutory reporting.
 */

import manifestData from "../../data/questionnaire_v1.json" with { type: "json" };
import type {
  CanonicalQuestion,
  CanonicalQuestionnaireSection,
  CanonicalResponseOption,
  RespondentQuestionResponse,
  SectionProgressSummary,
  QuestionnaireProgress,
} from "./types.ts";

export const QUESTIONNAIRE_METADATA = {
  version: manifestData.version,
  versionId: manifestData.version_id,
  title: manifestData.title,
  subtitle: manifestData.subtitle,
  draftStatus: manifestData.draft_status,
  importNote: manifestData.import_note,
  respondentInstructions: manifestData.respondent_instructions,
  assessorOnlyReference: manifestData.assessor_only_reference,
  totalSections: manifestData.total_sections,
  totalQuestions: manifestData.total_questions,
};

export const CANONICAL_OPTIONS: readonly CanonicalResponseOption[] = [
  "Implemented",
  "Partially implemented",
  "Not implemented",
  "Unknown / not verified",
  "Not applicable — justification required",
] as const;

export const CANONICAL_FOLLOWUP_PROMPT =
  "Follow-up field to add in Forms: Assessor / respondent comments and, if Not applicable, justification.";

/**
 * Standard MCQ Options alias for legacy test and component imports
 */
export const STANDARD_MCQ_OPTIONS = [
  { key: "FULLY_IMPLEMENTED", label: "Implemented", maturityScore: 4 },
  { key: "PARTIALLY_IMPLEMENTED", label: "Partially implemented", maturityScore: 2 },
  { key: "PLANNED_AD_HOC", label: "Not implemented", maturityScore: 1 },
  { key: "ABSENT", label: "Absent", maturityScore: 0 },
];

/**
 * 13 Statutory Control Domains (from PostgreSQL Migration 003)
 * Preserved for statutory framework analysis and executive report preview.
 */
export const CANONICAL_DOMAINS: Array<{
  code: string;
  title: string;
  weight: number;
  statutoryFocus: string;
}> = [
  {
    code: "NOTICE_TRANSPARENCY",
    title: "Notice & Transparency Architecture",
    weight: 1.25,
    statutoryFocus: "Sections 3 & 5 — Scope, Itemised Pre-Consent Notice & Multilingual Accessibility",
  },
  {
    code: "LEGITIMATE_USES",
    title: "Legitimate Uses & Legal Grounds",
    weight: 1.00,
    statutoryFocus: "Sections 4 & 7 — Lawful Processing Grounds, Voluntary Provision & Employment Data",
  },
  {
    code: "CONSENT_MANAGEMENT",
    title: "Consent Architecture & Consent Managers",
    weight: 1.25,
    statutoryFocus: "Section 6 — Freely Given Affirmation, Revocation Workflows & Interoperable CMs",
  },
  {
    code: "FIDUCIARY_DUTIES",
    title: "Data Fiduciary General Obligations",
    weight: 1.00,
    statutoryFocus: "Section 8(1)-(3) — Accuracy, Completeness & Unconditional Accountability",
  },
  {
    code: "PROCESSOR_OVERSIGHT",
    title: "Data Processor Oversight & Contracts",
    weight: 1.00,
    statutoryFocus: "Section 8(2) r/w Rule 7 — Mandatory Processor Agreements & Monitoring",
  },
  {
    code: "SECURITY_SAFEGUARDS",
    title: "Security Safeguards & Technical Measures",
    weight: 1.50,
    statutoryFocus: "Section 8(4)-(5) r/w Rule 8 — Tier 1 Technical Safeguards & Encryption (₹250 Cr)",
  },
  {
    code: "BREACH_READINESS",
    title: "Personal Data Breach Readiness & Notification",
    weight: 1.50,
    statutoryFocus: "Section 8(6) r/w Rule 9 — Dual Board & Principal Notification Within Timelines (₹200 Cr)",
  },
  {
    code: "RETENTION_ERASURE",
    title: "Data Retention & Purpose Erasure",
    weight: 1.00,
    statutoryFocus: "Section 8(7)-(8) — Purpose-Completion Erasure & Revocation Purge",
  },
  {
    code: "DATA_PRINCIPAL_RIGHTS",
    title: "Data Principal Rights & Grievance Redressal",
    weight: 1.25,
    statutoryFocus: "Sections 11–14 — Access, Correction, Erasure, Grievance Escalation & Nomination",
  },
  {
    code: "CHILDREN_DISABLED_DATA",
    title: "Children & Persons with Disabilities Safeguards",
    weight: 1.25,
    statutoryFocus: "Section 9 — Verifiable Parental Consent & Absolute Tracking Ban (₹200 Cr)",
  },
  {
    code: "SDF_GOVERNANCE",
    title: "Significant Data Fiduciary (SDF) Governance",
    weight: 1.25,
    statutoryFocus: "Section 10 — Resident DPO, DPIA Conduct & Periodic Independent Audit (₹150 Cr)",
  },
  {
    code: "CROSS_BORDER_TRANSFERS",
    title: "Cross-Border Personal Data Transfers",
    weight: 1.00,
    statutoryFocus: "Section 16 — Negative Country List & Sectoral Localization Restrictions",
  },
  {
    code: "PENALTY_READINESS",
    title: "Statutory Penalties & Adjudication Readiness",
    weight: 1.00,
    statutoryFocus: "Section 33 r/w Schedule — Forensic Evidence Retention & Statutory Mitigation Defense",
  },
];

/**
 * Returns the authoritative 8 questionnaire sections containing all 60 questions.
 */
export function getCanonicalQuestionnaireSections(): CanonicalQuestionnaireSection[] {
  const sectionsMap = new Map<string, CanonicalQuestion[]>();

  for (const s of manifestData.sections) {
    sectionsMap.set(s.code, []);
  }

  for (const q of manifestData.questions) {
    const list = sectionsMap.get(q.section_code);
    if (!list) {
      throw new Error(`Unknown section code '${q.section_code}' in question '${q.code}'`);
    }

    const questionItem: CanonicalQuestion = {
      code: q.code,
      order: q.order,
      sectionCode: q.section_code,
      sectionTitle: q.section_title,
      text: q.text,
      options: CANONICAL_OPTIONS,
      followUpPrompt: q.follow_up_prompt,
      canonicalControlId: q.canonical_control_id,
      mappingStatus: q.mapping_status as any,
      mappingNotes: q.mapping_notes,
    };
    list.push(questionItem);
  }

  return manifestData.sections.map((s) => ({
    code: s.code,
    title: s.title,
    heading: s.heading,
    questions: sectionsMap.get(s.code) || [],
  }));
}

/**
 * Calculates deterministic questionnaire completion metrics.
 */
export function calculateQuestionnaireProgress(
  sections: CanonicalQuestionnaireSection[],
  responses: Record<string, RespondentQuestionResponse>
): QuestionnaireProgress {
  let totalQuestions = 0;
  let totalAnswered = 0;
  let totalUnanswered = 0;
  let totalExcluded = 0;
  let hasErrors = false;

  const sectionSummaries: SectionProgressSummary[] = [];

  for (const section of sections) {
    let answered = 0;
    let unanswered = 0;
    let excluded = 0;
    let missingJustification = 0;

    for (const q of section.questions) {
      totalQuestions += 1;
      const resp = responses[q.code];

      if (!resp || !resp.selectedOption) {
        unanswered += 1;
        totalUnanswered += 1;
        continue;
      }

      if (resp.selectedOption === "Not applicable — justification required") {
        const hasJustification =
          Boolean(resp.commentsAndJustification) &&
          resp.commentsAndJustification!.trim().length > 0;

        if (hasJustification) {
          excluded += 1;
          totalExcluded += 1;
        } else {
          // Incomplete because justification is strictly required
          missingJustification += 1;
          hasErrors = true;
          unanswered += 1;
          totalUnanswered += 1;
        }
      } else {
        // Any of: Implemented, Partially implemented, Not implemented, Unknown / not verified
        answered += 1;
        totalAnswered += 1;
      }
    }

    const isComplete = answered + excluded === section.questions.length && missingJustification === 0;

    sectionSummaries.push({
      sectionCode: section.code,
      sectionTitle: section.title,
      totalQuestions: section.questions.length,
      answeredCount: answered,
      unansweredCount: unanswered,
      excludedCount: excluded,
      missingJustificationCount: missingJustification,
      isComplete,
    });
  }

  const effectiveCompleted = totalAnswered + totalExcluded;
  const completionPercentage =
    totalQuestions > 0 ? Math.round((effectiveCompleted / totalQuestions) * 100) : 0;

  return {
    totalQuestions,
    totalAnswered,
    totalUnanswered,
    totalExcluded,
    completionPercentage,
    hasErrors,
    sectionSummaries,
  };
}
