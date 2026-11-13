"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { readJsonResponse } from "@/lib/http/responses";
import type { AppointmentView } from "@/lib/consultations/service";
import { SlotPicker, StatusBadge, fmtDateTime, fmtDay, fmtTime, isoDate, localDateKey, postJson } from "./shared";
import type { Slot } from "./shared";

interface Props {
  typeIdsByName: Record<string, string>;
  organisations: Array<{ id: string; name: string }>;
  assessors: Array<{ id: string; name: string }>;
  canManageAll: boolean;
  canRetry: boolean;
}

const mondayOf = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};

export function AppointmentsDashboardClient({ typeIdsByName, organisations, assessors, canManageAll, canRetry }: Props) {
  const [items, setItems] = useState<AppointmentView[] | null>(null);
  // "Now" for grouping is the moment the data was loaded, which keeps rendering pure.
  const [now, setNow] = useState(0);
  const [filters, setFilters] = useState({ tenantId: "", assessorId: "", status: "" });
  const [week, setWeek] = useState(() => mondayOf(new Date()));
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [rescheduling, setRescheduling] = useState<AppointmentView | null>(null);
  const [newSlot, setNewSlot] = useState<Slot | null>(null);

  const load = useCallback(async () => {
    const q = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
    const res = await fetch(`/api/consultations?${q}`).catch(() => null);
    if (!res) return setNotice({ ok: false, text: "Unable to load appointments." });
    const { data, errorMessage } = await readJsonResponse<{ appointments: AppointmentView[] }>(res);
    if (errorMessage) setNotice({ ok: false, text: errorMessage });
    else {
      setItems(data.appointments);
      setNow(Date.now());
    }
  }, [filters]);
  useEffect(() => {
    // Loads server data; the loader is also used after every action.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const act = async (url: string, body: Record<string, unknown>, done: string) => {
    setBusy(true);
    const { error } = await postJson(url, body);
    setBusy(false);
    setNotice(error ? { ok: false, text: error } : { ok: true, text: done });
    setRescheduling(null);
    void load();
  };

  const all = items ?? [];
  const todayKey = now ? localDateKey(new Date(now).toISOString()) : "";
  const active = all.filter((a) => a.status === "PENDING" || a.status === "CONFIRMED");
  const requests = active.filter((a) => a.status === "PENDING");
  const today = active.filter((a) => localDateKey(a.startsAt) === todayKey);
  const upcoming = active.filter((a) => Date.parse(a.startsAt) > now && localDateKey(a.startsAt) !== todayKey);
  const failed = all.flatMap((a) => a.invitations.filter((i) => i.status === "FAILED").map((i) => ({ a, i })));
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(week.getTime() + i * 86_400_000)), [week]);

  const renderRow = (a: AppointmentView) => (
    <li key={a.id} className="py-3 flex flex-col lg:flex-row lg:items-start justify-between gap-2">
      <div className="space-y-0.5">
        <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-sm">{a.typeName}</span><StatusBadge status={a.status} /></div>
        <div className="text-sm text-slate-700">{fmtDateTime(a.startsAt)} · {a.organisation}{a.engagementCode ? ` · ${a.engagementCode}` : ""}</div>
        <div className="text-xs text-slate-500">Client: {a.clientName} {a.clientEmail && `<${a.clientEmail}>`} · Assessor: {a.assessorName}</div>
        {a.agenda && <div className="text-xs text-slate-600">Agenda: {a.agenda}</div>}
        <div className="text-xs text-slate-500 flex flex-wrap gap-1 items-center">Invitations: {a.invitations.length === 0 ? "none" : a.invitations.map((i) => <span key={i.id} className="inline-flex items-center gap-1">{i.role.toLowerCase()} {i.kind.toLowerCase()} <StatusBadge status={i.status} /></span>)}</div>
      </div>
      <div className="flex flex-wrap gap-1.5 text-xs">
        {a.status === "PENDING" && <button type="button" disabled={busy} onClick={() => { const url = window.prompt("Meeting link (https://…), or leave empty to use your default", "") ?? null; if (url !== null) void act(`/api/consultations/${a.id}`, { action: "CONFIRM", meetingUrl: url || null }, "Confirmed. Invitations are on their way."); }} className="px-2 py-1 bg-[#0B3B6F] text-white rounded">Confirm</button>}
        {(a.status === "PENDING" || a.status === "CONFIRMED") && <button type="button" onClick={() => { setRescheduling(a); setNewSlot(null); }} className="px-2 py-1 border border-slate-300 rounded">Reschedule</button>}
        {(a.status === "PENDING" || a.status === "CONFIRMED") && <button type="button" disabled={busy} onClick={() => { const reason = window.prompt("Reason for cancelling") ?? null; if (reason !== null) void act(`/api/consultations/${a.id}`, { action: "CANCEL", reason }, "Cancelled; both parties are notified."); }} className="px-2 py-1 border border-rose-300 text-rose-700 rounded">Cancel</button>}
        {a.status === "CONFIRMED" && Date.parse(a.startsAt) <= now && <button type="button" disabled={busy} onClick={() => act(`/api/consultations/${a.id}`, { action: "COMPLETE" }, "Marked as held.")} className="px-2 py-1 border border-emerald-300 text-emerald-700 rounded">Mark held</button>}
        <a href={`/api/consultations/${a.id}/ics`} className="px-2 py-1 border border-slate-300 rounded">.ics</a>
      </div>
    </li>
  );

  const renderList = (title: string, list: AppointmentView[], empty: string) => (
    <section className="bg-white border border-slate-200 rounded-xl p-5" aria-label={title}>
      <h2 className="text-base font-semibold mb-2">{title} ({list.length})</h2>
      {list.length === 0 ? <p className="text-sm text-slate-500">{empty}</p> : <ul className="divide-y divide-slate-100">{list.map(renderRow)}</ul>}
    </section>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Appointments</h1>
          <p className="text-sm text-slate-600 mt-1">{canManageAll ? "All consultations across organisations." : "Your consultations."} Times shown in your browser&apos;s timezone.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <select aria-label="Organisation" value={filters.tenantId} onChange={(e) => setFilters({ ...filters, tenantId: e.target.value })} className="border border-slate-300 rounded-md px-2 py-1"><option value="">All organisations</option>{organisations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
          {canManageAll && <select aria-label="Assessor" value={filters.assessorId} onChange={(e) => setFilters({ ...filters, assessorId: e.target.value })} className="border border-slate-300 rounded-md px-2 py-1"><option value="">All assessors</option>{assessors.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>}
          <select aria-label="Status" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="border border-slate-300 rounded-md px-2 py-1"><option value="">All statuses</option>{["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"].map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}</select>
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1 px-2 py-1 border border-slate-300 rounded-md"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
        </div>
      </header>

      {notice && <div role="status" className={`p-3 rounded-md border text-sm ${notice.ok ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-rose-50 border-rose-200 text-rose-900"}`}>{notice.text}</div>}

      {failed.length > 0 && (
        <div role="alert" className="p-3 rounded-md border border-rose-200 bg-rose-50 text-sm text-rose-900 space-y-1">
          <strong>{failed.length} invitation email{failed.length === 1 ? "" : "s"} failed.</strong>
          {failed.map(({ a, i }) => (
            <div key={i.id} className="flex flex-wrap items-center gap-2 text-xs">
              {a.organisation} · {fmtDateTime(a.startsAt)} · {i.role.toLowerCase()} {i.kind.toLowerCase()}: {i.lastError}
              {canRetry && <button type="button" disabled={busy} onClick={() => act(`/api/notifications/${i.id}/retry`, {}, "Email sent.")} className="px-2 py-0.5 border border-rose-300 rounded">Retry</button>}
            </div>
          ))}
        </div>
      )}

      {rescheduling && (
        <section className="bg-white border border-amber-300 rounded-xl p-5 space-y-3">
          <h2 className="text-base font-semibold">Reschedule {rescheduling.typeName} with {rescheduling.organisation}</h2>
          <SlotPicker typeId={typeIdsByName[rescheduling.typeName] ?? ""} assessorId={rescheduling.assessorId} selected={newSlot} onSelect={setNewSlot} />
          <div className="flex gap-2">
            <button type="button" disabled={!newSlot || busy} onClick={() => newSlot && act(`/api/consultations/${rescheduling.id}`, { action: "RESCHEDULE", startsAt: newSlot.startsAt }, "Rescheduled; updated invitations are on their way.")} className="px-4 py-2 text-sm font-semibold bg-[#0B3B6F] text-white rounded-md disabled:opacity-50">Move to selected time</button>
            <button type="button" onClick={() => setRescheduling(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-md">Cancel</button>
          </div>
        </section>
      )}

      <section className="bg-white border border-slate-200 rounded-xl p-5" aria-label="Week calendar">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Week of {fmtDay(week.toISOString())}</h2>
          <div className="flex gap-1">
            <button type="button" aria-label="Previous week" onClick={() => setWeek(new Date(week.getTime() - 7 * 86_400_000))} className="p-1.5 border border-slate-300 rounded"><ChevronLeft className="w-4 h-4" /></button>
            <button type="button" onClick={() => setWeek(mondayOf(new Date()))} className="px-2 py-1 text-xs border border-slate-300 rounded">This week</button>
            <button type="button" aria-label="Next week" onClick={() => setWeek(new Date(week.getTime() + 7 * 86_400_000))} className="p-1.5 border border-slate-300 rounded"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
          {days.map((d) => {
            const key = isoDate(d);
            const list = all.filter((a) => localDateKey(a.startsAt) === key && a.status !== "CANCELLED");
            return (
              <div key={key} className={`min-h-28 border rounded-lg p-2 ${key === todayKey ? "border-[#0B3B6F] bg-blue-50/40" : "border-slate-200"}`}>
                <div className="text-xs font-semibold text-slate-700 mb-1">{fmtDay(d.toISOString())}</div>
                {list.map((a) => (
                  <div key={a.id} className={`mb-1 p-1.5 rounded text-[11px] leading-tight ${a.status === "PENDING" ? "bg-amber-100 text-amber-900" : a.status === "COMPLETED" ? "bg-slate-100 text-slate-600" : "bg-[#0B3B6F] text-white"}`}>
                    <div className="font-semibold">{fmtTime(a.startsAt)}–{fmtTime(a.endsAt)}</div>
                    <div className="truncate">{a.organisation}</div>
                    <div className="truncate opacity-80">{a.typeName}</div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </section>

      {items === null ? <p className="text-sm text-slate-500">Loading…</p> : (
        <>
          {renderList("Requests awaiting confirmation", requests, "No requests waiting.")}
          {renderList("Today", today, "Nothing scheduled today.")}
          {renderList("Upcoming", upcoming, "No upcoming consultations.")}
          {renderList("History", all.filter((a) => !active.includes(a)).reverse(), "No history yet.")}
        </>
      )}
    </div>
  );
}
