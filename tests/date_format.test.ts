import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatDate, formatDateTime, formatTime } from "../lib/format/dates.ts";

describe("display dates", () => {
  it("formats in India time regardless of the runtime time zone", () => {
    // 20:00 UTC on 18 Oct is 01:30 IST on 19 Oct.
    assert.equal(formatDate("2026-10-18T20:00:00Z"), "19 Oct 2026");
    assert.match(formatDateTime("2026-10-18T20:00:00Z"), /^19 Oct 2026, 1:30\sam$/);
    assert.match(formatTime("2026-10-18T20:00:00Z"), /^1:30\sam$/);
  });

  it("returns an empty string for missing or invalid values", () => {
    assert.equal(formatDate(null), "");
    assert.equal(formatDate(""), "");
    assert.equal(formatDateTime("not a date"), "");
  });
});
