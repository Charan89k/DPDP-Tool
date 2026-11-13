/**
 * TLI — Consultation booking, availability, calendar invitations and notifications.
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pool } from "../lib/db/pool.ts";
import { executeWithRls } from "../lib/db/rls.ts";
import type { SessionUser } from "../lib/auth/types.ts";
import { devOutboxDir } from "../lib/email/mailer.ts";
import { buildIcs, foldIcsLine, googleCalendarUrl } from "../lib/calendar/ics.ts";
import { formatInZone, zonedDate, zonedWallTimeToUtc, addDays } from "../lib/scheduling/time.ts";
import {
  ConsultationError,
  addAvailabilityException,
  bookAppointment,
  cancelAppointment,
  completeAppointment,
  confirmAppointment,
  findSlots,
  listAppointments,
  rescheduleAppointment,
  saveAppointmentType,
  saveMyAvailability,
  setReminderOffsets,
} from "../lib/consultations/service.ts";
import type { WeeklyHours } from "../lib/consultations/service.ts";
import { attemptNotification, dispatchDueNotifications, retryNotification } from "../lib/notifications/dispatch.ts";

const TLI = "018f3a5b-7c8d-7e90-8000-000000000001";
const ALPHA = "018f3a5b-7c8d-7e90-8000-000000000002";
const BETA = "018f3a5b-7c8d-7e90-8000-000000000003";
const s = (userId: string, tenantId: string, role: SessionUser["role"], email: string): SessionUser => ({
  userId, tenantId, email, fullName: role, role, tenantType: tenantId === TLI ? "TLI" : "CLIENT", tenantName: "t", tenantSlug: "t", isSdf: false,
});
const SUPER = s("018f3a5b-7c8d-7e90-8000-000000000101", TLI, "TLI_SUPER_ADMIN", "admin@truthlabs.in");
const LEAD = s("018f3a5b-7c8d-7e90-8000-000000000102", TLI, "TLI_LEAD_CONSULTANT", "lead.consultant@truthlabs.in");
const REVIEWER = s("018f3a5b-7c8d-7e90-8000-000000000103", TLI, "TLI_REVIEWER", "reviewer.privacy@truthlabs.in");
const ALPHA_ADMIN = s("018f3a5b-7c8d-7e90-8000-000000000111", ALPHA, "CLIENT_ADMIN", "admin@alphahealth.example.com");
const ALPHA_VIEWER = s("018f3a5b-7c8d-7e90-8000-000000000114", ALPHA, "CLIENT_VIEWER", "legal.viewer@alphahealth.example.com");
const BETA_ADMIN = s("018f3a5b-7c8d-7e90-8000-000000000121", BETA, "CLIENT_ADMIN", "admin@betaexpress.example.com");
const ALPHA_ASSESSMENT = "018f3a5b-7c8d-7e90-8000-000000000201";
const WALKTHROUGH = "a7c0f6b2-0001-4000-8000-000000000002"; // 60 minutes
const FOLLOW_UP = "a7c0f6b2-0001-4000-8000-000000000005"; // 30 minutes
const ALL_DAYS: WeeklyHours = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((d) => [String(d), [["09:00", "12:00"] as [string, string]]]));

/** The email outbox persists between runs; this run's messages carry RUN in the agenda. */
const RUN = `run-${Date.now().toString(36)}`;
const isErr = (status: number) => (e: unknown) => e instanceof ConsultationError && e.status === status;
const notifications = async (appointmentId: string) =>
  (await pool.query("SELECT kind, recipient_role, status, entity_sequence, scheduled_for, attempts, last_error FROM notification_deliveries WHERE entity_id = $1 ORDER BY created_at;", [appointmentId])).rows;
const outbox = () => fs.readdirSync(devOutboxDir()).sort().map((f) => fs.readFileSync(path.join(devOutboxDir(), f), "utf8"));

