/**
 * TLI DPDP Compliance Gap Analysis Tool — Canonical Questionnaire Library
 *
 * Implements the questionnaire structure strictly adhering to:
 * 1. The 30 canonical DPDP controls from data/dpdp_controls.json.
 * 2. The 13 canonical control domains from PostgreSQL Migration 003.
 * 3. STRICT INVARIANT: No questionnaire section contains more than 4 questions.
 * 4. Clearly labelled 4-choice MCQ options per question with explicit maturity mapping.
 * 5. Explanatory notes, evidence linking, and consultant-approved exclusion workflow.
 */

import rawControls from "../../data/dpdp_controls.json" with { type: "json" };
import type {
  QuestionControl,
  QuestionnaireSection,
  MCQOption,
  QuestionResponse,
  SectionProgressSummary,
} from "./types.ts";

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

export const STANDARD_MCQ_OPTIONS: MCQOption[] = [
  {
    key: "FULLY_IMPLEMENTED",
    label: "Fully Implemented",
    description: "Verified operational controls, technical safeguards, and documented RoPA procedures are actively enforced.",
    maturityScore: 4,
    provisionalWeight: 1.0,
  },
  {
    key: "PARTIALLY_IMPLEMENTED",
    label: "Partially Implemented",
    description: "Controls and procedures are defined in policy, but operational gaps or inconsistent technical enforcement exist.",
    maturityScore: 2,
    provisionalWeight: 0.5,
  },
  {
    key: "PLANNED_AD_HOC",
    label: "Planned / Ad-Hoc",
    description: "Initial planning or ad-hoc practices exist; formal governance and technical safeguards are not operational.",
    maturityScore: 1,
    provisionalWeight: 0.25,
  },
  {
    key: "ABSENT",
    label: "Absent",
    description: "No technical safeguards, contractual clauses, or operational procedures currently exist for this requirement.",
    maturityScore: 0,
    provisionalWeight: 0.0,
  },
];

/**
 * Builds the canonical 13 questionnaire sections, verifying that
 * every section satisfies the strict <= 4 questions constraint.
 */
export function getCanonicalQuestionnaireSections(): QuestionnaireSection[] {
  // Map controls by domain code
  const controlsByTopic = new Map<string, QuestionControl[]>();

  for (const raw of rawControls) {
    const qControl: QuestionControl = {
      controlId: raw.control_id,
      controlVersion: raw.control_version,
      title: raw.title,
      objective: raw.objective,
      topic: raw.topic,
      sourceProvision: raw.source_provision,
      obligationType: raw.obligation_type,
      assessmentQuestion: raw.assessment_question,
      implementationExpectations: raw.implementation_expectations,
      acceptableEvidence: raw.acceptable_evidence || [],
      evidenceLimitations: raw.evidence_limitations,
      assessmentGuidance: raw.assessment_guidance,
      riskGuidance: raw.risk_guidance,
      options: STANDARD_MCQ_OPTIONS,
    };

    const existing = controlsByTopic.get(raw.topic) || [];
    existing.push(qControl);
    controlsByTopic.set(raw.topic, existing);
  }

  const sections: QuestionnaireSection[] = [];

  for (const domain of CANONICAL_DOMAINS) {
    const questions = controlsByTopic.get(domain.code) || [];

    // STRICT INVARIANT CHECK: Each section must contain no more than FOUR questions.
    if (questions.length > 4) {
      throw new Error(
        `CRITICAL QUESTIONNAIRE INVARIANT VIOLATION: Section '${domain.code}' contains ${questions.length} questions, exceeding the strict maximum of 4 questions per section.`
      );
    }

    sections.push({
      domainCode: domain.code,
      domainTitle: domain.title,
      domainWeight: domain.weight,
      statutoryFocus: domain.statutoryFocus,
      questions,
    });
  }

  return sections;
}

/**
 * Calculates progress and completion metrics across all sections.
 */
export function calculateQuestionnaireProgress(
  sections: QuestionnaireSection[],
  responses: Record<string, QuestionResponse>
): {
  totalQuestions: number;
  totalAnswered: number;
  totalUnanswered: number;
  totalExcluded: number;
  completionPercentage: number;
  sectionSummaries: SectionProgressSummary[];
} {
  let totalQuestions = 0;
  let totalAnswered = 0;
  let totalUnanswered = 0;
  let totalExcluded = 0;

  const sectionSummaries: SectionProgressSummary[] = [];

  for (const section of sections) {
    let answered = 0;
    let unanswered = 0;
    let excluded = 0;
    let hasEvidencePending = false;

    for (const q of section.questions) {
      totalQuestions += 1;
      const resp = responses[q.controlId];

      if (!resp) {
        unanswered += 1;
        totalUnanswered += 1;
        continue;
      }

      if (resp.isExcluded) {
        excluded += 1;
        totalExcluded += 1;
      } else if (resp.selectedOption) {
        answered += 1;
        totalAnswered += 1;

        // If control requires mandatory evidence but none attached
        if (q.acceptableEvidence.length > 0 && (!resp.evidenceItems || resp.evidenceItems.length === 0)) {
          hasEvidencePending = true;
        }
      } else {
        unanswered += 1;
        totalUnanswered += 1;
      }
    }

    const isComplete = answered + excluded === section.questions.length && section.questions.length > 0;

    sectionSummaries.push({
      domainCode: section.domainCode,
      domainTitle: section.domainTitle,
      totalQuestions: section.questions.length,
      answeredCount: answered,
      unansweredCount: unanswered,
      excludedCount: excluded,
      isComplete,
      hasEvidencePending,
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
    sectionSummaries,
  };
}

