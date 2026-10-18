import React from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { executeWithRls } from "@/lib/db/rls";
import { canCreateAssessment } from "@/lib/auth/rbac";
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
  if (!canCreateAssessment(sessionUser.role)) {
    redirect("/unauthorized");
  }

  const resolvedParams = searchParams ? await searchParams : {};
  const initialTenantId = resolvedParams.tenantId || null;

  // Fetch active customer organizations, their active users, and the framework label under RLS
  const initData = await executeWithRls(sessionUser, async (client) => {
    const tenantsRes = await client.query(`
      SELECT id, name, slug, industry, is_sdf, dpo_name, dpo_email
      FROM tenants
      WHERE type = 'CLIENT' AND status = 'ACTIVE'
      ORDER BY name ASC;
    `);

    const usersRes = await client.query(`
      SELECT u.id, u.tenant_id, u.full_name, u.email, u.role
      FROM users u
      JOIN tenants t ON t.id = u.tenant_id
      WHERE t.type = 'CLIENT' AND u.is_active = TRUE
      ORDER BY u.full_name ASC;
    `);

    const frameworksRes = await client.query(`
      SELECT name, code
      FROM framework_versions
      ORDER BY created_at DESC
      LIMIT 1;
    `);

    const framework = frameworksRes.rows[0];
    return {
      tenants: tenantsRes.rows,
      users: usersRes.rows,
      frameworkLabel: framework ? String(framework.name || framework.code) : null,
    };
  });

  return (
    <div className="space-y-6">
      <CreateAssessmentForm
        sessionUser={sessionUser}
        tenants={initData.tenants}
        users={initData.users}
        initialTenantId={initialTenantId}
        frameworkLabel={initData.frameworkLabel}
      />
    </div>
  );
}
