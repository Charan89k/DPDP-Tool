/**
 * CloudE5 — Transactional email delivery.
 *
 * Production: SMTP via nodemailer, configured with SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER,
 * SMTP_PASSWORD and SMTP_FROM. If SMTP is not configured in production, nothing is sent and the
 * caller is told so; tokens and links are never written to logs or returned in API responses.
 *
 * Development only (NODE_ENV !== "production"): without SMTP, messages are written as .eml files
 * to the dev outbox (CLOUDE5_DEV_OUTBOX_DIR, default ./.cloude5/dev-outbox) so flows can be tested
 * locally. This fallback is never active in production.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export type EmailDeliveryResult =
  | { sent: true; channel: "smtp" | "dev-outbox" }
  | { sent: false; reason: "SMTP_NOT_CONFIGURED" | "SMTP_ERROR" };

type Env = Record<string, string | undefined>;

export function isSmtpConfigured(env: Env = process.env): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_FROM);
}

let transporter: Transporter | null = null;

/** Hosts of a local mail catcher (the bundled Mailpit or one on this machine), reached without TLS. */
const LOCAL_MAIL_CATCHER_HOSTS = new Set(["mailpit", "localhost", "127.0.0.1", "::1"]);

/**
 * Plaintext SMTP is allowed only for a local mail catcher or when explicitly enabled with
 * SMTP_ALLOW_PLAINTEXT=true. Everywhere else STARTTLS is required, so a network attacker cannot
 * strip encryption and read the SMTP password or sign-in links.
 */
export function smtpAllowsPlaintext(env: Env = process.env): boolean {
  if (env.SMTP_ALLOW_PLAINTEXT === "true") return true;
  return LOCAL_MAIL_CATCHER_HOSTS.has(String(env.SMTP_HOST || "").trim().toLowerCase());
}

function getTransporter(env: Env): Transporter {
  if (!transporter) {
    const port = Number(env.SMTP_PORT || 587);
    const secure = env.SMTP_SECURE ? env.SMTP_SECURE === "true" : port === 465;
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port,
      secure,
      requireTLS: !secure && !smtpAllowsPlaintext(env),
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    });
  }
  return transporter;
}

export function devOutboxDir(env: Env = process.env): string {
  return path.resolve(env.CLOUDE5_DEV_OUTBOX_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), ".cloude5", "dev-outbox"));
}

function writeToDevOutbox(message: EmailMessage, env: Env): void {
  const dir = devOutboxDir(env);
  fs.mkdirSync(dir, { recursive: true, mode: 0o750 });
  const file = path.join(
    dir,
    `${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomUUID()}.eml`
  );
  const body = [
    `To: ${message.to}`,
    `From: ${env.SMTP_FROM || "CloudE5 <no-reply@localhost>"}`,
    `Subject: ${message.subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    message.text,
  ].join("\n");
  fs.writeFileSync(file, body, { mode: 0o600 });
}

export async function sendEmail(
  message: EmailMessage,
  env: Env = process.env
): Promise<EmailDeliveryResult> {
  if (isSmtpConfigured(env)) {
    try {
      await getTransporter(env).sendMail({
        from: env.SMTP_FROM,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      return { sent: true, channel: "smtp" };
    } catch (err) {
      console.error("SMTP delivery failed:", err instanceof Error ? err.message : "unknown error");
      return { sent: false, reason: "SMTP_ERROR" };
    }
  }

  if (env.NODE_ENV !== "production") {
    writeToDevOutbox(message, env);
    return { sent: true, channel: "dev-outbox" };
  }

  console.warn(
    `Email was not sent because SMTP is not configured (subject: "${message.subject}").`
  );
  return { sent: false, reason: "SMTP_NOT_CONFIGURED" };
}

/** Resolves the public base URL used in email links. */
export function publicBaseUrl(env: Env = process.env): string {
  const configured = env.CLOUDE5_PUBLIC_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (env.NODE_ENV === "production") {
    throw new Error(
      "CLOUDE5_PUBLIC_URL must be set in production so email links point to this server."
    );
  }
  return "http://localhost:3000";
}
