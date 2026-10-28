/**
 * CloudE5 — customer accounts use work email addresses, and the onboarding profile validates the
 * organisation type, team size and company contact details.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isWorkEmail, workEmailSchema } from "../lib/auth/work_email.ts";
import { organizationProfileSchema } from "../lib/organization/profile.ts";

describe("work email rule", () => {
  it("refuses free personal mailbox providers, case-insensitively", () => {
    for (const email of ["someone@gmail.com", "Someone@GMAIL.com", "a@yahoo.co.in", "b@outlook.com", "c@rediffmail.com"]) {
      assert.equal(isWorkEmail(email), false, email);
      assert.equal(workEmailSchema.safeParse(email).success, false, email);
    }
  });

  it("accepts company domains", () => {
    assert.equal(isWorkEmail("priya@acme.co.in"), true);
    assert.equal(workEmailSchema.safeParse(" priya@acme.co.in ").success, true);
  });
});

describe("organisation profile", () => {
  const base = { name: "Acme India", isSdf: false };

  it("stores a typed-in organisation type and the company contact details", () => {
    const parsed = organizationProfileSchema.parse({
      ...base,
      industry: "Agritech",
      teamSize: "51-200",
      contactPhone: "+91 98765 43210",
      contactEmail: "info@acme.co.in",
      website: "",
      address: "Pune",
    });
    assert.equal(parsed.industry, "Agritech");
    assert.equal(parsed.teamSize, "51-200");
    assert.equal(parsed.website, null);
  });

  it("refuses a personal company email, an unknown team size and a malformed phone number", () => {
    assert.equal(organizationProfileSchema.safeParse({ ...base, contactEmail: "acme@gmail.com" }).success, false);
    assert.equal(organizationProfileSchema.safeParse({ ...base, teamSize: "lots" }).success, false);
    assert.equal(organizationProfileSchema.safeParse({ ...base, contactPhone: "call me" }).success, false);
  });
});
