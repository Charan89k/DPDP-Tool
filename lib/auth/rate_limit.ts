/**
 * CloudE5 — In-Memory Login Rate Limiter
 *
 * Implements a sliding-window rate limiter protecting POST /api/auth/login
 * against brute-force password guessing and credential stuffing attacks.
 *
 * Defaults:
 * - 5 failed attempts per key within a 15-minute window (900 seconds)
 * - Tracked per client IP and per normalized target email
 *
 * ============================================================================
 * ARCHITECTURAL LIMITATIONS & PRODUCTION MITIGATION REQUIREMENTS:
 * ============================================================================
 * 1. Single-Instance Memory Scope:
 *    This in-memory rate limiter stores state in process memory. It resets
 *    upon application restarts and DOES NOT share state across multiple Node.js
 *    instances or serverless worker invocations.
 *
 * 2. No Distributed Protection Claim:
 *    This implementation DOES NOT provide distributed brute-force protection.
 *    In multi-pod Kubernetes clusters or auto-scaled environments, requests will
 *    be routed across multiple pods, partitioning the attempt counters.
 *
 * 3. Production Mitigations Required Before Public Deployment:
 *    Before exposing this application to the public internet, infrastructure
 *    teams MUST deploy one of the following production-grade mitigations:
 *    a) Edge-Layer Rate Limiting: Terminate traffic through Cloudflare Rate
 *       Limiting, AWS WAF rate-based rules, or NGINX limit_req_zone.
 *    b) Shared Distributed Store: Replace or back this in-memory class with a
 *       Redis / Valkey atomic token-bucket or sliding-window script.
 *    c) Reverse Proxy Header Hardening: Ensure reverse proxies (ALB, Nginx)
 *       strip client-supplied X-Forwarded-For headers and overwrite X-Real-IP
 *       with the genuine client connection address ($remote_addr).
 * ============================================================================
 */

import type { NextRequest } from "next/server";

interface RateLimitRecord {
  attempts: number;
  firstAttemptAt: number;
  lastAttemptAt: number;
}

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

export class MemoryRateLimiter {
  private records: Map<string, RateLimitRecord> = new Map();
  private readonly maxAttempts: number;
  private readonly windowSeconds: number;

  constructor(maxAttempts: number = MAX_FAILED_ATTEMPTS, windowSeconds: number = WINDOW_SECONDS) {
    this.maxAttempts = maxAttempts;
    this.windowSeconds = windowSeconds;
  }
  private lastCleanup: number = Date.now();

  private cleanupIfNeeded() {
    const now = Date.now();
    // Run garbage collection at most once every 60 seconds
    if (now - this.lastCleanup > 60 * 1000) {
      this.lastCleanup = now;
      const cutoff = now - this.windowSeconds * 1000;
      for (const [key, record] of this.records.entries()) {
        if (record.lastAttemptAt < cutoff) {
          this.records.delete(key);
        }
      }
    }
  }

  /**
   * Checks whether the given key has exceeded the allowed failed attempts threshold.
   */
  public isRateLimited(key: string): { limited: boolean; retryAfterSeconds: number } {
    this.cleanupIfNeeded();
    const record = this.records.get(key);
    if (!record) {
      return { limited: false, retryAfterSeconds: 0 };
    }

    const now = Date.now();
    const elapsedSeconds = (now - record.firstAttemptAt) / 1000;

    if (elapsedSeconds > this.windowSeconds) {
      // Window expired, reset
      this.records.delete(key);
      return { limited: false, retryAfterSeconds: 0 };
    }

    if (record.attempts >= this.maxAttempts) {
      const remainingSeconds = Math.ceil(this.windowSeconds - elapsedSeconds);
      return { limited: true, retryAfterSeconds: Math.max(remainingSeconds, 1) };
    }

    return { limited: false, retryAfterSeconds: 0 };
  }

  /**
   * Increments the failed attempt counter for the given key.
   */
  public recordFailedAttempt(key: string): void {
    this.cleanupIfNeeded();
    const now = Date.now();
    const record = this.records.get(key);

    if (!record) {
      this.records.set(key, {
        attempts: 1,
        firstAttemptAt: now,
        lastAttemptAt: now,
      });
      return;
    }

    const elapsedSeconds = (now - record.firstAttemptAt) / 1000;
    if (elapsedSeconds > this.windowSeconds) {
      // Start a fresh window
      this.records.set(key, {
        attempts: 1,
        firstAttemptAt: now,
        lastAttemptAt: now,
      });
      return;
    }

    record.attempts += 1;
    record.lastAttemptAt = now;
  }

  /**
   * Resets the failed attempts counter upon a successful login.
   */
  public resetAttempts(key: string): void {
    this.records.delete(key);
  }

  /**
   * Clears all stored rate limit records (for automated testing).
   */
  public clearAllRateLimits(): void {
    this.records.clear();
  }
}

export const loginRateLimiter = new MemoryRateLimiter();

/** Limits account emails (registration, verification resend, password reset) per IP and per email. */
export const accountEmailRateLimiter = new MemoryRateLimiter();

/** Installation-wide cap on new organisation registrations (per process): 30 per hour. */
export const registrationRateLimiter = new MemoryRateLimiter(30, 60 * 60);
