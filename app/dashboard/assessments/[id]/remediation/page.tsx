import React from "react";
import { notFound, redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { executeWithRls } from "@/lib/db/rls";
import { getAssessmentRemediations } from "@/lib/remediation";
import questionnaireData from "@/data/questionnaire_v1.json";
import { RemediationManagementClient } from "@/components/remediation/RemediationManagementClient";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AssessmentRemediationPage({ params }: Props) {
  const sessionUser = await getCurrentSession();
  const { id } = await params;

  if (!sessionUser) {
    redirect(`/login?redirect=/dashboard/assessments/${id}/remediation`);
  }

  // Fetch assessment under RLS
  const assessment = await executeWithRls(sessionUser, async (client) => {
    const res = await client.query(
      `SELECT a.id, a.engagement_code, a.title, a.status, t.name AS tenant_name
       FROM assessments a
       JOIN tenants t ON t.id = a.tenant_id
       WHERE a.id = $1 LIMIT 1;`,
      [id]
    );
    return res.rows[0] || null;
  });

  if (!assessment) {
    notFound();
  }

  // Fetch remediation tasks under RLS
  const remediations = await getAssessmentRemediations(sessionUser, id);

  // Compile question options for dropdown
  const questionOptions = questionnaireData.questions.map((q) => ({
    code: q.code,
    text: q.text,
  }));

  return (
    <RemediationManagementClient
      assessment={{
        id: assessment.id,
        engagementCode: assessment.engagement_code,
        title: assessment.title,
        tenantName: assessment.tenant_name,
        status: assessment.status,
      }}
      initialRemediations={remediations}
      sessionUser={sessionUser}
      questionOptions={questionOptions}
    />
  );
}
