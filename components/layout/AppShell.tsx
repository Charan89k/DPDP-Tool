"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { SessionUser } from "@/lib/auth/types";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

/** Authenticated workspace frame: persistent sidebar on large screens, drawer on small screens. */
export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();
  const [navPathname, setNavPathname] = useState(pathname);

  // Close the drawer when the route changes (adjusting state during render, not in an effect).
  if (navPathname !== pathname) {
    setNavPathname(pathname);
    setNavOpen(false);
  }

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNavOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navOpen]);

  return (
    <div className="h-screen flex overflow-hidden bg-[#F4F7FB] text-slate-900">
      <Sidebar user={user} mobileOpen={navOpen} onNavigate={() => setNavOpen(false)} />
      {navOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
        />
      )}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar user={user} onOpenNavigation={() => setNavOpen(true)} navigationOpen={navOpen} />
        <main id="main-content" className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
          <div className="max-w-[1400px] mx-auto space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
