"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Menu,
  ChevronDown,
  LogOut,
  Building,
} from "lucide-react";
import { SessionUser } from "@/lib/auth/types";
import { getRoleBadgeLabel } from "@/lib/auth/rbac";
import { clearLegacyResponseCaches } from "@/lib/questionnaire/legacy_cache";

interface TopbarProps {
  user: SessionUser;
  onOpenNavigation?: () => void;
  navigationOpen?: boolean;
}

export function Topbar({ user, onOpenNavigation, navigationOpen = false }: TopbarProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the account menu on outside click or Escape
  useEffect(() => {
    if (!showDropdown) return;
    const handlePointer = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowDropdown(false);
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [showDropdown]);
  const roleBadge = getRoleBadgeLabel(user.role);

  // Compute initials for avatar (e.g. "AS" for "Anita Sharma")
  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const initials = getInitials(user.fullName || "User");
  const displayRole = roleBadge.label;

  const handleLogout = async () => {
    setIsLoggingOut(true);
    setLogoutError(null);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      // Leaving while the session is still valid would let the user believe they signed out.
      if (!res.ok) throw new Error(`Logout failed with status ${res.status}`);
      clearLegacyResponseCaches();
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Logout failed:", err);
      setLogoutError("Sign-out failed. Please try again.");
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-3 flex-shrink-0 select-none shadow-xs">
      {/* Left: Navigation toggle (small screens) and application header */}
      <button
        type="button"
        onClick={onOpenNavigation}
        aria-controls="app-sidebar"
        aria-expanded={navigationOpen}
        aria-label="Open navigation"
        className="lg:hidden p-2 -ml-1 rounded-lg text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF]"
      >
        <Menu className="w-5 h-5" aria-hidden="true" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center space-x-2.5 min-w-0">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight truncate">
            {user.tenantName}
          </h2>
        </div>
        <p className="hidden sm:block text-[11px] text-slate-500 font-medium truncate">
          CloudE5 · DPDP compliance workspace
        </p>
      </div>

      {/* Right: Actions, Notifications & User Profile */}
      <div className="flex items-center space-x-2 sm:space-x-5 flex-shrink-0">
        {/* Tasks shortcut (counts are computed on the dashboard from live data) */}
        <Link
          href="/dashboard#my-tasks"
          title="My tasks"
          aria-label="My tasks"
          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF]/40"
        >
          <Bell className="w-5 h-5" aria-hidden="true" />
        </Link>

        {/* User Pill / Profile Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            aria-haspopup="menu"
            aria-expanded={showDropdown}
            aria-label={`Account menu for ${user.fullName}`}
            className="flex items-center space-x-3 p-1 pl-1.5 pr-2.5 rounded-full hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors"
          >
            {/* Avatar Circle */}
            <div className="w-9 h-9 rounded-full bg-[#0066FF] text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {initials}
            </div>

            {/* Name & Role */}
            <div className="text-left leading-tight hidden sm:block">
              <span className="text-xs font-semibold text-slate-900 block">
                {user.fullName}
              </span>
              <span className="text-[11px] text-slate-500 font-medium block">
                {displayRole}
              </span>
            </div>

            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* User Menu Dropdown */}
          {showDropdown && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1">
              <div className="px-4 py-2 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-900">{user.fullName}</p>
                <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                <div className="flex items-center space-x-1.5 mt-1 text-[11px] text-slate-600">
                  <Building className="w-3 h-3 text-slate-400" />
                  <span className="truncate">{user.tenantName}</span>
                </div>
              </div>

              <div className="py-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center space-x-2 transition-colors font-medium"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{isLoggingOut ? "Signing Out..." : "Sign Out"}</span>
                </button>
                {logoutError && (
                  <p role="alert" className="px-4 pb-2 text-[11px] text-rose-700">
                    {logoutError}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
