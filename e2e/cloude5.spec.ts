/**
 * Critical user journeys through the real UI: registration, email verification, onboarding,
 * starting an assessment, two-factor enrolment and two-factor sign-in, plus a phone-width check.
 */
import crypto from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { Secret, TOTP } from "otpauth";

const MAILPIT = process.env.E2E_MAILPIT_URL || "http://localhost:8025";

function newAccount() {
  return {
    name: "E2E Test Owner",
    email: `e2e+${Date.now()}-${crypto.randomBytes(3).toString("hex")}@example.com`,
    password: `${crypto.randomBytes(12).toString("base64url")}a1`,
    organisation: `E2E Org ${Date.now()}`,
  };
}

async function verificationLink(email: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const search = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    const { messages } = (await search.json()) as { messages?: { ID: string }[] };
    if (messages?.length) {
      const message = (await (await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json()) as { Text: string };
      const link = message.Text.match(/https?:\/\/\S*verify-email\?token=[A-Za-z0-9_-]+/)?.[0];
      if (link) return link;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No verification email for ${email}`);
}

async function registerAndVerify(page: Page, account: ReturnType<typeof newAccount>) {
  await page.goto("/register");
  await page.getByLabel("Your full name").fill(account.name);
  await page.getByLabel("Work email").fill(account.email);
  await page.getByLabel("Organisation name").fill(account.organisation);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(/check your email|verification/i).first()).toBeVisible();

  // The emailed link must point at this installation's public URL.
  const link = await verificationLink(account.email);
  expect(new URL(link).origin).toBe(new URL(page.url()).origin);
  await page.goto(link);
  await expect(page.getByText(/verified/i).first()).toBeVisible();
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Work email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("register, verify, onboard and start an assessment", async ({ page }) => {
  const account = newAccount();
  await registerAndVerify(page, account);

  await signIn(page, account.email, account.password);
  await expect(page).toHaveURL(/\/dashboard\/onboarding/);
  await expect(page.getByRole("heading", { name: "Set up your CloudE5 workspace" })).toBeVisible();

  await page.getByText("No", { exact: true }).click();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByRole("heading", { name: "Start your first assessment" })).toBeVisible();
  await page.getByRole("button", { name: "Start assessment" }).click();
  await expect(page).toHaveURL(/\/dashboard\/assessments\/[^/]+\/questionnaire/, { timeout: 30_000 });
});

test("two-factor enrolment and sign-in with an authenticator code", async ({ page }) => {
  const account = newAccount();
  await registerAndVerify(page, account);
  await signIn(page, account.email, account.password);
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/dashboard/settings");
  await page.getByRole("button", { name: "Set up two-factor" }).click();
  const manualKey = (await page.locator("code").first().innerText()).replace(/\s/g, "");
  const totp = new TOTP({ secret: Secret.fromBase32(manualKey) });
  await page.locator("#mfa-code").fill(totp.generate());
  await page.getByRole("button", { name: "Turn on" }).click();
  await expect(page.getByText("Save your recovery codes now")).toBeVisible();

  // Without the session cookie, sign-in now needs the second factor.
  await page.context().clearCookies();
  await signIn(page, account.email, account.password);
  await expect(page.getByRole("heading", { name: "Two-factor verification" })).toBeVisible();

  await page.locator("#mfa-code").fill("000000");
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await expect(page.getByRole("alert").first()).toBeVisible();

  // A code's time step can be used once, so wait for the next step before entering a fresh code.
  const remaining = 30 - (Math.floor(Date.now() / 1000) % 30);
  await page.waitForTimeout((remaining + 1) * 1000);
  await page.locator("#mfa-code").fill(totp.generate());
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});

test("landing and sign-in pages fit a phone screen @mobile", async ({ page }) => {
  for (const path of ["/", "/login", "/register"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} scrolls horizontally`).toBeLessThanOrEqual(0);
  }
});
