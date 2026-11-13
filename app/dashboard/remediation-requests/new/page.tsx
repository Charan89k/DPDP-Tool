import React from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { executeWithRls } from "@/lib/db/rls";
import { getAssessmentGapAnalysis } from "@/lib/gaps";
import { ReportLockedError } from "@/lib/payments/access";
import { NewRequestClient } from "@/components/remediation-requests/NewRequestClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Request remediation help" };

interface Props {
  searchParams: Promise<{ assessment?: string; consult?: string }>;
}

export default async function NewRemediationRequestPage({ searchParams }: Props) {
  const session = await getCurrentSession();
  if (!session) redirect("/login?redirect=/dashboard/remediation-requests");
  if (!["CLIENT_ADMIN", "CLIENT_BU_LEAD", "CLIENT_CONTRIBUTOR"].includes(session.role)) redirect("/dashboard/remediation-requests");
  const { assessment: assessmentId = "", consult } = await searchParams;
  const assessment = await executeWithRls(session, async (c) => (await c.query<{ id: string; engagement_code: string }>("SELECT id, engagement_code FROM assessments WHERE id = $1;", [assessmentId])).rows[0]);
  if (!assessment) redirect("/dashboard/reports");
  let gaps;
  try {
    gaps = (await getAssessmentGapAnalysis(session, assessmentId)).gaps;
  } catch (err) {
    // Gaps are part of the paid report.
    if (err instanceof ReportLockedError) redirect(`/dashboard/reports/${assessmentId}`);
    throw err;
  }
  return (
    <NewRequestClient
      assessmentId={assessmentId}
      engagementCode={assessment.engagement_code}
      gaps={gaps.map((g) => ({ code: g.questionCode, title: g.questionText, severity: g.gapSeverity }))}
      wantsConsultation={consult === "1"}
    />
  );
}
