import React from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { executeWithRls } from "@/lib/db/rls";

export const dynamic = "force-dynamic";

export default async function DefaultQuestionnaireRedirectPage() {
  const sessionUser = await getCurrentSession();
  if (!sessionUser) {
    redirect("/login?redirect=/dashboard/questionnaire");
  }

  // Find the latest assessment accessible to user
  const latestAssessmentId = await executeWithRls(sessionUser, async (client) => {
    const res = await client.query(`
      SELECT id FROM assessments ORDER BY created_at DESC LIMIT 1;
    `);
    return res.rows[0]?.id || null;
  });

  if (latestAssessmentId) {
    redirect(`/dashboard/assessments/${latestAssessmentId}/questionnaire`);
  }

  // Fallback to assessments list if no assessment exists
  redirect("/dashboard/assessments");
}

