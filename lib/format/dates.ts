/**
 * CloudE5 — date display.
 *
 * Dates are rendered on the server (UTC) and again in the browser (the viewer's zone). Formatting
 * with the runtime's default locale and time zone makes the two disagree, which React reports as a
 * hydration error. Every displayed date therefore uses one fixed locale and time zone (India, since
 * CloudE5 assesses the DPDP Act). Safe to import from client components.
 */

export const DISPLAY_LOCALE = "en-IN";
export const DISPLAY_TIME_ZONE = "Asia/Kolkata";

type DateInput = string | number | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function format(value: DateInput, options: Intl.DateTimeFormatOptions): string {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat(DISPLAY_LOCALE, { timeZone: DISPLAY_TIME_ZONE, ...options }).format(date) : "";
}

/** "19 Oct 2026" */
export function formatDate(value: DateInput): string {
  return format(value, { day: "numeric", month: "short", year: "numeric" });
}

/** "19 Oct 2026, 6:02 pm" */
export function formatDateTime(value: DateInput): string {
  return format(value, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/** "6:02 pm" */
export function formatTime(value: DateInput): string {
  return format(value, { hour: "numeric", minute: "2-digit" });
}
