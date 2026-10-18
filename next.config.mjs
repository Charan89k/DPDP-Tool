const isProduction = process.env.NODE_ENV === "production";

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
          // Content-Security-Policy is set per request by proxy.ts (script nonces).
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

