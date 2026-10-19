/**
 * CloudE5 — Password Security Module
 *
 * Implements secure password verification and hashing using bcryptjs.
 */

import bcrypt from "bcryptjs";

// Publicly known passwords (the former demo password is in this repository's history).
const PUBLICLY_KNOWN_PASSWORDS = new Set(["SyntheticTestPassword123!"]);

/**
 * Verifies a plain text password against a stored bcrypt hash (constant time).
 * Fails closed on empty values and on anything that is not a valid bcrypt hash.
 */
export async function verifyPassword(plainText: string, storedHash: string): Promise<boolean> {
  if (!plainText || !storedHash) {
    return false;
  }
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
  if (PUBLICLY_KNOWN_PASSWORDS.has(password)) {
    return "Choose a different password.";
  }
  return null;
}
