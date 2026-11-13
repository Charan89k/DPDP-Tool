/**
 * TLI — Notification queue for consultation and remediation emails.
 *
 * Each email is one notification_deliveries row with a unique dedupe_key, so retries, repeated
 * requests and the scheduler can never send the same notification twice. Rows are queued inside the
 * transaction that changes the appointment or request, and sent by lib/notifications/dispatch.ts.
 */

import crypto from "node:crypto";
import type { PoolClient } from "../db/pool.ts";

export type NotificationEntity = "appointment" | "remediation_request";
export type RecipientRole = "CLIENT" | "ASSESSOR" | "TLI";

export interface QueuedNotification {
  dedupeKey: string;
  tenantId: string;
  entityType: NotificationEntity;
  entityId: string;
  kind: string;
  recipientRole: RecipientRole;
  recipientEmail: string;
  entitySequence?: number;
  scheduledFor?: Date;
}

export async function queueNotifications(client: Pick<PoolClient, "query">, items: QueuedNotification[]): Promise<void> {
  for (const n of items) {
    await client.query(
      `INSERT INTO notification_deliveries (id, dedupe_key, tenant_id, entity_type, entity_id, kind, recipient_role,
         recipient_email, entity_sequence, scheduled_for)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (dedupe_key) DO NOTHING;`,
      [
        crypto.randomUUID(),
        n.dedupeKey,
        n.tenantId,
        n.entityType,
        n.entityId,
        n.kind,
        n.recipientRole,
        n.recipientEmail,
        n.entitySequence ?? 0,
        (n.scheduledFor ?? new Date()).toISOString(),
      ]
    );
  }
}

/** Cancels notifications that have not been sent yet (e.g. reminders of a rescheduled meeting). */
export async function cancelPendingNotifications(
  client: Pick<PoolClient, "query">,
  entityType: NotificationEntity,
  entityId: string,
  kinds: string[]
): Promise<void> {
  if (kinds.length === 0) return;
  await client.query(
    `UPDATE notification_deliveries SET status = 'CANCELLED', last_error = 'Superseded'
     WHERE entity_type = $1 AND entity_id = $2 AND status IN ('QUEUED', 'FAILED') AND kind IN (SELECT value FROM json_each($3));`,
    [entityType, entityId, JSON.stringify(kinds)]
  );
}

/** Minutes before a confirmed meeting at which reminders go out; configurable by the super admin. */
export const DEFAULT_REMINDER_OFFSETS = [1440, 60];
const REMINDER_KEY = "reminder_offsets_minutes";

export async function getReminderOffsets(client: Pick<PoolClient, "query">): Promise<number[]> {
  const res = await client.query<{ value: string }>("SELECT value FROM platform_settings WHERE key = $1;", [REMINDER_KEY]);
  const parsed = String(res.rows[0]?.value ?? "")
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isInteger(v) && v >= 5 && v <= 10080);
  return parsed.length > 0 ? [...new Set(parsed)].sort((a, b) => b - a) : DEFAULT_REMINDER_OFFSETS;
}

export const REMINDER_SETTING_KEY = REMINDER_KEY;
