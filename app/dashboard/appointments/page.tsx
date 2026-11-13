import React from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { isTliRole } from "@/lib/auth/rbac";
import { executeWithRls } from "@/lib/db/rls";
import { listAppointmentTypes } from "@/lib/consultations/service";
import { AppointmentsDashboardClient } from "@/components/consultations/AppointmentsDashboardClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Appointments" };

export default async function AppointmentsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login?redirect=/dashboard/appointments");
  if (!isTliRole(session.role)) redirect("/dashboard/consultations");
  const [types, lists] = await Promise.all([
    listAppointmentTypes(false),
    executeWithRls(session, async (c) => ({
      organisations: (await c.query<{ id: string; name: string }>("SELECT id, name FROM tenants WHERE type = 'CLIENT' ORDER BY name;")).rows,
      assessors: (await c.query<{ id: string; full_name: string }>("SELECT id, full_name FROM users WHERE role IN ('TLI_LEAD_CONSULTANT', 'TLI_REVIEWER') AND is_active = TRUE ORDER BY full_name;")).rows,
    })),
  ]);
  const manager = session.role === "TLI_SUPER_ADMIN" || session.role === "TLI_LEAD_CONSULTANT";
  return (
    <AppointmentsDashboardClient
      typeIdsByName={Object.fromEntries(types.map((t) => [t.name, t.id]))}
      organisations={lists.organisations}
      assessors={lists.assessors.map((a) => ({ id: a.id, name: a.full_name }))}
      canManageAll={manager}
      canRetry={manager}
    />
  );
}
