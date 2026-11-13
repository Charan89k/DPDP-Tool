/**
 * TLI — Sends queued consultation and remediation notifications.
 *
 * A row is claimed with a conditional update (QUEUED/FAILED → SENDING) before sending, so the
 * in-process scheduler, request handlers and manual retries never send the same row twice. The
 * message is rendered at send time from the current appointment/request: invitations superseded by
 * a later change, reminders for cancelled meetings and similar stale rows are cancelled, not sent.
 * Failed rows are retried with backoff up to MAX_AUTOMATIC_ATTEMPTS; after that only manually.
 */

import { pool } from "../db/pool.ts";
import { executeWithRls } from "../db/rls.ts";
import type { SessionUser } from "../auth/types.ts";
import { publicBaseUrl, sendEmail } from "../email/mailer.ts";
import type { EmailMessage } from "../email/mailer.ts";
import { brandedEmail } from "../email/templates.ts";
import { buildIcs, googleCalendarUrl, outlookCalendarUrl } from "../calendar/ics.ts";
import { formatInZone } from "../scheduling/time.ts";

export const MAX_AUTOMATIC_ATTEMPTS = 3;
const RETRY_BACKOFF_MINUTES = [2, 10];
const STALE_SENDING_MINUTES = 10;

interface DeliveryRow {
  id: string;
  tenant_id: string;
  entity_type: "appointment" | "remediation_request";
  entity_id: string;
  kind: string;
  recipient_role: "CLIENT" | "ASSESSOR" | "TLI";
  recipient_email: string;
  entity_sequence: number;
  attempts: number;
}

type Rendered = { message: EmailMessage } | { cancel: string };

export interface AppointmentDetails {
  id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  sequence: number;
  calendar_uid: string;
  agenda: string;
  meeting_url: string | null;
  location: string | null;
  client_timezone: string;
  assessor_timezone: string;
  type_name: string;
  organisation: string;
  engagement_code: string | null;
  client_name: string;
  client_email: string;
  assessor_name: string;
  assessor_email: string;
  cancellation_reason: string | null;
}

export async function loadAppointmentDetails(appointmentId: string): Promise<AppointmentDetails | null> {
  const res = await pool.query<AppointmentDetails>(
    `SELECT ap.id, ap.status, ap.starts_at, ap.ends_at, ap.sequence, ap.calendar_uid, ap.agenda, ap.meeting_url, ap.location,
            ap.client_timezone, ap.assessor_timezone, ap.cancellation_reason, ty.name AS type_name, t.name AS organisation,
            a.engagement_code, cu.full_name AS client_name, cu.email AS client_email, au.full_name AS assessor_name, au.email AS assessor_email
     FROM appointments ap
     JOIN appointment_types ty ON ty.id = ap.appointment_type_id
     JOIN tenants t ON t.id = ap.tenant_id
     LEFT JOIN assessments a ON a.id = ap.assessment_id
     JOIN users cu ON cu.id = ap.client_user_id
     JOIN users au ON au.id = ap.assessor_user_id
     WHERE ap.id = $1;`,
    [appointmentId]
  );
  const row = res.rows[0];
  if (!row) return null;
  // Timestamps arrive as Date objects from the data layer; keep ISO strings for formatting and ICS.
  return { ...row, starts_at: new Date(row.starts_at).toISOString(), ends_at: new Date(row.ends_at).toISOString() };
}

/** Calendar event for an appointment; the same UID and the current SEQUENCE every time. */
export function appointmentIcs(ap: AppointmentDetails, method: "REQUEST" | "CANCEL", organizerEmail: string): string {
  return buildIcs({
    uid: ap.calendar_uid,
    sequence: ap.sequence,
    method,
    start: new Date(ap.starts_at),
    end: new Date(ap.ends_at),
    summary: `${ap.type_name}: ${ap.organisation} and Truth Labs International`,
    description: appointmentDescription(ap),
    location: ap.meeting_url || ap.location,
    url: ap.meeting_url,
    organizer: { name: "Truth Labs International", email: organizerEmail },
    attendees: [
      { name: ap.client_name, email: ap.client_email },
      { name: ap.assessor_name, email: ap.assessor_email },
    ],
  });
}

