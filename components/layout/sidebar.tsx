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
  Building2,
} from "lucide-react";
import { SessionUser } from "@/lib/auth/types";
import { getRoleBadgeLabel, isTliRole } from "@/lib/auth/rbac";
import { Badge } from "@/components/ui/badge";

interface SidebarProps {
  user: SessionUser;
  /** Mobile drawer state; on large screens the sidebar is always visible. */
  mobileOpen?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ user, mobileOpen = false, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const roleBadge = getRoleBadgeLabel(user.role);

  const navItems = [
    {
      label: "Home",
      href: "/dashboard",
      icon: Home,
      exact: true,
    },
    {
      label: "Assessments",
      href: "/dashboard/assessments",
      icon: CheckSquare,
      exact: false,
    },
    ...(isTliRole(user.role)
      ? [
          {
            label: "Customers",
            href: "/dashboard/customers",
            icon: Users,
            exact: false,
          },
        ]
      : [
          {
            label: "Team",
            href: `/dashboard/customers/${user.tenantId}`,
            icon: Users,
            exact: false,
          },
        ]),
    {
      label: "Questionnaire",
      href: "/dashboard/questionnaire",
      icon: CheckSquare,
      exact: false,
    },
    {
      label: "Evidence",
      href: "/dashboard/evidence",
      icon: FileText,
      exact: false,
    },
    {
      label: "Reports",
      href: "/dashboard/reports",
      icon: BarChart3,
      exact: false,
    },
    {
      label: "Settings",
      href: "/dashboard/settings",
      icon: Settings,
      exact: false,
    },
  ];

  return (
    <aside
      id="app-sidebar"
      className={`w-64 bg-[#0B192C] text-slate-300 flex flex-col flex-shrink-0 select-none border-r border-[#15273F] fixed inset-y-0 left-0 z-40 transform transition-transform duration-200 lg:static lg:translate-x-0 ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      }`}
      aria-label="Main navigation"
    >
      {/* Brand Header */}
      <div className="p-6 pb-5">
        <Link
          href="/dashboard"
          aria-label="CloudE5 dashboard"
          className="inline-block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
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
            : pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center space-x-3.5 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-[#0066FF] text-white shadow-sm font-semibold"
                  : "text-slate-300 hover:text-white hover:bg-[#162740]"
              }`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Brand Tagline Footer matching reference design */}
      <div className="p-4 border-t border-[#15273F] flex items-center space-x-2 text-xs text-slate-300 font-medium">
        <Shield className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <span className="text-[11px] text-slate-400">Privacy | Trust | Compliance</span>
      </div>
    </aside>
  );
}
