/**
 * TLI — Appends an audit_logs row (append-only table). Rows carry the customer organisation's
 * tenant id, so the organisation and TLI staff can read their own history.
 */

import type { PoolClient } from "../db/pool.ts";

export interface AuditRecord {
  tenantId: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function writeAudit(client: Pick<PoolClient, "query">, entry: AuditRecord): Promise<void> {
  await client.query(
    `INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, ip_address, user_agent, new_state)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
    [entry.tenantId, entry.userId, entry.action, entry.entityType, entry.entityId, entry.ipAddress ?? null, entry.userAgent ?? null, JSON.stringify(entry.details)]
  );
}
