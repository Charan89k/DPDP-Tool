"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";
import { readJsonResponse } from "@/lib/http/responses";

export interface Slot {
  assessorId: string;
  assessorName: string;
  startsAt: string;
  endsAt: string;
}

export const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";

export const fmtDateTime = (iso: string, timeZone?: string) =>
  new Intl.DateTimeFormat("en-IN", { timeZone, weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(iso));
export const fmtTime = (iso: string) => new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
export const fmtDay = (iso: string) => new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
export const localDateKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type Variant = NonNullable<BadgeProps["variant"]>;
const STATUS: Record<string, [string, Variant]> = {
  PENDING: ["Awaiting confirmation", "amber"],
  CONFIRMED: ["Confirmed", "emerald"],
  CANCELLED: ["Cancelled", "slate"],
  COMPLETED: ["Held", "blue"],
  QUEUED: ["Queued", "slate"],
  SENDING: ["Sending", "blue"],
  SENT: ["Sent", "emerald"],
  FAILED: ["Failed", "rose"],
};
export function StatusBadge({ status }: { status: string }) {
  const [label, variant] = STATUS[status] ?? [status.replace(/_/g, " ").toLowerCase(), "slate" as Variant];
  return <Badge variant={variant} size="sm">{label}</Badge>;
}

export async function postJson<T extends object = Record<string, unknown>>(url: string, body: unknown, method = "POST") {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  if (!res) return { data: null, error: "Unable to reach the TLI platform. Please try again." };
  const { data, errorMessage } = await readJsonResponse<T>(res);
  return { data: errorMessage ? null : data, error: errorMessage };
}

/** Real availability for a consultation type, grouped by day in the viewer's timezone. */
export function SlotPicker({ typeId, assessorId, selected, onSelect }: { typeId: string; assessorId?: string; selected: Slot | null; onSelect: (s: Slot) => void }) {
  const [weekStart, setWeekStart] = useState(() => new Date());
  const from = isoDate(weekStart);
  const to = isoDate(new Date(weekStart.getTime() + 13 * 86_400_000));
  const query = new URLSearchParams({ typeId, from, to, ...(assessorId ? { assessorId } : {}) }).toString();
  // Results are keyed by the query, so a new query shows "loading" without resetting state in the effect.
  const [result, setResult] = useState<{ query: string; slots?: Slot[]; error?: string }>({ query: "" });
  const current = result.query === query ? result : null;
  const slots = current?.slots ?? null;
  const error = current?.error ?? null;

  useEffect(() => {
    if (!typeId) return;
    let cancelled = false;
    fetch(`/api/consultations/slots?${query}`)
      .then((r) => readJsonResponse<{ slots: Slot[] }>(r))
      .then(({ data, errorMessage }) => {
        if (!cancelled) setResult(errorMessage ? { query, error: errorMessage } : { query, slots: data.slots });
      })
      .catch(() => !cancelled && setResult({ query, error: "Unable to load available times." }));
    return () => {
      cancelled = true;
    };
  }, [typeId, query]);

  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots ?? []) map.set(localDateKey(s.startsAt), [...(map.get(localDateKey(s.startsAt)) ?? []), s]);
    return [...map.entries()];
  }, [slots]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-md disabled:opacity-40" disabled={weekStart <= new Date()} onClick={() => setWeekStart(new Date(Math.max(Date.now(), weekStart.getTime() - 14 * 86_400_000)))}>
          ← Earlier
        </button>
        <span className="text-xs text-slate-600">
          {fmtDay(`${from}T12:00:00`)} – {fmtDay(`${to}T12:00:00`)} · times in {browserTimeZone()}
        </span>
        <button type="button" className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-md" onClick={() => setWeekStart(new Date(weekStart.getTime() + 14 * 86_400_000))}>
          Later →
        </button>
      </div>
      {error && <p className="text-sm text-rose-700" role="alert">{error}</p>}
      {!slots && !error && <p className="text-sm text-slate-500">Loading available times…</p>}
      {slots && slots.length === 0 && <p className="text-sm text-slate-600">No available times in these two weeks. Try later dates.</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {byDay.map(([day, list]) => (
          <div key={day} className="border border-slate-200 rounded-lg p-3">
            <div className="text-xs font-semibold text-slate-800 mb-2">{fmtDay(list[0].startsAt)}</div>
            <div className="flex flex-wrap gap-1.5">
              {list.map((s) => {
                const active = selected?.startsAt === s.startsAt && selected.assessorId === s.assessorId;
                return (
                  <button
                    key={`${s.assessorId}-${s.startsAt}`}
                    type="button"
                    onClick={() => onSelect(s)}
                    aria-pressed={active}
                    title={s.assessorName}
                    className={`px-2 py-1 text-xs rounded border ${active ? "bg-[#0B3B6F] text-white border-[#0B3B6F]" : "bg-white text-slate-700 border-slate-300 hover:border-[#0B3B6F]"}`}
                  >
                    {fmtTime(s.startsAt)}
                    {!assessorId && <span className="block text-[10px] opacity-75">{s.assessorName.split(" (")[0]}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
