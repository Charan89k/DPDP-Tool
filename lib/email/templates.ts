/**
 * CloudE5 — Transactional email templates (plain text + minimal accessible HTML).
 */

import type { EmailMessage } from "./mailer.ts";

const BRAND = "CloudE5";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(title: string, paragraphs: string[], action?: { label: string; url: string }): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:1.5">${escapeHtml(p)}</p>`).join("");
  const button = action
    ? `<p style="margin:22px 0"><a href="${escapeHtml(action.url)}" style="background:#0066FF;color:#ffffff;padding:11px 18px;border-radius:6px;text-decoration:none;font-weight:600">${escapeHtml(action.label)}</a></p>
       <p style="margin:0 0 14px;font-size:12px;color:#64748B">If the button does not work, copy this link into your browser:<br>${escapeHtml(action.url)}</p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#F4F7FB;font-family:Arial,Helvetica,sans-serif;color:#0F172A">
<div style="max-width:560px;margin:0 auto;padding:28px 20px">
<div style="font-weight:700;font-size:18px;color:#0B192C;margin-bottom:18px">${BRAND}</div>
<div style="background:#ffffff;border:1px solid #E2E8F0;border-radius:10px;padding:24px">
<h1 style="font-size:18px;margin:0 0 16px">${escapeHtml(title)}</h1>${body}${button}
</div>
<p style="font-size:11px;color:#64748B;margin-top:16px">You received this email because of activity on a ${BRAND} account. ${BRAND} provides compliance self-assessment tooling and does not provide legal advice.</p>
</div></body></html>`;
}

function textBody(paragraphs: string[], action?: { label: string; url: string }): string {
  return [...paragraphs, ...(action ? [`${action.label}: ${action.url}`] : []), "", `— ${BRAND}`].join("\n\n");
}

function message(to: string, subject: string, title: string, paragraphs: string[], action?: { label: string; url: string }): EmailMessage {
  return { to, subject, text: textBody(paragraphs, action), html: layout(title, paragraphs, action) };
}

export function verificationEmail(to: string, fullName: string, url: string): EmailMessage {
  return message(
    to,
    `Verify your email for ${BRAND}`,
    "Confirm your email address",
    [
      `Hello ${fullName},`,
      `Please confirm your email address to activate your ${BRAND} workspace. This link expires in 24 hours and can be used once.`,
      "If you did not create this account, you can ignore this email.",
    ],
    { label: "Verify email address", url }
  );
}

export function existingAccountEmail(to: string, signInUrl: string, resetUrl: string): EmailMessage {
  return message(to, `${BRAND} sign-up attempt`, "You already have an account", [
    `Someone tried to register a new ${BRAND} workspace with this email address, which already has an account.`,
    `If this was you, sign in at ${signInUrl}. If you forgot your password, reset it at ${resetUrl}.`,
    "If this was not you, no action is needed.",
  ]);
}

export function passwordResetEmail(to: string, fullName: string, url: string): EmailMessage {
  return message(
    to,
    `Reset your ${BRAND} password`,
    "Reset your password",
    [
      `Hello ${fullName},`,
      "We received a request to reset your password. This link expires in 1 hour and can be used once.",
      "If you did not request a reset, ignore this email; your password will not change.",
    ],
    { label: "Choose a new password", url }
  );
}

export function passwordChangedEmail(to: string, fullName: string): EmailMessage {
  return message(to, `Your ${BRAND} password was changed`, "Password changed", [
    `Hello ${fullName},`,
    "Your password was just changed and all existing sessions were signed out.",
    "If you did not make this change, reset your password immediately and contact your organisation administrator.",
  ]);
}

export function invitationEmail(to: string, organisation: string, inviter: string, url: string): EmailMessage {
  return message(
    to,
    `You have been invited to ${organisation} on ${BRAND}`,
    "You're invited",
    [
      `${inviter} invited you to join ${organisation} on ${BRAND}.`,
      "Use the link below to set your password and activate your account. The invitation expires in 7 days.",
    ],
    { label: "Accept invitation", url }
  );
}
