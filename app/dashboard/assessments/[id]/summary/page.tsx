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

  let tenantName = "ABC Private Limited";
  let assessmentCode = "DPDP-2024-006";

  try {
    const assessment = await executeWithRls(sessionUser, async (client) => {
      const res = await client.query(
        `SELECT a.id, a.engagement_code, t.name AS tenant_name
         FROM assessments a
         LEFT JOIN tenants t ON t.id = a.tenant_id
         WHERE a.id = $1 LIMIT 1;`,
        [id]
      );
      return res.rows[0] || null;
    });

    if (assessment) {
      tenantName = assessment.tenant_name || tenantName;
      assessmentCode = assessment.engagement_code || assessmentCode;
    }
  } catch {}

  return (
    <div className="space-y-6">
      <AssessmentSummaryView
        assessmentId={id}
        tenantName={tenantName}
        assessmentCode={assessmentCode}
      />
    </div>
  );
}