function appointmentDescription(ap: AppointmentDetails): string {
  return [
    `${ap.type_name} with Truth Labs International`,
    `Organisation: ${ap.organisation}`,
    ...(ap.engagement_code ? [`Assessment reference: ${ap.engagement_code}`] : []),
    `TLI assessor: ${ap.assessor_name}`,
    `Agenda: ${ap.agenda || "To be confirmed"}`,
    `Join: ${ap.meeting_url || ap.location || "Details will be shared by your TLI assessor"}`,
  ].join("\n");
}

function organizerAddress(): string {
  const from = process.env.SMTP_FROM || "no-reply@localhost";
  return from.match(/<([^>]+)>/)?.[1] ?? from;
}

const APPOINTMENT_SUBJECTS: Record<string, (ap: AppointmentDetails) => string> = {
  REQUESTED: (ap) => `Consultation request received: ${ap.type_name}`,
  NEW_REQUEST: (ap) => `[TLI] New consultation request from ${ap.organisation}`,
  INVITE: (ap) => `Confirmed: ${ap.type_name} with Truth Labs International`,
  UPDATE: (ap) => `Rescheduled: ${ap.type_name} with Truth Labs International`,
  CANCEL: (ap) => `Cancelled: ${ap.type_name} with Truth Labs International`,
  REMINDER: (ap) => `Reminder: ${ap.type_name} with Truth Labs International`,
};

async function renderAppointment(row: DeliveryRow): Promise<Rendered> {
  const ap = await loadAppointmentDetails(row.entity_id);
  if (!ap) return { cancel: "Appointment not found" };
  const reminder = row.kind.startsWith("REMINDER");
  const kind = reminder ? "REMINDER" : row.kind;
  if (kind !== "CANCEL" && ap.status === "CANCELLED") return { cancel: "Appointment cancelled" };
  if ((kind === "INVITE" || kind === "UPDATE" || reminder) && row.entity_sequence < ap.sequence) return { cancel: "Superseded by a later change" };
  if (reminder && (ap.status !== "CONFIRMED" || new Date(ap.starts_at) <= new Date())) return { cancel: "Meeting no longer upcoming" };

  const zone = row.recipient_role === "CLIENT" ? ap.client_timezone : ap.assessor_timezone;
  const when = `${formatInZone(ap.starts_at, zone)} (${Math.round((Date.parse(ap.ends_at) - Date.parse(ap.starts_at)) / 60000)} minutes; ${new Date(ap.starts_at).toISOString().replace("T", " ").slice(0, 16)} UTC)`;
  const link = row.recipient_role === "CLIENT" ? "/dashboard/consultations" : "/dashboard/appointments";
  const event = { start: new Date(ap.starts_at), end: new Date(ap.ends_at), summary: `${ap.type_name}: Truth Labs International`, description: appointmentDescription(ap), location: ap.meeting_url || ap.location };
  const intro: Record<string, string> = {
    REQUESTED: "We received your consultation request. Your TLI assessor will confirm it shortly; the calendar invitation follows on confirmation.",
    NEW_REQUEST: "A customer requested a consultation that needs your confirmation.",
    INVITE: "Your consultation is confirmed. The calendar invitation is attached.",
    UPDATE: "Your consultation has been rescheduled. The updated calendar invitation is attached.",
    CANCEL: `This consultation has been cancelled.${ap.cancellation_reason ? ` Reason: ${ap.cancellation_reason}` : ""}`,
    REMINDER: "This is a reminder of your upcoming consultation.",
  };
  const paragraphs = [
    intro[kind] ?? "Your consultation has been updated.",
    `When: ${when}`,
    `Meeting: ${ap.type_name}`,
    `Organisation: ${ap.organisation}`,
    ...(ap.engagement_code ? [`Assessment reference: ${ap.engagement_code}`] : []),
    `TLI assessor: ${ap.assessor_name}`,
    `Agenda: ${ap.agenda || "To be confirmed"}`,
    `Join: ${ap.meeting_url || ap.location || "Details will be shared by your TLI assessor"}`,
    ...(kind === "INVITE" || kind === "UPDATE"
      ? [`Add to Google Calendar: ${googleCalendarUrl(event)}`, `Add to Outlook: ${outlookCalendarUrl(event)}`]
      : []),
  ];
  const message = brandedEmail(row.recipient_email, APPOINTMENT_SUBJECTS[kind](ap), APPOINTMENT_SUBJECTS[kind](ap), paragraphs, {
    label: "Open your consultations",
    url: `${publicBaseUrl()}${link}`,
  });
  if (kind === "INVITE" || kind === "UPDATE" || kind === "CANCEL") {
    return { message: { ...message, calendar: { method: kind === "CANCEL" ? "CANCEL" : "REQUEST", content: appointmentIcs(ap, kind === "CANCEL" ? "CANCEL" : "REQUEST", organizerAddress()) } } };
  }
  return { message };
}

