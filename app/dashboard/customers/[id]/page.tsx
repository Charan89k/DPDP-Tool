import React from "react";
import { redirect, notFound } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { executeWithRls } from "@/lib/db/rls";
import { isTliRole } from "@/lib/auth/rbac";
import { CustomerDetailClient } from "./CustomerDetailClient";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessionUser = await getCurrentSession();
  if (!sessionUser) {
    redirect("/login?redirect=/dashboard/customers");
  }

  const { id: customerId } = await params;

  // Cross-tenant boundary check: Client users cannot view other client organizations
  if (!isTliRole(sessionUser.role) && sessionUser.tenantId !== customerId) {
    redirect("/dashboard/customers");
  }

  const data = await executeWithRls(sessionUser, async (client) => {
    // 1. Fetch Tenant
    const tenantRes = await client.query(
      `SELECT id, type, name, slug, industry, is_sdf, dpo_name, dpo_email, status, created_at, updated_at
       FROM tenants
       WHERE id = $1;`,
      [customerId]
    );

    if (tenantRes.rows.length === 0) {
      return null;
    }

    const customer = tenantRes.rows[0];

    // 2. Fetch Users
    const usersRes = await client.query(
      `SELECT id, email, full_name, role, is_active, last_login_at, created_at
       FROM users
       WHERE tenant_id = $1
       ORDER BY created_at ASC;`,
      [customerId]
    );

    // 3. Fetch Invitations
    const invitationsRes = await client.query(
      `SELECT id, email, full_name, role, status, expires_at, accepted_at, created_at
       FROM user_invitations
       WHERE tenant_id = $1
       ORDER BY created_at DESC;`,
      [customerId]
    );

    // 4. Fetch Assessments
    const assessmentsRes = await client.query(
      `SELECT a.id, a.engagement_code, a.title, a.status, a.target_completion_date, a.created_at,
              u.full_name AS lead_consultant_name
       FROM assessments a
       LEFT JOIN users u ON u.id = a.lead_consultant_id
       WHERE a.tenant_id = $1
       ORDER BY a.created_at DESC;`,
      [customerId]
    );

    return {
      customer,
      users: usersRes.rows,
      invitations: invitationsRes.rows,
      assessments: assessmentsRes.rows,
    };
  });

  if (!data) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <CustomerDetailClient
        sessionUser={sessionUser}
        customer={data.customer}
        users={data.users}
        invitations={data.invitations}
        assessments={data.assessments}
      />
    </div>
  );
}

