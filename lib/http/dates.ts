/**
 * CloudE5 — Calendar date validation for API request bodies.
 */

import { z } from "zod";

/** True when `value` is YYYY-MM-DD and names a real calendar day (rejects 2027-02-30, 2027-13-01). */
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** A YYYY-MM-DD string that is a real calendar date. */
export const calendarDateSchema = z
  .string()
  .refine(isCalendarDate, "Use a real date in the YYYY-MM-DD format.");
