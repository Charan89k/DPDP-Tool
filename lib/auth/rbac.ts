/**
 * TLI DPDP Compliance Gap Analysis Tool — Role-Based Access Control (RBAC) Matrix
 *
 * Implements strict, server-side permission rules for the 7 defined application roles.
 * Denies access by default.
 */

import type { UserRole } from "./types.ts";

export const ALL_ROLES: UserRole[] = [
  "TLI_SUPER_ADMIN",
  "TLI_LEAD_CONSULTANT",
  "TLI_REVIEWER",
  "CLIENT_ADMIN",
  "CLIENT_BU_LEAD",
  "CLIENT_CONTRIBUTOR",
  "CLIENT_VIEWER",
];

export const TLI_ROLES: UserRole[] = [
  "TLI_SUPER_ADMIN",
  "TLI_LEAD_CONSULTANT",
  "TLI_REVIEWER",
];

export const CLIENT_ROLES: UserRole[] = [
  "CLIENT_ADMIN",
  "CLIENT_BU_LEAD",
  "CLIENT_CONTRIBUTOR",
  "CLIENT_VIEWER",
];

export function isTliRole(role: UserRole): boolean {
  return TLI_ROLES.includes(role);
}

export function isClientRole(role: UserRole): boolean {
  return CLIENT_ROLES.includes(role);
}

export function canAccessAllTenants(role: UserRole): boolean {
  return role === "TLI_SUPER_ADMIN";
}

export function canUploadEvidence(role: UserRole): boolean {
  // CLIENT_VIEWER is explicitly blocked from uploading
  return role !== "CLIENT_VIEWER";
}

export function canReviewAssessment(role: UserRole): boolean {
  return TLI_ROLES.includes(role);
}

export function canFinalizeAssessment(role: UserRole): boolean {
  return role === "TLI_SUPER_ADMIN" || role === "TLI_LEAD_CONSULTANT";
}

export function canManageTenantUsers(role: UserRole): boolean {
  return role === "TLI_SUPER_ADMIN" || role === "CLIENT_ADMIN";
}

export function canCreateCustomer(role: UserRole): boolean {
  return role === "TLI_SUPER_ADMIN";
}

export function canEditQuestionnaire(role: UserRole): boolean {
  return (
    role === "CLIENT_ADMIN" ||
    role === "CLIENT_BU_LEAD" ||
    role === "CLIENT_CONTRIBUTOR"
  );
}

export function getRoleBadgeLabel(role: UserRole): {
  label: string;
  variant: "indigo" | "blue" | "emerald" | "amber" | "slate";
} {
  switch (role) {
    case "TLI_SUPER_ADMIN":
      return { label: "TLI Super Admin", variant: "indigo" };
    case "TLI_LEAD_CONSULTANT":
      return { label: "Lead Consultant", variant: "blue" };
    case "TLI_REVIEWER":
      return { label: "Privacy Reviewer", variant: "blue" };
    case "CLIENT_ADMIN":
      return { label: "Client Admin", variant: "emerald" };
    case "CLIENT_BU_LEAD":
      return { label: "Business Unit Lead", variant: "amber" };
    case "CLIENT_CONTRIBUTOR":
      return { label: "Contributor", variant: "slate" };
    case "CLIENT_VIEWER":
      return { label: "Executive Viewer", variant: "slate" };
    default:
      return { label: role, variant: "slate" };
  }
}
