"use client";

import React, { useCallback, useEffect, useState } from "react";
import { CalendarCheck, CalendarPlus, Clock, Download, Video } from "lucide-react";
import { readJsonResponse } from "@/lib/http/responses";
import type { AppointmentView } from "@/lib/consultations/service";
import { SlotPicker, StatusBadge, browserTimeZone, fmtDateTime, postJson } from "./shared";
import type { Slot } from "./shared";

interface TypeOption { id: string; code: string; name: string; description: string; durationMinutes: number; requiresApproval: boolean }
interface Option { id: string; label: string }

interface ConsultationsClientProps {
  types: TypeOption[];
  assessors: Array<{ userId: string; fullName: string }>;
  assessments: Option[];
  canBook: boolean;
  preset: { typeCode?: string; assessmentId?: string; remediationRequestId?: string };
}

const icsLinks = (a: AppointmentView) => {
  const fmt = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const text = `${a.typeName}: Truth Labs International`;
  const details = `${a.typeName} with Truth Labs International\nAgenda: ${a.agenda || "To be confirmed"}\nJoin: ${a.meetingUrl || a.location || "Details from your TLI assessor"}`;
  return {
    google: `https://calendar.google.com/calendar/render?${new URLSearchParams({ action: "TEMPLATE", text, dates: `${fmt(a.startsAt)}/${fmt(a.endsAt)}`, details, location: a.meetingUrl || a.location || "" })}`,
    outlook: `https://outlook.office.com/calendar/0/deeplink/compose?${new URLSearchParams({ path: "/calendar/action/compose", rru: "addevent", subject: text, startdt: a.startsAt, enddt: a.endsAt, body: details, location: a.meetingUrl || a.location || "" })}`,
  };
};