describe("Timezones and ICS", () => {
  it("converts wall-clock time in a zone to UTC, including daylight-saving zones", () => {
    assert.equal(zonedWallTimeToUtc("2030-01-14", "09:30", "Asia/Kolkata").toISOString(), "2030-01-14T04:00:00.000Z");
    assert.equal(zonedWallTimeToUtc("2030-07-01", "09:00", "Europe/London").toISOString(), "2030-07-01T08:00:00.000Z"); // BST
    assert.equal(zonedWallTimeToUtc("2030-01-01", "09:00", "Europe/London").toISOString(), "2030-01-01T09:00:00.000Z"); // GMT
    assert.deepEqual(zonedDate(new Date("2030-01-13T20:00:00Z"), "Asia/Kolkata"), { date: "2030-01-14", weekday: 1 });
    assert.match(formatInZone("2030-01-14T04:00:00Z", "Asia/Kolkata"), /9:30/);
  });

  it("builds RFC 5545 invitations with a stable UID, sequence, escaping and folding", () => {
    const ics = buildIcs({
      uid: "appointment-x@truthlabs-dpdp",
      sequence: 2,
      method: "REQUEST",
      start: new Date("2030-01-14T04:00:00Z"),
      end: new Date("2030-01-14T05:00:00Z"),
      summary: "Walkthrough; Alpha, Ltd",
      description: `Line one\nLine two ${"x".repeat(120)} ₹`,
      organizer: { name: "Truth Labs International", email: "no-reply@tli.example.com" },
      attendees: [{ name: "Client", email: "c@example.com" }, { name: "Assessor", email: "a@example.com" }],
      stamp: new Date("2030-01-01T00:00:00Z"),
    });
    assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
    assert.match(ics, /METHOD:REQUEST\r\n/);
    assert.match(ics, /UID:appointment-x@truthlabs-dpdp\r\n/);
    assert.match(ics, /SEQUENCE:2\r\n/);
    assert.match(ics, /DTSTART:20300114T040000Z\r\n/);
    assert.match(ics, /SUMMARY:Walkthrough\\; Alpha\\, Ltd/);
    assert.match(ics.replace(/\r\n /g, ""), /ATTENDEE;[^\r]*mailto:c@example.com/, "unfolded");
    for (const line of ics.split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75, `line too long: ${line}`);
    const cancel = buildIcs({ uid: "u", sequence: 3, method: "CANCEL", start: new Date(), end: new Date(Date.now() + 1), summary: "s", description: "d", organizer: { name: "o", email: "o@x.y" }, attendees: [] });
    assert.match(cancel, /METHOD:CANCEL/);
    assert.match(cancel, /STATUS:CANCELLED/);
    assert.equal(foldIcsLine("ab"), "ab");
    assert.match(googleCalendarUrl({ start: new Date("2030-01-14T04:00:00Z"), end: new Date("2030-01-14T05:00:00Z"), summary: "x", description: "y" }), /dates=20300114T040000Z%2F20300114T050000Z/);
  });
});

