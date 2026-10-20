/**
 * CloudE5 — Regression tests for the October 2026 security review findings.
 *
 * Canonical question codes, audit-record integrity, engagement-lead sign-off, the review-time
 * evidence freeze, read-only clarification access for viewers, sign-out-everywhere from a revoked
 * session, the shared login rate-limit counter, SMTP encryption and owner-only backups.
 */

import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { pool } from "../lib/db/pool.ts";
import { executeWithRls } from "../lib/db/rls.ts";
import { executeAssessmentTransition } from "../lib/lifecycle/service.ts";
import { EvidenceVaultService } from "../lib/storage/service.ts";
import { revokeAllSessions, revokeSession } from "../lib/auth/account.ts";
import { PersistentRateLimiter } from "../lib/auth/rate_limit.ts";
import { smtpAllowsPlaintext } from "../lib/email/mailer.ts";
import { backupDatabase, MigrationError } from "../lib/db/sqlite/migrate.ts";
import {
  CANONICAL_QUESTION_COUNT,
  countCanonicalQuestions,
  toCanonicalQuestionCode,
} from "../lib/questionnaire/codes.ts";
import type { SessionUser } from "../lib/auth/types.ts";

const TLI_TENANT = "018f3a5b-7c8d-7e90-8000-000000000001";
const ALPHA_TENANT = "018f3a5b-7c8d-7e90-8000-000000000002";
const ALPHA_ASSESSMENT = "018f3a5b-7c8d-7e90-8000-000000000201";
const BETA_ASSESSMENT = "018f3a5b-7c8d-7e90-8000-000000000202";

const session = (userId: string, role: SessionUser["role"], tenantId: string): SessionUser => ({
  userId,
  email: `${userId}@example.test`,
  fullName: "Test User",
  role,
  tenantId,
  tenantName: "Test",
  tenantSlug: "test",
  tenantType: tenantId === TLI_TENANT ? "TLI" : "CLIENT",
  isSdf: false,
});

const LEAD = session("018f3a5b-7c8d-7e90-8000-000000000102", "TLI_LEAD_CONSULTANT", TLI_TENANT);
const ALPHA_ADMIN = session("018f3a5b-7c8d-7e90-8000-000000000111", "CLIENT_ADMIN", ALPHA_TENANT);
const ALPHA_VIEWER = session("018f3a5b-7c8d-7e90-8000-000000000114", "CLIENT_VIEWER", ALPHA_TENANT);

const setStatus = (status: string) =>
  pool.query("UPDATE assessments SET status = $1 WHERE id = $2;", [status, ALPHA_ASSESSMENT]);

function pdf(): Buffer {
  return Buffer.from(
    "%PDF-1.4\n1 0 obj\n<< /Title (Review freeze) >>\nendobj\nxref\n0 1\n0000000000 65535 f \ntrailer\n<< /Size 1 >>\nstartxref\n90\n%%EOF\n",
    "utf-8"
  );
}

