/**
 * CloudE5 — Rate limiting
 *
 * Sliding-window limits persisted in SQLite (rate_limit_buckets), so they survive restarts:
 * - Failed sign-ins: 5 per 15 minutes per client IP and per email address.
 * - Account emails (registration, verification resend, password reset): 5 per 15 minutes per IP
 *   and per email address.
 * - New organisation registrations: 30 per hour across the installation.
 *
 * Client IPs come only from headers the deployment trusts (see resolveClientIp). Limits apply to a
 * single CloudE5 server; for internet-facing deployments also rate-limit at the reverse proxy.
 */

import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { pool } from "../db/pool.ts";


const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60; // 15 minutes

const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const IPV6_REGEX = /^[0-9a-fA-F:]{2,39}$/;

/**
 * Validates that an IP string conforms to standard IPv4 or IPv6 syntax.
 */
export function isValidIp(ip: string): boolean {
  if (!ip || typeof ip !== "string") return false;
  const trimmed = ip.trim();
  return IPV4_REGEX.test(trimmed) || IPV6_REGEX.test(trimmed);
}

/**
 * Resolves the client IP address used for rate limiting and audit logs.
 *
 * Only headers set by infrastructure CloudE5 is told to trust are honoured, because any client can
 * send arbitrary X-Real-IP / CF-Connecting-IP / X-Forwarded-For values:
 * - Vercel (VERCEL=1): X-Vercel-Forwarded-For / X-Real-IP / X-Forwarded-For are set by the platform.
 * - Self-hosted behind a reverse proxy (default; Caddy, nginx `$proxy_add_x_forwarded_for`): the
 *   proxy appends the real peer address as the RIGHTMOST X-Forwarded-For entry, so that entry is used.
 *   Client-supplied entries to its left are ignored.
 * - X-Real-IP is honoured only with CLOUDE5_TRUST_X_REAL_IP=true (proxy overwrites it).
 * - CF-Connecting-IP is honoured only with TRUST_CLOUDFLARE_IP_HEADER=true (Cloudflare fronts the site).
 * Falls back to 127.0.0.1 when no trusted header carries a valid address.
 */
export function resolveClientIp(
  request: Request | NextRequest,
  env: Record<string, string | undefined> = process.env
): string {
  const headers = request.headers;
  const onVercel = env.VERCEL === "1";

  const valid = (value: string | null | undefined): string | null => {
    const candidate = value?.trim();
    return candidate && isValidIp(candidate) ? candidate : null;
  };
  const leftmost = (value: string | null) => valid(value?.split(",")[0]);
  const rightmost = (value: string | null) => valid(value?.split(",").pop());

  const candidates: Array<string | null> = [];
  if (env.TRUST_CLOUDFLARE_IP_HEADER === "true") {
    candidates.push(valid(headers.get("cf-connecting-ip")));
  }
  if (onVercel) {
    candidates.push(
      leftmost(headers.get("x-vercel-forwarded-for")),
      valid(headers.get("x-real-ip")),
      leftmost(headers.get("x-forwarded-for"))
    );
  } else {
    if (env.CLOUDE5_TRUST_X_REAL_IP === "true") {
      candidates.push(valid(headers.get("x-real-ip")));
    }
    candidates.push(rightmost(headers.get("x-forwarded-for")));
  }

  return candidates.find((ip): ip is string => Boolean(ip)) ?? "127.0.0.1";
}

/**
 * Rate limiter persisted in SQLite (table rate_limit_buckets), so limits survive restarts.
 * Keys are hashed before storage. Each update is a single atomic statement.
 */
export class PersistentRateLimiter {
  private readonly scope: string;
  private readonly maxAttempts: number;
  private readonly windowSeconds: number;
  private lastPrune = 0;

  constructor(scope: string, maxAttempts: number = MAX_FAILED_ATTEMPTS, windowSeconds: number = WINDOW_SECONDS) {
    this.scope = scope;
    this.maxAttempts = maxAttempts;
    this.windowSeconds = windowSeconds;
  }

  private hash(key: string): string {
    return crypto.createHash("sha256").update(`${this.scope}:${key}`).digest("hex");
  }

