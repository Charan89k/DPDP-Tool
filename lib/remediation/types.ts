/**
 * CloudE5 — Remediation Workflow Types
 *
 * Defines contracts for Corrective and Preventive Action (CAPA) tracking,
 * ownership assignment, closure submissions, and assessor validation.
 */

export type RemediationStatus =
  | "OPEN"
  | "IN_REMEDIATION"
  | "SUBMITTED_FOR_CLOSURE"
  | "VALIDATED_CLOSED"
  | "REJECTED_REOPENED";

export type RemediationPriority =
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "INFORMATIONAL";

export interface RemediationTask {
  id: string;
  tenantId: string;
  assessmentId: string;
  questionCode: string | null;
  assessmentControlId: string | null;
  title: string;
  description: string;
  priority: RemediationPriority;
  targetDate: string;
  ownerUserId: string | null;
  ownerName: string | null;
  status: RemediationStatus;
  closureSubmissionNotes: string | null;
  closureSubmittedAt: string | null;
  closureValidatedById: string | null;
  closureValidatedByName: string | null;
  closureValidationNotes: string | null;
  validatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRemediationInput {
  assessmentId: string;
  questionCode?: string;
  title: string;
  description: string;
  priority: RemediationPriority;
  targetDate: string;
  ownerUserId?: string;
}

export interface UpdateRemediationInput {
  title?: string;
  description?: string;
  targetDate?: string;
  ownerUserId?: string;
  status?: RemediationStatus;
  closureSubmissionNotes?: string;
}

export interface ValidateRemediationInput {
  action: "VALIDATE_CLOSE" | "REJECT_REOPEN";
  validationNotes: string;
}

