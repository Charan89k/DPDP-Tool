/**
 * TLI DPDP Compliance Gap Analysis Tool — Assessment Lifecycle Rules Engine
 *
 * Implements the deterministic state transition graph, authorized roles,
 * and precondition rules documented in docs/03, docs/09, and docs/31.
 */

import {
  AssessmentStatus,
  LifecycleTransitionRule,
  AllowedTransitionOption,
  TransitionRole,
} from "./types";

export const LIFECYCLE_TRANSITIONS: LifecycleTransitionRule[] = [
  // 1. DRAFT transitions
  {
    from: "DRAFT",
    to: "SCOPING",
    label: "Initiate Scoping",
    authorizedRoles: ["TLI_LEAD_CONSULTANT", "TLI_SUPER_ADMIN"],
    requiresLeadAssignment: true,
    description: "Initiates regulatory scoping and applicability assessment.",
  },
  {
    from: "DRAFT",
    to: "CANCELLED",
    label: "Cancel Engagement",
    authorizedRoles: ["TLI_LEAD_CONSULTANT", "TLI_SUPER_ADMIN"],
    requiresReason: true,
    reasonPrompt: "Please specify mandatory cancellation justification.",
    isDestructive: true,
    description: "Terminates draft assessment engagement.",
  },

  // 2. SCOPING transitions
  {
    from: "SCOPING",
    to: "SCOPE_LOCKED",
    label: "Lock Engagement Scope",
    authorizedRoles: ["TLI_LEAD_CONSULTANT", "TLI_SUPER_ADMIN"],
    requiresLeadAssignment: true,
    description: "Locks the 60 canonical questions and verifies all statutory exclusions.",
  },
  {
    from: "SCOPING",
    to: "CANCELLED",
    label: "Cancel Engagement",
    authorizedRoles: ["TLI_LEAD_CONSULTANT", "TLI_SUPER_ADMIN"],
    requiresReason: true,
    reasonPrompt: "Please specify mandatory cancellation justification.",
    isDestructive: true,
    description: "Terminates engagement during scoping phase.",
  },

  // 3. SCOPE_LOCKED transitions
  {
    from: "SCOPE_LOCKED",
    to: "DATA_GATHERING",
    label: "Dispatch to Client for Data Gathering",
    authorizedRoles: ["TLI_LEAD_CONSULTANT", "TLI_SUPER_ADMIN", "CLIENT_ADMIN"],
    description: "Unlocks questionnaire workspace for client responses and evidence submission.",
  },
  {
    from: "SCOPE_LOCKED",
    to: "SCOPING",
    label: "Reopen Scoping",
    authorizedRoles: ["TLI_LEAD_CONSULTANT", "TLI_SUPER_ADMIN"],
    requiresReason: true,
    reasonPrompt: "Specify reason for unlocking engagement scope.",
    description: "Reopens scoping to adjust control applicability.",
  },
  {
    from: "SCOPE_LOCKED",
    to: "CANCELLED",
    label: "Cancel Engagement",
    authorizedRoles: ["TLI_LEAD_CONSULTANT", "TLI_SUPER_ADMIN"],
    requiresReason: true,
    reasonPrompt: "Please specify mandatory cancellation justification.",
    isDestructive: true,
    description: "Terminates engagement while scope is locked.",
  },

  // 4. DATA_GATHERING transitions
  {
    from: "DATA_GATHERING",
    to: "SUBMITTED_FOR_REVIEW",
    label: "Submit Questionnaire for Assessor Review",
    authorizedRoles: ["CLIENT_ADMIN", "TLI_SUPER_ADMIN"],
    description: "Submits client responses and evidence to TLI assessors. Freezes client edits.",
  },
  {
    from: "DATA_GATHERING",
    to: "CANCELLED",
    label: "Cancel Engagement",
    authorizedRoles: ["TLI_LEAD_CONSULTANT", "TLI_SUPER_ADMIN"],
    requiresReason: true,
    reasonPrompt: "Please specify mandatory cancellation justification.",
    isDestructive: true,
    description: "Terminates engagement during client data gathering.",
  },

  // 5. SUBMITTED_FOR_REVIEW transitions
  {
    from: "SUBMITTED_FOR_REVIEW",
    to: "UNDER_REVIEW",
    label: "Commence Assessor Review",
    authorizedRoles: ["TLI_LEAD_CONSULTANT", "TLI_REVIEWER", "TLI_SUPER_ADMIN"],
    requiresReviewerAssignment: true,
    description: "TLI assessor begins independent evaluation of responses and attached evidence.",
  },
  {
    from: "SUBMITTED_FOR_REVIEW",
    to: "DATA_GATHERING",
    label: "Withdraw Submission",
    authorizedRoles: ["CLIENT_ADMIN", "TLI_SUPER_ADMIN"],
    requiresReason: true,
    reasonPrompt: "Specify reason for withdrawing questionnaire submission.",
    description: "Client withdraws submission prior to review commencement.",
  },
  {
    from: "SUBMITTED_FOR_REVIEW",
    to: "CANCELLED",
    label: "Cancel Engagement",
    authorizedRoles: ["TLI_LEAD_CONSULTANT", "TLI_SUPER_ADMIN"],
    requiresReason: true,
    reasonPrompt: "Please specify mandatory cancellation justification.",
    isDestructive: true,
    description: "Terminates engagement after submission.",
  },

  // 6. UNDER_REVIEW transitions
  {
    from: "UNDER_REVIEW",
    to: "CLARIFICATION_PENDING",
    label: "Request Client Clarifications",
    authorizedRoles: ["TLI_REVIEWER", "TLI_LEAD_CONSULTANT", "TLI_SUPER_ADMIN"],
    description: "Flags specific questions or evidence gaps requiring client explanation.",
  },
  {
    from: "UNDER_REVIEW",
    to: "DATA_GATHERING",
    label: "Return for Major Client Rework",
    authorizedRoles: ["TLI_LEAD_CONSULTANT", "TLI_SUPER_ADMIN"],
    requiresReason: true,
    reasonPrompt: "Mandatory: detail why engagement is returned for rework.",
    description: "Returns assessment to client due to fundamental data or evidence inadequacy.",
  },
  {
    from: "UNDER_REVIEW",
    to: "REVIEW_COMPLETED",
    label: "Complete Assessor Review",
    authorizedRoles: ["TLI_REVIEWER", "TLI_LEAD_CONSULTANT", "TLI_SUPER_ADMIN"],
    description: "Finalizes all question evaluations and exclusion reviews.",
  },

  // 7. CLARIFICATION_PENDING transitions
  {
    from: "CLARIFICATION_PENDING",
    to: "UNDER_REVIEW",
    label: "Submit Clarification Responses",
    authorizedRoles: ["CLIENT_ADMIN", "CLIENT_BU_LEAD", "TLI_SUPER_ADMIN"],
    description: "Resubmits assessment after responding to all raised clarification threads.",
  },

  // 8. REVIEW_COMPLETED transitions
  {
    from: "REVIEW_COMPLETED",
    to: "DRAFT_REPORT_GENERATED",
    label: "Generate Draft Compliance Report",
    authorizedRoles: ["TLI_REVIEWER", "TLI_LEAD_CONSULTANT", "TLI_SUPER_ADMIN"],
    description: "Runs deterministic scoring engine and compiles draft findings matrix.",
  },

  // 9. DRAFT_REPORT_GENERATED transitions
  {
    from: "DRAFT_REPORT_GENERATED",
    to: "UNDER_REVIEW",
    label: "Reopen Review for Adjustments",
    authorizedRoles: ["TLI_LEAD_CONSULTANT", "TLI_SUPER_ADMIN"],
    requiresReason: true,
    reasonPrompt: "Specify finding adjustments required in reviewer evaluation.",
    description: "Returns draft findings to reviewer for scoring or narrative revisions.",
  },
  {
    from: "DRAFT_REPORT_GENERATED",
    to: "LEAD_APPROVED",
    label: "Approve Compliance Assessment (Lead Consultant Sign-off)",
    authorizedRoles: ["TLI_LEAD_CONSULTANT", "TLI_SUPER_ADMIN"],
    requiresLeadAssignment: true,
    description: "TLI Lead Consultant formally approves the assessment findings and score.",
  },

  // 10. LEAD_APPROVED transitions
  {
    from: "LEAD_APPROVED",
    to: "FINAL_ISSUED",
    label: "Issue Final Regulatory Assessment Report",
    authorizedRoles: ["TLI_LEAD_CONSULTANT", "TLI_SUPER_ADMIN"],
    requiresLeadAssignment: true,
    description: "Delivers official audit report to client and permanently freezes dataset.",
  },

  // 11. FINAL_ISSUED transitions
  {
    from: "FINAL_ISSUED",
    to: "REMEDIATION_ACTIVE",
    label: "Activate Remediation CAPA Tracking",
    authorizedRoles: ["TLI_LEAD_CONSULTANT", "TLI_SUPER_ADMIN"],
    description: "Seeds corrective action tracking for identified gaps.",
  },
  {
    from: "FINAL_ISSUED",
    to: "ARCHIVED",
    label: "Archive Issued Engagement",
    authorizedRoles: ["TLI_LEAD_CONSULTANT", "TLI_SUPER_ADMIN"],
    requiresReason: true,
    reasonPrompt: "Specify retention or archiving justification.",
    description: "Places engagement in permanent archival storage.",
  },

  // 12. REMEDIATION_ACTIVE transitions
  {
    from: "REMEDIATION_ACTIVE",
    to: "ARCHIVED",
    label: "Archive Completed Engagement",
    authorizedRoles: ["TLI_LEAD_CONSULTANT", "TLI_SUPER_ADMIN"],
    requiresReason: true,
    reasonPrompt: "Specify archival or retention justification.",
    description: "Places completed remediation engagement into statutory archive.",
  },

  // 13. CANCELLED transitions
  {
    from: "CANCELLED",
    to: "ARCHIVED",
    label: "Archive Cancelled Engagement",
    authorizedRoles: ["TLI_LEAD_CONSULTANT", "TLI_SUPER_ADMIN"],
    requiresReason: true,
    reasonPrompt: "Specify archival justification.",
    description: "Archives terminated engagement records for compliance retention.",
  },
];

