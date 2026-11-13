/**
 * TLI — Consultation booking.
 *
 * Slots are generated on the server from each assessor's weekly hours (in the assessor's own
 * timezone), blocked dates, minimum notice, buffers and existing appointments. Booking re-checks
 * the chosen slot against freshly generated availability and inserts inside one transaction; the
 * database trigger in migration 0010 is the final guard, so two concurrent bookings of one slot can
 * never both succeed. All times are stored in UTC.
 */

import crypto from "node:crypto";
import { pool } from "../db/pool.ts";
import type { PoolClient } from "../db/pool.ts";
import { executeWithRls } from "../db/rls.ts";
import type { SessionUser } from "../auth/types.ts";
import { isTliRole } from "../auth/rbac.ts";
import { inSystemTransaction } from "../payments/records.ts";
import { writeAudit } from "../audit/log.ts";
import { addDays, isValidTimeZone, zonedDate, zonedWallTimeToUtc } from "../scheduling/time.ts";
import { cancelPendingNotifications, getReminderOffsets, queueNotifications, REMINDER_SETTING_KEY } from "../notifications/queue.ts";
import type { QueuedNotification } from "../notifications/queue.ts";

export class ConsultationError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ConsultationError";
    this.status = status;
  }
}

export interface RequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

const BOOKING_ROLES = ["CLIENT_ADMIN", "CLIENT_BU_LEAD", "CLIENT_CONTRIBUTOR"];
const ASSESSOR_ROLES = ["TLI_LEAD_CONSULTANT", "TLI_REVIEWER"];
const MANAGER_ROLES = ["TLI_SUPER_ADMIN", "TLI_LEAD_CONSULTANT"];
const MAX_RANGE_DAYS = 31;
const DEFAULT_TIMEZONE = "Asia/Kolkata";
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// ---------- Appointment types ----------

export interface AppointmentType {
  id: string;
  code: string;
  name: string;
  description: string;
  durationMinutes: number;
  requiresApproval: boolean;
  isActive: boolean;
  sortOrder: number;
}

export async function listAppointmentTypes(activeOnly = true): Promise<AppointmentType[]> {
  const res = await pool.query(`SELECT * FROM appointment_types ${activeOnly ? "WHERE is_active = TRUE" : ""} ORDER BY sort_order, name;`);
  return res.rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description,
    durationMinutes: r.duration_minutes,
    requiresApproval: Boolean(r.requires_approval),
    isActive: Boolean(r.is_active),
    sortOrder: r.sort_order,
  }));
}

