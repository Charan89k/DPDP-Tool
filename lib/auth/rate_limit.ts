/**
 * TLI DPDP Compliance Gap Analysis Tool — In-Memory Login Rate Limiter
 *
 * Implements a sliding-window rate limiter protecting POST /api/auth/login
 * against brute-force password guessing and credential stuffing attacks.
 *
 * Defaults:
 * - 5 failed attempts per key within a 15-minute window (900 seconds)
 * - Tracked per IP and per normalized target email
 */

interface RateLimitRecord {
  attempts: number;
  firstAttemptAt: number;
  lastAttemptAt: number;
}

const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60; // 15 minutes

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

