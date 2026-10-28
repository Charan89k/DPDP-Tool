/**
 * CloudE5 — work email rule for customer accounts.
 *
 * Customer users (sign-up, invitations, users added by an administrator) and organisation contact
 * addresses must use their organisation's own domain, not a free personal mailbox provider.
 * Platform staff accounts are created by command line and are not checked here.
 */

import { z } from "zod";

// shortcut: a fixed list of the common free providers; extend it when a new one shows up in sign-ups.
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com",
  "yahoo.com", "yahoo.co.in", "yahoo.in", "ymail.com", "rocketmail.com",
  "outlook.com", "outlook.in", "hotmail.com", "hotmail.co.in", "live.com", "live.in", "msn.com",
  "icloud.com", "me.com", "mac.com",
  "aol.com", "gmx.com", "gmx.net", "mail.com", "yandex.com", "yandex.ru",
  "proton.me", "protonmail.com", "pm.me", "tutanota.com", "zoho.com", "zohomail.in",
  "rediffmail.com", "rediff.com", "inbox.com", "fastmail.com", "hey.com",
]);

export const WORK_EMAIL_MESSAGE = "Use your work email address (personal addresses such as Gmail or Yahoo are not accepted).";

export function isWorkEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@").pop() ?? "";
  return domain.length > 0 && !FREE_EMAIL_DOMAINS.has(domain);
}

/** A valid email address on a work domain. */
export const workEmailSchema = z
  .string()
  .trim()
  .email("Enter a valid work email address.")
  .max(254)
  .refine(isWorkEmail, WORK_EMAIL_MESSAGE);
