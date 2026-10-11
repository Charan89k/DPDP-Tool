import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { executeWithRls } from "@/lib/db/rls";
import {
  Plus,
  ClipboardList,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Calendar,
  Users,
  BarChart3,
  ChevronRight,
  MoreHorizontal,
  ShieldCheck,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const sessionUser = await getCurrentSession();
  if (!sessionUser) {
    redirect("/login?redirect=/dashboard");
  }

  // Fetch real database metrics and assessments under RLS
  const dbData = await executeWithRls(sessionUser, async (client) => {
    // 1. Status metric counts from live assessments table
    const countsRes = await client.query(`
      SELECT 
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status IN ('DATA_GATHERING', 'SCOPING', 'SCOPE_LOCKED', 'UNDER_REVIEW'))::int AS in_progress,
        COUNT(*) FILTER (WHERE status IN ('SUBMITTED_FOR_REVIEW', 'CLARIFICATION_PENDING'))::int AS pending_val,
        COUNT(*) FILTER (WHERE status IN ('DRAFT', 'DRAFT_REPORT_GENERATED', 'REVIEW_COMPLETED'))::int AS draft,
        COUNT(*) FILTER (WHERE status IN ('LEAD_APPROVED', 'FINAL_ISSUED', 'REMEDIATION_ACTIVE', 'ARCHIVED'))::int AS completed
      FROM assessments;
    `);

    const counts = countsRes.rows[0] || {
      total: 0,
      in_progress: 0,
      pending_val: 0,
      draft: 0,
      completed: 0,
    };

    // 2. Fetch accessible assessments under RLS
    const listRes = await client.query(`
      SELECT 
        a.id, 
        a.engagement_code,
        a.title, 
        a.status, 
        t.name AS customer_name,
        COALESCE(t.industry, 'IT / ITES') AS industry,
        a.created_at AS visit_date,
        u.full_name AS assessor_name
      FROM assessments a
      LEFT JOIN tenants t ON t.id = a.tenant_id
      LEFT JOIN users u ON u.id = a.lead_consultant_id
      ORDER BY a.created_at DESC
      LIMIT 10;
    `);

    return {
      counts,
      assessments: listRes.rows,
    };
  });

  const { counts, assessments } = dbData;
  const totalCount = counts.total;
  const inProgressCount = counts.in_progress;
  const pendingValidationCount = counts.pending_val;
  const reportDraftCount = counts.draft;
  const completedCount = counts.completed;

  // Compute percentages for status donut chart
  const denom = totalCount > 0 ? totalCount : 1;
  const inProgressPct = Math.round((inProgressCount / denom) * 100);
  const pendingPct = Math.round((pendingValidationCount / denom) * 100);
  const draftPct = Math.round((reportDraftCount / denom) * 100);
  const completedPct = Math.round((completedCount / denom) * 100);

  // Helper for status badge styling
  const getStatusPill = (status: string) => {
    switch (status) {
      case "LEAD_APPROVED":
      case "FINAL_ISSUED":
      case "REMEDIATION_ACTIVE":
      case "ARCHIVED":
      case "FINALIZED":
      case "COMPLETED":
        return {
          label: "Completed",
          pillClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
          barClass: "bg-emerald-500",
          progress: 100,
        };
      case "SUBMITTED_FOR_REVIEW":
      case "CLARIFICATION_PENDING":
      case "CONSULTANT_REVIEW":
      case "PENDING_VALIDATION":
        return {
          label: "Pending Validation",
          pillClass: "bg-amber-50 text-amber-800 border-amber-200",
          barClass: "bg-amber-500",
          progress: 80,
        };
      case "DRAFT_REPORT_GENERATED":
      case "REVIEW_COMPLETED":
      case "DRAFT":
        return {
          label: "Report Draft",
          pillClass: "bg-purple-50 text-purple-700 border-purple-200",
          barClass: "bg-purple-500",
          progress: 50,
        };
      case "DATA_GATHERING":
      case "SCOPING":
      case "SCOPE_LOCKED":
      case "UNDER_REVIEW":
      case "IN_PROGRESS":
      default:
        return {
          label: "In Progress",
          pillClass: "bg-blue-50 text-blue-700 border-blue-200",
          barClass: "bg-[#0066FF]",
          progress: 67,
        };
    }
  };

  const firstAssessmentId = assessments[0]?.id;

  return (
    <div className="space-y-6">
      {/* 1. Welcome Hero Banner */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[#EFF6FF] via-[#F0F7FF] to-[#E0EFFF] border border-blue-100 p-7 shadow-xs">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="space-y-1.5 max-w-xl">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Welcome, {sessionUser.fullName}
            </h1>
            <p className="text-sm text-slate-600">
              Manage your DPDP Gap Assessments from here.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            <Link
              href="/dashboard/assessments/new"
              className="inline-flex items-center justify-center px-4 py-2.5 bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              <span>New Assessment</span>
            </Link>
          </div>
        </div>

        {/* Corporate architectural background watermark */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-20 pointer-events-none hidden md:flex items-center justify-end pr-8">
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest font-bold text-blue-900">
              Data Protection Compliance
            </p>
            <p className="text-sm font-semibold text-blue-950">
              Stronger Organizations
            </p>
          </div>
        </div>
      </div>

      {/* 2. Top 5 KPI Status Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Card 1: Total Assessments */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <span className="text-2xl font-bold text-slate-900 block leading-tight">
                {totalCount}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Total Assessments
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: In Progress */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-2xl font-bold text-slate-900 block leading-tight">
                {inProgressCount}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                In Progress
              </span>
            </div>
          </div>
          <Link
            href="/dashboard/assessments"
            className="text-xs font-semibold text-[#0066FF] hover:underline"
          >
            View &rarr;
          </Link>
        </div>

        {/* Card 3: Pending Validation */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-2xl font-bold text-slate-900 block leading-tight">
                {pendingValidationCount}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Pending Validation
              </span>
            </div>
          </div>
          <Link
            href="/dashboard/assessments"
            className="text-xs font-semibold text-[#0066FF] hover:underline"
          >
            View &rarr;
          </Link>
        </div>

        {/* Card 4: Report Draft */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-2xl font-bold text-slate-900 block leading-tight">
                {reportDraftCount}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Report Draft
              </span>
            </div>
          </div>
          <Link
            href="/dashboard/reports"
            className="text-xs font-semibold text-[#0066FF] hover:underline"
          >
            View &rarr;
          </Link>
        </div>

        {/* Card 5: Completed */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-2xl font-bold text-slate-900 block leading-tight">
                {completedCount}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Completed
              </span>
            </div>
          </div>
          <Link
            href="/dashboard/reports"
            className="text-xs font-semibold text-[#0066FF] hover:underline"
          >
            View &rarr;
          </Link>
        </div>
      </div>

      {/* 3. Middle Row: Assessment Status Donut | Domain Completion | My Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Assessment Status Donut Card (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <h3 className="font-bold text-slate-900 text-sm mb-4">
            Assessment Status
          </h3>

          <div className="flex items-center justify-between gap-4">
            {/* SVG Donut Chart */}
            <div className="relative w-36 h-36 flex-shrink-0 flex items-center justify-center">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="14" fill="transparent" stroke="#F1F5F9" strokeWidth="4.5" />
                {totalCount > 0 && (
                  <>
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      fill="transparent"
                      stroke="#0066FF"
                      strokeWidth="4.5"
                      strokeDasharray={`${(inProgressPct * 87.96) / 100} 87.96`}
                      strokeDashoffset="0"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      fill="transparent"
                      stroke="#F59E0B"
                      strokeWidth="4.5"
                      strokeDasharray={`${(pendingPct * 87.96) / 100} 87.96`}
                      strokeDashoffset={`-${(inProgressPct * 87.96) / 100}`}
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      fill="transparent"
                      stroke="#8B5CF6"
                      strokeWidth="4.5"
                      strokeDasharray={`${(draftPct * 87.96) / 100} 87.96`}
                      strokeDashoffset={`-${((inProgressPct + pendingPct) * 87.96) / 100}`}
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      fill="transparent"
                      stroke="#10B981"
                      strokeWidth="4.5"
                      strokeDasharray={`${(completedPct * 87.96) / 100} 87.96`}
                      strokeDashoffset={`-${((inProgressPct + pendingPct + draftPct) * 87.96) / 100}`}
                    />
                  </>
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-bold text-slate-900">{totalCount}</span>
                <span className="text-[10px] text-slate-500 font-medium">Assessments</span>
              </div>
            </div>

            {/* Legend List */}
            <div className="space-y-2 text-xs flex-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#0066FF]" />
                  <span className="text-slate-600 font-medium">In Progress</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-slate-900">{inProgressCount}</span>
                  <span className="text-slate-400 text-[11px]">{inProgressPct}%</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
                  <span className="text-slate-600 font-medium">Pending Validation</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-slate-900">{pendingValidationCount}</span>
                  <span className="text-slate-400 text-[11px]">{pendingPct}%</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]" />
                  <span className="text-slate-600 font-medium">Report Draft</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-slate-900">{reportDraftCount}</span>
                  <span className="text-slate-400 text-[11px]">{draftPct}%</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
                  <span className="text-slate-600 font-medium">Completed</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-slate-900">{completedCount}</span>
                  <span className="text-slate-400 text-[11px]">{completedPct}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Domain-wise Completion Card (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-900 text-sm">
              Domain-wise Completion <span className="font-normal text-slate-500 text-xs">(All Assessments)</span>
            </h3>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium text-slate-700">Governance & Accountability</span>
                <div className="flex items-center space-x-2 text-slate-500">
                  <span className="font-semibold text-slate-800">80%</span>
                  <span>4 / 5</span>
                </div>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div className="bg-emerald-500 h-2 rounded-full" style={{ width: "80%" }} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium text-slate-700">Data Processing</span>
                <div className="flex items-center space-x-2 text-slate-500">
                  <span className="font-semibold text-slate-800">60%</span>
                  <span>3 / 5</span>
                </div>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div className="bg-[#0066FF] h-2 rounded-full" style={{ width: "60%" }} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium text-slate-700">Security Safeguards</span>
                <div className="flex items-center space-x-2 text-slate-500">
                  <span className="font-semibold text-slate-800">40%</span>
                  <span>2 / 5</span>
                </div>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div className="bg-amber-500 h-2 rounded-full" style={{ width: "40%" }} />
              </div>
            </div>
          </div>
        </div>

        {/* My Tasks Card (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-slate-900 text-sm">My Tasks</h3>
            <Link href="/dashboard/assessments" className="text-xs font-semibold text-[#0066FF] hover:underline">
              View All
            </Link>
          </div>

          <div className="space-y-2.5">
            <Link
              href="/dashboard/assessments"
              className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors group"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-slate-900">2</span>
                  <span className="text-xs text-slate-600 font-medium">Field Visits Scheduled</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
            </Link>

            <Link
              href="/dashboard/evidence"
              className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors group"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-slate-900">3</span>
                  <span className="text-xs text-slate-600 font-medium">Evidence to Review</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
            </Link>

            <Link
              href="/dashboard/assessments"
              className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors group"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-slate-900">1</span>
                  <span className="text-xs text-slate-600 font-medium">Assessments Pending Validation</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
            </Link>

            <Link
              href="/dashboard/reports"
              className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors group"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-slate-900">1</span>
                  <span className="text-xs text-slate-600 font-medium">Draft Report to Finalise</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
            </Link>
          </div>
        </div>
      </div>

      {/* 4. Bottom Row: Recent Assessments (8 cols) | Quick Actions (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Recent Assessments Table (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 pb-3 flex items-center justify-between border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm">Recent Assessments</h3>
            <Link
              href="/dashboard/assessments"
              className="text-xs font-semibold text-[#0066FF] hover:underline"
            >
              View All
            </Link>
          </div>

          <div className="overflow-x-auto">
            {assessments.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                <p>No compliance assessments currently initialized.</p>
                <Link
                  href="/dashboard/assessments/new"
                  className="mt-2 inline-flex items-center text-xs font-semibold text-[#0066FF] hover:underline"
                >
                  + Create New Assessment
                </Link>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold">
                  <tr>
                    <th className="py-3 px-4">Assessment ID</th>
                    <th className="py-3 px-4">Customer Name</th>
                    <th className="py-3 px-4">Industry</th>
                    <th className="py-3 px-4">Visit Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Progress</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assessments.map((item) => {
                    const statusInfo = getStatusPill(item.status);
                    const formattedDate = item.visit_date
                      ? new Date(item.visit_date).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "20 Aug 2024";

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-medium text-slate-900">
                          {item.engagement_code || "DPDP-2024-006"}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-800">
                          {item.customer_name}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {item.industry}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 font-medium">
                          {formattedDate}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusInfo.pillClass}`}
                          >
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-2">
                            <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-1.5 rounded-full ${statusInfo.barClass}`}
                                style={{ width: `${statusInfo.progress}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-medium text-slate-600">
                              {statusInfo.progress}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            <Link
                              href={`/dashboard/assessments/${item.id}/review`}
                              className="px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded shadow-2xs transition-colors"
                            >
                              Review
                            </Link>
                            <Link
                              href={`/dashboard/assessments/${item.id}/questionnaire`}
                              className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 hover:border-slate-400 hover:bg-slate-50 rounded shadow-2xs transition-colors"
                            >
                              Open
                            </Link>
                            <button
                              type="button"
                              className="p-1 text-slate-400 hover:text-slate-600 rounded"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Quick Actions Card (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-sm">Quick Actions</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
            {/* 1. New Assessment */}
            <Link
              href="/dashboard/assessments/new"
              className="p-3.5 rounded-xl border border-blue-100 bg-[#F0F7FF] hover:bg-[#E5F1FF] flex items-center justify-between group transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-[#0066FF] text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 leading-tight">
                    New Assessment
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Create a new DPDP gap assessment
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-blue-500 group-hover:translate-x-0.5 transition-transform" />
            </Link>

            {/* 2. Manage Customers */}
            <Link
              href="/dashboard/customers"
              className="p-3.5 rounded-xl border border-emerald-100 bg-[#F0FDF4] hover:bg-[#DCFCE7] flex items-center justify-between group transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 leading-tight">
                    Manage Customers
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    View and manage customer information
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-emerald-600 group-hover:translate-x-0.5 transition-transform" />
            </Link>

            {/* 3. Questionnaire */}
            <Link
              href={firstAssessmentId ? `/dashboard/assessments/${firstAssessmentId}/questionnaire` : "/dashboard/questionnaire"}
              className="p-3.5 rounded-xl border border-purple-100 bg-[#FAF5FF] hover:bg-[#F3E8FF] flex items-center justify-between group transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 leading-tight">
                    Questionnaire
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Start or continue assessment
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-purple-600 group-hover:translate-x-0.5 transition-transform" />
            </Link>

            {/* 4. Reports */}
            <Link
              href="/dashboard/reports"
              className="p-3.5 rounded-xl border border-amber-100 bg-[#FFFBEB] hover:bg-[#FEF3C7] flex items-center justify-between group transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 leading-tight">
                    Reports
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Generate and download assessment reports
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-600 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

