import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { executeWithRls } from "@/lib/db/rls";
import { EvidenceManagementClient } from "@/components/evidence/EvidenceManagementClient";

export const dynamic = "force-dynamic";

export default async function DefaultEvidencePage() {
  const sessionUser = await getCurrentSession();
  if (!sessionUser) {
    redirect("/login?redirect=/dashboard/evidence");
  }

  // Load the active assessment under RLS
  const assessment = await executeWithRls(sessionUser, async (client) => {
    const res = await client.query(
      `SELECT a.id, a.engagement_code, t.name AS tenant_name
       FROM assessments a
       LEFT JOIN tenants t ON t.id = a.tenant_id
       ORDER BY a.created_at DESC LIMIT 1;`
    );
    return res.rows[0] || null;
  });

  if (!assessment) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-3 shadow-xs">
        <h1 className="text-lg font-bold text-slate-900">No assessments yet</h1>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Evidence is attached to assessment questions. Start an assessment first, then upload supporting
          documents from the questionnaire or this page.
        </p>
        <Link href="/dashboard/assessments" className="inline-block text-sm font-semibold text-[#0066FF] hover:underline">
          Go to assessments
        </Link>
      </div>
    );
  }

  const assessmentId: string = assessment.id;
  const tenantName: string = assessment.tenant_name || sessionUser.tenantName;
  const assessmentCode: string = assessment.engagement_code;

  return (
    <div className="space-y-6">
      <EvidenceManagementClient
        assessmentId={assessmentId}
        tenantName={tenantName}
        assessmentCode={assessmentCode}
        userRole={sessionUser.role}
        userName={sessionUser.fullName || sessionUser.email}
      />
    </div>
  );
}

