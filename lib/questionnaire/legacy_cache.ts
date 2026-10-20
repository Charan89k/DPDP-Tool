/**
 * CloudE5 — Removal of questionnaire answers cached in the browser by earlier versions.
 *
 * Answers used to be copied to localStorage, which survives sign-out and is readable by anyone
 * using the same browser profile. They are now kept only in memory and on the server; these
 * helpers delete any copies older versions left behind.
 */

export const LEGACY_RESPONSE_CACHE_PREFIX = "tli_dpdp_responses_";

/** Deletes every cached questionnaire answer set in this browser. Safe when storage is blocked. */
export function clearLegacyResponseCaches(): void {
  try {
    const keys = Object.keys(localStorage).filter((key) => key.startsWith(LEGACY_RESPONSE_CACHE_PREFIX));
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    // Storage unavailable (private window, blocked site data): nothing to remove.
  }
}
