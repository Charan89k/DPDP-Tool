/**
 * TLI DPDP Compliance Gap Analysis Tool — Password Security Module
 *
 * Implements secure password verification and hashing using bcryptjs.
 * Handles synthetic development test fixtures safely without compromising production rules.
 */

import bcrypt from "bcryptjs";

// Canonical synthetic placeholder hash seeded in migrations/004_seed_synthetic_data.sql
export const SYNTHETIC_SEED_HASH =
  "$2b$12$e80yvV3n2YfV3n2YfV3n2Oe2Z3iP1W5e2Z3iP1W5e2Z3iP1W5e2Z3";
export const SYNTHETIC_SEED_PASSWORD = "SyntheticTestPassword123!";

export function getDemoPassword(): string {
  return process.env.DEMO_USER_PASSWORD || SYNTHETIC_SEED_PASSWORD;
}

/**
 * Verifies a plain text password against a stored password hash.
 * Fails closed on empty strings or null values.
 * In production environments, synthetic test hashes and credentials are unconditionally rejected.
 */
export async function verifyPassword(
  plainText: string,
  storedHash: string
): Promise<boolean> {
  if (!plainText || !storedHash) {
    return false;
  }

  const isProduction = process.env.NODE_ENV === "production";

  // 1. Synthetic development seed check
  // In local test environments seeded with Migration 004 or scripts/seed_demo_users.py,
  // the synthetic placeholder hash corresponds to 'SyntheticTestPassword123!' or DEMO_USER_PASSWORD.
  // CRITICAL SECURITY ENFORCEMENT: Synthetic fixtures are strictly rejected in production.
  if (storedHash === SYNTHETIC_SEED_HASH) {
    if (isProduction) {
      return false;
    }
    return plainText === getDemoPassword();
  }

  // In production, synthetic credentials must never match any production hash
  if (isProduction && (plainText === SYNTHETIC_SEED_PASSWORD || (process.env.DEMO_USER_PASSWORD && plainText === process.env.DEMO_USER_PASSWORD))) {
    return false;
  }

  // 2. Standard constant-time bcrypt verification
  try {
    return await bcrypt.compare(plainText, storedHash);
  } catch (err) {
    console.error("Password comparison error:", err);
    return false;
  }
}

/**
 * Hashes a plain text password with a high work factor (salt rounds = 12).
 */
export async function hashPassword(plainText: string): Promise<string> {
  if (!plainText || plainText.length < 8) {
    throw new Error("Password must be at least 8 characters long.");
  }
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(plainText, salt);
}


let timingEqualizationHash: Promise<string> | null = null;

/**
 * Performs a bcrypt comparison against a throwaway hash of the same cost factor.
 * Called when no account matches a login attempt so that unknown and known emails
 * take comparable time, preventing account enumeration through response timing.
 */
export async function consumePasswordVerificationTime(plainText: string): Promise<void> {
  if (!timingEqualizationHash) {
    timingEqualizationHash = bcrypt
      .genSalt(12)
      .then((salt) => bcrypt.hash(`timing-equalization-${Date.now()}-${Math.random()}`, salt));
  }
  try {
    await bcrypt.compare(plainText || "", await timingEqualizationHash);
  } catch {
    // Timing equalization is best-effort and never affects the authentication outcome.
  }
}

export const MIN_PASSWORD_LENGTH = 12;
// bcrypt only uses the first 72 bytes of a password; longer inputs would be silently truncated.
const MAX_PASSWORD_BYTES = 72;

/**
 * Password policy for self-service accounts. Returns a user-facing problem description, or null
 * when the password is acceptable.
 */
export function describePasswordProblem(password: string, context: { email?: string } = {}): string | null {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
    return "Use at most 72 bytes (roughly 72 characters).";
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Include at least one letter and one number.";
  }
  if (/^(.)\1+$/.test(password)) {
    return "Avoid repeating a single character.";
  }
  const localPart = context.email?.split("@")[0]?.toLowerCase();
  if (localPart && localPart.length >= 4 && password.toLowerCase().includes(localPart)) {
    return "Do not include your email address in your password.";
  }
  if (password === SYNTHETIC_SEED_PASSWORD) {
    return "Choose a different password.";
  }
  return null;
}
