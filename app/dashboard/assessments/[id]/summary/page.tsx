import React from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { executeWithRls } from "@/lib/db/rls";
import { AssessmentSummaryView } from "@/components/questionnaire/AssessmentSummaryView";

export const dynamic = "force-dynamic";

interface SummaryPageProps {
  params: Promise<{ id: string }>;
}

export default async function AssessmentSummaryPage({ params }: SummaryPageProps) {
  const sessionUser = await getCurrentSession();
  const { id } = await params;

  if (!sessionUser) {
    redirect(`/login?redirect=/dashboard/assessments/${id}/summary`);
  }

  let assessmentData: any = null;

  try {
    assessmentData = await executeWithRls(sessionUser, async (client) => {
      const res = await client.query(
        `SELECT 
          a.id, 
          a.engagement_code, 
          a.title,
          a.status,
          a.created_at,
          a.target_completion_date,
          a.is_partial_assessment,
          a.partial_assessment_reason,
          t.name AS tenant_name,
          t.industry,
          u.full_name AS lead_consultant_name
         FROM assessments a
         LEFT JOIN tenants t ON t.id = a.tenant_id
         LEFT JOIN users u ON u.id = a.lead_consultant_id
         WHERE a.id = $1 LIMIT 1;`,
        [id]
      );
      return res.rows[0] || null;
    });
  } catch {}

  const tenantName = assessmentData?.tenant_name || sessionUser.tenantName || "ABC Private Limited";
  const assessmentCode = assessmentData?.engagement_code || "DPDP-2024-006";
  const visitDate = assessmentData?.created_at
    ? new Date(assessmentData.created_at).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "20 Aug 2024";

  return (
    <div className="space-y-6">
      <AssessmentSummaryView
        assessmentId={id}
        tenantName={tenantName}
        assessmentCode={assessmentCode}
        visitDate={visitDate}
        leadConsultantName={assessmentData?.lead_consultant_name || "Anita Sharma"}
        industry={assessmentData?.industry || "IT / ITES"}
        assessmentStatus={assessmentData?.status || "DATA_GATHERING"}
        userRole={sessionUser.role}
      />
    </div>
  );
}
