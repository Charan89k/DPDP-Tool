"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Shield,
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  LogIn,
  FileCheck2,
  BarChart3,
  Users,
} from "lucide-react";
import { TliBrandMark } from "@/components/ui/tli-brand-mark";
import { getSafeRedirectUrl } from "@/lib/auth/redirects";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get("redirect") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Authentication failed. Please verify your credentials.");
        setIsLoading(false);
        return;
      }

      // Safe redirect navigation
      const safeUrl = getSafeRedirectUrl(redirectTarget);
      router.push(safeUrl);
      router.refresh();
    } catch (err) {
      console.error("Login network exception:", err);
      setErrorMessage("Unable to connect to the authentication service. Please check your network connection.");
      setIsLoading(false);
    }
  };

  const features = [
    {
      icon: ShieldCheck,
      title: "Structured Assessments",
      description: "Follow a guided 60-question framework aligned with DPDP 2023 requirements.",
    },
    {
      icon: FileCheck2,
      title: "Secure Evidence Management",
      description: "Upload, manage and track compliance evidence with enterprise-grade security.",
    },
    {
      icon: BarChart3,
      title: "Compliance Gap Analysis",
      description: "Identify gaps, track progress and get clear recommendations for improvement.",
    },
    {
      icon: Users,
      title: "Role-Based Access",
      description: "Separate workspaces for TLI consultants, assessors and client teams.",
    },
  ];

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#F4F7FB] text-[#0F172A] selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden">
      {/* =========================================================================
          LEFT COLUMN: Navy Brand Panel (TLI Authority, Identity & Feature Ledger)
         ========================================================================= */}
      <div className="w-full lg:w-[52%] xl:w-[50%] bg-[#0B192C] text-white p-6 sm:p-10 lg:p-12 xl:p-16 flex flex-col justify-between relative overflow-hidden flex-shrink-0">
        {/* Subtle Wave Graphic Backdrop */}
        <svg
          className="absolute bottom-0 left-0 right-0 w-full pointer-events-none opacity-30 select-none"
          viewBox="0 0 900 450"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M-50 360 C 180 260, 360 410, 580 320 C 720 255, 820 280, 950 230 L 950 480 L -50 480 Z"
            fill="url(#wave-grad-1)"
          />
          <path
            d="M-50 390 C 140 330, 300 400, 500 330 C 670 270, 770 320, 950 290 L 950 480 L -50 480 Z"
            fill="url(#wave-grad-2)"
          />
          <path
            d="M-50 310 C 200 210, 420 360, 620 250 C 730 195, 830 220, 950 180"
            stroke="#0066FF"
            strokeWidth="1.5"
            strokeOpacity="0.45"
          />
          <path
            d="M-50 345 C 190 270, 390 380, 600 290 C 720 235, 810 255, 950 220"
            stroke="#38BDF8"
            strokeWidth="1"
            strokeOpacity="0.3"
          />
          <path
            d="M-50 280 C 230 190, 430 330, 640 220 C 740 165, 840 190, 950 150"
            stroke="#0066FF"
            strokeWidth="1"
            strokeOpacity="0.25"
          />
          <defs>
            <linearGradient id="wave-grad-1" x1="0" y1="260" x2="900" y2="480" gradientUnits="userSpaceOnUse">
              <stop stopColor="#0066FF" stopOpacity="0.18" />
              <stop offset="1" stopColor="#0B192C" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="wave-grad-2" x1="0" y1="320" x2="900" y2="480" gradientUnits="userSpaceOnUse">
              <stop stopColor="#0052CC" stopOpacity="0.22" />
              <stop offset="1" stopColor="#081323" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        {/* Top Header Row */}
        <header className="relative z-10 flex items-center justify-between gap-4 mb-5 sm:mb-12">
          <TliBrandMark variant="dark" size="sm" />
          <div className="text-[11px] sm:text-xs text-slate-400 font-medium tracking-wide">
            Privacy &nbsp;|&nbsp; Trust &nbsp;|&nbsp; Compliance
          </div>
        </header>

        {/* Central Brand Content & Feature Ledger */}
        <div className="relative z-10 my-auto py-1 sm:py-6 space-y-5 sm:space-y-10">
          <div>
            <h1 className="text-2xl sm:text-4xl lg:text-4xl xl:text-5xl font-bold tracking-tight text-white leading-tight">
              DPDP Compliance{" "}
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-sky-200">
                Gap Assessment Platform
              </span>
            </h1>
            <p className="mt-2.5 sm:mt-4 text-xs sm:text-sm text-slate-300 max-w-lg leading-relaxed">
              Structured assessments, secure evidence management and actionable compliance insights.
            </p>
          </div>

          {/* 4 Feature Highlights (Responsive: 2-column grid on tablet, vertical stack on desktop, hidden on compact mobile) */}
          <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-1 gap-5 lg:space-y-5 lg:gap-0">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 text-blue-400 shadow-sm mt-0.5">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-white tracking-tight">
                      {feature.title}
                    </h2>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Brand Footer */}
        <footer className="relative z-10 pt-6 lg:pt-8 mt-6 lg:mt-8 border-t border-white/10 hidden sm:flex items-center gap-2.5 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <span>Building a more private and trusted digital future.</span>
        </footer>
      </div>

      {/* =========================================================================
          RIGHT COLUMN: Authentication Card Panel (Centered, Clean Enterprise UI)
         ========================================================================= */}
      <div className="w-full lg:w-[48%] xl:w-[50%] flex items-center justify-center p-6 sm:p-10 lg:p-12 xl:p-16 flex-1">
        <div className="w-full max-w-[440px] bg-white rounded-2xl border border-slate-200/90 shadow-xl shadow-slate-200/50 p-7 sm:p-10 transition-all">
          {/* Card Brand Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <TliBrandMark variant="light" size="md" className="mb-5" />
            <h2 className="text-2xl font-bold tracking-tight text-[#0F172A]">
              Welcome Back
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              Sign in to your account to continue
            </p>
          </div>

          {/* Error Message Alert */}
          {errorMessage && (
            <div
              className="mb-6 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span className="leading-relaxed font-medium">{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  id="email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  disabled={isLoading}
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50/60 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition-all disabled:opacity-60"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  disabled={isLoading}
                  className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50/60 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition-all disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF] rounded p-0.5 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-[#0066FF] hover:bg-[#0052CC] active:bg-[#0047B3] disabled:opacity-60 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0066FF]"
              >
                {isLoading ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Sign In</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Authorized Users Only Notice */}
          <div className="mt-6 p-3.5 bg-blue-50/70 border border-blue-100 rounded-xl flex items-start gap-3">
            <Shield className="w-5 h-5 text-[#0066FF] flex-shrink-0 mt-0.5" />
            <div className="text-left">
              <span className="text-xs font-semibold text-[#0B192C] block">
                Authorized users only
              </span>
              <span className="text-[11px] text-slate-600 mt-0.5 block leading-normal">
                This system is for TLI staff and invited customers.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F4F7FB] flex items-center justify-center text-slate-500 font-medium text-xs">
          Loading workspace...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
