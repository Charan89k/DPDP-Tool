import React from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/AppShell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sessionUser = await getCurrentSession();
  if (!sessionUser) {
    redirect("/login?redirect=/dashboard");
  }
  return <AppShell user={sessionUser}>{children}</AppShell>;
}
