/**
 * CloudE5 — Authentication & Identity Types
 *
 * Defines the 7 application roles, session context structures, and authentication contracts.
 */

export type UserRole =
  | "TLI_SUPER_ADMIN"
  | "TLI_LEAD_CONSULTANT"
  | "TLI_REVIEWER"
  | "CLIENT_ADMIN"
  | "CLIENT_BU_LEAD"
  | "CLIENT_CONTRIBUTOR"
  | "CLIENT_VIEWER";

export type TenantType = "TLI" | "CLIENT";

export interface SessionUser {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  tenantType: TenantType;
  isSdf: boolean;
  /** users.session_version at sign-in; sessions with an older version are revoked. */
  sessionVersion?: number;
}

export interface AuthSuccessResult {
  success: true;
  user: SessionUser;
  token: string;
}

export interface AuthFailureResult {
  success: false;
  error: string;
}

export type AuthResult = AuthSuccessResult | AuthFailureResult;

