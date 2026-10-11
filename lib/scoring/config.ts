/**
 * TLI DPDP Compliance Gap Analysis Tool — Scoring Engine Configuration
 *
 * Implements provisional model configuration while embedding strict governance boundaries:
 * - Option values (Implemented=100, Partially=50, Not Implemented=0) are classified
 *   as an unratified engineering baseline pending formal methodology approval (DEC-08, DEC-09).
 * - Definitive official scoring is disabled until formal executive approval is recorded.
 * - 4 questions (GOV-005, GOV-006, GOV-008, APP-006) remain strictly unmapped.
 */

import type { ScoringModelConfig } from "./types.ts";

export const UNMAPPED_QUESTION_CODES: readonly string[] = Object.freeze([
  "GOV-005",
  "GOV-006",
  "GOV-008",
  "APP-006",
]);

export const STATUTORY_DOMAIN_WEIGHTS: Readonly<Record<string, number>> = Object.freeze({
  NOTICE_TRANSPARENCY: 1.25,
  LEGITIMATE_USES: 1.0,
  CONSENT_MANAGEMENT: 1.25,
  FIDUCIARY_DUTIES: 1.0,
  PROCESSOR_OVERSIGHT: 1.0,
  SECURITY_SAFEGUARDS: 1.5,
  BREACH_READINESS: 1.5,
  RETENTION_ERASURE: 1.0,
  DATA_PRINCIPAL_RIGHTS: 1.25,
  CHILDREN_DISABLED_DATA: 1.25,
  SDF_GOVERNANCE: 1.25,
  CROSS_BORDER_TRANSFERS: 1.0,
  PENALTY_READINESS: 1.0,
});

export const STATUTORY_PENALTY_TIERS = Object.freeze({
  TIER_1: Object.freeze({
    ceilingAmountInr: 2_500_000_000,
    ceilingCrores: 250,
    legalReference: "Section 33(1) r/w Schedule Item 1",
    triggeringTopic: "SECURITY_SAFEGUARDS",
  }),
  TIER_2: Object.freeze({
    ceilingAmountInr: 2_000_000_000,
    ceilingCrores: 200,
    legalReference: "Section 33(1) r/w Schedule Items 2 & 3",
    triggeringTopic: "BREACH_READINESS / CHILDREN_DISABLED_DATA",
  }),
  TIER_3: Object.freeze({
    ceilingAmountInr: 1_500_000_000,
    ceilingCrores: 150,
    legalReference: "Section 33(1) r/w Schedule Item 4",
    triggeringTopic: "SDF_GOVERNANCE",
  }),
  TIER_4: Object.freeze({
    ceilingAmountInr: 500_000_000,
    ceilingCrores: 50,
    legalReference: "Section 33(1) r/w Schedule Item 6",
    triggeringTopic: "GENERAL_STATUTORY_OBLIGATIONS",
  }),
});

export const STATUTORY_LEGAL_DISCLAIMER =
  "IMPORTANT LEGAL NOTICE AND DISCLAIMER: This evaluation represents an independent professional advisory gap analysis conducted by Truth Labs International (TLI) based strictly upon questionnaire representations and supporting evidence provided. This document does NOT constitute a legal certification of statutory compliance, an immunity certificate, nor an endorsement by the Data Protection Board of India (DPBI) or the Central Government. Under the Digital Personal Data Protection Act, 2023, compliance is a continuous, non-compensatory legal duty of the Data Fiduciary. In accordance with TLI governance decisions DEC-01, DEC-08, and DEC-10, numeric scores are indicative engineering diagnostic measures under provisional model SCORING-V1-PROVISIONAL pending formal methodology ratification.";

export const PROVISIONAL_ASSUMPTIONS: readonly string[] = Object.freeze([
  "1. Proposed Option Values: Implemented=100, Partially implemented=50, Not implemented=0.",
  "2. Unscored Items: 'Unknown / not verified' is treated as unscored pending verification and is not converted to 0 or 100.",
  "3. Exclusion Approval: 'Not applicable' is excluded from scorable scope strictly when written justification is non-empty AND an authorized assessor has verified the exclusion.",
  "4. Unresolved Mappings: Questions GOV-005, GOV-006, GOV-008, and APP-006 remain unresolved pending official Excel build sheet mappings and do not roll up into statutory controls.",
  "5. Statutory Penalty Ceilings: Penalty tier amounts represent maximum statutory limits under Section 33(1), not automatic or confirmed fines, and are subject to Section 28(2) mitigating factors.",
  "6. Non-Compensatory Dual Metric: Overall readiness percentage does not obscure individual statutory deficits or Tier 1/2 gap exposures.",
]);

export const DEFAULT_PROVISIONAL_CONFIG: ScoringModelConfig = Object.freeze({
  modelCode: "SCORING-V1-PROVISIONAL",
  modelVersion: "1.0.0-provisional",
  methodologyStatus: "PROVISIONAL_PENDING_APPROVAL",
  isOfficialScore: false,
  optionValues: Object.freeze({
    IMPLEMENTED: 100,
    PARTIALLY_IMPLEMENTED: 50,
    NOT_IMPLEMENTED: 0,
  }),
  unmappedQuestionCodes: UNMAPPED_QUESTION_CODES,
  domainWeights: STATUTORY_DOMAIN_WEIGHTS,
  penaltyTiers: STATUTORY_PENALTY_TIERS,
  statutoryDisclaimer: STATUTORY_LEGAL_DISCLAIMER,
});

