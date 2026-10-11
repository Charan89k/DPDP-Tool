import React from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessionUser = await getCurrentSession();

  if (!sessionUser) {
    redirect("/login?redirect=/dashboard");
  }

  return (
    <div className="h-screen flex overflow-hidden bg-[#F4F7FB] text-slate-900">
      {/* Sidebar Navigation */}
      <Sidebar user={sessionUser} />

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar user={sessionUser} />

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-[1400px] mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
