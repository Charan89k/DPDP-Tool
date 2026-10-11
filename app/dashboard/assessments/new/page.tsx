import React from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { executeWithRls } from "@/lib/db/rls";
import { CreateAssessmentForm } from "./CreateAssessmentForm";

export const dynamic = "force-dynamic";

export default async function NewAssessmentPage() {
  const sessionUser = await getCurrentSession();
  if (!sessionUser) {
    redirect("/login?redirect=/dashboard/assessments/new");
  }

  // Fetch available tenants and existing assessment ID for reference under RLS
  const initData = await executeWithRls(sessionUser, async (client) => {
    const tenantsRes = await client.query(`
      SELECT id, name, slug, industry, is_sdf
      FROM tenants
      ORDER BY name ASC;
    `);

    const frameworksRes = await client.query(`
      SELECT id, name, code
      FROM framework_versions
      LIMIT 1;
    `);

    const latestRes = await client.query(`
      SELECT id FROM assessments LIMIT 1;
    `);

    return {
      tenants: tenantsRes.rows,
      frameworkId: frameworksRes.rows[0]?.id || null,
      existingAssessmentId: latestRes.rows[0]?.id || null,
    };
  });

  return (
    <div className="space-y-6">
      <CreateAssessmentForm
        sessionUser={sessionUser}
        tenants={initData.tenants}
        frameworkId={initData.frameworkId}
        fallbackAssessmentId={initData.existingAssessmentId}
      />
    </div>
  );
}

