import React from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { executeWithRls } from "@/lib/db/rls";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileCheck2, Calendar, User, ShieldCheck, AlertCircle } from "lucide-react";

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
        return <Badge variant="emerald">{status}</Badge>;
      case "DATA_GATHERING":
      case "IN_PROGRESS":
        return <Badge variant="blue">{status}</Badge>;
      case "CONSULTANT_REVIEW":
        return <Badge variant="amber">{status}</Badge>;
      default:
        return <Badge variant="slate">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Compliance Assessments
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Deterministic evaluations mapped against India DPDP legal framework and rules.
          </p>
        </div>
        <div className="text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-1.5 self-start sm:self-auto shadow-sm">
          Isolation Mode: <span className="font-semibold text-slate-800">PostgreSQL RLS Active</span>
        </div>
      </div>

      {/* Assessments List */}
      {assessments.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <AlertCircle className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800">
              Zero Accessible Assessments
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Your profile has no active assessments assigned under the current tenant policy.
              Contact Truth Labs International to initialize an engagement.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {assessments.map((assessment) => (
            <Card key={assessment.id} className="hover:border-slate-300 transition-colors">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-3">
                      <h3 className="font-bold text-slate-900 text-base">
                        {assessment.title}
                      </h3>
                      {getStatusBadge(assessment.status)}
                    </div>
                    <p className="text-xs text-slate-500">
                      Organization:{" "}
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

                  <div className="flex items-center space-x-2 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200 self-start md:self-auto">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    <span>Framework: <strong className="text-slate-800">{assessment.target_framework}</strong></span>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-xs text-slate-600">
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Lead Consultant</span>
                      <span className="font-medium text-slate-800">{assessment.lead_consultant_name || "Assigned by TLI"}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Commencement Date</span>
                      <span className="font-medium text-slate-800">
                        {assessment.start_date
                          ? new Date(assessment.start_date).toLocaleDateString()
                          : "Scheduled"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <FileCheck2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Target Completion</span>
                      <span className="font-medium text-slate-800">
                        {assessment.target_completion_date
                          ? new Date(assessment.target_completion_date).toLocaleDateString()
                          : "Q4 2026 Audit"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions: Questionnaire & Report */}
                <div className="pt-4 mt-4 border-t border-stone-200/80 flex items-center justify-end gap-2.5">
                  <a
                    href={`/dashboard/reports/${assessment.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-white border border-stone-300 hover:bg-stone-50 text-stone-800 rounded-md transition-colors"
                  >
                    <span>View Report</span>
                  </a>
                  <a
                    href={`/dashboard/assessments/${assessment.id}/questionnaire`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#16191f] hover:bg-stone-800 text-white rounded-md shadow-xs transition-colors"
                  >
                    <span>Open Questionnaire</span>
                    <span aria-hidden="true">&rarr;</span>
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
