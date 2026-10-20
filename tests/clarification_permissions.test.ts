import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { ALL_ROLES, canWriteClarifications } from "../lib/auth/rbac.ts";
import type { SessionUser, UserRole } from "../lib/auth/types.ts";
import { pool } from "../lib/db/pool.ts";
import { executeWithRls } from "../lib/db/rls.ts";

const ASSESSMENT_ID = "018f3a5b-7c8d-7e90-8000-000000000201";
const THREAD_IDS = [
  "018f3a5b-7c8d-7e90-8000-000000000451", // Control-linked thread
  "018f3a5b-7c8d-7e90-8000-000000000511", // Question-linked thread
];

function fixtureUser(suffix: string, role: UserRole, tli = false): SessionUser {
  return {
    userId: `018f3a5b-7c8d-7e90-8000-000000000${suffix}`,
    role,
    tenantId: `018f3a5b-7c8d-7e90-8000-00000000000${tli ? "1" : "2"}`,
    email: "fixture@example.test",
    fullName: "Synthetic fixture user",
    tenantName: tli ? "Truth Labs International" : "Alpha Healthcare",
    tenantSlug: tli ? "truth-labs-advisory" : "alpha-healthcare",
    tenantType: tli ? "TLI" : "CLIENT",
    isSdf: !tli,
  };
}

const VIEWER = fixtureUser("114", "CLIENT_VIEWER");
const WRITERS = [
  fixtureUser("101", "TLI_SUPER_ADMIN", true),
  fixtureUser("102", "TLI_LEAD_CONSULTANT", true),
  fixtureUser("103", "TLI_REVIEWER", true),
  fixtureUser("111", "CLIENT_ADMIN"),
  fixtureUser("112", "CLIENT_BU_LEAD"),
  fixtureUser("113", "CLIENT_CONTRIBUTOR"),
];

describe("Clarification write permissions", () => {
  after(async () => { await pool.end(); });

  it("allows the existing writer roles and denies viewers and unknown roles", () => {
    for (const role of ALL_ROLES) {
      assert.equal(canWriteClarifications(role), WRITERS.some((user) => user.role === role), role);
    }
    assert.equal(canWriteClarifications("UNKNOWN" as UserRole), false);
  });

  for (const threadId of THREAD_IDS) {
    it(`preserves viewer reads but blocks every database write for ${threadId}`, async () => {
      const original = await executeWithRls(VIEWER, async (client) => {
        const thread = (await client.query("SELECT * FROM clarification_threads WHERE id = $1", [threadId])).rows[0];
        const messages = (await client.query("SELECT * FROM clarification_messages WHERE thread_id = $1 ORDER BY id", [threadId])).rows;
        assert.ok(thread, "Viewer must still see the thread");
        assert.ok(messages.length, "Viewer must still see its messages");
        return { thread, messages };
      });

      await assert.rejects(executeWithRls(VIEWER, (client) => client.query(
        "INSERT INTO clarification_threads (assessment_id, assessment_control_id, question_code, raised_by_user_id, title) VALUES ($1, $2, $3, $4, 'Forbidden thread')",
        [original.thread.assessment_id, original.thread.assessment_control_id, original.thread.question_code, VIEWER.userId]
      )), /row-level security/);
      await assert.rejects(executeWithRls(VIEWER, (client) => client.query(
        "INSERT INTO clarification_messages (thread_id, author_user_id, message_text) VALUES ($1, $2, 'Forbidden reply')",
        [threadId, VIEWER.userId]
      )), /row-level security/);

      // Updates and deletes outside the write policy silently affect no rows, like RLS.
      await executeWithRls(VIEWER, async (client) => {
        assert.equal((await client.query("UPDATE clarification_threads SET status = 'RESOLVED', resolved_at = CURRENT_TIMESTAMP WHERE id = $1", [threadId])).rowCount, 0);
        assert.equal((await client.query("UPDATE clarification_messages SET message_text = 'Forbidden edit' WHERE thread_id = $1", [threadId])).rowCount, 0);
        assert.equal((await client.query("DELETE FROM clarification_messages WHERE thread_id = $1", [threadId])).rowCount, 0);
        assert.equal((await client.query("DELETE FROM clarification_threads WHERE id = $1", [threadId])).rowCount, 0);
      });

      const unchanged = await executeWithRls(VIEWER, async (client) => ({
        thread: (await client.query("SELECT * FROM clarification_threads WHERE id = $1", [threadId])).rows[0],
        messages: (await client.query("SELECT * FROM clarification_messages WHERE thread_id = $1 ORDER BY id", [threadId])).rows,
      }));
      assert.deepEqual(unchanged, original);
    });
  }

  for (const writer of WRITERS) {
    it(`preserves thread creation, replies and status updates for ${writer.role}`, async () => {
      await executeWithRls(writer, async (client) => {
        const thread = (await client.query(
          "INSERT INTO clarification_threads (assessment_id, question_code, raised_by_user_id, title) VALUES ($1, 'GOV-01', $2, 'Allowed clarification') RETURNING id",
          [ASSESSMENT_ID, writer.userId]
        )).rows[0];
        assert.ok(thread.id);
        const message = await client.query(
          "INSERT INTO clarification_messages (thread_id, author_user_id, message_text) VALUES ($1, $2, 'Allowed reply') RETURNING id",
          [thread.id, writer.userId]
        );
        assert.equal(message.rowCount, 1);
        assert.equal((await client.query("UPDATE clarification_threads SET status = 'RESOLVED' WHERE id = $1 RETURNING status", [thread.id])).rows[0].status, "RESOLVED");
      });
    });
  }

  it("continues to deny writes outside the user's tenant or engagement assignment", async () => {
    const betaAdmin = { ...fixtureUser("121", "CLIENT_ADMIN"), tenantId: "018f3a5b-7c8d-7e90-8000-000000000003" };
    const reviewer = WRITERS.find((user) => user.role === "TLI_REVIEWER")!;
    const unassignedId = (await pool.query(
      "INSERT INTO users (tenant_id, email, password_hash, full_name, role) VALUES ($1, 'unassigned.clarifications@example.test', 'fixture-only', 'Unassigned reviewer', 'TLI_REVIEWER') RETURNING id",
      [reviewer.tenantId]
    )).rows[0].id;
    const unassignedReviewer = { ...reviewer, userId: unassignedId };

    for (const user of [betaAdmin, unassignedReviewer]) {
      await assert.rejects(executeWithRls(user, (client) => client.query(
        "INSERT INTO clarification_threads (assessment_id, raised_by_user_id, title) VALUES ($1, $2, 'Out of scope')",
        [ASSESSMENT_ID, user.userId]
      )), /row-level security/);
      await assert.rejects(executeWithRls(user, (client) => client.query(
        "INSERT INTO clarification_messages (thread_id, author_user_id, message_text) VALUES ($1, $2, 'Out of scope')",
        [THREAD_IDS[0], user.userId]
      )), /row-level security/);
      assert.equal(await executeWithRls(user, async (client) => (
        await client.query("UPDATE clarification_threads SET status = 'RESOLVED' WHERE id = $1", [THREAD_IDS[0]])
      ).rowCount), 0);
    }
  });
});
