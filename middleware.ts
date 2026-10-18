/**
 * CloudE5 — Request middleware.
 *
 * CSRF defence in depth: the session cookie is SameSite=Lax, and in addition every state-changing
 * API request (POST, PUT, PATCH, DELETE) must carry an Origin (or, failing that, Referer) header
 * whose origin matches this site. Requests from other sites are rejected before reaching any
 * handler. Allowed origins: the request's own host, plus CLOUDE5_PUBLIC_URL when configured
 * (useful behind a reverse proxy that rewrites Host).
 *
 * Browsers cannot attach custom headers such as X-Forwarded-Host to cross-site form posts, and
 * cross-site fetches with custom headers fail CORS preflight, so honouring them here is safe.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function originOf(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function isSameOriginRequest(
  req: NextRequest,
  publicUrl: string | undefined = process.env.CLOUDE5_PUBLIC_URL
): boolean {
  const requestOrigin = originOf(req.headers.get("origin")) ?? originOf(req.headers.get("referer"));
  if (!requestOrigin) return false;

  const allowed = new Set<string>([req.nextUrl.origin]);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) {
    const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
    allowed.add(`${proto}://${host}`);
  }
  const configured = originOf(publicUrl);
  if (configured) allowed.add(configured);

  return allowed.has(requestOrigin);
}

export function middleware(req: NextRequest) {
  if (UNSAFE_METHODS.has(req.method) && !isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Cross-site request rejected." }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