export function ConsultationsClient({ types, assessors, assessments, canBook, preset }: ConsultationsClientProps) {
  const [appointments, setAppointments] = useState<AppointmentView[] | null>(null);
  const [now, setNow] = useState(0);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [typeId, setTypeId] = useState(() => types.find((t) => t.code === preset.typeCode)?.id ?? "");
  const [assessorId, setAssessorId] = useState("");
  const [slot, setSlot] = useState<Slot | null>(null);
  const [agenda, setAgenda] = useState("");
  const [assessmentId, setAssessmentId] = useState(preset.assessmentId ?? "");
  const [busy, setBusy] = useState(false);
  const [rescheduling, setRescheduling] = useState<AppointmentView | null>(null);
  const [newSlot, setNewSlot] = useState<Slot | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/consultations").catch(() => null);
    if (!res) return setNotice({ ok: false, text: "Unable to load your consultations." });
    const { data, errorMessage } = await readJsonResponse<{ appointments: AppointmentView[] }>(res);
    if (errorMessage) setNotice({ ok: false, text: errorMessage });
    else {
      setAppointments(data.appointments);
      setNow(Date.now());
    }
  }, []);
  useEffect(() => {
    // Loads server data; the loader is also used after every action.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const book = async () => {
    if (!slot) return;
    setBusy(true);
    const { data, error } = await postJson<{ status: string }>("/api/consultations", {
      typeId,
      assessorId: slot.assessorId,
      startsAt: slot.startsAt,
      agenda,
      clientTimezone: browserTimeZone(),
      assessmentId: assessmentId || null,
      remediationRequestId: preset.remediationRequestId || null,
    });
    setBusy(false);
    if (error) return setNotice({ ok: false, text: error });
    setNotice({ ok: true, text: data?.status === "PENDING" ? "Request sent. TLI will confirm it and email you the calendar invitation." : "Booked. A calendar invitation is on its way to you and your TLI assessor." });
    setSlot(null);
    setAgenda("");
    void load();
  };

  const act = async (id: string, body: Record<string, unknown>, done: string) => {
    setBusy(true);
    const { error } = await postJson(`/api/consultations/${id}`, body);
    setBusy(false);
    setNotice(error ? { ok: false, text: error } : { ok: true, text: done });
    setRescheduling(null);
    setNewSlot(null);
    void load();
  };

  const upcoming = (appointments ?? []).filter((a) => (a.status === "PENDING" || a.status === "CONFIRMED") && Date.parse(a.endsAt) > now);
  const history = (appointments ?? []).filter((a) => !upcoming.includes(a)).reverse();
  const type = types.find((t) => t.id === typeId);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Consultations</h1>
        <p className="text-sm text-slate-600 mt-1">Book time with a Truth Labs International assessor. Invitations arrive by email and work with Google Calendar, Outlook and Apple Calendar.</p>
      </header>

      {notice && (
        <div role="status" className={`p-3 rounded-md border text-sm ${notice.ok ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-rose-50 border-rose-200 text-rose-900"}`}>{notice.text}</div>
      )}

      {canBook ? (
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-5" aria-labelledby="book-heading">
          <h2 id="book-heading" className="text-lg font-semibold text-slate-900 flex items-center gap-2"><CalendarPlus className="w-5 h-5 text-[#0B3B6F]" /> Book a consultation</h2>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">1. Consultation type</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {types.map((t) => (
                <button key={t.id} type="button" onClick={() => { setTypeId(t.id); setSlot(null); }} aria-pressed={typeId === t.id}
                  className={`text-left p-3 rounded-lg border ${typeId === t.id ? "border-[#0B3B6F] ring-2 ring-[#0B3B6F]/20 bg-blue-50/40" : "border-slate-200 hover:border-slate-400"}`}>
                  <div className="font-semibold text-sm text-slate-900">{t.name}</div>
                  <div className="text-xs text-slate-600 mt-1">{t.description}</div>
                  <div className="text-xs text-slate-500 mt-2 flex items-center gap-1"><Clock className="w-3 h-3" /> {t.durationMinutes} minutes{t.requiresApproval ? " · confirmed by TLI" : ""}</div>
                </button>
              ))}
            </div>
          </div>
          {type && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">2. Assessor and time</h3>
              {assessors.length === 0 ? (
                <p className="text-sm text-slate-600">No assessor is taking bookings right now. Please try again later.</p>
              ) : (
                <>
                  <label className="text-sm text-slate-700 block mb-3">
                    <span className="mr-2">Assessor</span>
                    <select value={assessorId} onChange={(e) => { setAssessorId(e.target.value); setSlot(null); }} className="border border-slate-300 rounded-md px-2 py-1 text-sm">
                      <option value="">Any available assessor</option>
                      {assessors.map((a) => <option key={a.userId} value={a.userId}>{a.fullName}</option>)}
                    </select>
                  </label>
                  <SlotPicker typeId={typeId} assessorId={assessorId || undefined} selected={slot} onSelect={setSlot} />
                </>
              )}
            </div>
          )}
          {slot && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">3. Meeting details</h3>
              {assessments.length > 0 && (
                <label className="text-sm text-slate-700 block">
                  <span className="block text-xs font-semibold mb-1">Related assessment (optional)</span>
                  <select value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)} className="border border-slate-300 rounded-md px-2 py-1.5 text-sm w-full sm:w-auto">
                    <option value="">None</option>
                    {assessments.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                  </select>
                </label>
              )}
              <label className="text-sm text-slate-700 block">
                <span className="block text-xs font-semibold mb-1">What would you like to discuss?</span>
                <textarea value={agenda} onChange={(e) => setAgenda(e.target.value)} rows={3} maxLength={2000} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="For example: walk through the findings on consent and breach notification" />
              </label>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-sm">
                <strong>{type?.name}</strong> with {slot.assessorName} on {fmtDateTime(slot.startsAt)} ({type?.durationMinutes} minutes)
              </div>
              <button type="button" disabled={busy} onClick={book} className="px-4 py-2 text-sm font-semibold bg-[#0B3B6F] hover:bg-[#0A3260] text-white rounded-md disabled:opacity-50">
                {type?.requiresApproval ? "Request this time" : "Confirm booking"}
              </button>
            </div>
          )}
        </section>
      ) : (
        <p className="text-sm text-slate-600">Ask your organisation administrator or a contributor to book consultations.</p>
      )}

      {rescheduling && (
        <section className="bg-white border border-amber-300 rounded-xl p-5 space-y-3" aria-labelledby="resched-heading">
          <h2 id="resched-heading" className="text-base font-semibold">Reschedule {rescheduling.typeName} ({fmtDateTime(rescheduling.startsAt)})</h2>
          <SlotPicker typeId={types.find((t) => t.name === rescheduling.typeName)?.id ?? ""} assessorId={rescheduling.assessorId} selected={newSlot} onSelect={setNewSlot} />
          <div className="flex gap-2">
            <button type="button" disabled={!newSlot || busy} onClick={() => newSlot && act(rescheduling.id, { action: "RESCHEDULE", startsAt: newSlot.startsAt }, "Rescheduled. Updated calendar invitations are on their way.")} className="px-4 py-2 text-sm font-semibold bg-[#0B3B6F] text-white rounded-md disabled:opacity-50">Move to selected time</button>
            <button type="button" onClick={() => setRescheduling(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-md">Keep current time</button>
          </div>
        </section>
      )}

      <AppointmentList title="Upcoming appointments" items={upcoming} empty="No upcoming consultations." actions={(a) => (
        <div className="flex flex-wrap gap-2 text-xs">
          <a href={`/api/consultations/${a.id}/ics`} className="inline-flex items-center gap-1 px-2 py-1 border border-slate-300 rounded"><Download className="w-3 h-3" /> .ics</a>
          <a href={icsLinks(a).google} target="_blank" rel="noopener noreferrer" className="px-2 py-1 border border-slate-300 rounded">Google Calendar</a>
          <a href={icsLinks(a).outlook} target="_blank" rel="noopener noreferrer" className="px-2 py-1 border border-slate-300 rounded">Outlook</a>
          {canBook && <button type="button" onClick={() => { setRescheduling(a); setNewSlot(null); }} className="px-2 py-1 border border-slate-300 rounded">Reschedule</button>}
          {canBook && <button type="button" disabled={busy} onClick={() => { const reason = window.prompt("Reason for cancelling (optional)") ?? null; if (reason !== null) void act(a.id, { action: "CANCEL", reason }, "Cancelled. Both calendars will be updated."); }} className="px-2 py-1 border border-rose-300 text-rose-700 rounded">Cancel</button>}
        </div>
      )} />
      <AppointmentList title="Appointment history" items={history} empty="No past consultations yet." />
    </div>
  );
}

