import React from "react";
import { notFound, redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { executeWithRls } from "@/lib/db/rls";
import { EvidenceManagementClient } from "@/components/evidence/EvidenceManagementClient";

export const dynamic = "force-dynamic";

interface EvidencePageProps {
  params: Promise<{ id: string }>;
}

export default async function AssessmentEvidencePage({ params }: EvidencePageProps) {
  const sessionUser = await getCurrentSession();
  const { id } = await params;

  if (!sessionUser) {
    redirect(`/login?redirect=/dashboard/assessments/${id}/evidence`);
  }

  const assessment = await executeWithRls(sessionUser, async (client) => {
    const res = await client.query(
      `SELECT a.id, a.engagement_code, t.name AS tenant_name
       FROM assessments a
       LEFT JOIN tenants t ON t.id = a.tenant_id
       WHERE a.id = $1 LIMIT 1;`,
      [id]
    );
    return res.rows[0] || null;
  }).catch(() => null);

  if (!assessment) {
    notFound();
  }
  const tenantName: string = assessment.tenant_name;
  const assessmentCode: string = assessment.engagement_code;

  return (
    <div className="space-y-6">
      <EvidenceManagementClient
        assessmentId={id}
        tenantName={tenantName}
        assessmentCode={assessmentCode}
        userRole={sessionUser.role}
        userName={sessionUser.fullName || sessionUser.email}
      />
    </div>
  );
}

