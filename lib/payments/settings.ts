/**
 * TLI — Report price configuration, managed by the platform super administrator.
 */

import { pool } from "../db/pool.ts";
import type { SessionUser } from "../auth/types.ts";
import { assertSessionMatchesDatabase } from "../db/rls.ts";

const PRICE_KEY = "report_price_paise";
/** Razorpay's minimum order is ₹1; the upper bound guards against a mistyped extra digit. */
export const MIN_PRICE_PAISE = 100;
export const MAX_PRICE_PAISE = 100_000_000; // ₹10,00,000

export async function getReportPricePaise(): Promise<number | null> {
  const res = await pool.query<{ value: string }>("SELECT value FROM platform_settings WHERE key = $1;", [PRICE_KEY]);
  const value = Number(res.rows[0]?.value);
  return Number.isInteger(value) && value >= MIN_PRICE_PAISE ? value : null;
}

export class PriceValidationError extends Error {}

/** Sets the price of the final report in paise. Only a verified super administrator may do this. */
export async function setReportPricePaise(session: SessionUser, amountPaise: number): Promise<void> {
  if (!Number.isInteger(amountPaise) || amountPaise < MIN_PRICE_PAISE || amountPaise > MAX_PRICE_PAISE) {
    throw new PriceValidationError("Enter a price between ₹1 and ₹10,00,000.");
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN;");
    // Re-check the role against the database rather than trusting the session token alone.
    const dbUser = await assertSessionMatchesDatabase(client, session);
    if (dbUser.role !== "TLI_SUPER_ADMIN") throw new PriceValidationError("Only the super administrator can change the report price.");
    const previous = await client.query<{ value: string }>("SELECT value FROM platform_settings WHERE key = $1;", [PRICE_KEY]);
    await client.query(
      `INSERT INTO platform_settings (key, value, updated_by_user_id, updated_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_by_user_id = excluded.updated_by_user_id,
         updated_at = excluded.updated_at;`,
      [PRICE_KEY, String(amountPaise), session.userId]
    );
    await client.query(
      `INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, previous_state, new_state)
       VALUES ($1, $2, 'REPORT_PRICE_CHANGED', 'platform_settings', $3, $4, $5);`,
      [
        session.tenantId,
        session.userId,
        PRICE_KEY,
        JSON.stringify({ amountPaise: previous.rows[0] ? Number(previous.rows[0].value) : null }),
        JSON.stringify({ amountPaise }),
      ]
    );
    await client.query("COMMIT;");
  } catch (err) {
    await client.query("ROLLBACK;");
    throw err;
  } finally {
    client.release();
  }
}
