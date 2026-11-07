/**
 * TLI — Content Security Policy.
 *
 * Pages get a fresh nonce per request (set by proxy.ts). Next.js reads the nonce from the request's
 * Content-Security-Policy header and adds it to every script it renders, so scripts run only when
 * they carry the nonce or are loaded by one ('strict-dynamic'); injected inline scripts are blocked.
 * Inline style attributes stay allowed ('unsafe-inline' in style-src) because React renders them.
 * The development server additionally needs 'unsafe-eval' and WebSocket connections for hot reload.
 */

export function buildContentSecurityPolicy(nonce: string, isProduction: boolean): string {
  return [
    "default-src 'self'",
    // checkout.razorpay.com: Razorpay Checkout, loaded by a nonce-trusted script on the report page.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://checkout.razorpay.com${isProduction ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // Razorpay Checkout's script calls its API and telemetry endpoints from the page itself.
    `connect-src 'self'${isProduction ? "" : " ws: wss:"} https://api.razorpay.com https://lumberjack.razorpay.com`,
    // Razorpay Checkout renders its payment form in an iframe served from these origins.
    "frame-src https://api.razorpay.com https://checkout.razorpay.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** API responses are data, never documents: nothing may load or frame them. */
export const API_CONTENT_SECURITY_POLICY = "default-src 'none'; frame-ancestors 'none'";

/** A 128-bit random nonce, base64-encoded. */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
