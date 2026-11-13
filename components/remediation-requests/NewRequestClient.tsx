"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/components/consultations/shared";

interface Gap { code: string; title: string; severity: string }

export function NewRequestClient({ assessmentId, engagementCode, gaps, wantsConsultation }: { assessmentId: string; engagementCode: string; gaps: Gap[]; wantsConsultation: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [consult, setConsult] = useState(wantsConsultation);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toggle = (code: string) => setSelected((s) => (s.includes(code) ? s.filter((c) => c !== code) : [...s, code]));

  const submit = async (asDraft: boolean) => {
    setBusy(true);
    const { data, error: err } = await postJson<{ id: string }>("/api/remediation-requests", { assessmentId, questionCodes: selected, helpDescription: description, wantsConsultation: consult, submit: !asDraft });
    setBusy(false);
    if (err || !data) return setError(err);
    router.push(consult && !asDraft ? `/dashboard/consultations?type=REMEDIATION_PLANNING&assessment=${assessmentId}&request=${data.id}` : `/dashboard/remediation-requests/${data.id}`);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-12">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Get help fixing compliance gaps</h1>
        <p className="text-sm text-slate-600 mt-1">Assessment {engagementCode}. Choose the gaps you want TLI&apos;s help with. TLI reviews your request and sends a proposal; nothing is charged by submitting it.</p>
      </header>
      {error && <p role="alert" className="p-3 rounded-md border border-rose-200 bg-rose-50 text-sm text-rose-900">{error}</p>}
      <fieldset className="bg-white border border-slate-200 rounded-xl p-5">
        <legend className="text-sm font-semibold px-1">Identified gaps ({selected.length} selected)</legend>
        {gaps.length === 0 ? <p className="text-sm text-slate-500">This report lists no gaps.</p> : (
          <ul className="divide-y divide-slate-100 max-h-[28rem] overflow-y-auto">
            {gaps.map((g) => (
              <li key={g.code}>
                <label className="flex items-start gap-3 py-2 text-sm cursor-pointer">
                  <input type="checkbox" className="mt-1" checked={selected.includes(g.code)} onChange={() => toggle(g.code)} />
                  <span><span className="font-mono text-xs font-semibold mr-2">{g.code}</span>{g.title}<span className="block text-xs text-slate-500">{g.severity.replace(/_/g, " ").toLowerCase()}</span></span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
      <label className="block bg-white border border-slate-200 rounded-xl p-5 text-sm">
        <span className="font-semibold block mb-1">What help do you need?</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} maxLength={5000} className="w-full border border-slate-300 rounded-md px-3 py-2" placeholder="Describe the remediation you need, deadlines and any constraints." />
        <span className="flex items-center gap-2 mt-3"><input type="checkbox" checked={consult} onChange={(e) => setConsult(e.target.checked)} /> I also want a consultation to plan the remediation</span>
      </label>
      <p className="text-xs text-slate-500">You can add supporting documents after submitting, on the request page.</p>
      <div className="flex gap-2">
        <button type="button" disabled={busy || selected.length === 0} onClick={() => submit(false)} className="px-4 py-2 text-sm font-semibold bg-[#0B3B6F] text-white rounded-md disabled:opacity-50">Submit request</button>
        <button type="button" disabled={busy || selected.length === 0} onClick={() => submit(true)} className="px-4 py-2 text-sm border border-slate-300 rounded-md disabled:opacity-50">Save as draft</button>
      </div>
    </div>
  );
}
