import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { executeWithRls } from "@/lib/db/rls";
import { isTliRole } from "@/lib/auth/rbac";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Calendar,
  User,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  Info,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReportsListPage() {
  const sessionUser = await getCurrentSession();
  if (!sessionUser) {
    redirect("/login?redirect=/dashboard/reports");
  }

  const isConsultant = isTliRole(sessionUser.role);

  // Fetch reports accessible under RLS
  const assessments = await executeWithRls(sessionUser, async (client) => {
    const sql = `
      SELECT 
        a.id,
        a.tenant_id,
        a.title,
        a.assessment_type,
        a.status,
        a.target_framework,
        a.start_date,
        a.target_completion_date,
        a.lead_consultant_name,
        a.dpo_contact_name,
        a.created_at,
        t.name AS tenant_name,
        t.slug AS tenant_slug,
        t.is_sdf
      FROM assessments a
      JOIN tenants t ON t.id = a.tenant_id
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-stone-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] uppercase font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
              Audit Deliverables
            </span>
            <span className="text-[11px] font-mono text-stone-500">
              {isConsultant ? "All Client Engagements" : `Tenant: ${sessionUser.tenantName}`}
            </span>
          </div>
          <h1 className="font-serif text-2xl font-bold text-stone-900">
            Compliance Evaluation Reports
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Document-oriented compliance gap analysis reports and statutory findings under DPDPA 2023.
          </p>
        </div>

        <div className="text-xs font-mono text-stone-600 bg-stone-50 border border-stone-200 rounded px-3 py-1.5 self-start sm:self-auto">
          Isolation Mode: <span className="font-semibold text-stone-900">RLS Boundary Active</span>
        </div>
      </div>

      {/* Synthetic Preview Notice */}
      <div className="p-3.5 bg-[#fbfaf8] border border-stone-200 rounded-lg text-xs text-stone-600 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-stone-500 flex-shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-stone-900">Synthetic Preview Mode:</strong> Reports reflect verified questionnaire submissions and provisional control evaluations. In accordance with DEC-01 and DEC-08, numeric scores are advisory pending final methodology ratification.
        </div>
      </div>

      {/* Reports List */}
      {assessments.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <AlertCircle className="w-8 h-8 text-stone-400 mx-auto mb-2" />
            <h3 className="font-serif text-sm font-bold text-stone-800">
              No Accessible Reports Found
            </h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
              Your profile currently has no active compliance assessments assigned under RLS policy.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {assessments.map((a) => (
            <div
              key={a.id}
              className="bg-white border border-stone-200 rounded-xl p-5 hover:border-stone-400 transition-colors shadow-xs"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-3 border-b border-stone-100">
                <div className="space-y-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="font-serif font-bold text-stone-900 text-base">
                      {a.title}
                    </h3>
                    {getStatusBadge(a.status)}
                  </div>
                  <p className="text-xs text-stone-500 font-mono">
                    Organization: <strong className="text-stone-800">{a.tenant_name}</strong>
                    {a.is_sdf && (
                      <span className="ml-2 text-[10px] bg-amber-50 text-amber-900 border border-amber-200 px-1.5 py-0.2 rounded font-mono">
                        SDF
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex items-center space-x-2 text-xs font-mono text-stone-600 bg-stone-50 px-2.5 py-1 rounded border border-stone-200 self-start md:self-auto">
                  <ShieldCheck className="w-3.5 h-3.5 text-stone-700" />
                  <span>Framework: {a.target_framework}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 text-xs text-stone-600">
                <div className="flex items-center space-x-2">
                  <User className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase font-mono font-semibold">Lead Consultant</span>
                    <span className="font-medium text-stone-800">{a.lead_consultant_name || "TLI Advisory"}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Calendar className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase font-mono font-semibold">Target Completion</span>
                    <span className="font-medium text-stone-800 font-mono">
                      {a.target_completion_date
                        ? new Date(a.target_completion_date).toLocaleDateString()
                        : "Q4 2026 Audit"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-start sm:justify-end">
                  <Link
                    href={`/dashboard/reports/${a.id}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-[#16191f] hover:bg-stone-800 text-white rounded-md shadow-xs transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Open Report Preview</span>
                    <ArrowRight className="w-3 h-3 ml-0.5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