/**
 * Checks whether an assessment state is forensically immutable.
 */
export function isAssessmentImmutable(status: AssessmentStatus): boolean {
  return [
    "LEAD_APPROVED",
    "FINAL_ISSUED",
    "REMEDIATION_ACTIVE",
    "ARCHIVED",
    "CANCELLED",
  ].includes(status);
}

/**
 * Finds the transition rule between two lifecycle states.
 */
export function findTransitionRule(
  from: AssessmentStatus,
  to: AssessmentStatus
): LifecycleTransitionRule | undefined {
  return LIFECYCLE_TRANSITIONS.find((r) => r.from === from && r.to === to);
}

/**
 * Determines whether the given user role is authorized for the transition rule.
 */
export function isRoleAuthorizedForTransition(
  rule: LifecycleTransitionRule,
  userRole: string
): boolean {
  return rule.authorizedRoles.includes(userRole as TransitionRole);
}

/**
 * Computes all allowed transitions from the current status for a specific user role.
 */
export function getAllowedTransitionsForRole(
  currentStatus: AssessmentStatus,
  userRole: string,
  isAssignedConsultant: boolean = true
): AllowedTransitionOption[] {
  return LIFECYCLE_TRANSITIONS.filter((rule) => {
    if (rule.from !== currentStatus) return false;
    if (!isRoleAuthorizedForTransition(rule, userRole)) return false;
    // If rule requires consultant assignment, ensure consultant is assigned (unless super admin)
    if (
      userRole !== "TLI_SUPER_ADMIN" &&
      (rule.requiresLeadAssignment || rule.requiresReviewerAssignment) &&
      !isAssignedConsultant
    ) {
      return false;
    }
    return true;
  }).map((rule) => ({
    targetStatus: rule.to,
    label: rule.label,
    requiresReason: Boolean(rule.requiresReason),
    reasonPrompt: rule.reasonPrompt,
    isDestructive: Boolean(rule.isDestructive),
    description: rule.description,
  }));
}

