import React from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { getRoleBadgeLabel, isTliRole } from "@/lib/auth/rbac";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Building2, User } from "lucide-react";
import { getMfaStatus } from "@/lib/auth/mfa";
import { SecuritySettings } from "@/components/settings/SecuritySettings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const sessionUser = await getCurrentSession();
  if (!sessionUser) {
    redirect("/login?redirect=/dashboard/settings");
  }
  const roleBadge = getRoleBadgeLabel(sessionUser.role);
  const mfa = await getMfaStatus(sessionUser);
  const isConsultant = isTliRole(sessionUser.role);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">
          Account & Security Overview
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Authenticated session context and enterprise tenant configuration.
        </p>
      </div>

      <SecuritySettings mfaEnabled={mfa.enabled} recoveryCodesRemaining={mfa.recoveryCodesRemaining} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Identity Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <User className="w-5 h-5 text-blue-600" />
              <CardTitle>User Profile</CardTitle>
            </div>
            <Badge variant={roleBadge.variant}>{roleBadge.label}</Badge>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div>
              <span className="text-slate-400 block uppercase font-semibold text-[10px]">
                Full Name
              </span>
              <span className="text-sm font-semibold text-slate-800">
                {sessionUser.fullName}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block uppercase font-semibold text-[10px]">
                Corporate Email
              </span>
              <span className="text-sm font-mono text-slate-800">
                {sessionUser.email}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block uppercase font-semibold text-[10px]">
                User ID (UUIDv7)
              </span>
              <span className="font-mono text-slate-600 text-[11px]">
                {sessionUser.userId}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block uppercase font-semibold text-[10px]">
                Assigned Authority
              </span>
              <p className="text-slate-600 mt-0.5">
                {isConsultant
                  ? "Authorized CloudE5 platform reviewer. Cross-tenant assessment evaluation privileges active."
                  : "Authorized client organization contributor. Access strictly restricted to tenant boundary."}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Tenant Organization Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-slate-600" />
              <CardTitle>Organization Scope</CardTitle>
            </div>
            {sessionUser.isSdf ? (
              <Badge variant="amber">Significant Data Fiduciary</Badge>
            ) : (
              <Badge variant="slate">Standard Fiduciary</Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div>
              <span className="text-slate-400 block uppercase font-semibold text-[10px]">
                Organization Name
              </span>
              <span className="text-sm font-semibold text-slate-800">
                {sessionUser.tenantName}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block uppercase font-semibold text-[10px]">
                Tenant Identifier Slug
              </span>
              <span className="text-sm font-mono text-slate-800">
                {sessionUser.tenantSlug}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block uppercase font-semibold text-[10px]">
                Tenant UUID
              </span>
              <span className="font-mono text-slate-600 text-[11px]">
                {sessionUser.tenantId}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block uppercase font-semibold text-[10px]">
                Tenant Classification
              </span>
              <span className="text-slate-700 font-medium">
                {sessionUser.tenantType === "TLI"
                  ? "CloudE5 Platform Operator"
                  : sessionUser.isSdf
                  ? "Significant Data Fiduciary (Section 10 Additional Obligations)"
                  : "Standard Data Fiduciary"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Security Architecture & Governance Notice */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-emerald-600" />
            <CardTitle>Security Architecture & Governance Status</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-slate-600">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">
                PostgreSQL Kernel Row-Level Security (RLS)
              </span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold">
                ACTIVE
              </span>
            </div>
            <p className="text-slate-500">
              Every query runs through CloudE5&apos;s tenant policy layer, bound to your verified identity for that request, so you only ever see your own organisation&apos;s data.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">
                Stateless Session Cryptography (HTTP-Only)
              </span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold">
                ACTIVE
              </span>
            </div>
            <p className="text-slate-500">
              Sessions are maintained via cryptographically signed HMAC-SHA256 JSON Web Tokens with strict 8-hour expiry. Tokens are stored in secure, SameSite=Lax, HttpOnly cookies immune to client-side script extraction.
            </p>
          </div>

          <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-blue-900">
                Single sign-on
              </span>
              <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-semibold">
                NOT YET AVAILABLE
              </span>
            </div>
            <p className="text-blue-800">
              Single sign-on (SAML / OIDC) is not yet available. Sign-in uses bcrypt-hashed passwords with optional two-factor authentication.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
