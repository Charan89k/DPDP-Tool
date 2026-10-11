/**
 * TLI DPDP Compliance Gap Analysis Tool — In-Memory Login Rate Limiter
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
 * Resolves the client IP address from trusted edge and proxy headers.
 * Does not trust arbitrary client-supplied headers without validation.
 *
 * Priority:
 * 1. CF-Connecting-IP (Cloudflare Edge, cannot be forged if Cloudflare terminates)
 * 2. X-Real-IP (Standard reverse proxy edge header overwritten by NGINX / Envoy)
 * 3. X-Forwarded-For (Sanitized leftmost IP, strictly validated against IP regex)
 * 4. Fallback: 127.0.0.1
 */
export function resolveClientIp(request: Request | NextRequest): string {
  const headers = request.headers;

  // 1. Cloudflare edge header
  const cfIp = headers.get("cf-connecting-ip")?.trim();
  if (cfIp && isValidIp(cfIp)) {
    return cfIp;
  }

  // 2. Standard single-proxy header overwritten by edge reverse proxy
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp && isValidIp(realIp)) {
    return realIp;
  }

  // 3. Forwarded-For header (extract first IP and strictly validate format)
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const candidate = forwardedFor.split(",")[0]?.trim();
    if (candidate && isValidIp(candidate)) {
      return candidate;
    }
  }

  return "127.0.0.1";
}

class MemoryRateLimiter {
  private records: Map<string, RateLimitRecord> = new Map();
  private lastCleanup: number = Date.now();

  private cleanupIfNeeded() {
    const now = Date.now();
    // Run garbage collection at most once every 60 seconds
    if (now - this.lastCleanup > 60 * 1000) {
      this.lastCleanup = now;
      const cutoff = now - WINDOW_SECONDS * 1000;
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

    if (elapsedSeconds > WINDOW_SECONDS) {
      // Window expired, reset
      this.records.delete(key);
      return { limited: false, retryAfterSeconds: 0 };
    }

    if (record.attempts >= MAX_FAILED_ATTEMPTS) {
      const remainingSeconds = Math.ceil(WINDOW_SECONDS - elapsedSeconds);
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
    if (elapsedSeconds > WINDOW_SECONDS) {
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
