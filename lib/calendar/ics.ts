/**
 * TLI — iCalendar (RFC 5545) invitations and add-to-calendar links.
 *
 * Each appointment has one stable UID; every change increases SEQUENCE, so calendar clients
 * (Google Calendar, Outlook, Apple Calendar) update or cancel the same event instead of adding a
 * duplicate. Invitations are emailed as iTIP REQUEST/CANCEL messages (RFC 5546), which works
 * without any calendar-provider credentials.
 */

export type CalendarMethod = "REQUEST" | "CANCEL";

export interface CalendarPerson {
  name: string;
  email: string;
}

export interface CalendarEventInput {
  uid: string;
  sequence: number;
  method: CalendarMethod;
  start: Date;
  end: Date;
  summary: string;
  description: string;
  location?: string | null;
  url?: string | null;
  organizer: CalendarPerson;
  attendees: CalendarPerson[];
  /** Defaults to now; injectable for deterministic tests. */
  stamp?: Date;
}

/** 20260114T043000Z */
export function icsUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Escapes TEXT values (RFC 5545 §3.3.11). */
export function escapeIcsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Folds a content line to at most 75 octets per line without splitting UTF-8 characters. */
export function foldIcsLine(line: string): string {
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const size = Buffer.byteLength(ch);
    const limit = out.length === 0 ? 75 : 74; // continuation lines start with one space
    if (bytes + size > limit) {
      out.push(current);
      current = "";
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join("\r\n ");
}

const mailto = (p: CalendarPerson) => `CN=${escapeIcsText(p.name).replace(/"/g, "")}:mailto:${p.email}`;

export function buildIcs(ev: CalendarEventInput): string {
  const cancelled = ev.method === "CANCEL";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Truth Labs International//DPDP Compliance Platform//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${ev.method}`,
    "BEGIN:VEVENT",
    `UID:${ev.uid}`,
    `SEQUENCE:${ev.sequence}`,
    `DTSTAMP:${icsUtc(ev.stamp ?? new Date())}`,
    `DTSTART:${icsUtc(ev.start)}`,
    `DTEND:${icsUtc(ev.end)}`,
    `SUMMARY:${escapeIcsText(ev.summary)}`,
    `DESCRIPTION:${escapeIcsText(ev.description)}`,
    ...(ev.location ? [`LOCATION:${escapeIcsText(ev.location)}`] : []),
    ...(ev.url ? [`URL:${ev.url}`] : []),
    `ORGANIZER;${mailto(ev.organizer)}`,
    ...ev.attendees.map((a) => `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;${mailto(a)}`),
    `STATUS:${cancelled ? "CANCELLED" : "CONFIRMED"}`,
    "TRANSP:OPAQUE",
    ...(cancelled
      ? []
      : ["BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Reminder", "TRIGGER:-PT15M", "END:VALARM"]),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

/** "Add to Google Calendar" link (no credentials needed). */
export function googleCalendarUrl(ev: Pick<CalendarEventInput, "start" | "end" | "summary" | "description" | "location">): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.summary,
    dates: `${icsUtc(ev.start)}/${icsUtc(ev.end)}`,
    details: ev.description,
    ...(ev.location ? { location: ev.location } : {}),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** "Add to Outlook / Microsoft 365" link (no credentials needed). */
export function outlookCalendarUrl(ev: Pick<CalendarEventInput, "start" | "end" | "summary" | "description" | "location">): string {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: ev.summary,
    startdt: ev.start.toISOString(),
    enddt: ev.end.toISOString(),
    body: ev.description,
    ...(ev.location ? { location: ev.location } : {}),
  });
  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
}
