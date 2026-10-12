import React from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { executeWithRls } from "@/lib/db/rls";
import { CreateAssessmentForm } from "./CreateAssessmentForm";

export const dynamic = "force-dynamic";

export default async function NewAssessmentPage({
  searchParams,
}: {
  searchParams?: Promise<{ tenantId?: string }>;
}) {
  const sessionUser = await getCurrentSession();
  if (!sessionUser) {
    redirect("/login?redirect=/dashboard/assessments/new");
  }

  const resolvedParams = searchParams ? await searchParams : {};
  const initialTenantId = resolvedParams.tenantId || null;

  // Fetch available tenants, users, and existing assessment ID under RLS
  const initData = await executeWithRls(sessionUser, async (client) => {
    const tenantsRes = await client.query(`
      SELECT id, name, slug, industry, is_sdf, dpo_name, dpo_email
      FROM tenants
      WHERE type = 'CLIENT'
      ORDER BY name ASC;
    `);

    const usersRes = await client.query(`
      SELECT id, tenant_id, full_name, email, role, phone
      FROM users
      ORDER BY full_name ASC;
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
      users: usersRes.rows,
      frameworkId: frameworksRes.rows[0]?.id || null,
      existingAssessmentId: latestRes.rows[0]?.id || null,
    };
  });

  return (
    <div className="space-y-6">
      <CreateAssessmentForm
        sessionUser={sessionUser}
        tenants={initData.tenants}
        users={initData.users}
        initialTenantId={initialTenantId}
        frameworkId={initData.frameworkId}
        fallbackAssessmentId={initData.existingAssessmentId}
      />
    </div>
  );
}
