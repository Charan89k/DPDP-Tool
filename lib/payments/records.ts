/**
 * TLI — Shared payment record types and privileged write helpers.
 */

import { pool } from "../db/pool.ts";
import type { PoolClient } from "../db/pool.ts";
import type { PaymentMode } from "./razorpay.ts";

export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";

export class PaymentError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "PaymentError";
    this.status = status;
  }
}

export interface RequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface PaymentRow {
  id: string;
  tenant_id: string;
  assessment_id: string;
  report_snapshot_id: string;
  requested_by_user_id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  amount_paise: number;
  currency: string;
  mode: PaymentMode;
  status: PaymentStatus;
}

export interface AuditEntry {
  tenantId: string;
  assessmentId: string;
  userId: string | null;
  action: string;
  details: Record<string, unknown>;
  meta?: RequestMeta;
}

/** Appends an audit row for an assessment; visible to the customer and assigned consultants. */
export async function writePaymentAudit(client: Pick<PoolClient, "query">, entry: AuditEntry): Promise<void> {
  await client.query(
    `INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, ip_address, user_agent, new_state)
     VALUES ($1, $2, $3, 'assessments', $4, $5, $6, $7);`,
    [
      entry.tenantId,
      entry.userId,
      entry.action,
      entry.assessmentId,
      entry.meta?.ipAddress ?? null,
      entry.meta?.userAgent ?? null,
      JSON.stringify(entry.details),
    ]
  );
}

/** Runs `work` in one privileged transaction on the shared connection. Never call the network inside. */
export async function inSystemTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN;");
    const result = await work(client);
    await client.query("COMMIT;");
    return result;
  } catch (err) {
    await client.query("ROLLBACK;");
    throw err;
  } finally {
    client.release();
  }
}
