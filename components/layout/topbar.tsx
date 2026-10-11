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
    <header className="h-14 bg-white border-b border-stone-200 px-6 flex items-center justify-between flex-shrink-0">
      {/* Left: Organization context */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2 text-stone-800 font-medium text-xs font-mono">
          <Building className="w-3.5 h-3.5 text-stone-500" />
          <span>{user.tenantName}</span>
        </div>
        {user.isSdf && (
          <span className="text-[10px] bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded font-mono font-medium">
            Significant Data Fiduciary (SDF)
          </span>
        )}
      </div>

      {/* Right: User Profile & Actions */}
      <div className="flex items-center space-x-4">
        {/* User Pill */}
        <div className="flex items-center space-x-2.5 bg-stone-50 border border-stone-200 rounded-md py-1 px-2.5">
          <div className="w-5 h-5 rounded bg-stone-900 text-stone-100 flex items-center justify-center text-[10px] font-bold font-mono">
            {user.fullName.charAt(0).toUpperCase() || <UserIcon className="w-3 h-3" />}
          </div>
          <div className="text-left text-xs leading-tight">
            <span className="font-semibold text-stone-900 block truncate max-w-[150px]">
              {user.fullName}
            </span>
            <span className="text-[10px] text-stone-500 block truncate font-mono">
              {roleBadge.label}
            </span>
          </div>
        </div>

        {/* Logout Button */}
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-stone-600 hover:text-stone-900 bg-white border border-stone-200 hover:border-stone-400 rounded transition-colors"
          title="Sign out of compliance workspace"
        >
          <LogOut className="w-3.5 h-3.5 text-stone-500" />
          <span>{isLoggingOut ? "Signing Out..." : "Sign Out"}</span>
        </button>
      </div>
    </header>
  );
}
