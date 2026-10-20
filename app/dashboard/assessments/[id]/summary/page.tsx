import React from "react";
import { notFound, redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { executeWithRls } from "@/lib/db/rls";
import { AssessmentSummaryView } from "@/components/questionnaire/AssessmentSummaryView";
import { formatDate } from "@/lib/format/dates";

export const dynamic = "force-dynamic";

interface SummaryPageProps {
  params: Promise<{ id: string }>;
}

interface SummaryAssessmentRow {
  id: string;
  engagement_code: string;
  title: string;
  status: string;
  created_at: Date | null;
  target_completion_date: Date | null;
  is_partial_assessment: boolean;
  tenant_name: string | null;
  industry: string | null;
  lead_consultant_name: string | null;
}

export default async function AssessmentSummaryPage({ params }: SummaryPageProps) {
  const sessionUser = await getCurrentSession();
  const { id } = await params;

  if (!sessionUser) {
    redirect(`/login?redirect=/dashboard/assessments/${id}/summary`);
  }

  let assessmentData: SummaryAssessmentRow | null = null;

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
  } catch (err) {
    console.error("Failed to load assessment summary:", err instanceof Error ? err.message : err);
  }

  if (!assessmentData) {
    notFound();
  }
  const tenantName: string = assessmentData.tenant_name || sessionUser.tenantName;
  const assessmentCode: string = assessmentData.engagement_code;
  const visitDate = assessmentData?.created_at
    ? formatDate(assessmentData.created_at)
    : "—";

  return (
    <div className="space-y-6">
      <AssessmentSummaryView
        assessmentId={id}
        tenantName={tenantName}
        assessmentCode={assessmentCode}
        visitDate={visitDate}
        leadConsultantName={assessmentData?.lead_consultant_name || "Not assigned"}
        industry={assessmentData?.industry || "Not recorded"}
        assessmentStatus={assessmentData?.status || "DATA_GATHERING"}
        userRole={sessionUser.role}
      />
    </div>
  );
}
