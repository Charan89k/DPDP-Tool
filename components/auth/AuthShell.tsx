import React from "react";
import Link from "next/link";
import { BarChart3, ClipboardCheck, FileCheck2, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/ui/brand-mark";

const FEATURES = [
  {
    icon: ClipboardCheck,
    title: "Guided DPDP self-assessment",
    description:
      "60 questions mapped to a documented control library for the Digital Personal Data Protection Act, 2023.",
  },
  {
    icon: FileCheck2,
    title: "Private evidence workspace",
    description: "Attach supporting documents to the questions they evidence, scoped to your organisation.",
  },
  {
    icon: BarChart3,
    title: "Explainable gap analysis",
    description: "See which answers drive each finding, its priority, and the corrective action to plan.",
  },
];

interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** Two-panel layout shared by sign-in, registration, verification and password pages. */
export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#F4F7FB] text-[#0F172A]">
      <aside className="w-full lg:w-[46%] bg-[#0B192C] text-white px-6 py-6 sm:p-10 lg:p-12 xl:p-14 flex flex-col justify-between relative overflow-hidden">
        <svg
          className="absolute bottom-0 left-0 w-full pointer-events-none opacity-30"
          viewBox="0 0 900 450"
          fill="none"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M-50 360 C 180 260, 360 410, 580 320 C 720 255, 820 280, 950 230 L 950 480 L -50 480 Z"
            fill="#0066FF"
            fillOpacity="0.12"
          />
          <path
            d="M-50 310 C 200 210, 420 360, 620 250 C 730 195, 830 220, 950 180"
            stroke="#0066FF"
            strokeOpacity="0.4"
            strokeWidth="1.5"
          />
          <path
            d="M-50 345 C 190 270, 390 380, 600 290 C 720 235, 810 255, 950 220"
            stroke="#38BDF8"
            strokeOpacity="0.25"
          />
        </svg>

        <header className="relative z-10">
          <Link
            href="/"
            aria-label="CloudE5 home"
            className="inline-block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            <BrandMark variant="dark" size="sm" showTagline />
          </Link>
        </header>

        <div className="relative z-10 my-6 lg:my-auto space-y-8 hidden sm:block">
          <p className="text-2xl lg:text-3xl xl:text-4xl font-bold tracking-tight leading-tight">
            Understand your DPDP readiness.
            <span className="block text-sky-300">Fix what matters first.</span>
          </p>
          <ul className="space-y-5">
            {FEATURES.map(({ icon: Icon, title: featureTitle, description }) => (
              <li key={featureTitle} className="flex items-start gap-4">
                <span className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 text-sky-300">
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{featureTitle}</span>
                  <span className="block text-xs text-slate-400 mt-1 leading-relaxed max-w-sm">
                    {description}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <footer className="relative z-10 hidden sm:flex items-start gap-2.5 text-[11px] text-slate-400 border-t border-white/10 pt-5 leading-relaxed">
          <ShieldCheck className="w-4 h-4 text-sky-300 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            CloudE5 supports compliance self-assessment. Results are not legal advice and do not
            certify compliance with the DPDP Act.
          </span>
        </footer>
      </aside>

      <main className="flex-1 flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-[440px] bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 p-6 sm:p-9">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {children}
          {footer && (
            <div className="mt-6 pt-5 border-t border-slate-100 text-sm text-slate-600">{footer}</div>
          )}
        </div>
      </main>
    </div>
  );
}

export const authInputClass =
  "w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent disabled:opacity-60";

export const authButtonClass =
  "w-full py-2.5 px-4 bg-[#0066FF] hover:bg-[#0052CC] active:bg-[#0047B3] disabled:opacity-60 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0066FF]";

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

/** Labelled form field with optional hint or error text. */
export function Field({ id, label, hint, error, children }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-700 mb-1.5">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-rose-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function FormAlert({
  tone,
  children,
}: {
  tone: "error" | "success" | "info";
  children: React.ReactNode;
}) {
  const styles = {
    error: "bg-rose-50 border-rose-200 text-rose-800",
    success: "bg-emerald-50 border-emerald-200 text-emerald-800",
    info: "bg-blue-50 border-blue-200 text-blue-900",
  }[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`mb-5 p-3.5 rounded-lg border text-sm leading-relaxed ${styles}`}
    >
      {children}
    </div>
  );
}
