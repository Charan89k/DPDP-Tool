"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileCheck2,
  FileText,
  Settings,
  Building2,
} from "lucide-react";
import { SessionUser } from "@/lib/auth/types";
import { getRoleBadgeLabel } from "@/lib/auth/rbac";
import { Badge } from "@/components/ui/badge";

interface SidebarProps {
  user: SessionUser;
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const roleBadge = getRoleBadgeLabel(user.role);

  const navItems = [
    {
      label: "Workspace Overview",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      label: "Assessments",
      href: "/dashboard/assessments",
      icon: FileCheck2,
    },
    {
      label: "Compliance Reports",
      href: "/dashboard/reports",
      icon: FileText,
    },
    {
      label: "Account & Security",
      href: "/dashboard/settings",
      icon: Settings,
    },
  ];

  return (
    <aside className="w-64 bg-white text-stone-800 flex flex-col flex-shrink-0 border-r border-stone-200">
      {/* Brand Header */}
      <div className="p-4 border-b border-stone-200 flex items-center space-x-3 bg-stone-50/50">
        <div className="w-7 h-7 rounded border border-stone-400 bg-stone-900 flex items-center justify-center text-white font-serif font-bold text-xs tracking-tight shadow-xs flex-shrink-0">
          TLI
        </div>
        <div className="overflow-hidden">
          <h1 className="text-xs font-serif font-bold text-stone-900 tracking-tight truncate">
            Truth Labs International
          </h1>
          <p className="text-[10px] text-stone-500 font-mono truncate">
            DPDP Compliance Tool
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1">
        <div className="px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-stone-400">
          Main Modules
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center space-x-3 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                isActive
                  ? "bg-[#16191f] text-white shadow-xs font-semibold"
                  : "text-stone-700 hover:bg-stone-100 hover:text-stone-900"
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Tenant Context & Role Badge Footer */}
      <div className="p-4 border-t border-stone-200 bg-stone-50/80">
        <div className="flex items-center space-x-2 text-xs text-stone-600 mb-2">
          <Building2 className="w-3.5 h-3.5 flex-shrink-0 text-stone-500" />
          <span className="truncate font-medium">{user.tenantName}</span>
        </div>
        <div className="flex items-center justify-between">
          <Badge variant={roleBadge.variant} size="sm">
            {roleBadge.label}
          </Badge>
          {user.isSdf && (
            <span
              title="Significant Data Fiduciary"
              className="text-[10px] font-semibold text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200"
            >
              SDF
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}
