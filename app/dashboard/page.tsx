import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { executeWithRls } from "@/lib/db/rls";
import { getRoleBadgeLabel, isTliRole } from "@/lib/auth/rbac";
import {
  FileCheck2,
  Building2,
  FileSpreadsheet,
  ArrowRight,
  ShieldAlert,
  Info,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const sessionUser = await getCurrentSession();
  if (!sessionUser) {
    redirect("/login?redirect=/dashboard");
  }
  const roleBadge = getRoleBadgeLabel(sessionUser.role);
  const isConsultant = isTliRole(sessionUser.role);

  // Fetch real database metrics under RLS
  const stats = await executeWithRls(sessionUser, async (client) => {
    // 1. Assessment count
    const assessmentsRes = await client.query(
      "SELECT COUNT(*)::int AS count FROM assessments;"
    );
    const assessmentCount = assessmentsRes.rows[0]?.count || 0;

    // 2. Business units count
    const buRes = await client.query(
      "SELECT COUNT(*)::int AS count FROM business_units;"
    );
    const buCount = buRes.rows[0]?.count || 0;

    // 3. Processing activities count (RoPA)
    const ropaRes = await client.query(
      "SELECT COUNT(*)::int AS count FROM processing_activities;"
    );
    const ropaCount = ropaRes.rows[0]?.count || 0;

    // 4. Recent assessment sample
    const recentRes = await client.query(
      "SELECT id, title, status, target_framework, start_date FROM assessments ORDER BY created_at DESC LIMIT 1;"
    );
    const latestAssessment = recentRes.rows[0] || null;

    return {
      assessmentCount,
      buCount,
      ropaCount,
      latestAssessment,
    };
  });

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <h1 className="text-xl font-bold text-slate-900">
              Welcome back, {sessionUser.fullName}
            </h1>
            <Badge variant={roleBadge.variant}>{roleBadge.label}</Badge>
          </div>
          <p className="text-sm text-slate-600">
            {isConsultant
              ? "Truth Labs International Forensic Advisory Console — Manage tenant assessments, scoping reviews, and compliance gap validations."
              : `Compliance workspace for ${sessionUser.tenantName}. Track assessment progress, submit documentary evidence, and remediate statutory gaps.`}
          </p>
        </div>
        <Link
          href="/dashboard/assessments"
          className="inline-flex items-center justify-center px-4 py-2 bg-blue-700 text-white text-sm font-medium rounded-lg hover:bg-blue-800 transition-colors shadow-sm self-start md:self-auto"
        >
          <span>View Assessments</span>
          <ArrowRight className="w-4 h-4 ml-2" />
        </Link>
      </div>

      {/* Genuine Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Active Assessments
              </span>
              <FileCheck2 className="w-5 h-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {stats.assessmentCount}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Engagements accessible under RLS scope
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Business Units
              </span>
              <Building2 className="w-5 h-5 text-slate-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {stats.buCount}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Departmental scopes configured
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Processing Activities (RoPA)
              </span>
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {stats.ropaCount}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Mapped operational workflows (Sections 6 & 7)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Engagement / Latest Assessment Card */}
      <Card>
        <CardHeader>
          <CardTitle>Current Assessment Scope</CardTitle>
          <span className="text-xs text-slate-500 font-medium">
            PostgreSQL Kernel Row-Level Security Enforced
          </span>
        </CardHeader>
        <CardContent>
          {stats.latestAssessment ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <h4 className="font-semibold text-slate-900 text-sm">
                    {stats.latestAssessment.title}
                  </h4>
                  <Badge variant="blue" size="sm">
                    {stats.latestAssessment.status}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">
                  Target Framework:{" "}
                  <span className="font-medium text-slate-700">
                    {stats.latestAssessment.target_framework}
                  </span>{" "}
                  • Commenced:{" "}
                  <span className="font-medium text-slate-700">
                    {stats.latestAssessment.start_date
                      ? new Date(stats.latestAssessment.start_date).toLocaleDateString()
                      : "Scheduled"}
                  </span>
                </p>
              </div>
              <Link
                href="/dashboard/assessments"
                className="inline-flex items-center text-xs font-semibold text-blue-700 hover:text-blue-900 self-start sm:self-auto"
              >
                Inspect Assessment &rarr;
              </Link>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 text-sm">
              <Info className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p>No assessment engagements currently assigned to your profile.</p>
              <p className="text-xs text-slate-400 mt-1">
                Consult with your TLI Lead Consultant to initiate an evaluation.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Role-Based Next Action Guidance */}
      <Card>
        <CardHeader>
          <CardTitle>Workspace Guidance & Next Steps</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-slate-600">
            {isConsultant ? (
              <div className="p-4 bg-blue-50/60 rounded-lg border border-blue-100 flex items-start space-x-3">
                <ShieldAlert className="w-5 h-5 text-blue-700 flex-shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <span className="font-semibold text-blue-900 block">
                    TLI Consultant Advisory Role
                  </span>
                  <p className="text-blue-800">
                    You have forensic evaluation privileges. Use the Assessments view to examine documentary evidence, review response justifications against DPDP statutory provisions, and raise clarification threads.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-100/70 rounded-lg border border-slate-200 flex items-start space-x-3">
                <Info className="w-5 h-5 text-slate-700 flex-shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <span className="font-semibold text-slate-900 block">
                    Client Organization Contributor Scope
                  </span>
                  <p className="text-slate-700">
                    All operations are restricted strictly to {sessionUser.tenantName}. Ensure all submitted evidence artifacts undergo pre-upload PII redaction certification in compliance with Section 4 of TLI Evidence Standards.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
