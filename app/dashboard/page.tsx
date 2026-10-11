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
  FileText,
  CheckCircle2,
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
      {/* Welcome & Context Banner */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <h1 className="font-serif text-xl font-bold text-stone-900">
              Welcome back, {sessionUser.fullName}
            </h1>
            <Badge variant={roleBadge.variant}>{roleBadge.label}</Badge>
          </div>
          <p className="text-xs text-stone-600 max-w-3xl leading-relaxed">
            {isConsultant
              ? "Truth Labs International Forensic Advisory Console — Manage tenant assessments, scoping reviews, evidence validation, and gap evaluations."
              : `Compliance workspace for ${sessionUser.tenantName}. Complete statutory questionnaire sections, attach verified evidence, and review gap findings.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
          {stats.latestAssessment && (
            <Link
              href={`/dashboard/assessments/${stats.latestAssessment.id}/questionnaire`}
              className="inline-flex items-center justify-center px-3.5 py-2 bg-[#16191f] hover:bg-stone-800 text-white text-xs font-semibold rounded-md shadow-xs transition-colors"
            >
              <span>Open Questionnaire</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Link>
          )}
          <Link
            href="/dashboard/reports"
            className="inline-flex items-center justify-center px-3.5 py-2 bg-white hover:bg-stone-50 border border-stone-300 text-stone-800 text-xs font-semibold rounded-md shadow-xs transition-colors"
          >
            <span>Compliance Reports</span>
          </Link>
        </div>
      </div>

      {/* Genuine Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-stone-500">
                Active Assessments
              </span>
              <FileCheck2 className="w-4 h-4 text-stone-700" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-stone-900">
              {stats.assessmentCount}
            </div>
            <p className="text-[11px] text-stone-500 mt-1">
              Engagements accessible under tenant RLS policy
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-stone-500">
                Business Units
              </span>
              <Building2 className="w-4 h-4 text-stone-700" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-stone-900">
              {stats.buCount}
            </div>
            <p className="text-[11px] text-stone-500 mt-1">
              Departmental scopes in compliance boundary
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-stone-500">
                Processing Activities (RoPA)
              </span>
              <FileSpreadsheet className="w-4 h-4 text-stone-700" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-stone-900">
              {stats.ropaCount}
            </div>
            <p className="text-[11px] text-stone-500 mt-1">
              Documented data processing streams (Sections 6 & 7)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Engagement / Latest Assessment Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Current Assessment Inquest</CardTitle>
            <span className="text-[11px] font-mono text-stone-500 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
              RLS Kernel Isolation Active
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {stats.latestAssessment ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-[#fbfaf8] rounded-lg border border-stone-200 gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2.5">
                  <h4 className="font-semibold text-stone-900 text-sm">
                    {stats.latestAssessment.title}
                  </h4>
                  <Badge variant="blue" size="sm">
                    {stats.latestAssessment.status}
                  </Badge>
                </div>
                <p className="text-xs text-stone-500 font-mono">
                  Framework: <strong className="text-stone-700">{stats.latestAssessment.target_framework}</strong> • Commenced:{" "}
                  {stats.latestAssessment.start_date
                    ? new Date(stats.latestAssessment.start_date).toLocaleDateString()
                    : "Scheduled"}
                </p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <Link
                  href={`/dashboard/assessments/${stats.latestAssessment.id}/questionnaire`}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-semibold bg-[#16191f] text-white hover:bg-stone-800 rounded transition-colors"
                >
                  <span>Launch Questionnaire</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Link>
                <Link
                  href={`/dashboard/reports/${stats.latestAssessment.id}`}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-semibold bg-white text-stone-800 hover:bg-stone-50 border border-stone-300 rounded transition-colors"
                >
                  <span>View Report</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-stone-500 text-xs">
              <Info className="w-6 h-6 text-stone-400 mx-auto mb-2" />
              <p>No assessment engagements currently assigned to your profile.</p>
              <p className="text-[11px] text-stone-400 mt-0.5">
                Consult with your TLI Lead Consultant to initialize an evaluation.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Role-Based Guidance */}
      <Card>
        <CardHeader>
          <CardTitle>Enterprise Compliance Guidelines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-xs text-stone-600">
            {isConsultant ? (
              <div className="p-3.5 bg-stone-50 rounded-lg border border-stone-200 flex items-start space-x-3">
                <ShieldAlert className="w-4 h-4 text-stone-700 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-semibold text-stone-900 block font-mono text-[11px]">
                    TLI Consultant Forensic Scope
                  </span>
                  <p className="text-stone-600 leading-relaxed">
                    You have evaluation and review authority. Use the Questionnaire and Reports views to examine documentary evidence, review response maturity scores, validate exclusion justifications under DEC-01, and draft gap remediation findings.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-stone-50 rounded-lg border border-stone-200 flex items-start space-x-3">
                <CheckCircle2 className="w-4 h-4 text-stone-700 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-semibold text-stone-900 block font-mono text-[11px]">
                    Client Organization Workflow
                  </span>
                  <p className="text-stone-600 leading-relaxed">
                    Data principal safeguards and operational controls must be reported accurately. Complete the 13 questionnaire sections, attach documentary evidence to the local vault, and submit the assessment to TLI for independent verification.
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
