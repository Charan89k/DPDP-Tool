import React from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { isTliRole } from "@/lib/auth/rbac";
import { pool } from "@/lib/db/pool";
import { getMyAvailability, listAppointmentTypes } from "@/lib/consultations/service";
import { getReminderOffsets } from "@/lib/notifications/queue";
import { AvailabilityClient } from "@/components/consultations/AvailabilityClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Availability" };

export default async function AvailabilityPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login?redirect=/dashboard/availability");
  if (!isTliRole(session.role)) redirect("/dashboard");
  const isAssessor = session.role === "TLI_LEAD_CONSULTANT" || session.role === "TLI_REVIEWER";
  const isAdmin = session.role === "TLI_SUPER_ADMIN";
  return (
    <AvailabilityClient
      availability={isAssessor ? await getMyAvailability(session) : null}
      types={isAdmin ? await listAppointmentTypes(false) : null}
      reminderOffsets={isAdmin ? await getReminderOffsets(pool) : null}
    />
  );
}
