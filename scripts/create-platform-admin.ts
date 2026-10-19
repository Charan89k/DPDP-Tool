/**
 * CloudE5 — Create (or reset) the platform operator administrator.
 *
 *   npm run admin:create -- --email=admin@example.com --name="Platform Admin"
 *   npm run admin:create -- --email=admin@example.com --name="Platform Admin" --reset-password
 *
 * Password: taken from CLOUDE5_ADMIN_PASSWORD if set (min 14 characters); otherwise a strong
 * password is generated and written to a credentials file readable only by the current OS user
 * (default ./cloude5-admin-credentials.txt, override with --credentials-file). The password is
 * never printed. Delete the credentials file after the first sign-in.
 */

import fs from "node:fs";
import path from "node:path";
import { BootstrapError, createPlatformAdmin } from "../lib/admin/bootstrap.ts";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

async function main(): Promise<number> {
  const email = arg("email");
  const name = arg("name");
  if (!email || !name) {
    console.error('Usage: npm run admin:create -- --email=<email> --name="<full name>" [--reset-password]');
    return 2;
  }
  const credentialsFile = path.resolve(arg("credentials-file") || "cloude5-admin-credentials.txt");

  const result = await createPlatformAdmin({
    email,
    fullName: name,
    password: process.env.CLOUDE5_ADMIN_PASSWORD || undefined,
    resetPassword: process.argv.includes("--reset-password"),
  });

  if (result.status === "EXISTING") {
    console.log(`Administrator ${result.email} already exists; nothing changed (use --reset-password to reset).`);
    return 0;
  }
  console.log(`${result.status === "CREATED" ? "Created" : "Reset password for"} platform administrator ${result.email}.`);

  if (result.generatedPassword) {
    fs.writeFileSync(
      credentialsFile,
      `CloudE5 platform administrator\nEmail: ${result.email}\nPassword: ${result.generatedPassword}\n` +
        "Sign in, then delete this file.\n",
      { mode: 0o600 }
    );
    fs.chmodSync(credentialsFile, 0o600);
    console.log(`Generated password written to ${credentialsFile} (mode 0600). Delete it after first sign-in.`);
  } else {
    console.log("Password set from CLOUDE5_ADMIN_PASSWORD.");
  }
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err instanceof BootstrapError ? err.message : `Error: ${err.message}`);
    process.exit(1);
  });
