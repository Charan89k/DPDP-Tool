import React from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { executeWithRls } from "@/lib/db/rls";
import { QuestionnaireClient } from "@/components/questionnaire/QuestionnaireClient";

export const dynamic = "force-dynamic";

interface QuestionnairePageProps {
  params: Promise<{ id: string }>;
}

export default async function QuestionnairePage({ params }: QuestionnairePageProps) {
  const sessionUser = await getCurrentSession();
  const { id } = await params;

  if (!sessionUser) {
    redirect(`/login?redirect=/dashboard/assessments/${id}/questionnaire`);
  }

  let assessmentTitle = "India DPDP Comprehensive Compliance Gap Evaluation";
  let tenantName = "Client Organization";

  try {
    const assessment = await executeWithRls(sessionUser, async (client) => {
      const sql = `
        SELECT 
          a.id,
          a.title,
          t.name AS tenant_name
        FROM assessments a
        LEFT JOIN tenants t ON t.id = a.tenant_id
        WHERE a.id = $1
        LIMIT 1;
      `;
      const res = await client.query(sql, [id]);
      return res.rows[0] || null;
    });

    if (assessment) {
      assessmentTitle = assessment.title;
      tenantName = assessment.tenant_name;
    }
  } catch {
    // Graceful fallback for offline / development environments
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <QuestionnaireClient
        assessmentId={id}
        assessmentTitle={assessmentTitle}
        tenantName={tenantName}
      />
    </div>
  );
}