const REMEDIATION_TEXT: Record<string, { subject: string; body: string }> = {
  REQUEST_SUBMITTED: { subject: "[TLI] New remediation request", body: "A customer submitted a request for help with compliance gaps." },
  CLARIFICATION_REQUESTED: { subject: "TLI needs more information about your remediation request", body: "Your TLI assessor asked a question about your request. Please reply in the platform." },
  CLIENT_RESPONDED: { subject: "[TLI] Customer replied on a remediation request", body: "The customer replied to your question." },
  PROPOSAL_SENT: { subject: "Your remediation proposal from Truth Labs International", body: "TLI has prepared a remediation proposal for you to review. You can accept it, decline it or ask a question." },
  PROPOSAL_ACCEPTED: { subject: "[TLI] Remediation proposal accepted", body: "The customer accepted the remediation proposal. Start the engagement when ready." },
  PROPOSAL_DECLINED: { subject: "[TLI] Remediation proposal declined", body: "The customer declined the remediation proposal." },
  PROPOSAL_QUESTION: { subject: "[TLI] Question about a remediation proposal", body: "The customer asked a question about the proposal." },
  ENGAGEMENT_STARTED: { subject: "Your remediation engagement with TLI has started", body: "Corrective actions are now tracked in the platform for each selected gap." },
  REQUEST_COMPLETED: { subject: "Your remediation engagement is complete", body: "Every gap in this engagement has been verified and closed by a TLI assessor." },
};

async function renderRemediation(row: DeliveryRow): Promise<Rendered> {
  const res = await pool.query<{ organisation: string; engagement_code: string; status: string }>(
    `SELECT t.name AS organisation, a.engagement_code, r.status FROM remediation_requests r
     JOIN tenants t ON t.id = r.tenant_id JOIN assessments a ON a.id = r.assessment_id WHERE r.id = $1;`,
    [row.entity_id]
  );
  const req = res.rows[0];
  const text = REMEDIATION_TEXT[row.kind];
  if (!req || !text) return { cancel: "Request or notification type not found" };
  return {
    message: brandedEmail(row.recipient_email, text.subject, text.subject, [text.body, `Organisation: ${req.organisation}`, `Assessment reference: ${req.engagement_code}`], {
      label: "Open the request",
      url: `${publicBaseUrl()}/dashboard/remediation-requests/${row.entity_id}`,
    }),
  };
}

export interface AttemptOutcome {
  id: string;
  outcome: "SENT" | "FAILED" | "CANCELLED" | "SKIPPED";
}