describe("Security review regressions", () => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "cloude5-security-"));
  after(() => fs.rmSync(workDir, { recursive: true, force: true }));

  it("recognises only the canonical question codes", () => {
    assert.equal(CANONICAL_QUESTION_COUNT, 60);
    assert.equal(toCanonicalQuestionCode("gov-01"), "GOV-001");
    assert.equal(toCanonicalQuestionCode("FAKE-001"), null);
    assert.equal(countCanonicalQuestions(["GOV-001", "GOV-01", "XYZ-999", "Q1"]), 1);
  });

  it("does not let invented question codes complete a submission", async () => {
    for (let i = 1; i <= 60; i++) {
      await pool.query(
        `INSERT INTO assessment_questionnaire_responses (assessment_id, tenant_id, question_code, selected_option)
         VALUES ($1, $2, $3, 'Implemented');`,
        [ALPHA_ASSESSMENT, ALPHA_TENANT, `FAK-${String(i).padStart(3, "0")}`]
      );
    }
    await assert.rejects(
      executeAssessmentTransition(ALPHA_ADMIN, ALPHA_ASSESSMENT, { targetStatus: "SUBMITTED_FOR_REVIEW" }),
      /Only 0 of 60 canonical questions answered/
    );
  });

  it("records server facts in the audit log even if caller metadata names the same fields", async () => {
    await executeAssessmentTransition(LEAD, BETA_ASSESSMENT, {
      targetStatus: "SCOPING",
      metadata: { status: "FINAL_ISSUED", actorRole: "TLI_SUPER_ADMIN", note: "kept" },
    });
    const row = (
      await pool.query(
        `SELECT new_state FROM audit_logs WHERE entity_id = $1 AND action = 'ASSESSMENT_STATE_TRANSITION'
         ORDER BY timestamp DESC LIMIT 1;`,
        [BETA_ASSESSMENT]
      )
    ).rows[0];
    const state = typeof row.new_state === "string" ? JSON.parse(row.new_state) : row.new_state;
    assert.equal(state.status, "SCOPING");
    assert.equal(state.actorRole, "TLI_LEAD_CONSULTANT");
    assert.equal(state.note, "kept");
  });

  it("allows lead sign-off only to the engagement lead, not to a lead consultant assigned as reviewer", async () => {
    const otherLeadId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, 'x', 'Second Lead', 'TLI_LEAD_CONSULTANT', TRUE);`,
      [otherLeadId, TLI_TENANT, `second.lead.${otherLeadId}@example.test`]
    );
    await pool.query(
      `INSERT INTO assessment_assignments (assessment_id, user_id, assignment_role) VALUES ($1, $2, 'REVIEWER');`,
      [ALPHA_ASSESSMENT, otherLeadId]
    );
    await setStatus("DRAFT_REPORT_GENERATED");
    await assert.rejects(
      executeAssessmentTransition(session(otherLeadId, "TLI_LEAD_CONSULTANT", TLI_TENANT), ALPHA_ASSESSMENT, {
        targetStatus: "LEAD_APPROVED",
      }),
      /Engagement lead required/
    );
  });

  it("freezes customer evidence changes during review but allows them for clarifications", async () => {
    const vault = new EvidenceVaultService(undefined, undefined, undefined, null);
    const upload = () =>
      vault.uploadEvidence({
        sessionUser: ALPHA_ADMIN,
        assessmentId: ALPHA_ASSESSMENT,
        questionCode: "SEC-001",
        filename: "policy.pdf",
        mimeType: "application/pdf",
        content: pdf(),
      });

    await setStatus("UNDER_REVIEW");
    await assert.rejects(upload(), /Evidence cannot be changed while the assessment is UNDER_REVIEW/);

    await setStatus("CLARIFICATION_PENDING");
    const record = await upload();
    assert.ok(record.id);

    await setStatus("REVIEW_COMPLETED");
    await assert.rejects(
      vault.deleteEvidence({ sessionUser: ALPHA_ADMIN, evidenceId: record.id }),
      /Evidence cannot be changed while the assessment is REVIEW_COMPLETED/
    );
  });

  it("gives executive viewers read-only access to clarification threads", async () => {
    await setStatus("UNDER_REVIEW");
    const raise = (user: SessionUser) =>
      executeWithRls(user, (client) =>
        client.query(
          `INSERT INTO clarification_threads (assessment_id, question_code, raised_by_user_id, title, status)
           VALUES ($1, 'SEC-001', $2, 'Question', 'OPEN') RETURNING id;`,
          [ALPHA_ASSESSMENT, user.userId]
        )
      );
    await assert.rejects(raise(ALPHA_VIEWER));
    const thread = (await raise(ALPHA_ADMIN)).rows[0];
    await assert.rejects(
      executeWithRls(ALPHA_VIEWER, (client) =>
        client.query(
          "INSERT INTO clarification_messages (thread_id, author_user_id, message_text) VALUES ($1, $2, 'hi');",
          [thread.id, ALPHA_VIEWER.userId]
        )
      )
    );
    const visible = await executeWithRls(ALPHA_VIEWER, (client) =>
      client.query("SELECT id FROM clarification_threads WHERE id = $1;", [thread.id])
    );
    assert.equal(visible.rows.length, 1, "Viewers can still read threads");
  });

  it("refuses sign-out-everywhere from a session that was already signed out", async () => {
    const versionOf = async () =>
      Number(
        (await pool.query("SELECT session_version FROM users WHERE id = $1;", [ALPHA_VIEWER.userId])).rows[0]
          .session_version
      );
    const before = await versionOf();
    const stale = { ...ALPHA_VIEWER, sessionVersion: before, sessionId: crypto.randomUUID() };
    await revokeSession(stale);
    await assert.rejects(revokeAllSessions(stale), /signed out/);
    assert.equal(await versionOf(), before, "Newer sessions stay valid");
  });

  it("keeps failures against other accounts counted after a successful sign-in from the same address", async () => {
    const limiter = new PersistentRateLimiter(`security-test-${crypto.randomUUID()}`, 5, 900);
    const ip = "ip:203.0.113.7";
    for (let i = 0; i < 4; i++) await limiter.hit(ip);
    await limiter.hit(ip);
    await limiter.refundAttempt(ip); // the successful sign-in
    assert.equal((await limiter.hit(ip)).limited, false, "Fifth attempt is allowed");
    assert.equal((await limiter.hit(ip)).limited, true, "Earlier failures were not wiped");
  });

  it("requires encrypted SMTP except for a local mail catcher", () => {
    assert.equal(smtpAllowsPlaintext({ SMTP_HOST: "smtp-relay.brevo.com" }), false);
    assert.equal(smtpAllowsPlaintext({ SMTP_HOST: "mailpit" }), true);
    assert.equal(smtpAllowsPlaintext({ SMTP_HOST: "localhost" }), true);
    assert.equal(smtpAllowsPlaintext({ SMTP_HOST: "relay.internal", SMTP_ALLOW_PLAINTEXT: "true" }), true);
  });

  it("creates backups owner-only from the start and never overwrites an existing file", async () => {
    const db = new Database(":memory:");
    db.exec("CREATE TABLE t (x); INSERT INTO t VALUES (1);");
    const target = path.join(workDir, "backup.db");
    await backupDatabase(db, target);
    assert.equal(fs.statSync(target).mode & 0o777, 0o600);
    await assert.rejects(backupDatabase(db, target), (err: unknown) => err instanceof MigrationError);
    db.close();
  });
});
