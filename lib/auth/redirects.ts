/**
 * CloudE5 — Safe Redirect Handler
 *
 * Prevents Open Redirect vulnerabilities (CWE-601) by strictly validating
 * target redirect paths. Rejects external schemes, protocol-relative URLs,
 * and malicious path traversal characters.
 */

export function getSafeRedirectUrl(
  target: string | null | undefined,
  fallback: string = "/dashboard"
): string {
  if (!target || typeof target !== "string") {
    return fallback;
  }

  const trimmed = target.trim();

  // Must begin with a single forward slash
  if (!trimmed.startsWith("/")) {
    return fallback;
  }

  // Reject any backslash characters anywhere in the path to defeat Windows/browser parser discrepancies
  if (trimmed.includes("\\")) {
    return fallback;
  }

  // Reject protocol-relative URLs (e.g., //evil.com)
  if (trimmed.startsWith("//")) {
    return fallback;
  }

  // Reject URLs containing control characters or newlines
  if (/[\r\n\t\0]/.test(trimmed)) {
    return fallback;
  }

  // Disallow javascript:, data:, or any custom scheme prefix
  if (/[a-zA-Z0-9_-]+:/.test(trimmed)) {
    return fallback;
  }

  return trimmed;
}

