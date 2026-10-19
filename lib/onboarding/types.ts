/**
 * CloudE5 — Customer Onboarding Types
 */

import type { UserRole } from "../auth/types.ts";

export interface CreateCustomerInput {
  name: string;
  slug?: string;
  industry?: string;
  isSdf?: boolean;
  dpoName?: string | null;
  dpoEmail?: string | null;
  phone?: string | null;
  address?: string | null;
  initialUser?: {
    fullName: string;
    email: string;
    role?: UserRole;
    password?: string;
  };
}

export interface ProvisionUserInput {
  fullName: string;
  email: string;
  role: UserRole;
  password?: string;
  phone?: string | null;
}

export interface CreateInvitationInput {
  email: string;
  role: UserRole;
  fullName?: string;
}

export interface AcceptInvitationInput {
  token: string;
  fullName: string;
  password: string;
}

export interface CreateAssessmentWithAssignmentInput {
  tenantId: string;
  title: string;
  engagementCode: string;
  leadConsultantId: string;
  targetCompletionDate?: string | null;
  assignedUserIds?: string[];
}

export interface CustomerSummary {
  id: string;
  name: string;
  slug: string;
  industry: string;
  is_sdf: boolean;
  dpo_name: string | null;
  dpo_email: string | null;
  status: string;
  created_at: string;
  assessment_count: number;
  user_count: number;
}

export interface CustomerDetails {
  tenant: {
    id: string;
    name: string;
    slug: string;
    industry: string;
    is_sdf: boolean;
    dpo_name: string | null;
    dpo_email: string | null;
    phone: string | null;
    address: string | null;
    status: string;
    created_at: string;
  };
  users: Array<{
    id: string;
    full_name: string;
    email: string;
    role: string;
    status: string;
    phone: string | null;
    created_at: string;
  }>;
  invitations: Array<{
    id: string;
    email: string;
    role: string;
    status: string;
    expires_at: string;
    created_at: string;
    accepted_at: string | null;
  }>;
  assessments: Array<{
    id: string;
    title: string;
    engagement_code: string;
    status: string;
    created_at: string;
    target_completion_date: string | null;
  }>;
}

export interface InvitationResult {
  id: string;
  tenantId: string;
  email: string;
  role: string;
  token: string;
  activationUrl: string;
  expiresAt: string;
  emailDelivery: {
    sent: boolean;
    reason: string;
  };
}

/** tenants row returned when a customer organisation is created. */
export interface CustomerRecord {
  id: string;
  type: "TLI" | "CLIENT";
  name: string;
  slug: string;
  industry: string | null;
  is_sdf: boolean;
  dpo_name: string | null;
  dpo_email: string | null;
  status: string;
  created_at: Date;
}

/** users row returned when an account is provisioned or activated (never includes credentials). */
export interface ProvisionedUserRecord {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string | null;
  is_active: boolean;
  created_at: Date;
}

/** assessments row returned when an assessment is created. */
export interface CreatedAssessmentRecord {
  id: string;
  tenant_id: string;
  title: string;
  engagement_code: string;
  status: string;
  target_completion_date: Date | null;
  created_at: Date;
}

