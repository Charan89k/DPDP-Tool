"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Shield,
  LayoutDashboard,
  FileCheck2,
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
      label: "Account & Security",
      href: "/dashboard/settings",
      icon: Settings,
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-200 flex flex-col flex-shrink-0 border-r border-slate-800">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center space-x-3">
        <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md flex-shrink-0">
          <Shield className="w-5 h-5" />
        </div>
        <div className="overflow-hidden">
          <h1 className="text-sm font-bold text-white tracking-wide truncate">
            Truth Labs Intl
          </h1>
          <p className="text-[11px] text-slate-400 truncate">
            DPDP Compliance Tool
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1">
        <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center space-x-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Tenant Context & Role Badge Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/60">
        <div className="flex items-center space-x-2 text-xs text-slate-400 mb-2">
          <Building2 className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
          <span className="truncate font-medium">{user.tenantName}</span>
        </div>
        <div className="flex items-center justify-between">
          <Badge variant={roleBadge.variant} size="sm">
            {roleBadge.label}
          </Badge>
          {user.isSdf && (
            <span
              title="Significant Data Fiduciary"
              className="text-[10px] font-semibold text-amber-400 bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-800"
            >
              SDF
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}

