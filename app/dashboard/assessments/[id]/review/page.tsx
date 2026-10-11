import React from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { AssessorReviewClient } from "@/components/review/AssessorReviewClient";

export const dynamic = "force-dynamic";

interface AssessorReviewPageProps {
  params: Promise<{ id: string }>;
}

export default async function AssessorReviewPage({ params }: AssessorReviewPageProps) {
  const sessionUser = await getCurrentSession();
  const { id } = await params;

  if (!sessionUser) {
    redirect(`/login?redirect=/dashboard/assessments/${id}/review`);
  }

  return <AssessorReviewClient assessmentId={id} />;
}