/** Claims and sends one notification. `manual` lets TLI staff retry beyond the automatic limit. */
export async function attemptNotification(id: string, options: { manual?: boolean; now?: Date } = {}): Promise<AttemptOutcome> {
  const now = options.now ?? new Date();
  const claimed = await pool.query<DeliveryRow>(
    `UPDATE notification_deliveries SET status = 'SENDING', attempts = attempts + 1, last_attempt_at = $2
     WHERE id = $1 AND status IN ('QUEUED', 'FAILED') AND ($3 = 1 OR (attempts < $4 AND scheduled_for <= $2))
     RETURNING id, tenant_id, entity_type, entity_id, kind, recipient_role, recipient_email, entity_sequence, attempts;`,
    [id, now.toISOString(), options.manual ? 1 : 0, MAX_AUTOMATIC_ATTEMPTS]
  );
  const row = claimed.rows[0];
  if (!row) return { id, outcome: "SKIPPED" };

  let rendered: Rendered;
  try {
    rendered = row.entity_type === "appointment" ? await renderAppointment(row) : await renderRemediation(row);
  } catch (err) {
    rendered = { cancel: `Render failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
  if ("cancel" in rendered) {
    await pool.query("UPDATE notification_deliveries SET status = 'CANCELLED', last_error = $2 WHERE id = $1;", [id, rendered.cancel.slice(0, 300)]);
    return { id, outcome: "CANCELLED" };
  }
  const result = await sendEmail(rendered.message);
  if (result.sent) {
    await pool.query("UPDATE notification_deliveries SET status = 'SENT', sent_at = $2, last_error = NULL WHERE id = $1;", [id, new Date().toISOString()]);
    return { id, outcome: "SENT" };
  }
  const backoff = RETRY_BACKOFF_MINUTES[Math.min(row.attempts - 1, RETRY_BACKOFF_MINUTES.length - 1)];
  await pool.query(
    "UPDATE notification_deliveries SET status = 'FAILED', last_error = $2, scheduled_for = $3 WHERE id = $1;",
    [id, result.reason, new Date(now.getTime() + backoff * 60_000).toISOString()]
  );
  return { id, outcome: "FAILED" };
}

/** Sends every due notification (queued, or failed and due for retry). Safe to run concurrently. */
export async function dispatchDueNotifications(now: Date = new Date(), limit = 100): Promise<AttemptOutcome[]> {
  // Recover rows left SENDING by a process that stopped mid-send.
  await pool.query(
    "UPDATE notification_deliveries SET status = 'FAILED', last_error = 'Interrupted while sending' WHERE status = 'SENDING' AND last_attempt_at < $1;",
    [new Date(now.getTime() - STALE_SENDING_MINUTES * 60_000).toISOString()]
  );
  const due = await pool.query<{ id: string }>(
    `SELECT id FROM notification_deliveries
     WHERE status IN ('QUEUED', 'FAILED') AND attempts < $2 AND scheduled_for <= $1
     ORDER BY scheduled_for LIMIT $3;`,
    [now.toISOString(), MAX_AUTOMATIC_ATTEMPTS, limit]
  );
  const results: AttemptOutcome[] = [];
  for (const { id } of due.rows) results.push(await attemptNotification(id, { now }));
  return results;
}

/** Background dispatch for request handlers; never throws into the caller. */
export function dispatchInBackground(): Promise<void> {
  return dispatchDueNotifications().then(
    () => undefined,
    (err) => console.error("Notification dispatch failed:", err instanceof Error ? err.message : err)
  );
}

/** Manual retry of a failed notification by TLI staff (lead consultant or super admin). */
export async function retryNotification(session: SessionUser, id: string): Promise<AttemptOutcome> {
  if (session.role !== "TLI_SUPER_ADMIN" && session.role !== "TLI_LEAD_CONSULTANT") throw new Error("FORBIDDEN");
  const visible = await executeWithRls(session, async (client) =>
    (await client.query<{ status: string }>("SELECT status FROM notification_deliveries WHERE id = $1;", [id])).rows[0]
  );
  if (!visible) throw new Error("NOT_FOUND");
  if (visible.status !== "FAILED") throw new Error("NOT_FAILED");
  return attemptNotification(id, { manual: true });
}

const SCHEDULER_INTERVAL_MS = 60_000;
const schedulerState = globalThis as typeof globalThis & { __tliNotificationScheduler?: ReturnType<typeof setInterval> };

/**
 * Sends due notifications (reminders, retries) every minute in the server process. Claims are
 * atomic, so overlapping ticks or several processes never send a notification twice.
 */
export function startNotificationScheduler(): void {
  if (schedulerState.__tliNotificationScheduler) return;
  let running = false;
  schedulerState.__tliNotificationScheduler = setInterval(() => {
    if (running) return;
    running = true;
    dispatchInBackground().finally(() => {
      running = false;
    });
  }, SCHEDULER_INTERVAL_MS);
  schedulerState.__tliNotificationScheduler.unref?.();
}
