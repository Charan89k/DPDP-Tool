import React from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { executeWithRls } from "@/lib/db/rls";
import { EvidenceManagementClient } from "@/components/evidence/EvidenceManagementClient";

export const dynamic = "force-dynamic";

export default async function DefaultEvidencePage() {
  const sessionUser = await getCurrentSession();
  if (!sessionUser) {
    redirect("/login?redirect=/dashboard/evidence");
  }

  // Load the active assessment under RLS
  const assessment = await executeWithRls(sessionUser, async (client) => {
    const res = await client.query(
      `SELECT a.id, a.engagement_code, t.name AS tenant_name
       FROM assessments a
       LEFT JOIN tenants t ON t.id = a.tenant_id
       ORDER BY a.created_at DESC LIMIT 1;`
    );
    return res.rows[0] || null;
  });

  const assessmentId = assessment?.id || "default-assessment";
  const tenantName = assessment?.tenant_name || sessionUser.tenantName || "ABC Private Limited";
  const assessmentCode = assessment?.engagement_code || "DPDP-2024-006";

  return (
    <div className="space-y-6">
      <EvidenceManagementClient
        assessmentId={assessmentId}
        tenantName={tenantName}
        assessmentCode={assessmentCode}
        userRole={sessionUser.role}
        userName={sessionUser.fullName || sessionUser.email}
      />
    </div>
  );
}