describe("Consultation booking", () => {
  // A Monday well ahead; "now" is pinned so notice rules are deterministic.
  const NOW = new Date("2029-12-20T00:00:00Z");
  const DAY = "2030-01-14";
  const slotAt = (time: string) => zonedWallTimeToUtc(DAY, time, "Asia/Kolkata").toISOString();
  const RESCHEDULED = zonedWallTimeToUtc(addDays(DAY, 2), "10:00", "Asia/Kolkata").toISOString();
  let appointmentId = "";

  before(async () => {
    await saveMyAvailability(LEAD, { timezone: "Asia/Kolkata", weeklyHours: ALL_DAYS, bufferMinutes: 15, slotStepMinutes: 30, minNoticeHours: 24, maxDaysAhead: 365, meetingUrl: "https://meet.example.com/tli", location: null, isAccepting: true });
    await saveMyAvailability(REVIEWER, { timezone: "Europe/London", weeklyHours: { "1": [["10:00", "11:00"]] }, bufferMinutes: 0, slotStepMinutes: 60, minNoticeHours: 0, maxDaysAhead: 365, meetingUrl: null, location: "TLI office, Mumbai", isAccepting: true });
  });

  it("only assessors manage availability and only valid hours are accepted", async () => {
    const base = { bufferMinutes: 0, slotStepMinutes: 30, minNoticeHours: 0, maxDaysAhead: 30, meetingUrl: null, location: null, isAccepting: true };
    await assert.rejects(() => saveMyAvailability(ALPHA_ADMIN, { ...base, timezone: "Asia/Kolkata", weeklyHours: {} }), isErr(403));
    await assert.rejects(() => saveMyAvailability(LEAD, { ...base, timezone: "Mars/Olympus", weeklyHours: ALL_DAYS }), isErr(400));
    await assert.rejects(() => saveMyAvailability(LEAD, { ...base, timezone: "Asia/Kolkata", weeklyHours: { "1": [["12:00", "09:00"]] } }), isErr(400));
    await assert.rejects(() => saveMyAvailability(LEAD, { ...base, timezone: "Asia/Kolkata", weeklyHours: ALL_DAYS, maxDaysAhead: 3650 }), isErr(400), "window too long");
  });

  it("shows real slots from each assessor's hours in their own timezone", async () => {
    const slots = await findSlots({ typeId: WALKTHROUGH, fromDate: DAY, toDate: DAY, now: NOW });
    const lead = slots.filter((x) => x.assessorId === LEAD.userId).map((x) => x.startsAt);
    assert.deepEqual(lead, [slotAt("09:00"), slotAt("09:30"), slotAt("10:00"), slotAt("10:30"), slotAt("11:00")]);
    const reviewer = slots.filter((x) => x.assessorId === REVIEWER.userId).map((x) => x.startsAt);
    assert.deepEqual(reviewer, ["2030-01-14T10:00:00.000Z"]); // 10:00 London in January = 10:00 UTC
  });

  it("books a slot, creates invitations for both people and reminders", async () => {
    const booked = await bookAppointment(ALPHA_ADMIN, { typeId: WALKTHROUGH, assessorId: LEAD.userId, startsAt: slotAt("09:00"), agenda: `Walk through the report ${RUN}`, clientTimezone: "Europe/Berlin", assessmentId: ALPHA_ASSESSMENT }, {}, NOW);
    appointmentId = booked.id;
    assert.equal(booked.status, "CONFIRMED");
    const rows = await notifications(appointmentId);
    assert.deepEqual(rows.filter((r) => r.kind === "INVITE").map((r) => r.recipient_role).sort(), ["ASSESSOR", "CLIENT"]);
    assert.equal(rows.filter((r) => r.kind.startsWith("REMINDER_")).length, 4, "24h and 1h reminders for both");
    const audit = await pool.query("SELECT action FROM audit_logs WHERE entity_id = $1;", [appointmentId]);
    assert.ok(audit.rows.some((r) => r.action === "APPOINTMENT_BOOKED"));
  });

  it("refuses unavailable, misaligned and blocked times, and the buffer after a meeting", async () => {
    await assert.rejects(() => bookAppointment(ALPHA_ADMIN, { typeId: WALKTHROUGH, assessorId: LEAD.userId, startsAt: slotAt("09:00"), agenda: "", clientTimezone: "UTC" }, {}, NOW), isErr(409), "taken");
    await assert.rejects(() => bookAppointment(ALPHA_ADMIN, { typeId: FOLLOW_UP, assessorId: LEAD.userId, startsAt: slotAt("10:00"), agenda: "", clientTimezone: "UTC" }, {}, NOW), isErr(409), "inside the 15-minute buffer");
    await assert.rejects(() => bookAppointment(ALPHA_ADMIN, { typeId: FOLLOW_UP, assessorId: LEAD.userId, startsAt: slotAt("10:45"), agenda: "", clientTimezone: "UTC" }, {}, NOW), isErr(409), "not on the slot grid");
    await assert.rejects(() => bookAppointment(ALPHA_ADMIN, { typeId: FOLLOW_UP, assessorId: LEAD.userId, startsAt: slotAt("13:00"), agenda: "", clientTimezone: "UTC" }, {}, NOW), isErr(409), "outside working hours");
    await addAvailabilityException(LEAD, { startsOn: addDays(DAY, 1), endsOn: addDays(DAY, 1), reason: "Leave" });
    const blocked = await findSlots({ typeId: FOLLOW_UP, fromDate: addDays(DAY, 1), toDate: addDays(DAY, 1), assessorId: LEAD.userId, now: NOW });
    assert.equal(blocked.length, 0, "blocked date has no slots");
    await assert.rejects(() => bookAppointment(ALPHA_VIEWER, { typeId: FOLLOW_UP, assessorId: LEAD.userId, startsAt: slotAt("11:00"), agenda: "", clientTimezone: "UTC" }, {}, NOW), isErr(403), "viewer");
    await assert.rejects(() => bookAppointment(BETA_ADMIN, { typeId: FOLLOW_UP, assessorId: LEAD.userId, startsAt: slotAt("11:00"), agenda: "", clientTimezone: "UTC", assessmentId: ALPHA_ASSESSMENT }, {}, NOW), isErr(404), "other organisation's assessment");
  });

  it("prevents double booking when two customers book the same slot at the same moment", async () => {
    const attempt = (who: SessionUser) => bookAppointment(who, { typeId: FOLLOW_UP, assessorId: LEAD.userId, startsAt: slotAt("11:00"), agenda: "race", clientTimezone: "UTC" }, {}, NOW);
    const results = await Promise.allSettled([attempt(ALPHA_ADMIN), attempt(BETA_ADMIN)]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    assert.ok(isErr(409)(rejected.reason));
    const active = await pool.query("SELECT COUNT(*) AS n FROM appointments WHERE assessor_user_id = $1 AND starts_at = $2 AND status = 'CONFIRMED';", [LEAD.userId, slotAt("11:00")]);
    assert.equal(Number(active.rows[0].n), 1);
  });

  it("the database refuses an overlapping appointment even if application checks are bypassed", async () => {
    await assert.rejects(
      () => pool.query(
        `INSERT INTO appointments (id, tenant_id, appointment_type_id, assessor_user_id, client_user_id, status, starts_at, ends_at, buffer_minutes, client_timezone, assessor_timezone, calendar_uid)
         VALUES ('direct-1', $1, $2, $3, $4, 'CONFIRMED', $5, $6, 0, 'UTC', 'UTC', 'direct-1');`,
        [ALPHA, FOLLOW_UP, LEAD.userId, ALPHA_ADMIN.userId, slotAt("09:30"), slotAt("10:00")]
      ),
      /APPOINTMENT_SLOT_TAKEN/
    );
  });

  it("sends each invitation once, in the recipient's timezone, with the calendar invite attached", async () => {
    const before = outbox().length;
    const results = await dispatchDueNotifications(NOW);
    assert.ok(results.filter((r) => r.outcome === "SENT").length >= 2);
    const again = await dispatchDueNotifications(NOW);
    assert.equal(again.filter((r) => r.outcome === "SENT").length, 0, "nothing sent twice");
    const mails = outbox().slice(before).filter((m) => m.includes(`UID:appointment-${appointmentId}@truthlabs-dpdp`));
    const client = mails.find((m) => m.includes("To: admin@alphahealth.example.com"));
    const assessor = mails.find((m) => m.includes("To: lead.consultant@truthlabs.in"));
    assert.ok(client && assessor, "both received the invitation");
    assert.match(client, /X-Calendar-Method: REQUEST/);
    assert.match(client, /SEQUENCE:0/);
    assert.match(client, /CET|GMT\+1/, "client sees Berlin time");
    assert.match(assessor, /IST|GMT\+5:30/, "assessor sees India time");
    assert.match(client, /Assessment reference: ENG-ALPHA-2026-Q4/);
    assert.match(client, /https:\/\/meet\.example\.com\/tli/);
    assert.match(client, /calendar\.google\.com/);
  });

  it("rescheduling updates the same calendar event and replaces the reminders", async () => {
    const before = outbox().length;
    await rescheduleAppointment(ALPHA_ADMIN, appointmentId, RESCHEDULED, {}, NOW);
    const rows = await notifications(appointmentId);
    assert.ok(rows.filter((r) => r.kind.startsWith("REMINDER_") && r.entity_sequence === 0).every((r) => r.status === "CANCELLED"));
    assert.equal(rows.filter((r) => r.kind.startsWith("REMINDER_") && r.entity_sequence === 1 && r.status === "QUEUED").length, 4);
    await dispatchDueNotifications(NOW);
    const updates = outbox().slice(before).filter((m) => m.includes(`UID:appointment-${appointmentId}@truthlabs-dpdp`));
    assert.equal(updates.length, 2);
    assert.ok(updates.every((m) => /SEQUENCE:1/.test(m) && /Rescheduled/.test(m)));
    await assert.rejects(() => rescheduleAppointment(BETA_ADMIN, appointmentId, slotAt("10:30"), {}, NOW), isErr(404), "other organisation");
  });

  it("does not send an invitation that a later change has superseded", async () => {
    const booked = await bookAppointment(BETA_ADMIN, { typeId: FOLLOW_UP, assessorId: REVIEWER.userId, startsAt: "2030-01-14T10:00:00.000Z", agenda: "", clientTimezone: "Asia/Kolkata" }, {}, NOW);
    await cancelAppointment(BETA_ADMIN, booked.id, "Changed plans");
    await dispatchDueNotifications(NOW);
    const rows = await notifications(booked.id);
    assert.ok(rows.filter((r) => r.kind === "INVITE").every((r) => r.status === "CANCELLED"), "stale invite not sent");
    assert.equal(rows.filter((r) => r.kind === "CANCEL" && r.status === "SENT").length, 2);
    const cancelMail = outbox().find((m) => m.includes(`UID:appointment-${booked.id}`) && /METHOD:CANCEL/.test(m));
    assert.ok(cancelMail && /SEQUENCE:1/.test(cancelMail));
  });

  it("sends reminders when due, once, and only for confirmed meetings", async () => {
    const start = new Date(RESCHEDULED).getTime();
    const dayBefore = new Date(start - 1440 * 60_000 + 1000);
    await dispatchDueNotifications(dayBefore);
    await dispatchDueNotifications(dayBefore);
    const rows = await notifications(appointmentId);
    assert.equal(rows.filter((r) => r.kind === "REMINDER_1440" && r.entity_sequence === 1 && r.status === "SENT").length, 2, "24-hour reminder to client and assessor, once");
    const reminderMails = outbox().filter((m) => m.includes("Subject: Reminder: Assessment report walkthrough") && m.includes(RUN));
    assert.equal(reminderMails.length, 2, "no duplicate reminder emails");
    assert.equal(rows.filter((r) => r.kind === "REMINDER_60" && r.status === "QUEUED").length, 2, "1-hour reminder still waiting");
  });

  it("records failed emails, retries them automatically and lets TLI retry manually", async () => {
    const booked = await bookAppointment(ALPHA_ADMIN, { typeId: FOLLOW_UP, assessorId: LEAD.userId, startsAt: zonedWallTimeToUtc(addDays(DAY, 7), "09:00", "Asia/Kolkata").toISOString(), agenda: "", clientTimezone: "Asia/Kolkata" }, {}, NOW);
    const env = { ...process.env };
    (process.env as Record<string, string>).NODE_ENV = "production"; // no SMTP configured in tests: production refuses to send
    process.env.CLOUDE5_PUBLIC_URL = "https://tli.example.com";
    try {
      await dispatchDueNotifications(NOW);
      let invite = (await notifications(booked.id)).find((r) => r.kind === "INVITE" && r.recipient_role === "CLIENT");
      assert.equal(invite.status, "FAILED");
      assert.equal(invite.last_error, "SMTP_NOT_CONFIGURED");
      assert.equal((await dispatchDueNotifications(NOW)).length, 0, "backoff: not retried before it is due");
      await dispatchDueNotifications(new Date(NOW.getTime() + 3 * 60_000));
      await dispatchDueNotifications(new Date(NOW.getTime() + 20 * 60_000));
      invite = (await notifications(booked.id)).find((r) => r.kind === "INVITE" && r.recipient_role === "CLIENT");
      assert.equal(invite.attempts, 3, "three automatic attempts");
      const later = await dispatchDueNotifications(new Date(NOW.getTime() + 60 * 60_000));
      assert.ok(!later.some((r) => r.outcome === "FAILED"), "no automatic attempts after the limit");
    } finally {
      process.env = env;
    }
    const failedId = (await pool.query("SELECT id FROM notification_deliveries WHERE entity_id = $1 AND kind = 'INVITE' AND recipient_role = 'CLIENT';", [booked.id])).rows[0].id;
    await assert.rejects(() => retryNotification(ALPHA_ADMIN, failedId), /FORBIDDEN/);
    assert.equal((await retryNotification(LEAD, failedId)).outcome, "SENT");
    assert.equal((await attemptNotification(failedId, { manual: true })).outcome, "SKIPPED", "a sent notification is never sent again");
  });

  it("supports appointment types that need TLI confirmation and configurable reminders", async () => {
    await assert.rejects(() => saveAppointmentType(LEAD, { name: "x", description: "", durationMinutes: 30, requiresApproval: true, isActive: true, sortOrder: 9 }), isErr(403));
    await saveAppointmentType(SUPER, { name: "Board briefing", description: "Executive briefing", durationMinutes: 30, requiresApproval: true, isActive: true, sortOrder: 9 });
    const type = (await pool.query("SELECT id FROM appointment_types WHERE name = 'Board briefing';")).rows[0].id;
    assert.deepEqual(await setReminderOffsets(SUPER, [120, 1440, 120]), [1440, 120]);
    await assert.rejects(() => setReminderOffsets(LEAD, [60]), isErr(403));
    const booked = await bookAppointment(ALPHA_ADMIN, { typeId: type, assessorId: LEAD.userId, startsAt: zonedWallTimeToUtc(addDays(DAY, 14), "09:00", "Asia/Kolkata").toISOString(), agenda: "", clientTimezone: "Asia/Kolkata" }, {}, NOW);
    assert.equal(booked.status, "PENDING");
    assert.deepEqual((await notifications(booked.id)).map((r) => r.kind).sort(), ["NEW_REQUEST", "REQUESTED"]);
    await assert.rejects(() => confirmAppointment(ALPHA_ADMIN, booked.id), isErr(403));
    await confirmAppointment(LEAD, booked.id, { meetingUrl: "https://meet.example.com/board" });
    const kinds = (await notifications(booked.id)).map((r) => r.kind);
    assert.ok(kinds.includes("INVITE") && kinds.includes("REMINDER_1440") && kinds.includes("REMINDER_120"));
  });

  it("isolates appointments by organisation and assessor", async () => {
    const alpha = await listAppointments(ALPHA_ADMIN);
    const beta = await listAppointments(BETA_ADMIN);
    assert.ok(alpha.length > 0 && alpha.every((a) => a.tenantId === ALPHA));
    assert.ok(beta.every((a) => a.tenantId === BETA));
    assert.ok(alpha.every((a) => a.invitations.every((i) => i.role === "CLIENT")), "customers see only their own invitation status");
    const reviewer = await listAppointments(REVIEWER);
    assert.ok(reviewer.every((a) => a.assessorId === REVIEWER.userId), "a reviewer sees only their own appointments");
    assert.ok((await listAppointments(LEAD)).length >= alpha.length, "lead consultants see all");
    await assert.rejects(() => cancelAppointment(REVIEWER, appointmentId, "not mine"), isErr(404));
    await assert.rejects(() => executeWithRls(ALPHA_ADMIN, (c) => c.query("UPDATE appointments SET status = 'CANCELLED';")), /permission denied/);
  });

  it("marks held meetings complete and cancels their remaining reminders", async () => {
    await assert.rejects(() => completeAppointment(LEAD, appointmentId, NOW), isErr(409), "not started yet");
    await completeAppointment(LEAD, appointmentId, new Date("2030-02-01T00:00:00Z"));
    const rows = await notifications(appointmentId);
    assert.ok(rows.filter((r) => r.kind === "REMINDER_60").every((r) => r.status === "CANCELLED"));
  });
});
