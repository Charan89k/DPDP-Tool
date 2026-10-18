/**
 * CloudE5 browser tests (Playwright). They run against a running installation, not a dev server:
 *
 *   docker compose --profile mail up -d          # app + Mailpit (SMTP_HOST=mailpit, SMTP_PORT=1025)
 *   E2E_BASE_URL=https://your-host npm run test:e2e
 *
 * E2E_MAILPIT_URL (default http://localhost:8025) is where verification emails are read from.
 * E2E_EXPECT_VIRUS_SCANNER=1 also checks that ClamAV rejects an EICAR test file.
 * Each run registers two throwaway organisations on example.com addresses. Account emails are rate
 * limited per IP (5 per 15 minutes), so back-to-back runs from one machine can see "Too many requests".
 */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, grepInvert: /@mobile/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
});
