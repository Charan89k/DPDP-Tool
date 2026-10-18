"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CheckCircle2, ClipboardList, Info } from "lucide-react";
import type { OrganizationProfile } from "@/lib/organization/profile";
import { readJsonResponse } from "@/lib/http/responses";

const inputClass =
  "w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent";
const labelClass = "block text-xs font-semibold text-slate-700 mb-1";

type SdfAnswer = "yes" | "no" | "unsure";

export function OnboardingClient({ organization, adminName }: { organization: OrganizationProfile; adminName: string }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(organization.onboardingCompletedAt ? 2 : 1);
  const [profile, setProfile] = useState({
    name: organization.name,
    industry: organization.industry ?? "",
    dpoName: organization.dpoName ?? "",
    dpoEmail: organization.dpoEmail ?? "",
  });
  const [sdf, setSdf] = useState<SdfAnswer>(organization.isSdf ? "yes" : "no");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    const res = await fetch("/api/organization", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: profile.name,
        industry: profile.industry || null,
        dpoName: profile.dpoName || null,
        dpoEmail: profile.dpoEmail || null,
        isSdf: sdf === "yes",
        completeOnboarding: true,
      }),
    }).catch(() => null);
    setBusy(false);
    if (!res) return setError("Unable to reach CloudE5. Please try again.");
    const { data, errorMessage } = await readJsonResponse(res);
    if (errorMessage) {
      setError(errorMessage);
      setFieldErrors((data.details as Record<string, string[] | undefined>) || {});
      return;
    }
    setStep(2);
  };

  const startAssessment = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/assessments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: `${profile.name} DPDP Self-Assessment` }),
    }).catch(() => null);
    if (!res) {
      setBusy(false);
      return setError("Unable to reach CloudE5. Please try again.");
    }
    const { data, errorMessage } = await readJsonResponse<{ assessment: { id: string } }>(res);
    if (errorMessage || !data.assessment?.id) {
      setBusy(false);
      return setError(errorMessage || "The assessment could not be created.");
    }
    router.push(`/dashboard/assessments/${data.assessment.id}/questionnaire`);
  };

  const fieldError = (key: string) =>
    fieldErrors[key]?.[0] ? <p className="mt-1 text-xs text-rose-600">{fieldErrors[key]![0]}</p> : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#0066FF]">Welcome, {adminName}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Set up your CloudE5 workspace</h1>
        <p className="mt-1 text-sm text-slate-600">Two short steps, then you can start answering the assessment.</p>
      </div>

      <ol className="flex items-center gap-3 text-xs font-semibold" aria-label="Onboarding steps">
        {["Organisation profile", "Start your first assessment"].map((label, index) => {
          const current = step === index + 1;
          const done = step > index + 1;
          return (
            <li key={label} className="flex items-center gap-2" aria-current={current ? "step" : undefined}>
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center ${
                  done ? "bg-emerald-500 text-white" : current ? "bg-[#0066FF] text-white" : "bg-slate-200 text-slate-600"
                }`}
              >
                {done ? <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> : index + 1}
              </span>
              <span className={current ? "text-slate-900" : "text-slate-500"}>{label}</span>
              {index === 0 && <span aria-hidden="true" className="w-10 h-0.5 bg-slate-200" />}
            </li>
          );
        })}
      </ol>

      {error && (
        <div role="alert" className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm">
          {error}
        </div>
      )}

      {step === 1 ? (
        <form onSubmit={saveProfile} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5 shadow-xs">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Building2 className="w-4 h-4 text-[#0066FF]" aria-hidden="true" />
            <h2 className="font-bold text-sm text-slate-900">Organisation profile</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="org-name" className={labelClass}>Organisation name</label>
              <input id="org-name" required minLength={2} value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} className={inputClass} />
              {fieldError("name")}
            </div>
            <div>
              <label htmlFor="industry" className={labelClass}>Industry</label>
              <input id="industry" value={profile.industry} onChange={(e) => setProfile({ ...profile, industry: e.target.value })} placeholder="e.g. Healthcare" className={inputClass} />
            </div>
            <div>
              <label htmlFor="dpo-name" className={labelClass}>Data protection / grievance contact</label>
              <input id="dpo-name" value={profile.dpoName} onChange={(e) => setProfile({ ...profile, dpoName: e.target.value })} placeholder="Name (optional)" className={inputClass} />
            </div>
            <div>
              <label htmlFor="dpo-email" className={labelClass}>Contact email</label>
              <input id="dpo-email" type="email" value={profile.dpoEmail} onChange={(e) => setProfile({ ...profile, dpoEmail: e.target.value })} placeholder="Optional" className={inputClass} />
              {fieldError("dpoEmail")}
            </div>
          </div>

          <fieldset>
            <legend className={labelClass}>
              Has the Central Government notified your organisation as a Significant Data Fiduciary (SDF)?
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {([
                ["no", "No"],
                ["yes", "Yes, we have been notified"],
                ["unsure", "Not sure"],
              ] as [SdfAnswer, string][]).map(([value, label]) => (
                <label key={value} className={`px-3 py-2 rounded-lg border text-sm cursor-pointer focus-within:ring-2 focus-within:ring-[#0066FF]/40 ${sdf === value ? "border-[#0066FF] bg-blue-50 text-slate-900" : "border-slate-300 text-slate-700"}`}>
                  <input type="radio" name="sdf" value={value} checked={sdf === value} onChange={() => setSdf(value)} className="sr-only" />
                  {label}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500 flex gap-1.5">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" aria-hidden="true" />
              SDF obligations apply only after a government notification. &ldquo;Not sure&rdquo; is recorded as not notified.
              This status is shown with your results; it does not hide questions. Where an SDF-specific question does not
              apply to you, answer &ldquo;Not applicable&rdquo; and give the reason.
            </p>
          </fieldset>

          <div className="flex justify-end">
            <button type="submit" disabled={busy} aria-busy={busy} className="px-5 py-2.5 text-sm font-semibold text-white bg-[#0066FF] hover:bg-[#0052CC] disabled:opacity-60 rounded-lg">
              {busy ? "Saving..." : "Save and continue"}
            </button>
          </div>
        </form>
      ) : (
        <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <ClipboardList className="w-4 h-4 text-[#0066FF]" aria-hidden="true" />
            <h2 className="font-bold text-sm text-slate-900">Start your first assessment</h2>
          </div>
          <ul className="text-sm text-slate-700 space-y-2 list-disc pl-5">
            <li>60 questions across eight areas of the DPDP Act. Answers save automatically as you go.</li>
            <li>For each question choose Implemented, Partially implemented, Not implemented, Unknown, or Not applicable with a justification.</li>
            <li>Attach evidence where you have it. Your gap analysis and corrective actions update from your saved answers.</li>
            <li>You can invite colleagues to help from the Team page at any time.</li>
          </ul>
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" onClick={() => router.push("/dashboard")} className="px-4 py-2.5 text-sm font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50">
              Go to dashboard
            </button>
            <button type="button" onClick={startAssessment} disabled={busy} aria-busy={busy} className="px-5 py-2.5 text-sm font-semibold text-white bg-[#0066FF] hover:bg-[#0052CC] disabled:opacity-60 rounded-lg">
              {busy ? "Creating..." : "Start assessment"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
