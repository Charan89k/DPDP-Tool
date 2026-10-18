/**
 * CloudE5 — Assessment Lifecycle Types
 *
 * Canonical 14-state assessment lifecycle types as defined in:
 * - docs/03_assessment_workflow_and_state_machine.md
 * - docs/09_unresolved_decisions_and_tl_assumptions.md
 * - docs/31_phase_3d_assessment_workflow_implementation_plan.md
 */


export const CANONICAL_ASSESSMENT_STATUSES = [
  "DRAFT",
  "SCOPING",
  "SCOPE_LOCKED",
  "DATA_GATHERING",
  "SUBMITTED_FOR_REVIEW",
  "UNDER_REVIEW",
  "CLARIFICATION_PENDING",
  "REVIEW_COMPLETED",
  "DRAFT_REPORT_GENERATED",
  "LEAD_APPROVED",
  "FINAL_ISSUED",
  "REMEDIATION_ACTIVE",
  "CANCELLED",
  "ARCHIVED",
] as const;

export type AssessmentStatus = (typeof CANONICAL_ASSESSMENT_STATUSES)[number];

export type TransitionRole =
  | "TLI_SUPER_ADMIN"
  | "TLI_LEAD_CONSULTANT"
  | "TLI_REVIEWER"
  | "CLIENT_ADMIN"
  | "CLIENT_BU_LEAD";

export interface LifecycleTransitionRule {
  from: AssessmentStatus;
  to: AssessmentStatus;
  label: string;
  authorizedRoles: TransitionRole[];
  requiresLeadAssignment?: boolean;
  requiresReviewerAssignment?: boolean;
  requiresReason?: boolean;
  reasonPrompt?: string;
  isDestructive?: boolean;
  description: string;
}

export interface AllowedTransitionOption {
  targetStatus: AssessmentStatus;
  label: string;
  requiresReason: boolean;
  reasonPrompt?: string;
  isDestructive?: boolean;
  description: string;
}

export interface TransitionValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface TransitionRequest {
  targetStatus: AssessmentStatus;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface AssessmentStateSummary {
  id: string;
  engagementCode: string;
  title: string;
  currentStatus: AssessmentStatus;
  tenantId: string;
  leadConsultantId: string;
  isPartialAssessment: boolean;
  targetCompletionDate?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  approvedAt?: string | null;
  issuedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  allowedTransitions: AllowedTransitionOption[];
  isImmutable: boolean;
}

export interface TransitionAuditLogEntry {
  id: string;
  tenantId?: string;
  userId?: string;
  userRole?: string;
  action: string;
  previousStatus: AssessmentStatus;
  newStatus: AssessmentStatus;
  reason?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface ReauditCloneRequest {
  engagementCode?: string;
  title?: string;
  targetCompletionDate?: string;
  copyResponses?: boolean;
}
