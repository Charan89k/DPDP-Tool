"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import type { Availability, AppointmentType } from "@/lib/consultations/service";
import { postJson } from "./shared";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const ZONES = ["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "Europe/Berlin", "America/New_York", "UTC"];

interface Props {
  availability: Availability | null;
  types: AppointmentType[] | null;
  reminderOffsets: number[] | null;
}

export function AvailabilityClient({ availability, types, reminderOffsets }: Props) {
  const router = useRouter();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(availability);
  const [block, setBlock] = useState({ startsOn: "", endsOn: "", reason: "" });
  const [offsets, setOffsets] = useState((reminderOffsets ?? []).join(", "));

  const run = async (url: string, body: unknown, method: string, done: string) => {
    setBusy(true);
    const { error } = await postJson(url, body, method);
    setBusy(false);
    setNotice(error ? { ok: false, text: error } : { ok: true, text: done });
    if (!error) router.refresh();
  };

  const setDay = (day: string, ranges: Array<[string, string]>) =>
    form && setForm({ ...form, weeklyHours: { ...form.weeklyHours, [day]: ranges } });
  const num = (v: string) => Number.parseInt(v, 10) || 0;
  const input = "border border-slate-300 rounded-md px-2 py-1 text-sm";

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Availability</h1>
        <p className="text-sm text-slate-600 mt-1">Customers see only times inside your working hours, outside blocked dates and after your minimum notice.</p>
      </header>
      {notice && <div role="status" className={`p-3 rounded-md border text-sm ${notice.ok ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-rose-50 border-rose-200 text-rose-900"}`}>{notice.text}</div>}

      {form && (
        <form className="bg-white border border-slate-200 rounded-xl p-5 space-y-5" onSubmit={(e) => { e.preventDefault(); const { exceptions: _ignored, userId: _u, ...rest } = form; void run("/api/availability", { ...rest, weeklyHours: Object.fromEntries(Object.entries(form.weeklyHours).filter(([, r]) => r.length)) }, "PUT", "Availability saved."); }}>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={form.isAccepting} onChange={(e) => setForm({ ...form, isAccepting: e.target.checked })} /> Accept new bookings
          </label>
          <fieldset>
            <legend className="text-sm font-semibold text-slate-900 mb-2">Working hours</legend>
            <div className="space-y-2">
              {DAYS.map((name, i) => {
                const day = String(i + 1);
                const ranges = form.weeklyHours[day] ?? [];
                return (
                  <div key={day} className="flex flex-wrap items-center gap-2 text-sm">
                    <label className="w-32 flex items-center gap-2">
                      <input type="checkbox" checked={ranges.length > 0} onChange={(e) => setDay(day, e.target.checked ? [["09:00", "17:00"]] : [])} /> {name}
                    </label>
                    {ranges.map((r, j) => (
                      <span key={j} className="inline-flex items-center gap-1">
                        <input aria-label={`${name} start ${j + 1}`} type="time" value={r[0]} onChange={(e) => setDay(day, ranges.map((x, k) => (k === j ? [e.target.value, x[1]] : x)))} className={input} />
                        –
                        <input aria-label={`${name} end ${j + 1}`} type="time" value={r[1]} onChange={(e) => setDay(day, ranges.map((x, k) => (k === j ? [x[0], e.target.value] : x)))} className={input} />
                        {ranges.length > 1 && <button type="button" aria-label="Remove hours" onClick={() => setDay(day, ranges.filter((_, k) => k !== j))} className="text-rose-700 px-1">×</button>}
                      </span>
                    ))}
                    {ranges.length > 0 && ranges.length < 3 && <button type="button" onClick={() => setDay(day, [...ranges, ["14:00", "17:00"]])} className="text-xs text-blue-700">+ add hours</button>}
                  </div>
                );
              })}
            </div>
          </fieldset>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <label>Timezone<select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} className={`${input} block w-full mt-1`}>{[...new Set([form.timezone, ...ZONES])].map((z) => <option key={z}>{z}</option>)}</select></label>
            <label>Buffer after meetings (minutes)<input type="number" min={0} max={120} value={form.bufferMinutes} onChange={(e) => setForm({ ...form, bufferMinutes: num(e.target.value) })} className={`${input} block w-full mt-1`} /></label>
            <label>Slot interval<select value={form.slotStepMinutes} onChange={(e) => setForm({ ...form, slotStepMinutes: num(e.target.value) })} className={`${input} block w-full mt-1`}>{[15, 30, 60].map((v) => <option key={v} value={v}>{v} minutes</option>)}</select></label>
            <label>Minimum notice (hours)<input type="number" min={0} max={336} value={form.minNoticeHours} onChange={(e) => setForm({ ...form, minNoticeHours: num(e.target.value) })} className={`${input} block w-full mt-1`} /></label>
            <label>Booking window (days ahead)<input type="number" min={1} max={365} value={form.maxDaysAhead} onChange={(e) => setForm({ ...form, maxDaysAhead: num(e.target.value) })} className={`${input} block w-full mt-1`} /></label>
            <label>Default meeting link<input type="url" placeholder="https://…" value={form.meetingUrl ?? ""} onChange={(e) => setForm({ ...form, meetingUrl: e.target.value || null })} className={`${input} block w-full mt-1`} /></label>
            <label className="sm:col-span-3">Or meeting location<input value={form.location ?? ""} onChange={(e) => setForm({ ...form, location: e.target.value || null })} className={`${input} block w-full mt-1`} /></label>
          </div>
          <button type="submit" disabled={busy} className="px-4 py-2 text-sm font-semibold bg-[#0B3B6F] text-white rounded-md disabled:opacity-50">Save availability</button>
        </form>
      )}

      {form && (
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3" aria-labelledby="blocked-heading">
          <h2 id="blocked-heading" className="text-base font-semibold">Blocked dates</h2>
          <form className="flex flex-wrap items-end gap-2 text-sm" onSubmit={(e) => { e.preventDefault(); void run("/api/availability", block, "POST", "Dates blocked."); }}>
            <label>From<input type="date" required value={block.startsOn} onChange={(e) => setBlock({ ...block, startsOn: e.target.value })} className={`${input} block mt-1`} /></label>
            <label>To<input type="date" required value={block.endsOn} onChange={(e) => setBlock({ ...block, endsOn: e.target.value })} className={`${input} block mt-1`} /></label>
            <label>Reason<input value={block.reason} onChange={(e) => setBlock({ ...block, reason: e.target.value })} className={`${input} block mt-1`} /></label>
            <button type="submit" disabled={busy} className="px-3 py-1.5 border border-slate-300 rounded-md">Block</button>
          </form>
          {form.exceptions.length === 0 ? <p className="text-sm text-slate-500">No blocked dates.</p> : (
            <ul className="text-sm divide-y divide-slate-100">
              {form.exceptions.map((x) => (
                <li key={x.id} className="py-1.5 flex justify-between gap-2">
                  <span>{x.startsOn}{x.endsOn !== x.startsOn ? ` to ${x.endsOn}` : ""}{x.reason ? ` · ${x.reason}` : ""}</span>
                  <button type="button" disabled={busy} onClick={() => run(`/api/availability?exceptionId=${x.id}`, {}, "DELETE", "Dates unblocked.")} className="text-xs text-rose-700">Remove</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {types && (
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4" aria-labelledby="types-heading">
          <h2 id="types-heading" className="text-base font-semibold">Consultation types (administrator)</h2>
          {[...types, { id: "", code: "", name: "", description: "", durationMinutes: 30, requiresApproval: false, isActive: true, sortOrder: types.length + 1 }].map((t) => (
            <TypeRow key={t.id || "new"} type={t} busy={busy} onSave={(value) => run("/api/consultations/settings", { appointmentType: { ...value, id: value.id || undefined } }, "PUT", "Consultation type saved.")} />
          ))}
          <form className="flex flex-wrap items-end gap-2 text-sm border-t border-slate-100 pt-4" onSubmit={(e) => { e.preventDefault(); void run("/api/consultations/settings", { reminderOffsets: offsets.split(",").map((v) => Number(v.trim())).filter(Boolean) }, "PUT", "Reminder timing saved."); }}>
            <label>Reminders, minutes before the meeting (comma-separated)<input value={offsets} onChange={(e) => setOffsets(e.target.value)} className={`${input} block mt-1 w-64`} /></label>
            <button type="submit" disabled={busy} className="px-3 py-1.5 border border-slate-300 rounded-md">Save reminders</button>
          </form>
        </section>
      )}
    </div>
  );
}

function TypeRow({ type, busy, onSave }: { type: AppointmentType; busy: boolean; onSave: (t: AppointmentType) => void }) {
  const [t, setT] = useState(type);
  const input = "border border-slate-300 rounded-md px-2 py-1 text-sm";
  return (
    <form className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end text-sm" onSubmit={(e) => { e.preventDefault(); onSave(t); }}>
      <label className="md:col-span-3">Name<input required minLength={3} value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} className={`${input} block w-full`} placeholder="New consultation type" /></label>
      <label className="md:col-span-4">Description<input value={t.description} onChange={(e) => setT({ ...t, description: e.target.value })} className={`${input} block w-full`} /></label>
      <label className="md:col-span-1">Minutes<input type="number" min={15} max={240} value={t.durationMinutes} onChange={(e) => setT({ ...t, durationMinutes: Number(e.target.value) })} className={`${input} block w-full`} /></label>
      <label className="md:col-span-2 flex items-center gap-1"><input type="checkbox" checked={t.requiresApproval} onChange={(e) => setT({ ...t, requiresApproval: e.target.checked })} /> TLI confirms</label>
      <label className="md:col-span-1 flex items-center gap-1"><input type="checkbox" checked={t.isActive} onChange={(e) => setT({ ...t, isActive: e.target.checked })} /> Active</label>
      <button type="submit" disabled={busy} className="md:col-span-1 px-2 py-1 border border-slate-300 rounded-md">{type.id ? "Save" : "Add"}</button>
    </form>
  );
}
