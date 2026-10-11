"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield, Lock, Mail, Eye, EyeOff, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
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
  const [showTestAccounts, setShowTestAccounts] = useState(false);

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
        setErrorMessage(data.error || "Authentication failed. Please try again.");
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

  const fillTestCredentials = (testEmail: string) => {
    setEmail(testEmail);
    setPassword("SyntheticTestPassword123!");
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Header */}
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Shield className="w-7 h-7" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-xl font-bold tracking-tight text-white">
          Truth Labs International
        </h2>
        <p className="mt-1 text-center text-xs font-medium text-slate-400 uppercase tracking-widest">
          DPDP Compliance Gap Analysis Tool
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-xl rounded-xl sm:px-10 border border-slate-800/10">
          <div className="mb-6">
            <h3 className="text-base font-semibold text-slate-900">
              Sign in to assessment workspace
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Enter your corporate credentials to access tenant compliance evaluations.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-5">
              <Alert variant="error">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              </Alert>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                label="Corporate Email"
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@organization.com"
                disabled={isLoading}
              />
            </div>

            <div className="relative">
              <Input
                label="Password"
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-8 text-slate-400 hover:text-slate-600 focus:outline-none"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isLoading}
                className="w-full font-medium"
              >
                <Lock className="w-4 h-4 mr-2" />
                Sign In
              </Button>
            </div>
          </form>

          {/* Synthetic Test Credentials Helper (Development Only - Tree-shaken in production) */}
          {process.env.NODE_ENV !== "production" && (
            <div className="mt-6 pt-5 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowTestAccounts(!showTestAccounts)}
                className="text-xs text-blue-700 hover:text-blue-900 font-medium flex items-center justify-between w-full"
              >
                <span>{showTestAccounts ? "Hide" : "Show"} Synthetic Test Personas</span>
                <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">
                  Dev Fixtures
                </span>
              </button>

              {showTestAccounts && (
                <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2">
                  <p className="text-[11px] text-slate-500 font-medium">
                    Seeded synthetic users (Password: <code className="text-slate-800 bg-white px-1 py-0.5 rounded border">SyntheticTestPassword123!</code>):
                  </p>
                <div className="space-y-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => fillTestCredentials("admin@truthlabs.in")}
                    className="w-full text-left p-1.5 rounded hover:bg-white text-slate-700 flex justify-between items-center transition-colors"
                  >
                    <span className="font-mono text-[11px]">admin@truthlabs.in</span>
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded font-semibold">
                      TLI Super Admin
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fillTestCredentials("lead.consultant@truthlabs.in")}
                    className="w-full text-left p-1.5 rounded hover:bg-white text-slate-700 flex justify-between items-center transition-colors"
                  >
                    <span className="font-mono text-[11px]">lead.consultant@truthlabs.in</span>
                    <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded font-semibold">
                      Lead Consultant
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fillTestCredentials("admin@alphahealth.example.com")}
                    className="w-full text-left p-1.5 rounded hover:bg-white text-slate-700 flex justify-between items-center transition-colors"
                  >
                    <span className="font-mono text-[11px]">admin@alphahealth.example.com</span>
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded font-semibold">
                      Alpha Client Admin (SDF)
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fillTestCredentials("eng.contributor@alphahealth.example.com")}
                    className="w-full text-left p-1.5 rounded hover:bg-white text-slate-700 flex justify-between items-center transition-colors"
                  >
                    <span className="font-mono text-[11px]">eng.contributor@alphahealth.example.com</span>
                    <span className="text-[10px] bg-slate-200 text-slate-800 px-1.5 py-0.2 rounded font-semibold">
                      Contributor
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fillTestCredentials("legal.viewer@alphahealth.example.com")}
                    className="w-full text-left p-1.5 rounded hover:bg-white text-slate-700 flex justify-between items-center transition-colors"
                  >
                    <span className="font-mono text-[11px]">legal.viewer@alphahealth.example.com</span>
                    <span className="text-[10px] bg-slate-200 text-slate-800 px-1.5 py-0.2 rounded font-semibold">
                      Executive Viewer
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
          )}
        </div>

        {/* Advisory Legal Disclaimer Notice */}
        <p className="text-center text-[11px] text-slate-500 mt-6 leading-relaxed">
          Truth Labs International (TLI) Digital Personal Data Protection Compliance Advisory Platform.
          Protected by India DPDPA 2023 technical safeguards and Row-Level Security isolation.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}

