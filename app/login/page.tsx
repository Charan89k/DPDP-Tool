"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield, Lock, Eye, EyeOff, AlertCircle, FileText, CheckCircle2 } from "lucide-react";
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

  const fillTestCredentials = (testEmail: string) => {
    setEmail(testEmail);
    setPassword("SyntheticTestPassword123!");
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-[#fbfaf8] text-[#16191f] flex flex-col justify-between selection:bg-stone-200 selection:text-stone-900">
      {/* Top Editorial Bar */}
      <header className="border-b border-stone-200/80 bg-[#f8f6f0]/60 px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center space-x-3">
            <div className="w-7 h-7 rounded border border-stone-400 bg-stone-900 flex items-center justify-center text-stone-100 font-serif font-bold text-sm tracking-tighter shadow-sm">
              TLI
            </div>
            <div>
              <span className="font-serif tracking-tight text-sm font-semibold text-stone-900">
                Truth Labs International
              </span>
              <span className="hidden sm:inline-block mx-2 text-stone-300">|</span>
              <span className="text-xs text-stone-600 block sm:inline font-mono">
                Forensic Privacy Advisory
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-3 text-[11px] text-stone-500 font-mono">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-stone-100 border border-stone-200 text-stone-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
              SECURE KERNEL // RLS ACTIVE
            </span>
            <span className="hidden md:inline text-stone-400">REF: TLI-DPDP-AUDIT-PLATFORM</span>
          </div>
        </div>
      </header>

      {/* Main Content Area: Structured Editorial Layout */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex items-center justify-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">

          {/* Left Column: Forensic Audit Engagement Metadata Panel */}
          <div className="lg:col-span-5 flex flex-col justify-between bg-[#f6f4ee] p-6 sm:p-8 rounded-xl border border-stone-200 shadow-sm">
            <div className="space-y-6">
              <div>
                <span className="text-[10px] uppercase tracking-widest font-mono text-stone-500 font-semibold block mb-1">
                  Statutory Evaluation Portal
                </span>
                <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 leading-tight">
                  DPDP Compliance Gap Analysis
                </h1>
                <p className="mt-2 text-xs sm:text-sm text-stone-600 leading-relaxed">
                  Independent compliance evaluation and gap scoring platform under the India Digital Personal Data Protection Act, 2023.
                </p>
              </div>

              {/* Audit Metadata Ledger */}
              <div className="border-t border-b border-stone-300/80 py-4 space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center text-stone-600">
                  <span className="text-stone-500">Statutory Base:</span>
                  <span className="font-semibold text-stone-900">DPDPA 2023 / MeitY</span>
                </div>
                <div className="flex justify-between items-center text-stone-600">
                  <span className="text-stone-500">Canonical Controls:</span>
                  <span className="font-semibold text-stone-900">30 Controls (13 Domains)</span>
                </div>
                <div className="flex justify-between items-center text-stone-600">
                  <span className="text-stone-500">Classification:</span>
                  <span className="font-semibold text-rose-900 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                    RESTRICTED // FORENSIC
                  </span>
                </div>
                <div className="flex justify-between items-center text-stone-600">
                  <span className="text-stone-500">Evidence Vault:</span>
                  <span className="font-semibold text-stone-900">Tenant-Isolated Disk Storage</span>
                </div>
              </div>

              {/* Advisory Standard Notes */}
              <div className="space-y-2.5 text-xs text-stone-600">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-stone-700 flex-shrink-0 mt-0.5" />
                  <span>Immutable audit logging of assessor responses and consultant reviews.</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-stone-700 flex-shrink-0 mt-0.5" />
                  <span>Row-Level Security boundary prevents inter-tenant record leakage.</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-stone-200 text-[11px] text-stone-500 font-mono">
              TLI Legal Governance Register • DEC-01 through DEC-10
            </div>
          </div>

          {/* Right Column: Sign-in Form */}
          <div className="lg:col-span-7 flex flex-col justify-center">
            <div className="bg-white p-6 sm:p-10 rounded-xl border border-stone-200 shadow-sm">
              <div className="mb-6">
                <h2 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-stone-900">
                  Sign in to Assessment Workspace
                </h2>
                <p className="mt-1 text-xs text-stone-500">
                  Enter your authorized corporate credentials to access tenant compliance evaluations.
                </p>
              </div>

              {errorMessage && (
                <div className="mb-6">
                  <Alert variant="error">
                    <div className="flex items-center space-x-2 text-xs">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  </Alert>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-xs font-semibold text-stone-800 uppercase tracking-wider mb-1.5">
                    Corporate Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@organization.com"
                    disabled={isLoading}
                    className="w-full px-3.5 py-2.5 text-sm bg-stone-50/50 border border-stone-300 rounded-md text-stone-900 placeholder-stone-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-900 focus:border-stone-900 transition-colors"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label htmlFor="password" className="block text-xs font-semibold text-stone-800 uppercase tracking-wider">
                      Account Password
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      disabled={isLoading}
                      className="w-full px-3.5 py-2.5 text-sm bg-stone-50/50 border border-stone-300 rounded-md text-stone-900 placeholder-stone-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-900 focus:border-stone-900 transition-colors pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-700 focus:outline-none"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 bg-[#16191f] hover:bg-stone-800 disabled:opacity-60 text-stone-100 text-sm font-semibold rounded-md shadow-sm transition-colors flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-stone-900"
                  >
                    {isLoading ? (
                      <span className="inline-block w-4 h-4 border-2 border-stone-400 border-t-white rounded-full animate-spin"></span>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Authenticate to Workspace</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Synthetic Test Credentials Helper (Development Only - Tree-shaken in production) */}
              {process.env.NODE_ENV !== "production" && (
                <div className="mt-8 pt-6 border-t border-stone-200">
                  <button
                    type="button"
                    onClick={() => setShowTestAccounts(!showTestAccounts)}
                    className="text-xs text-stone-700 hover:text-stone-900 font-mono font-medium flex items-center justify-between w-full"
                  >
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-stone-500" />
                      <span>{showTestAccounts ? "Hide" : "Show"} Synthetic Seed Personas</span>
                    </span>
                    <span className="text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded border border-stone-200">
                      Dev Fixtures
                    </span>
                  </button>

                  {showTestAccounts && (
                    <div className="mt-3 p-3.5 bg-[#fbfaf8] rounded-md border border-stone-200 text-xs space-y-2">
                      <p className="text-[11px] text-stone-500 font-mono">
                        Local Demo Password: <code className="text-stone-800 bg-white px-1 py-0.5 rounded border border-stone-200">SyntheticTestPassword123!</code> (or configured via <code className="text-stone-800 bg-white px-1 py-0.5 rounded border border-stone-200">$DEMO_USER_PASSWORD</code>)
                      </p>
                      <div className="space-y-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => fillTestCredentials("consultant.demo@tli.local")}
                          className="w-full text-left p-2 rounded hover:bg-white text-stone-800 flex justify-between items-center transition-colors border border-stone-200 bg-white shadow-xs"
                        >
                          <div>
                            <span className="font-mono text-[11px] font-semibold text-blue-900">consultant.demo@tli.local</span>
                            <span className="block text-[10px] text-stone-500">TLI Advisory Lead Consultant View</span>
                          </div>
                          <span className="text-[10px] bg-blue-50 text-blue-800 px-2 py-0.5 rounded font-semibold border border-blue-200">
                            Consultant Demo
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => fillTestCredentials("customer.demo@tli.local")}
                          className="w-full text-left p-2 rounded hover:bg-white text-stone-800 flex justify-between items-center transition-colors border border-stone-200 bg-white shadow-xs"
                        >
                          <div>
                            <span className="font-mono text-[11px] font-semibold text-emerald-900">customer.demo@tli.local</span>
                            <span className="block text-[10px] text-stone-500">Alpha Healthcare Client Admin View</span>
                          </div>
                          <span className="text-[10px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded font-semibold border border-emerald-200">
                            Customer Demo
                          </span>
                        </button>
                        <div className="pt-2 border-t border-stone-200/80">
                          <span className="text-[10px] uppercase font-mono text-stone-400 block mb-1">Additional Seed Personas:</span>
                          <div className="grid grid-cols-2 gap-1">
                            <button
                              type="button"
                              onClick={() => fillTestCredentials("admin@truthlabs.in")}
                              className="text-left p-1.5 rounded hover:bg-white text-stone-700 text-[11px] font-mono truncate"
                            >
                              admin@truthlabs.in
                            </button>
                            <button
                              type="button"
                              onClick={() => fillTestCredentials("admin@alphahealth.example.com")}
                              className="text-left p-1.5 rounded hover:bg-white text-stone-700 text-[11px] font-mono truncate"
                            >
                              admin@alphahealth...
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Editorial Footer */}
      <footer className="border-t border-stone-200/80 bg-[#f8f6f0]/60 px-6 py-4 text-center">
        <p className="text-[11px] text-stone-500 font-serif leading-relaxed max-w-3xl mx-auto">
          Truth Labs International (TLI) • Digital Personal Data Protection Act, 2023 Technical Compliance Evaluation System.
          Access is monitored and restricted to authorized enterprise evaluators and forensic consultants.
        </p>
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#fbfaf8] flex items-center justify-center text-stone-500 font-mono text-xs">Initializing audit workspace...</div>}>
      <LoginForm />
    </Suspense>
  );
}
