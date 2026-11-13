/**
 * TLI — Timezone helpers for scheduling (IANA zones via Intl; no external library).
 * Instants are stored and compared in UTC; wall-clock times are interpreted in a named zone.
 */

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

function zoneParts(instant: Date, timeZone: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  }).formatToParts(instant);
  const out: Record<string, number> = {};
  for (const p of parts) if (p.type !== "literal" && p.type !== "weekday") out[p.type] = Number(p.value);
  out.weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(parts.find((p) => p.type === "weekday")!.value) + 1;
  return out;
}

/** Milliseconds the zone is ahead of UTC at `instant` (e.g. +19800000 for Asia/Kolkata). */
function offsetMs(instant: Date, timeZone: string): number {
  const p = zoneParts(instant, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The UTC instant of wall-clock `date` (YYYY-MM-DD) `time` (HH:MM) in `timeZone`. */
export function zonedWallTimeToUtc(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, h, mi);
  // Two passes settle the offset across daylight-saving transitions.
  let utc = wall - offsetMs(new Date(wall), timeZone);
  utc = wall - offsetMs(new Date(utc), timeZone);
  return new Date(utc);
}

/** Calendar date (YYYY-MM-DD) and ISO weekday (1 = Monday) of an instant in a zone. */
export function zonedDate(instant: Date, timeZone: string): { date: string; weekday: number } {
  const p = zoneParts(instant, timeZone);
  return { date: `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`, weekday: p.weekday };
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** e.g. "Wed, 14 Jan 2026, 10:00 am IST" in the given zone. */
export function formatInZone(instant: Date | string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(instant));
}
