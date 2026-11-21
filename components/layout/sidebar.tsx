"use client";

import React from "react";
import Link from "next/link";
import { BrandMark } from "@/components/ui/brand-mark";
import { usePathname } from "next/navigation";
import {
  Home,
  CheckSquare,
  Users,
  FileText,
  BarChart3,
  Settings,
  Shield,
  CreditCard,
  CalendarDays,
  Clock,
  ClipboardCheck,
} from "lucide-react";
import { SessionUser } from "@/lib/auth/types";
import { isTliRole } from "@/lib/auth/rbac";

interface SidebarProps {
  user: SessionUser;
  /** Mobile drawer state; on large screens the sidebar is always visible. */
  mobileOpen?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ user, mobileOpen = false, onNavigate }: SidebarProps) {
  const pathname = usePathname();

  // Customers see only their own work: answer, attach evidence, read results; platform staff see everything.
  const navItems: Array<{ label: string; href: string; icon: typeof Home; exact: boolean; alsoActive?: RegExp }> =
    isTliRole(user.role)
      ? [
          { label: "Home", href: "/dashboard", icon: Home, exact: true },
          { label: "Assessments", href: "/dashboard/assessments", icon: CheckSquare, exact: false },
          { label: "Customers", href: "/dashboard/customers", icon: Users, exact: false },
          { label: "Questionnaire", href: "/dashboard/questionnaire", icon: CheckSquare, exact: false },
          { label: "Evidence", href: "/dashboard/evidence", icon: FileText, exact: false },
          { label: "Reports", href: "/dashboard/reports", icon: BarChart3, exact: false },
          { label: "Payments", href: "/dashboard/payments", icon: CreditCard, exact: false },
          { label: "Appointments", href: "/dashboard/appointments", icon: CalendarDays, exact: false },
          { label: "Availability", href: "/dashboard/availability", icon: Clock, exact: false },
          { label: "Remediation", href: "/dashboard/remediation-requests", icon: ClipboardCheck, exact: false },
          { label: "Settings", href: "/dashboard/settings", icon: Settings, exact: false },
        ]
      : [
          {
            label: "Questionnaire",
            href: "/dashboard/questionnaire",
            icon: CheckSquare,
            exact: false,
            alsoActive: /^\/dashboard\/assessments(\/[^/]+\/questionnaire)?$/,
          },
          {
            label: "Evidence",
            href: "/dashboard/evidence",
            icon: FileText,
            exact: false,
            alsoActive: /^\/dashboard\/assessments\/[^/]+\/evidence$/,
          },
          {
            label: "Results",
            href: "/dashboard/reports",
            icon: BarChart3,
            exact: false,
            alsoActive: /^\/dashboard\/assessments\/[^/]+\/(summary|gaps|remediation)$/,
          },
          { label: "Consultations", href: "/dashboard/consultations", icon: CalendarDays, exact: false },
          { label: "Remediation", href: "/dashboard/remediation-requests", icon: ClipboardCheck, exact: false },
          { label: "Team", href: `/dashboard/customers/${user.tenantId}`, icon: Users, exact: false },
          { label: "Settings", href: "/dashboard/settings", icon: Settings, exact: false },
        ];

  return (
    <aside
      id="app-sidebar"
      className={`w-64 bg-[#06145B] text-slate-300 flex flex-col flex-shrink-0 select-none border-r border-[#132356] fixed inset-y-0 left-0 z-40 transform transition-transform duration-200 lg:static lg:translate-x-0 ${
        mobileOpen ? "translate-x-0" : "-translate-x-full invisible lg:visible"
      }`}
      aria-label="Main navigation"
    >
      {/* Brand Header */}
      <div className="p-6 pb-5">
        <Link
          href="/dashboard"
          aria-label="TLI dashboard"
          className="inline-block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2CB3C4]"
        >
          <BrandMark variant="dark" size="sm" showTagline />
        </Link>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/") || Boolean(item.alsoActive?.test(pathname));

          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center space-x-3.5 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-gradient-to-r from-[#071D77] to-[#0B63FF] border border-[#2CB3C4]/30 text-white shadow-sm font-semibold"
                  : "text-slate-300 hover:text-white hover:bg-[#0D2577]/60"
              }`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-[#2CB3C4]" : "text-slate-400"}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Brand Tagline Footer matching reference design */}
      <div className="p-4 border-t border-[#132356] flex items-center space-x-2 text-xs text-slate-300 font-medium">
        <Shield className="w-4 h-4 text-[#2CB3C4] flex-shrink-0" />
        <span className="text-[11px] text-slate-300">Privacy | Trust | Compliance</span>
      </div>
    </aside>
  );
}