function AppointmentList({ title, items, empty, actions }: { title: string; items: AppointmentView[]; empty: string; actions?: (a: AppointmentView) => React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5" aria-label={title}>
      <h2 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2"><CalendarCheck className="w-4 h-4 text-[#0B3B6F]" /> {title}</h2>
      {items.length === 0 ? <p className="text-sm text-slate-500">{empty}</p> : (
        <ul className="divide-y divide-slate-100">
          {items.map((a) => (
            <li key={a.id} className="py-3 flex flex-col sm:flex-row sm:items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-sm text-slate-900">{a.typeName}</span>
                  <StatusBadge status={a.status} />
                </div>
                <div className="text-sm text-slate-700">{fmtDateTime(a.startsAt)} with {a.assessorName}</div>
                {a.engagementCode && <div className="text-xs text-slate-500">Assessment {a.engagementCode}</div>}
                {(a.meetingUrl || a.location) && a.status !== "CANCELLED" && (
                  <div className="text-xs text-slate-600 flex items-center gap-1"><Video className="w-3 h-3" />{a.meetingUrl ? <a className="text-blue-700 underline" href={a.meetingUrl} target="_blank" rel="noopener noreferrer">{a.meetingUrl}</a> : a.location}</div>
                )}
                {a.cancellationReason && <div className="text-xs text-slate-500">Reason: {a.cancellationReason}</div>}
                <div className="text-xs text-slate-500">Invitation: {a.invitations.length ? a.invitations.slice(-1).map((i) => <StatusBadge key={i.id} status={i.status} />) : "not sent"}</div>
              </div>
              {actions?.(a)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
