/**
 * Critical user journeys through the real UI: registration, email verification, onboarding,
 * starting an assessment, two-factor enrolment and two-factor sign-in, plus phone and tablet layout checks.
 */
import crypto from "node:crypto";
import zlib from "node:zlib";
import { expect, test, type Page } from "@playwright/test";
import { Secret, TOTP } from "otpauth";

const MAILPIT = process.env.E2E_MAILPIT_URL || "http://localhost:8025";
// Set E2E_EXPECT_VIRUS_SCANNER=1 when the installation runs ClamAV (CLOUDE5_CLAMAV_HOST).
const EXPECT_VIRUS_SCANNER = process.env.E2E_EXPECT_VIRUS_SCANNER === "1";

/** The industry-standard EICAR antivirus test string, assembled at runtime (it is harmless). */
function eicar(): Buffer {
  return Buffer.from(["X5O!P%@AP[4\\PZX54(P^)7CC)7}$", "EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"].join(""), "latin1");
}

/** Minimal stored (uncompressed) ZIP with one member: the shape of a .docx carrying a payload. */
function zipWith(name: string, data: Buffer): Buffer {
  const fileName = Buffer.from(name);
  const crc = zlib.crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(fileName.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(fileName.length, 28);
  const localSize = local.length + fileName.length + data.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + fileName.length, 12);
  end.writeUInt32LE(localSize, 16);
  return Buffer.concat([local, fileName, data, central, fileName, end]);
}

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

  // Evidence upload with the signed-in session (same-origin, as the evidence page sends it).
  const assessmentId = page.url().match(/assessments\/([^/]+)\/questionnaire/)![1];
  const upload = (name: string, mimeType: string, buffer: Buffer) =>
    page.request.post("/api/evidence/upload", {
      headers: { Origin: new URL(page.url()).origin },
      multipart: { file: { name, mimeType, buffer }, assessmentId, controlCode: "GENERIC" },
    });

  // Answers are validated by schema: malformed payloads are refused with 400, never a server error.
  const saveAnswers = (responses: unknown) =>
    page.request.put(`/api/assessments/${assessmentId}/responses`, {
      headers: { Origin: new URL(page.url()).origin },
      data: { responses },
    });
  expect((await saveAnswers({ "GOV-001": { selectedOption: "Implemented", commentsAndJustification: 42 } })).status()).toBe(400);
  expect((await saveAnswers({ "GOV-001": { selectedOption: "Definitely" } })).status()).toBe(400);
  expect((await saveAnswers({ "<script>": { selectedOption: "Implemented" } })).status()).toBe(400);
  expect((await saveAnswers({ "GOV-001": { selectedOption: "Not applicable — justification required" } })).status()).toBe(400);
  const saved = await saveAnswers({ "GOV-001": { selectedOption: "Implemented", commentsAndJustification: "Policy approved" } });
  expect(saved.status(), await saved.text()).toBe(200);

  // The summary reads the scoring engine's output: one Implemented answer gives a non-zero readiness.
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));
  await page.goto(`/dashboard/assessments/${assessmentId}/summary`);
  await expect(page.getByText("Indicative Readiness Score")).toBeVisible();
  await expect(page.getByText("100.0%").first()).toBeVisible();
  await expect(page.getByText("Maturity 5.00/5.0")).toBeVisible();
  expect(pageErrors).toEqual([]);

  const clean = await upload("privacy-policy.pdf", "application/pdf", Buffer.from(`%PDF-1.7\nPrivacy policy\n${"A".repeat(300)}\n%%EOF`));
  expect(clean.status(), await clean.text()).toBe(201);

  if (EXPECT_VIRUS_SCANNER) {
    const docx = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const infected = await upload("policy.docx", docx, zipWith("word/eicar.com", eicar()));
    expect(infected.status()).toBe(400);
    expect((await infected.json()).error).toMatch(/virus scanner/i);
  }
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

/** How far content in the workspace reaches past the screen, ignoring tables that scroll sideways on purpose. */
async function workspaceOverflow(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const main = document.getElementById("main-content");
    if (!main) return ["no #main-content"];
    const edge = main.getBoundingClientRect().right;
    const problems: string[] = [];
    if (main.scrollWidth > main.clientWidth) problems.push(`main scrolls sideways by ${main.scrollWidth - main.clientWidth}px`);
    for (const el of main.querySelectorAll<HTMLElement>("*")) {
      const box = el.getBoundingClientRect();
      if (!box.width || (box.right <= edge + 1 && box.left >= -1)) continue;
      let scrolls = false;
      for (let p = el.parentElement; p && p !== main; p = p.parentElement) {
        if (/(auto|scroll)/.test(getComputedStyle(p).overflowX)) scrolls = true;
      }
      if (!scrolls) problems.push(`${el.tagName.toLowerCase()} "${(el.innerText || "").trim().slice(0, 40)}" ends at ${Math.round(box.right)}px`);
    }
    return problems.slice(0, 5);
  });
}

test("the assessment workspace fits phone and tablet screens @mobile", async ({ page }) => {
  const account = newAccount();
  await registerAndVerify(page, account);
  await signIn(page, account.email, account.password);
  await expect(page).toHaveURL(/\/dashboard\/onboarding/);
  await page.getByText("No", { exact: true }).click();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page.getByRole("button", { name: "Start assessment" }).click();
  await expect(page).toHaveURL(/\/dashboard\/assessments\/[^/]+\/questionnaire/, { timeout: 30_000 });
  const assessmentId = page.url().match(/assessments\/([^/]+)\/questionnaire/)![1];

  // The navigation is a drawer on small screens.
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.locator("#app-sidebar").getByRole("link", { name: "Reports" })).toBeInViewport();
  await page.keyboard.press("Escape");

  const pages = [
    "/dashboard",
    "/dashboard/assessments",
    `/dashboard/assessments/${assessmentId}/questionnaire`,
    `/dashboard/assessments/${assessmentId}/summary`,
    `/dashboard/assessments/${assessmentId}/gaps`,
    `/dashboard/assessments/${assessmentId}/remediation`,
    `/dashboard/assessments/${assessmentId}/evidence`,
    "/dashboard/reports",
    "/dashboard/settings",
  ];
  for (const path of pages) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(await workspaceOverflow(page), `${path} fits the screen`).toEqual([]);
  }
});