export async function saveAppointmentType(
  session: SessionUser,
  input: { id?: string; code?: string; name: string; description: string; durationMinutes: number; requiresApproval: boolean; isActive: boolean; sortOrder: number }
): Promise<void> {
  if (session.role !== "TLI_SUPER_ADMIN") throw new ConsultationError("Only the super administrator can configure appointment types.", 403);
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 15 || input.durationMinutes > 240) {
    throw new ConsultationError("Duration must be between 15 and 240 minutes.", 400);
  }
  await inSystemTransaction(async (client) => {
    const id = input.id ?? crypto.randomUUID();
    if (input.id) {
      const res = await client.query(
        `UPDATE appointment_types SET name = $2, description = $3, duration_minutes = $4, requires_approval = $5, is_active = $6,
           sort_order = $7, updated_at = CURRENT_TIMESTAMP WHERE id = $1;`,
        [id, input.name, input.description, input.durationMinutes, input.requiresApproval, input.isActive, input.sortOrder]
      );
      if (res.rowCount === 0) throw new ConsultationError("Appointment type not found.", 404);
    } else {
      const code = (input.code || input.name).toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "TYPE";
      await client.query(
        `INSERT INTO appointment_types (id, code, name, description, duration_minutes, requires_approval, is_active, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
        [id, `${code}_${id.slice(0, 4).toUpperCase()}`, input.name, input.description, input.durationMinutes, input.requiresApproval, input.isActive, input.sortOrder]
      );
    }
    await writeAudit(client, { tenantId: session.tenantId, userId: session.userId, action: "APPOINTMENT_TYPE_SAVED", entityType: "appointment_types", entityId: id, details: { ...input } });
  });
}

export async function setReminderOffsets(session: SessionUser, offsetsMinutes: number[]): Promise<number[]> {
  if (session.role !== "TLI_SUPER_ADMIN") throw new ConsultationError("Only the super administrator can change reminder timing.", 403);
  const clean = [...new Set(offsetsMinutes)].filter((v) => Number.isInteger(v) && v >= 5 && v <= 10080).sort((a, b) => b - a);
  if (clean.length === 0 || clean.length > 4) throw new ConsultationError("Choose between one and four reminder times (5 minutes to 7 days before).", 400);
  await inSystemTransaction(async (client) => {
    await client.query(
      `INSERT INTO platform_settings (key, value, updated_by_user_id, updated_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_by_user_id = excluded.updated_by_user_id, updated_at = excluded.updated_at;`,
      [REMINDER_SETTING_KEY, clean.join(","), session.userId]
    );
    await writeAudit(client, { tenantId: session.tenantId, userId: session.userId, action: "REMINDER_TIMING_CHANGED", entityType: "platform_settings", entityId: REMINDER_SETTING_KEY, details: { offsetsMinutes: clean } });
  });
  return clean;
}

// ---------- Availability ----------

export type WeeklyHours = Record<string, Array<[string, string]>>;

export interface Availability {
  userId: string;
  timezone: string;
  weeklyHours: WeeklyHours;
  bufferMinutes: number;
  slotStepMinutes: number;
  minNoticeHours: number;
  maxDaysAhead: number;
  meetingUrl: string | null;
  location: string | null;
  isAccepting: boolean;
  exceptions: Array<{ id: string; startsOn: string; endsOn: string; reason: string | null }>;
}

const toDateString = (v: unknown) => (v instanceof Date ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}` : String(v));

async function loadAvailability(userId: string): Promise<Availability | null> {
  const res = await pool.query("SELECT * FROM assessor_availability WHERE user_id = $1;", [userId]);
  const r = res.rows[0];
  if (!r) return null;
  const ex = await pool.query("SELECT id, starts_on, ends_on, reason FROM availability_exceptions WHERE user_id = $1 ORDER BY starts_on;", [userId]);
  return {
    userId,
    timezone: r.timezone,
    weeklyHours: typeof r.weekly_hours === "string" ? JSON.parse(r.weekly_hours) : r.weekly_hours ?? {},
    bufferMinutes: r.buffer_minutes,
    slotStepMinutes: r.slot_step_minutes,
    minNoticeHours: r.min_notice_hours,
    maxDaysAhead: r.max_days_ahead,
    meetingUrl: r.meeting_url,
    location: r.location,
    isAccepting: Boolean(r.is_accepting),
    exceptions: ex.rows.map((e) => ({ id: e.id, startsOn: toDateString(e.starts_on), endsOn: toDateString(e.ends_on), reason: e.reason })),
  };
}

function assertAssessor(session: SessionUser): void {
  if (!ASSESSOR_ROLES.includes(session.role)) throw new ConsultationError("Only TLI assessors manage availability.", 403);
}

export async function getMyAvailability(session: SessionUser): Promise<Availability> {
  assertAssessor(session);
  return (
    (await loadAvailability(session.userId)) ?? {
      userId: session.userId,
      timezone: DEFAULT_TIMEZONE,
      weeklyHours: {},
      bufferMinutes: 15,
      slotStepMinutes: 30,
      minNoticeHours: 24,
      maxDaysAhead: 60,
      meetingUrl: null,
      location: null,
      isAccepting: false,
      exceptions: [],
    }
  );
}

export function validateWeeklyHours(hours: unknown): WeeklyHours {
  if (!hours || typeof hours !== "object") throw new ConsultationError("Working hours are required.", 400);
  const out: WeeklyHours = {};
  for (const [day, ranges] of Object.entries(hours as Record<string, unknown>)) {
    if (!/^[1-7]$/.test(day) || !Array.isArray(ranges)) throw new ConsultationError("Working hours are invalid.", 400);
    const parsed = ranges.map((r) => {
      if (!Array.isArray(r) || r.length !== 2 || !TIME.test(String(r[0])) || !TIME.test(String(r[1])) || String(r[0]) >= String(r[1])) {
        throw new ConsultationError(`Working hours for day ${day} are invalid; use HH:MM with start before end.`, 400);
      }
      return [String(r[0]), String(r[1])] as [string, string];
    }).sort((a, b) => a[0].localeCompare(b[0]));
    for (let i = 1; i < parsed.length; i++) {
      if (parsed[i][0] < parsed[i - 1][1]) throw new ConsultationError(`Working hours for day ${day} overlap.`, 400);
    }
    if (parsed.length) out[day] = parsed;
  }
  return out;
}

export async function saveMyAvailability(
  session: SessionUser,
  input: Omit<Availability, "userId" | "exceptions">
): Promise<Availability> {
  assertAssessor(session);
  if (!isValidTimeZone(input.timezone)) throw new ConsultationError("Unknown timezone.", 400);
  const weekly = validateWeeklyHours(input.weeklyHours);
  if (input.meetingUrl && !/^https:\/\/\S+$/.test(input.meetingUrl)) throw new ConsultationError("The meeting link must be an https:// address.", 400);
  const within = (v: number, min: number, max: number) => Number.isInteger(v) && v >= min && v <= max;
  if (!within(input.bufferMinutes, 0, 120)) throw new ConsultationError("Buffer must be 0 to 120 minutes.", 400);
  if (![15, 30, 60].includes(input.slotStepMinutes)) throw new ConsultationError("Slot interval must be 15, 30 or 60 minutes.", 400);
  if (!within(input.minNoticeHours, 0, 336)) throw new ConsultationError("Minimum notice must be 0 to 336 hours.", 400);
  if (!within(input.maxDaysAhead, 1, 365)) throw new ConsultationError("Booking window must be 1 to 365 days.", 400);
  await inSystemTransaction(async (client) => {
    await client.query(
      `INSERT INTO assessor_availability (user_id, timezone, weekly_hours, buffer_minutes, slot_step_minutes, min_notice_hours,
         max_days_ahead, meeting_url, location, is_accepting, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET timezone = excluded.timezone, weekly_hours = excluded.weekly_hours,
         buffer_minutes = excluded.buffer_minutes, slot_step_minutes = excluded.slot_step_minutes,
         min_notice_hours = excluded.min_notice_hours, max_days_ahead = excluded.max_days_ahead, meeting_url = excluded.meeting_url,
         location = excluded.location, is_accepting = excluded.is_accepting, updated_at = excluded.updated_at;`,
      [session.userId, input.timezone, JSON.stringify(weekly), input.bufferMinutes, input.slotStepMinutes, input.minNoticeHours, input.maxDaysAhead, input.meetingUrl || null, input.location || null, input.isAccepting]
    );
    await writeAudit(client, { tenantId: session.tenantId, userId: session.userId, action: "AVAILABILITY_UPDATED", entityType: "assessor_availability", entityId: session.userId, details: { timezone: input.timezone, weeklyHours: weekly, bufferMinutes: input.bufferMinutes, isAccepting: input.isAccepting } });
  });
  return getMyAvailability(session);
}

export async function addAvailabilityException(session: SessionUser, input: { startsOn: string; endsOn: string; reason?: string }): Promise<void> {
  assertAssessor(session);
  const date = /^\d{4}-\d{2}-\d{2}$/;
  if (!date.test(input.startsOn) || !date.test(input.endsOn) || input.endsOn < input.startsOn) throw new ConsultationError("Enter a valid date range.", 400);
  await inSystemTransaction(async (client) => {
    const id = crypto.randomUUID();
    await client.query("INSERT INTO availability_exceptions (id, user_id, starts_on, ends_on, reason) VALUES ($1, $2, $3, $4, $5);", [id, session.userId, input.startsOn, input.endsOn, input.reason?.slice(0, 200) || null]);
    await writeAudit(client, { tenantId: session.tenantId, userId: session.userId, action: "AVAILABILITY_BLOCKED", entityType: "availability_exceptions", entityId: id, details: input });
  });
}

export async function removeAvailabilityException(session: SessionUser, id: string): Promise<void> {
  assertAssessor(session);
  await inSystemTransaction(async (client) => {
    const res = await client.query("DELETE FROM availability_exceptions WHERE id = $1 AND user_id = $2;", [id, session.userId]);
    if (res.rowCount === 0) throw new ConsultationError("Blocked period not found.", 404);
    await writeAudit(client, { tenantId: session.tenantId, userId: session.userId, action: "AVAILABILITY_UNBLOCKED", entityType: "availability_exceptions", entityId: id, details: {} });
  });
}

// ---------- Slots ----------

export interface Assessor {
  userId: string;
  fullName: string;
  timezone: string;
}

export async function listBookableAssessors(): Promise<Assessor[]> {
  const res = await pool.query(
    `SELECT u.id, u.full_name, av.timezone FROM users u JOIN assessor_availability av ON av.user_id = u.id
     WHERE u.is_active = TRUE AND u.role IN ('TLI_LEAD_CONSULTANT', 'TLI_REVIEWER') AND av.is_accepting = TRUE AND av.weekly_hours <> '{}'
     ORDER BY u.full_name;`
  );
  return res.rows.map((r) => ({ userId: r.id, fullName: r.full_name, timezone: r.timezone }));
}

export interface Slot {
  assessorId: string;
  assessorName: string;
  startsAt: string;
  endsAt: string;
}

interface Busy {
  start: number;
  endWithBuffer: number;
}

/** Bookable slots of one assessor for `durationMinutes` between two calendar dates (assessor's zone). */
export async function assessorSlots(
  assessor: Assessor,
  durationMinutes: number,
  fromDate: string,
  toDate: string,
  now: Date,
  excludeAppointmentId?: string
): Promise<Slot[]> {
  const av = await loadAvailability(assessor.userId);
  if (!av || !av.isAccepting) return [];
  const earliest = now.getTime() + av.minNoticeHours * 3_600_000;
  const latest = now.getTime() + av.maxDaysAhead * 86_400_000;
  const busyRes = await pool.query<{ starts_at: string; ends_at: string; buffer_minutes: number }>(
    `SELECT starts_at, ends_at, buffer_minutes FROM appointments
     WHERE assessor_user_id = $1 AND status IN ('PENDING', 'CONFIRMED') AND id <> $2 AND ends_at >= $3 AND starts_at <= $4;`,
    [assessor.userId, excludeAppointmentId ?? "", new Date(now.getTime() - 86_400_000).toISOString(), new Date(latest + 86_400_000).toISOString()]
  );
  const busy: Busy[] = busyRes.rows.map((b) => ({ start: new Date(b.starts_at).getTime(), endWithBuffer: new Date(b.ends_at).getTime() + b.buffer_minutes * 60_000 }));
  const blocked = (date: string) => av.exceptions.some((e) => e.startsOn <= date && date <= e.endsOn);

  const slots: Slot[] = [];
  for (let date = fromDate, n = 0; date <= toDate && n <= MAX_RANGE_DAYS; date = addDays(date, 1), n++) {
    if (blocked(date)) continue;
    const weekday = zonedDate(zonedWallTimeToUtc(date, "12:00", av.timezone), av.timezone).weekday;
    for (const [from, to] of av.weeklyHours[String(weekday)] ?? []) {
      const [fh, fm] = from.split(":").map(Number);
      const [th, tm] = to.split(":").map(Number);
      for (let minute = fh * 60 + fm; minute + durationMinutes <= th * 60 + tm; minute += av.slotStepMinutes) {
        const start = zonedWallTimeToUtc(date, `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`, av.timezone).getTime();
        const end = start + durationMinutes * 60_000;
        if (start < earliest || start > latest) continue;
        const clash = busy.some((b) => start < b.endWithBuffer && end + av.bufferMinutes * 60_000 > b.start);
        if (!clash) slots.push({ assessorId: assessor.userId, assessorName: assessor.fullName, startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString() });
      }
    }
  }
  return slots;
}

export async function getAppointmentType(typeId: string): Promise<AppointmentType> {
  const type = (await listAppointmentTypes(false)).find((t) => t.id === typeId);
  if (!type || !type.isActive) throw new ConsultationError("Choose an available consultation type.", 400);
  return type;
}

/** Available slots for a type across all bookable assessors (or one), between two dates. */
export async function findSlots(input: { typeId: string; fromDate: string; toDate: string; assessorId?: string; now?: Date }): Promise<Slot[]> {
  const type = await getAppointmentType(input.typeId);
  const date = /^\d{4}-\d{2}-\d{2}$/;
  if (!date.test(input.fromDate) || !date.test(input.toDate) || input.toDate < input.fromDate) throw new ConsultationError("Enter a valid date range.", 400);
  const assessors = (await listBookableAssessors()).filter((a) => !input.assessorId || a.userId === input.assessorId);
  const now = input.now ?? new Date();
  const all = await Promise.all(assessors.map((a) => assessorSlots(a, type.durationMinutes, input.fromDate, input.toDate, now)));
  return all.flat().sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

async function assertSlotAvailable(assessorId: string, durationMinutes: number, startsAt: Date, now: Date, excludeAppointmentId?: string): Promise<Assessor> {
  const assessor = (await listBookableAssessors()).find((a) => a.userId === assessorId);
  if (!assessor) throw new ConsultationError("This assessor is not taking bookings.", 409);
  const day = zonedDate(startsAt, assessor.timezone).date;
  const slots = await assessorSlots(assessor, durationMinutes, addDays(day, -1), addDays(day, 1), now, excludeAppointmentId);
  if (!slots.some((s) => s.startsAt === startsAt.toISOString())) throw new ConsultationError("That time is no longer available. Please choose another slot.", 409);
  return assessor;
}

// ---------- Appointments ----------

interface AppointmentRow {
  id: string;
  tenant_id: string;
  assessment_id: string | null;
  assessor_user_id: string;
  client_user_id: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  starts_at: string;
  ends_at: string;
  sequence: number;
  appointment_type_id: string;
}

async function contactEmails(client: Pick<PoolClient, "query">, ap: { client_user_id: string; assessor_user_id: string }) {
  const res = await client.query<{ id: string; email: string }>("SELECT id, email FROM users WHERE id IN ($1, $2);", [ap.client_user_id, ap.assessor_user_id]);
  const email = (id: string) => res.rows.find((r) => r.id === id)?.email ?? "";
  return { client: email(ap.client_user_id), assessor: email(ap.assessor_user_id) };
}

async function queueAppointmentEmails(client: PoolClient, ap: AppointmentRow, kind: "REQUESTED" | "INVITE" | "UPDATE" | "CANCEL"): Promise<void> {
  const emails = await contactEmails(client, ap);
  const base = { tenantId: ap.tenant_id, entityType: "appointment" as const, entityId: ap.id, entitySequence: ap.sequence };
  const items: QueuedNotification[] =
    kind === "REQUESTED"
      ? [
          { ...base, dedupeKey: `appt:${ap.id}:REQUESTED:${ap.sequence}:CLIENT`, kind: "REQUESTED", recipientRole: "CLIENT", recipientEmail: emails.client },
          { ...base, dedupeKey: `appt:${ap.id}:NEW_REQUEST:${ap.sequence}:ASSESSOR`, kind: "NEW_REQUEST", recipientRole: "ASSESSOR", recipientEmail: emails.assessor },
        ]
      : (["CLIENT", "ASSESSOR"] as const).map((role) => ({
          ...base,
          dedupeKey: `appt:${ap.id}:${kind}:${ap.sequence}:${role}`,
          kind,
          recipientRole: role,
          recipientEmail: role === "CLIENT" ? emails.client : emails.assessor,
        }));
  if (ap.status === "CONFIRMED" && kind !== "CANCEL") {
    const start = new Date(ap.starts_at).getTime();
    for (const offset of await getReminderOffsets(client)) {
      const at = start - offset * 60_000;
      if (at <= Date.now()) continue;
      for (const role of ["CLIENT", "ASSESSOR"] as const) {
        items.push({ ...base, dedupeKey: `appt:${ap.id}:REMINDER_${offset}:${ap.sequence}:${role}`, kind: `REMINDER_${offset}`, recipientRole: role, recipientEmail: role === "CLIENT" ? emails.client : emails.assessor, scheduledFor: new Date(at) });
      }
    }
  }
  await queueNotifications(client, items);
}

async function reminderKinds(client: Pick<PoolClient, "query">, appointmentId: string): Promise<string[]> {
  const res = await client.query<{ kind: string }>("SELECT DISTINCT kind FROM notification_deliveries WHERE entity_type = 'appointment' AND entity_id = $1 AND kind LIKE 'REMINDER_%';", [appointmentId]);
  return res.rows.map((r) => r.kind);
}

function slotTakenError(err: unknown): boolean {
  return err instanceof Error && /APPOINTMENT_SLOT_TAKEN/.test(err.message);
}

export interface BookingInput {
  typeId: string;
  assessorId: string;
  startsAt: string;
  agenda: string;
  clientTimezone: string;
  assessmentId?: string | null;
  remediationRequestId?: string | null;
}

export async function bookAppointment(session: SessionUser, input: BookingInput, meta: RequestMeta = {}, now: Date = new Date()): Promise<{ id: string; status: string }> {
  if (!BOOKING_ROLES.includes(session.role)) throw new ConsultationError("Your role cannot book consultations; ask your organisation administrator.", 403);
  const type = await getAppointmentType(input.typeId);
  const startsAt = new Date(input.startsAt);
  if (Number.isNaN(startsAt.getTime())) throw new ConsultationError("Choose a valid time.", 400);

  // Linked assessment / request must be the customer's own (tenant policy layer).
  const links = await executeWithRls(session, async (client) => ({
    assessment: input.assessmentId
      ? (await client.query("SELECT id, tenant_id FROM assessments WHERE id = $1;", [input.assessmentId])).rows[0]
      : null,
    request: input.remediationRequestId
      ? (await client.query("SELECT id, tenant_id, assessment_id FROM remediation_requests WHERE id = $1;", [input.remediationRequestId])).rows[0]
      : null,
  }));
  if (input.assessmentId && links.assessment?.tenant_id !== session.tenantId) throw new ConsultationError("Assessment not found.", 404);
  if (input.remediationRequestId && links.request?.tenant_id !== session.tenantId) throw new ConsultationError("Remediation request not found.", 404);

  const assessor = await assertSlotAvailable(input.assessorId, type.durationMinutes, startsAt, now);
  const av = await loadAvailability(assessor.userId);
  const id = crypto.randomUUID();
  const status = type.requiresApproval ? "PENDING" : "CONFIRMED";
  try {
    await inSystemTransaction(async (client) => {
      await client.query(
        `INSERT INTO appointments (id, tenant_id, assessment_id, remediation_request_id, appointment_type_id, assessor_user_id, client_user_id,
           status, starts_at, ends_at, buffer_minutes, client_timezone, assessor_timezone, agenda, meeting_url, location, calendar_uid, sequence)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 0);`,
        [
          id,
          session.tenantId,
          input.assessmentId ?? links.request?.assessment_id ?? null,
          input.remediationRequestId ?? null,
          type.id,
          assessor.userId,
          session.userId,
          status,
          startsAt.toISOString(),
          new Date(startsAt.getTime() + type.durationMinutes * 60_000).toISOString(),
          av?.bufferMinutes ?? 0,
          isValidTimeZone(input.clientTimezone) ? input.clientTimezone : DEFAULT_TIMEZONE,
          assessor.timezone,
          input.agenda.slice(0, 2000),
          av?.meetingUrl ?? null,
          av?.location ?? null,
          `appointment-${id}@truthlabs-dpdp`,
        ]
      );
      const row = (await client.query<AppointmentRow>("SELECT * FROM appointments WHERE id = $1;", [id])).rows[0];
      await queueAppointmentEmails(client, row, status === "PENDING" ? "REQUESTED" : "INVITE");
      await writeAudit(client, { tenantId: session.tenantId, userId: session.userId, action: "APPOINTMENT_BOOKED", entityType: "appointments", entityId: id, details: { type: type.code, assessorId: assessor.userId, startsAt: startsAt.toISOString(), status }, ...meta });
    });
  } catch (err) {
    if (slotTakenError(err)) throw new ConsultationError("That time was just booked by someone else. Please choose another slot.", 409);
    throw err;
  }
  return { id, status };
}

type Side = "CLIENT" | "ASSESSOR";

/** Loads an appointment the caller can see and decides which side of it they act for. */
async function authorizeAppointment(session: SessionUser, id: string): Promise<{ row: AppointmentRow; side: Side }> {
  const row = await executeWithRls(session, async (client) => (await client.query<AppointmentRow>("SELECT * FROM appointments WHERE id = $1;", [id])).rows[0]);
  if (!row) throw new ConsultationError("Appointment not found.", 404);
  if (isTliRole(session.role)) {
    if (row.assessor_user_id !== session.userId && !MANAGER_ROLES.includes(session.role)) throw new ConsultationError("Only the assigned assessor or a lead consultant can change this appointment.", 403);
    return { row, side: "ASSESSOR" };
  }
  if (row.tenant_id !== session.tenantId || !BOOKING_ROLES.includes(session.role)) throw new ConsultationError("Your role cannot change consultations.", 403);
  return { row, side: "CLIENT" };
}

export async function rescheduleAppointment(session: SessionUser, id: string, startsAtIso: string, meta: RequestMeta = {}, now: Date = new Date()): Promise<void> {
  const { row, side } = await authorizeAppointment(session, id);
  if (row.status !== "PENDING" && row.status !== "CONFIRMED") throw new ConsultationError("Only upcoming appointments can be rescheduled.", 409);
  const startsAt = new Date(startsAtIso);
  if (Number.isNaN(startsAt.getTime())) throw new ConsultationError("Choose a valid time.", 400);
  const duration = (new Date(row.ends_at).getTime() - new Date(row.starts_at).getTime()) / 60_000;
  await assertSlotAvailable(row.assessor_user_id, duration, startsAt, now, id);
  try {
    await inSystemTransaction(async (client) => {
      const res = await client.query(
        `UPDATE appointments SET starts_at = $2, ends_at = $3, sequence = sequence + 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND status IN ('PENDING', 'CONFIRMED') AND sequence = $4;`,
        [id, startsAt.toISOString(), new Date(startsAt.getTime() + duration * 60_000).toISOString(), row.sequence]
      );
      if (res.rowCount === 0) throw new ConsultationError("The appointment changed meanwhile. Reload and try again.", 409);
      await cancelPendingNotifications(client, "appointment", id, await reminderKinds(client, id));
      const updated = (await client.query<AppointmentRow>("SELECT * FROM appointments WHERE id = $1;", [id])).rows[0];
      await queueAppointmentEmails(client, updated, updated.status === "PENDING" ? "REQUESTED" : "UPDATE");
      await writeAudit(client, { tenantId: row.tenant_id, userId: session.userId, action: "APPOINTMENT_RESCHEDULED", entityType: "appointments", entityId: id, details: { by: side, from: new Date(row.starts_at).toISOString(), to: startsAt.toISOString(), sequence: updated.sequence }, ...meta });
    });
  } catch (err) {
    if (slotTakenError(err)) throw new ConsultationError("That time was just booked by someone else. Please choose another slot.", 409);
    throw err;
  }
}

export async function cancelAppointment(session: SessionUser, id: string, reason: string, meta: RequestMeta = {}): Promise<void> {
  const { row, side } = await authorizeAppointment(session, id);
  if (row.status !== "PENDING" && row.status !== "CONFIRMED") throw new ConsultationError("This appointment can no longer be cancelled.", 409);
  await inSystemTransaction(async (client) => {
    const res = await client.query(
      `UPDATE appointments SET status = 'CANCELLED', sequence = sequence + 1, cancelled_by_user_id = $2, cancellation_reason = $3,
         updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status IN ('PENDING', 'CONFIRMED');`,
      [id, session.userId, reason.slice(0, 500) || null]
    );
    if (res.rowCount === 0) throw new ConsultationError("The appointment changed meanwhile. Reload and try again.", 409);
    await cancelPendingNotifications(client, "appointment", id, [...(await reminderKinds(client, id)), "INVITE", "UPDATE", "REQUESTED", "NEW_REQUEST"]);
    const updated = (await client.query<AppointmentRow>("SELECT * FROM appointments WHERE id = $1;", [id])).rows[0];
    await queueAppointmentEmails(client, updated, "CANCEL");
    await writeAudit(client, { tenantId: row.tenant_id, userId: session.userId, action: "APPOINTMENT_CANCELLED", entityType: "appointments", entityId: id, details: { by: side, reason }, ...meta });
  });
}

export async function confirmAppointment(session: SessionUser, id: string, details: { meetingUrl?: string | null; location?: string | null } = {}, meta: RequestMeta = {}): Promise<void> {
  const { row, side } = await authorizeAppointment(session, id);
  if (side !== "ASSESSOR") throw new ConsultationError("Only TLI can confirm an appointment request.", 403);
  if (row.status !== "PENDING") throw new ConsultationError("Only requested appointments need confirmation.", 409);
  if (details.meetingUrl && !/^https:\/\/\S+$/.test(details.meetingUrl)) throw new ConsultationError("The meeting link must be an https:// address.", 400);
  await inSystemTransaction(async (client) => {
    await client.query(
      `UPDATE appointments SET status = 'CONFIRMED', sequence = sequence + 1, meeting_url = COALESCE($2, meeting_url),
         location = COALESCE($3, location), updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status = 'PENDING';`,
      [id, details.meetingUrl || null, details.location || null]
    );
    const updated = (await client.query<AppointmentRow>("SELECT * FROM appointments WHERE id = $1;", [id])).rows[0];
    await queueAppointmentEmails(client, updated, "INVITE");
    await writeAudit(client, { tenantId: row.tenant_id, userId: session.userId, action: "APPOINTMENT_CONFIRMED", entityType: "appointments", entityId: id, details: { sequence: updated.sequence }, ...meta });
  });
}

export async function completeAppointment(session: SessionUser, id: string, now: Date = new Date()): Promise<void> {
  const { row, side } = await authorizeAppointment(session, id);
  if (side !== "ASSESSOR") throw new ConsultationError("Only TLI can mark a consultation as held.", 403);
  if (row.status !== "CONFIRMED" || new Date(row.starts_at) > now) throw new ConsultationError("Only confirmed consultations that have started can be completed.", 409);
  await inSystemTransaction(async (client) => {
    await client.query("UPDATE appointments SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status = 'CONFIRMED';", [id]);
    await cancelPendingNotifications(client, "appointment", id, await reminderKinds(client, id));
    await writeAudit(client, { tenantId: row.tenant_id, userId: session.userId, action: "APPOINTMENT_COMPLETED", entityType: "appointments", entityId: id, details: {} });
  });
}

export interface AppointmentView {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  typeName: string;
  organisation: string;
  tenantId: string;
  engagementCode: string | null;
  assessmentId: string | null;
  remediationRequestId: string | null;
  clientName: string;
  clientEmail: string;
  assessorId: string;
  assessorName: string;
  agenda: string;
  meetingUrl: string | null;
  location: string | null;
  clientTimezone: string;
  assessorTimezone: string;
  cancellationReason: string | null;
  invitations: Array<{ id: string; role: string; kind: string; status: string; attempts: number; lastError: string | null }>;
}

export interface AppointmentFilters {
  status?: string;
  tenantId?: string;
  assessorId?: string;
  from?: string;
  to?: string;
}

/** Appointments the caller may see (tenant policy layer), with their email delivery status. */
export async function listAppointments(session: SessionUser, filters: AppointmentFilters = {}): Promise<AppointmentView[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    where.push(sql.replace("?", `$${params.length}`));
  };
  if (filters.status) add("ap.status = ?", filters.status);
  if (filters.tenantId) add("ap.tenant_id = ?", filters.tenantId);
  if (filters.assessorId) add("ap.assessor_user_id = ?", filters.assessorId);
  if (filters.from) add("ap.ends_at >= ?", new Date(filters.from).toISOString());
  if (filters.to) add("ap.starts_at <= ?", new Date(filters.to).toISOString());
  const staff = isTliRole(session.role);
  return executeWithRls(session, async (client) => {
    const res = await client.query(
      `SELECT ap.*, ty.name AS type_name, t.name AS organisation, a.engagement_code, cu.full_name AS client_name, cu.email AS client_email,
              au.full_name AS assessor_name
       FROM appointments ap
       JOIN appointment_types ty ON ty.id = ap.appointment_type_id
       LEFT JOIN tenants t ON t.id = ap.tenant_id
       LEFT JOIN assessments a ON a.id = ap.assessment_id
       LEFT JOIN users cu ON cu.id = ap.client_user_id
       LEFT JOIN users au ON au.id = ap.assessor_user_id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY ap.starts_at ASC LIMIT 500;`,
      params
    );
    const ids = res.rows.map((r) => r.id);
    const notes = ids.length
      ? (await client.query(
          `SELECT id, entity_id, recipient_role, kind, status, attempts, last_error FROM notification_deliveries
           WHERE entity_type = 'appointment' AND entity_id = ANY($1) AND kind NOT LIKE 'REMINDER_%' ORDER BY created_at;`,
          [ids]
        )).rows
      : [];
    return res.rows.map((r) => ({
      id: r.id,
      status: r.status,
      startsAt: new Date(r.starts_at).toISOString(),
      endsAt: new Date(r.ends_at).toISOString(),
      typeName: r.type_name,
      organisation: r.organisation ?? "",
      tenantId: r.tenant_id,
      engagementCode: r.engagement_code,
      assessmentId: r.assessment_id,
      remediationRequestId: r.remediation_request_id,
      clientName: r.client_name ?? "",
      clientEmail: staff ? r.client_email ?? "" : "",
      assessorId: r.assessor_user_id,
      assessorName: r.assessor_name ?? "TLI assessor",
      agenda: r.agenda,
      meetingUrl: r.meeting_url,
      location: r.location,
      clientTimezone: r.client_timezone,
      assessorTimezone: r.assessor_timezone,
      cancellationReason: r.cancellation_reason,
      invitations: notes
        .filter((n) => n.entity_id === r.id && (staff || n.recipient_role === "CLIENT"))
        .map((n) => ({ id: n.id, role: n.recipient_role, kind: n.kind, status: n.status, attempts: n.attempts, lastError: staff ? n.last_error : null })),
    }));
  });
}
