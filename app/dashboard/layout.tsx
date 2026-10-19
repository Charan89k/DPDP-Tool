import React from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { isMfaSetupRequired } from "@/lib/auth/mfa";
import { AppShell } from "@/components/layout/AppShell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sessionUser = await getCurrentSession();
  if (!sessionUser) {
    redirect("/login?redirect=/dashboard");
  }
  if (await isMfaSetupRequired(sessionUser)) {
    redirect("/setup-two-factor");
  }
  return <AppShell user={sessionUser}>{children}</AppShell>;
}