  private cutoff(): string {
    return new Date(Date.now() - this.windowSeconds * 1000).toISOString();
  }

  public async isRateLimited(key: string): Promise<{ limited: boolean; retryAfterSeconds: number }> {
    const row = (
      await pool.query(
        "SELECT attempts, window_started_at FROM rate_limit_buckets WHERE key_hash = $1;",
        [this.hash(key)]
      )
    ).rows[0];
    if (!row) return { limited: false, retryAfterSeconds: 0 };
    const startedAt = new Date(row.window_started_at).getTime();
    const elapsedSeconds = (Date.now() - startedAt) / 1000;
    if (elapsedSeconds > this.windowSeconds || Number(row.attempts) < this.maxAttempts) {
      return { limited: false, retryAfterSeconds: 0 };
    }
    return { limited: true, retryAfterSeconds: Math.max(Math.ceil(this.windowSeconds - elapsedSeconds), 1) };
  }

  /**
   * Atomically counts one attempt and reports whether the caller is over the limit. Call this
   * BEFORE doing the guarded work (checking a password or code) so concurrent requests cannot
   * all pass a separate "check" step; reset on success.
   */
  public async hit(key: string): Promise<{ limited: boolean; retryAfterSeconds: number }> {
    const now = new Date().toISOString();
    const row = (
      await pool.query(
        `INSERT INTO rate_limit_buckets (key_hash, attempts, window_started_at, updated_at)
         VALUES ($1, 1, $2, $2)
         ON CONFLICT (key_hash) DO UPDATE SET
           attempts = CASE WHEN rate_limit_buckets.window_started_at < $3 THEN 1 ELSE rate_limit_buckets.attempts + 1 END,
           window_started_at = CASE WHEN rate_limit_buckets.window_started_at < $3 THEN $2 ELSE rate_limit_buckets.window_started_at END,
           updated_at = $2
         RETURNING attempts, window_started_at;`,
        [this.hash(key), now, this.cutoff()]
      )
    ).rows[0];
    await this.pruneIfDue();
    if (Number(row.attempts) <= this.maxAttempts) {
      return { limited: false, retryAfterSeconds: 0 };
    }
    const elapsedSeconds = (Date.now() - new Date(row.window_started_at).getTime()) / 1000;
    return { limited: true, retryAfterSeconds: Math.max(Math.ceil(this.windowSeconds - elapsedSeconds), 1) };
  }

  public async recordFailedAttempt(key: string): Promise<void> {
    const now = new Date().toISOString();
    const cutoff = this.cutoff();
    await pool.query(
      `INSERT INTO rate_limit_buckets (key_hash, attempts, window_started_at, updated_at)
       VALUES ($1, 1, $2, $2)
       ON CONFLICT (key_hash) DO UPDATE SET
         attempts = CASE WHEN rate_limit_buckets.window_started_at < $3 THEN 1 ELSE rate_limit_buckets.attempts + 1 END,
         window_started_at = CASE WHEN rate_limit_buckets.window_started_at < $3 THEN $2 ELSE rate_limit_buckets.window_started_at END,
         updated_at = $2;`,
      [this.hash(key), now, cutoff]
    );
    await this.pruneIfDue();
  }

  public async resetAttempts(key: string): Promise<void> {
    await pool.query("DELETE FROM rate_limit_buckets WHERE key_hash = $1;", [this.hash(key)]);
  }

  /** Removes buckets whose window ended long ago (at most once a minute). */
  private async pruneIfDue(): Promise<void> {
    if (Date.now() - this.lastPrune < 60_000) return;
    this.lastPrune = Date.now();
    const staleBefore = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await pool.query("DELETE FROM rate_limit_buckets WHERE updated_at < $1;", [staleBefore]);
  }
}

export const loginRateLimiter = new PersistentRateLimiter("login");

/** Limits account emails (registration, verification resend, password reset) per IP and per email. */
export const accountEmailRateLimiter = new PersistentRateLimiter("account-email");

/** Installation-wide cap on new organisation registrations: 30 per hour. */
export const registrationRateLimiter = new PersistentRateLimiter("registration", 30, 60 * 60);
