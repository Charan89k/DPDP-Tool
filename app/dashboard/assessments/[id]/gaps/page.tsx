import React from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { getAssessmentGapAnalysis } from "@/lib/gaps";
import { ReportLockedError } from "@/lib/payments/access";
import { GapAnalysisDashboardClient } from "@/components/gaps/GapAnalysisDashboardClient";

export const dynamic = "force-dynamic";

interface GapAnalysisPageProps {
  params: Promise<{ id: string }>;
}

export default async function AssessmentGapAnalysisPage({
  params,
}: GapAnalysisPageProps) {
  const sessionUser = await getCurrentSession();
  const { id } = await params;

  if (!sessionUser) {
    redirect(`/login?redirect=/dashboard/assessments/${id}/gaps`);
  }

  let gapData = null;

  try {
    gapData = await getAssessmentGapAnalysis(sessionUser, id);
  } catch (error) {
    // Customers before payment: the report page shows the report status and how to pay.
    if (error instanceof ReportLockedError) redirect(`/dashboard/reports/${id}`);
    console.error("Error loading assessment gap analysis:", error);
    redirect(`/dashboard/assessments/${id}/summary`);
  }

  return (
    <div className="space-y-6">
      <GapAnalysisDashboardClient
        initialData={gapData}
        userRole={sessionUser.role}
        userName={sessionUser.fullName || sessionUser.email}
      />
    </div>
  );
}

