import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { executeWithRls } from "@/lib/db/rls";
import { isTliRole } from "@/lib/auth/rbac";
import { Badge } from "@/components/ui/badge";
import {
  FileCheck2,
  Calendar,
  User,
  ShieldCheck,
  AlertCircle,
  Plus,
  ArrowRight,
  FileText,
  Paperclip,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AssessmentsPage() {
  const sessionUser = await getCurrentSession();
  if (!sessionUser) {
    redirect("/login?redirect=/dashboard/assessments");
  }

  // Fetch assessments under RLS
  const assessments = await executeWithRls(sessionUser, async (client) => {
    const sql = `
      SELECT 
        a.id,
        a.tenant_id,
        a.title,
        a.engagement_code,
        'ENTERPRISE_GAP_ASSESSMENT' AS assessment_type,
        a.status,
        fv.name AS target_framework,
        a.created_at AS start_date,
        a.target_completion_date,
        u.full_name AS lead_consultant_name,
        t.dpo_name AS dpo_contact_name,
        a.created_at,
        t.name AS tenant_name,
        t.slug AS tenant_slug,
        t.is_sdf
      FROM assessments a
      JOIN framework_versions fv ON fv.id = a.framework_version_id
      LEFT JOIN users u ON u.id = a.lead_consultant_id
      LEFT JOIN tenants t ON t.id = a.tenant_id
      ORDER BY a.created_at DESC;
    `;
    const res = await client.query(sql);
    return res.rows;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "FINALIZED":
      case "COMPLETED":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Completed
          </span>
        );
      case "DATA_GATHERING":
      case "IN_PROGRESS":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            In Progress
          </span>
        );
      case "CONSULTANT_REVIEW":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            Pending Validation
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Draft
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Assessments
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage customer engagements, questionnaire responses, and compliance validations.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/dashboard/assessments/new"
            className="inline-flex items-center px-4 py-2 bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            <span>New Assessment</span>
          </Link>
        </div>
      </div>

      {/* Assessments List */}
      {assessments.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
          <AlertCircle className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">
            No Assessments Found
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
            Your profile currently has no active compliance assessments assigned under RLS policy.
          </p>
          <Link
            href="/dashboard/assessments/new"
            className="inline-flex items-center px-4 py-2 bg-[#0066FF] text-white text-xs font-semibold rounded-lg"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Create First Assessment</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {assessments.map((assessment) => (
            <div
              key={assessment.id}
              className="bg-white rounded-xl border border-slate-200 p-6 hover:border-slate-300 transition-all shadow-xs"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="space-y-1">
                  <div className="flex items-center space-x-3">
                    <span className="font-mono text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {assessment.engagement_code}
                    </span>
                    <h3 className="font-bold text-slate-900 text-base">
                      {assessment.title}
                    </h3>
                    {getStatusBadge(assessment.status)}
                  </div>
                  <p className="text-xs text-slate-500">
                    Customer:{" "}
                    <span className="font-semibold text-slate-800">
                      {assessment.tenant_name}
                    </span>
                    {assessment.is_sdf && (
                      <span className="ml-2 text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded font-medium">
                        Significant Data Fiduciary
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex items-center space-x-2 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 self-start md:self-auto">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>Framework: <strong className="text-slate-800">{assessment.target_framework}</strong></span>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-xs text-slate-600">
                <div className="flex items-center space-x-2.5">
                  <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Lead Assessor</span>
                    <span className="font-medium text-slate-800">{assessment.lead_consultant_name || "Anita Sharma"}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2.5">
                  <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Commencement Date</span>
                    <span className="font-medium text-slate-800">
                      {assessment.start_date
                        ? new Date(assessment.start_date).toLocaleDateString()
                        : "—"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2.5">
                  <FileCheck2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Target Completion</span>
                    <span className="font-medium text-slate-800">
                      {assessment.target_completion_date
                        ? new Date(assessment.target_completion_date).toLocaleDateString()
                        : "Not set"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <Link
                  href={`/dashboard/assessments/${assessment.id}/evidence`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg shadow-2xs transition-colors"
                >
                  <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                  <span>Evidence</span>
                </Link>

                {isTliRole(sessionUser.role) && (
                  <Link
                    href={`/dashboard/assessments/${assessment.id}/review`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 rounded-lg shadow-2xs transition-colors"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>Assessor Review</span>
                  </Link>
                )}

                <Link
                  href={`/dashboard/assessments/${assessment.id}/gaps`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-lg shadow-2xs transition-colors"
                >
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Gap Analysis</span>
                </Link>

                <Link
                  href={`/dashboard/assessments/${assessment.id}/remediation`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 rounded-lg shadow-2xs transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Remediation</span>
                </Link>

                <Link
                  href={`/dashboard/assessments/${assessment.id}/summary`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg shadow-2xs transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>Summary & Review</span>
                </Link>

                <Link
                  href={`/dashboard/assessments/${assessment.id}/questionnaire`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-[#0066FF] hover:bg-[#0052CC] text-white rounded-lg shadow-sm transition-colors"
                >
                  <span>Questionnaire</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
