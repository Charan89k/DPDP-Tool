const isProduction = process.env.NODE_ENV === "production";

// Next.js renders inline bootstrap scripts and style attributes, so 'unsafe-inline' is required for
// script-src/style-src without per-request nonces; everything else is restricted to this origin.
// The dev server additionally needs 'unsafe-eval' for fast refresh.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isProduction ? "" : " ws: wss:"}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Native SQLite driver and SMTP client run only on the Node.js server runtime.
  serverExternalPackages: ["better-sqlite3", "nodemailer"],
  // Self-contained server bundle for the Docker image (node .next/standalone/server.js).
  output: "standalone",
  // Never trace local development state (dev database, dev email outbox) into the server bundle.
  // Runtime files read from disk by the server (applied to the database at startup checks).
  outputFileTracingIncludes: {
    "*": ["migrations/sqlite/**"],
  },
  outputFileTracingExcludes: {
    "*": [".cloude5/**", ".test-db/**", ".local_evidence/**", "**/*.db", "**/*.db-wal", "**/*.db-shm"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          ...(isProduction
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;

