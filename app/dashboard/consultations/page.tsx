import React from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { isTliRole } from "@/lib/auth/rbac";
import { executeWithRls } from "@/lib/db/rls";
import { listAppointmentTypes, listBookableAssessors } from "@/lib/consultations/service";
import { ConsultationsClient } from "@/components/consultations/ConsultationsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Consultations" };

interface Props {
  searchParams: Promise<{ type?: string; assessment?: string; request?: string }>;
}

export default async function ConsultationsPage({ searchParams }: Props) {
  const session = await getCurrentSession();
  if (!session) redirect("/login?redirect=/dashboard/consultations");
  if (isTliRole(session.role)) redirect("/dashboard/appointments");
  const q = await searchParams;
  const [types, assessors, assessments] = await Promise.all([
    listAppointmentTypes(true),
    listBookableAssessors(),
    executeWithRls(session, async (c) => (await c.query<{ id: string; engagement_code: string; title: string }>("SELECT id, engagement_code, title FROM assessments ORDER BY created_at DESC;")).rows),
  ]);
  return (
    <ConsultationsClient
      types={types}
      assessors={assessors.map((a) => ({ userId: a.userId, fullName: a.fullName }))}
      assessments={assessments.map((a) => ({ id: a.id, label: `${a.engagement_code} · ${a.title}` }))}
      canBook={["CLIENT_ADMIN", "CLIENT_BU_LEAD", "CLIENT_CONTRIBUTOR"].includes(session.role)}
      preset={{ typeCode: q.type, assessmentId: q.assessment, remediationRequestId: q.request }}
    />
  );
}
