import React from "react";
import { notFound, redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { executeWithRls } from "@/lib/db/rls";
import { isTliRole, canEditQuestionnaire } from "@/lib/auth/rbac";
import { QuestionnaireClient } from "@/components/questionnaire/QuestionnaireClient";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface QuestionnairePageProps {
  params: Promise<{ id: string }>;
}

export default async function QuestionnairePage({ params }: QuestionnairePageProps) {
  const sessionUser = await getCurrentSession();
  const { id } = await params;

  if (!sessionUser) {
    redirect(`/login?redirect=/dashboard/assessments/${id}/questionnaire`);
  }
  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

  // Only assessments visible to this user under the tenant policy layer are rendered.
  const assessment = await executeWithRls(sessionUser, async (client) => {
    const res = await client.query(
      `SELECT a.id, a.title, a.status, a.engagement_code, a.created_at, a.target_completion_date,
              t.name AS tenant_name
       FROM assessments a
       LEFT JOIN tenants t ON t.id = a.tenant_id
       WHERE a.id = $1
       LIMIT 1;`,
      [id]
    );
    return res.rows[0] || null;
  });

  if (!assessment) {
    notFound();
  }

  return (
    <div className="max-w-7xl mx-auto px-0 sm:px-2 py-2">
      <QuestionnaireClient
        assessmentId={id}
        assessmentTitle={assessment.title}
        tenantName={assessment.tenant_name}
        engagementCode={assessment.engagement_code}
        startedAt={new Date(assessment.created_at).toISOString()}
        targetCompletionDate={
          assessment.target_completion_date ? new Date(assessment.target_completion_date).toISOString() : null
        }
        isAssessor={isTliRole(sessionUser.role)}
        canEdit={canEditQuestionnaire(sessionUser.role)}
        userRole={sessionUser.role}
        assessmentStatus={assessment.status}
      />
    </div>
  );
}
