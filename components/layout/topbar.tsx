"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, User as UserIcon, Building } from "lucide-react";
import { SessionUser } from "@/lib/auth/types";
import { getRoleBadgeLabel } from "@/lib/auth/rbac";
import { Button } from "@/components/ui/button";

interface TopbarProps {
  user: SessionUser;
}

export function Topbar({ user }: TopbarProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const roleBadge = getRoleBadgeLabel(user.role);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Logout failed:", err);
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between flex-shrink-0">
      {/* Left: Organization context */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2 text-slate-700 font-semibold text-sm">
          <Building className="w-4 h-4 text-slate-500" />
          <span>{user.tenantName}</span>
        </div>
        {user.isSdf && (
          <span className="text-xs bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
            Significant Data Fiduciary (SDF)
          </span>
        )}
      </div>

      {/* Right: User Profile & Actions */}
      <div className="flex items-center space-x-4">
        {/* User Pill */}
        <div className="flex items-center space-x-2.5 bg-slate-50 border border-slate-200 rounded-full py-1 px-3">
          <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
            {user.fullName.charAt(0).toUpperCase() || <UserIcon className="w-3.5 h-3.5" />}
          </div>
          <div className="text-left text-xs leading-tight">
            <span className="font-semibold text-slate-800 block truncate max-w-[140px]">
              {user.fullName}
            </span>
            <span className="text-[10px] text-slate-500 block truncate">
              {roleBadge.label}
            </span>
          </div>
        </div>

        {/* Logout Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          isLoading={isLoggingOut}
          className="text-slate-600 hover:text-rose-700 hover:border-rose-300"
          title="Sign out of compliance workspace"
        >
          <LogOut className="w-3.5 h-3.5 mr-1.5" />
          Sign Out
        </Button>
      </div>
    </header>
  );
}

