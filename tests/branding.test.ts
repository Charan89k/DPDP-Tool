/**
 * TLI — Branding regression tests: the product is Truth Labs International (TLI).
 *
 * Technical identifiers that keep the former name on purpose, because renaming them would break
 * running installations: CLOUDE5_* environment variables, the .cloude5/ data directory and
 * cloude5.db file, MFA key-derivation labels (changing them would invalidate enrolled
 * authenticators), the "CloudE5-App" audit fallback user agent, and the cloude5.tech domain.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOTS = ["app", "components", "lib"];
const OLD_BRAND = /CloudE5(?!-App)/;

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(tsx?|svg|css)$/.test(entry.name) ? [full] : [];
  });
}

describe("Truth Labs International branding", () => {
  it("leaves no CloudE5 brand text in the application source", () => {
    const offenders = ROOTS.flatMap(sourceFiles).flatMap((file) =>
      fs
        .readFileSync(file, "utf8")
        .split("\n")
        .map((line, i) => ({ file, line: i + 1, text: line }))
        .filter(({ text }) => OLD_BRAND.test(text))
    );
    assert.deepEqual(offenders, [], offenders.map((o) => `${o.file}:${o.line}`).join("\n"));
  });

  it("names Truth Labs International in page metadata, emails and the brand mark", () => {
    assert.match(fs.readFileSync("app/layout.tsx", "utf8"), /Truth Labs International/);
    assert.match(fs.readFileSync("lib/email/templates.ts", "utf8"), /const BRAND = "Truth Labs International"/);
    const mark = fs.readFileSync("components/ui/brand-mark.tsx", "utf8");
    assert.match(mark, /aria-label="Truth Labs International"/);
    assert.match(mark, />TLI</);
  });

  it("keeps the MFA key-derivation labels unchanged so enrolled authenticators keep working", () => {
    const mfa = fs.readFileSync("lib/auth/mfa.ts", "utf8");
    assert.match(mfa, /"cloude5:mfa-secret-encryption:v1"/);
    assert.match(mfa, /"cloude5:mfa-recovery-codes:v1"/);
  });
});
