/**
 * TLI — Compliance-gap remediation requests, proposals and engagements.
 *
 * A customer selects gaps from their paid report and asks for help; TLI reviews, asks questions,
 * prepares versioned proposals (frozen once sent), and on acceptance starts an engagement that
 * creates one corrective-action task per gap in the existing remediation (CAPA) module. Accepting a
 * proposal never closes a gap: a gap is closed only when a TLI assessor validates its task through
 * validateRemediationClosure. No payment is ever taken here.
 */

import crypto from "node:crypto";
import { pool } from "../db/pool.ts";
import type { PoolClient } from "../db/pool.ts";
import { executeWithRls } from "../db/rls.ts";
import type { SessionUser } from "../auth/types.ts";
import { isTliRole } from "../auth/rbac.ts";
import { inSystemTransaction } from "../payments/records.ts";
import { assertFindingsAccess } from "../payments/access.ts";
import { writeAudit } from "../audit/log.ts";
import { getAssessmentGapAnalysis } from "../gaps/index.ts";
import { queueNotifications } from "../notifications/queue.ts";
import { FileValidator } from "../storage/validation.ts";
import { MalwareDetectedError, getConfiguredScanner } from "../storage/malware_scanner.ts";
import { getLocalStorageAdapter } from "../storage/local_adapter.ts";

export class RemediationRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "RemediationRequestError";
    this.status = status;
  }
}

export type RequestStatus =
  | "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "CLARIFICATION_REQUIRED" | "PROPOSAL_PREPARED" | "PROPOSAL_SENT"
  | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "DECLINED" | "CANCELLED";

const CLIENT_WRITERS = ["CLIENT_ADMIN", "CLIENT_BU_LEAD", "CLIENT_CONTRIBUTOR"];
const PROPOSAL_AUTHORS = ["TLI_SUPER_ADMIN", "TLI_LEAD_CONSULTANT"];
const CLOSED: RequestStatus[] = ["COMPLETED", "DECLINED", "CANCELLED"];
const PRIORITY: Record<string, string> = { CRITICAL_GAP: "CRITICAL", HIGH_DEFICIT: "HIGH", MEDIUM_DEFICIT: "MEDIUM", LOW_DEFICIT: "LOW", INFORMATIONAL: "INFORMATIONAL" };

interface RequestRow {
  id: string;
  tenant_id: string;
  assessment_id: string;
  requested_by_user_id: string;
  assigned_assessor_id: string | null;
  status: RequestStatus;
  accepted_proposal_id: string | null;
}

const fail = (message: string, status: number): never => {
  throw new RemediationRequestError(message, status);
};

/** Loads a request through the tenant policy layer (invisible means not found). */
async function visibleRequest(session: SessionUser, id: string): Promise<RequestRow> {
  const row = await executeWithRls(session, async (c) => (await c.query<RequestRow>("SELECT * FROM remediation_requests WHERE id = $1;", [id])).rows[0]);
  if (!row) fail("Remediation request not found.", 404);
  if (!isTliRole(session.role) && row!.tenant_id !== session.tenantId) fail("Remediation request not found.", 404);
  return row!;
}

function assertClientWriter(session: SessionUser): void {
  if (!CLIENT_WRITERS.includes(session.role)) fail("Your role cannot change remediation requests; ask your organisation administrator.", 403);
}

/** TLI recipients: the assigned assessor, else the assessment's lead consultant, else the central mailbox. */
async function tliRecipient(client: Pick<PoolClient, "query">, row: RequestRow): Promise<string> {
  const res = await client.query<{ email: string }>(
    `SELECT u.email FROM users u WHERE u.id = COALESCE($1, (SELECT lead_consultant_id FROM assessments WHERE id = $2));`,
    [row.assigned_assessor_id, row.assessment_id]
  );
  return res.rows[0]?.email || process.env.TLI_ASSESSOR_EMAIL?.trim() || "";
}

async function clientRecipient(client: Pick<PoolClient, "query">, row: RequestRow): Promise<string> {
  return (await client.query<{ email: string }>("SELECT email FROM users WHERE id = $1;", [row.requested_by_user_id])).rows[0]?.email ?? "";
}

async function notify(client: Pick<PoolClient, "query">, row: RequestRow, kind: string, to: "CLIENT" | "TLI", uniqueSuffix: string): Promise<void> {
  const email = to === "CLIENT" ? await clientRecipient(client, row) : await tliRecipient(client, row);
  if (!email) return;
  await queueNotifications(client, [
    { dedupeKey: `rr:${row.id}:${kind}:${uniqueSuffix}`, tenantId: row.tenant_id, entityType: "remediation_request", entityId: row.id, kind, recipientRole: to, recipientEmail: email },
  ]);
}

/** Conditional status change; `extra` may set more columns using $4, $5… bound to `extraParams`. */
async function setStatus(client: Pick<PoolClient, "query">, row: RequestRow, from: RequestStatus[], to: RequestStatus, extra = "", extraParams: unknown[] = []): Promise<void> {
  const res = await client.query(
    `UPDATE remediation_requests SET status = $2, updated_at = CURRENT_TIMESTAMP ${extra} WHERE id = $1 AND status IN (SELECT value FROM json_each($3));`,
    [row.id, to, JSON.stringify(from), ...extraParams]
  );
  if (res.rowCount === 0) fail("The request changed meanwhile. Reload and try again.", 409);
}

async function addMessageRow(client: Pick<PoolClient, "query">, requestId: string, session: SessionUser, kind: string, body: string): Promise<void> {
  await client.query(
    "INSERT INTO remediation_messages (id, request_id, author_user_id, author_side, kind, body) VALUES ($1, $2, $3, $4, $5, $6);",
    [crypto.randomUUID(), requestId, session.userId, isTliRole(session.role) ? "TLI" : "CLIENT", kind, body.slice(0, 5000)]
  );
}

// ---------- Requests ----------

export interface CreateRequestInput {
  assessmentId: string;
  questionCodes: string[];
  helpDescription: string;
  wantsConsultation: boolean;
  submit: boolean;
}

/** Validates that every selected code is an identified gap of the (paid) report. */
async function selectedGaps(session: SessionUser, assessmentId: string, codes: string[]) {
  const unique = [...new Set(codes)];
  if (unique.length === 0 || unique.length > 60) fail("Select at least one compliance gap.", 400);
  const analysis = await getAssessmentGapAnalysis(session, assessmentId);
  const byCode = new Map(analysis.gaps.map((g) => [g.questionCode, g]));
  return unique.map((code) => {
    const gap = byCode.get(code);
    if (!gap) fail(`${code} is not an identified gap in this assessment.`, 400);
    return { code, title: gap!.questionText.slice(0, 300), severity: gap!.gapSeverity };
  });
}

export async function createRemediationRequest(session: SessionUser, input: CreateRequestInput): Promise<{ id: string }> {
  assertClientWriter(session);
  // Detailed gaps are released only with the paid report (throws 402 otherwise).
  await assertFindingsAccess(session, input.assessmentId);
  const assessment = await executeWithRls(session, async (c) => (await c.query("SELECT id, tenant_id FROM assessments WHERE id = $1;", [input.assessmentId])).rows[0]);
  if (!assessment || assessment.tenant_id !== session.tenantId) fail("Assessment not found.", 404);
  const gaps = await selectedGaps(session, input.assessmentId, input.questionCodes);
  if (input.submit && input.helpDescription.trim().length < 10) fail("Describe the help you need (at least 10 characters).", 400);
  const id = crypto.randomUUID();
  await inSystemTransaction(async (client) => {
    await client.query(
      `INSERT INTO remediation_requests (id, tenant_id, assessment_id, requested_by_user_id, status, help_description, wants_consultation, submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
      [id, session.tenantId, input.assessmentId, session.userId, input.submit ? "SUBMITTED" : "DRAFT", input.helpDescription.slice(0, 5000), input.wantsConsultation, input.submit ? new Date().toISOString() : null]
    );
    for (const g of gaps) {
      await client.query("INSERT INTO remediation_request_gaps (request_id, question_code, gap_title, gap_severity) VALUES ($1, $2, $3, $4);", [id, g.code, g.title, g.severity]);
    }
    await writeAudit(client, { tenantId: session.tenantId, userId: session.userId, action: input.submit ? "REMEDIATION_REQUEST_SUBMITTED" : "REMEDIATION_REQUEST_DRAFTED", entityType: "remediation_requests", entityId: id, details: { assessmentId: input.assessmentId, gaps: gaps.map((g) => g.code), wantsConsultation: input.wantsConsultation } });
    if (input.submit) {
      const row = (await client.query<RequestRow>("SELECT * FROM remediation_requests WHERE id = $1;", [id])).rows[0];
      await notify(client, row, "REQUEST_SUBMITTED", "TLI", "1");
    }
  });
  return { id };
}

export async function updateDraftRequest(session: SessionUser, id: string, input: Partial<Omit<CreateRequestInput, "assessmentId" | "submit">>): Promise<void> {
  assertClientWriter(session);
  const row = await visibleRequest(session, id);
  if (row.status !== "DRAFT") fail("Only drafts can be edited.", 409);
  const gaps = input.questionCodes ? await selectedGaps(session, row.assessment_id, input.questionCodes) : null;
  await inSystemTransaction(async (client) => {
    await client.query(
      `UPDATE remediation_requests SET help_description = COALESCE($2, help_description), wants_consultation = COALESCE($3, wants_consultation),
         updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status = 'DRAFT';`,
      [id, input.helpDescription?.slice(0, 5000) ?? null, input.wantsConsultation ?? null]
    );
    if (gaps) {
      await client.query("DELETE FROM remediation_request_gaps WHERE request_id = $1;", [id]);
      for (const g of gaps) await client.query("INSERT INTO remediation_request_gaps (request_id, question_code, gap_title, gap_severity) VALUES ($1, $2, $3, $4);", [id, g.code, g.title, g.severity]);
    }
    await writeAudit(client, { tenantId: row.tenant_id, userId: session.userId, action: "REMEDIATION_REQUEST_DRAFT_UPDATED", entityType: "remediation_requests", entityId: id, details: { gaps: gaps?.map((g) => g.code) } });
  });
}

export type RequestAction =
  | "SUBMIT" | "CANCEL" | "RESPOND" | "START_REVIEW" | "REQUEST_CLARIFICATION" | "DECLINE_REQUEST" | "START_ENGAGEMENT" | "COMPLETE";

export async function performRequestAction(session: SessionUser, id: string, action: RequestAction, message = ""): Promise<void> {
  const row = await visibleRequest(session, id);
  const staff = isTliRole(session.role);
  const needMessage = () => (message.trim().length >= 2 ? message.trim() : fail("Please add a message.", 400));
  const audit = (client: PoolClient, extra: Record<string, unknown> = {}) =>
    writeAudit(client, { tenantId: row.tenant_id, userId: session.userId, action: `REMEDIATION_${action}`, entityType: "remediation_requests", entityId: id, details: { from: row.status, ...extra } });

  if (action === "SUBMIT") {
    assertClientWriter(session);
    const desc = (await pool.query<{ help_description: string }>("SELECT help_description FROM remediation_requests WHERE id = $1;", [id])).rows[0]?.help_description ?? "";
    if (desc.trim().length < 10) fail("Describe the help you need (at least 10 characters).", 400);
    return inSystemTransaction(async (c) => {
      await setStatus(c, row, ["DRAFT"], "SUBMITTED", ", submitted_at = CURRENT_TIMESTAMP");
      await notify(c, row, "REQUEST_SUBMITTED", "TLI", "1");
      await audit(c);
    });
  }
  if (action === "CANCEL") {
    assertClientWriter(session);
    return inSystemTransaction(async (c) => {
      await setStatus(c, row, ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "CLARIFICATION_REQUIRED", "PROPOSAL_PREPARED", "PROPOSAL_SENT"], "CANCELLED");
      if (message.trim()) await addMessageRow(c, id, session, "STATUS_NOTE", message.trim());
      await audit(c);
    });
  }
  if (action === "RESPOND") {
    assertClientWriter(session);
    const body = needMessage();
    return inSystemTransaction(async (c) => {
      await setStatus(c, row, ["CLARIFICATION_REQUIRED"], "UNDER_REVIEW");
      await addMessageRow(c, id, session, "CLARIFICATION_RESPONSE", body);
      await notify(c, row, "CLIENT_RESPONDED", "TLI", crypto.randomUUID());
      await audit(c);
    });
  }
  if (!staff) fail("Only TLI can perform this action.", 403);
  if (action === "START_REVIEW") {
    return inSystemTransaction(async (c) => {
      await setStatus(c, row, ["SUBMITTED"], "UNDER_REVIEW", ", assigned_assessor_id = COALESCE(assigned_assessor_id, $4)", [session.userId]);
      await audit(c);
    });
  }
  if (action === "REQUEST_CLARIFICATION") {
    const body = needMessage();
    return inSystemTransaction(async (c) => {
      await setStatus(c, row, ["UNDER_REVIEW", "PROPOSAL_PREPARED"], "CLARIFICATION_REQUIRED");
      await addMessageRow(c, id, session, "CLARIFICATION_REQUEST", body);
      await notify(c, row, "CLARIFICATION_REQUESTED", "CLIENT", crypto.randomUUID());
      await audit(c);
    });
  }
  if (action === "DECLINE_REQUEST") {
    if (!PROPOSAL_AUTHORS.includes(session.role)) fail("Only a lead consultant can decline a request.", 403);
    const body = needMessage();
    return inSystemTransaction(async (c) => {
      await setStatus(c, row, ["SUBMITTED", "UNDER_REVIEW", "CLARIFICATION_REQUIRED", "PROPOSAL_PREPARED"], "DECLINED");
      await addMessageRow(c, id, session, "STATUS_NOTE", body);
      await audit(c);
    });
  }
  if (action === "START_ENGAGEMENT") return startEngagement(session, row);
  if (action === "COMPLETE") {
    if (!PROPOSAL_AUTHORS.includes(session.role)) fail("Only a lead consultant can complete an engagement.", 403);
    return inSystemTransaction(async (c) => {
      const open = await c.query("SELECT COUNT(*) AS n FROM remediation_tasks WHERE remediation_request_id = $1 AND status <> 'VALIDATED_CLOSED';", [id]);
      if (Number(open.rows[0].n) > 0) fail("Every gap must be verified and closed by a TLI assessor before the engagement is complete.", 409);
      await setStatus(c, row, ["IN_PROGRESS"], "COMPLETED", ", completed_at = CURRENT_TIMESTAMP");
      await notify(c, row, "REQUEST_COMPLETED", "CLIENT", "1");
      await audit(c);
    });
  }
  fail("Unknown action.", 400);
}

export async function postMessage(session: SessionUser, id: string, body: string): Promise<void> {
  const row = await visibleRequest(session, id);
  if (!isTliRole(session.role)) assertClientWriter(session);
  if (CLOSED.includes(row.status) || row.status === "DRAFT") fail("Messages can be added only to active requests.", 409);
  if (body.trim().length < 2) fail("Please add a message.", 400);
  await inSystemTransaction(async (c) => {
    await addMessageRow(c, id, session, "MESSAGE", body.trim());
    await writeAudit(c, { tenantId: row.tenant_id, userId: session.userId, action: "REMEDIATION_MESSAGE_POSTED", entityType: "remediation_requests", entityId: id, details: {} });
  });
}

// ---------- Proposals ----------

export interface ProposalInput {
  scopeOfServices: string;
  correctiveActivities: string;
  deliverables: string;
  estimatedTimeline: string;
  targetCompletionDate: string;
  commercialTerms: string;
  feeAmountPaise: number | null;
  validUntil: string;
}

function validateProposal(p: ProposalInput): void {
  for (const [k, v] of Object.entries({ scope: p.scopeOfServices, activities: p.correctiveActivities, deliverables: p.deliverables, timeline: p.estimatedTimeline, terms: p.commercialTerms })) {
    if (!v || v.trim().length < 3) fail(`The proposal ${k} is required.`, 400);
  }
  const date = /^\d{4}-\d{2}-\d{2}$/;
  if (!date.test(p.targetCompletionDate) || !date.test(p.validUntil)) fail("Enter valid dates.", 400);
  if (p.validUntil < new Date().toISOString().slice(0, 10)) fail("The validity date is in the past.", 400);
  if (p.feeAmountPaise !== null && (!Number.isInteger(p.feeAmountPaise) || p.feeAmountPaise < 0)) fail("The fee is invalid.", 400);
}

/** Creates a new proposal version (or updates the current draft). */
export async function saveProposalDraft(session: SessionUser, requestId: string, input: ProposalInput, proposalId?: string): Promise<{ id: string; version: number }> {
  if (!PROPOSAL_AUTHORS.includes(session.role)) fail("Only a lead consultant can prepare proposals.", 403);
  const row = await visibleRequest(session, requestId);
  if (!["UNDER_REVIEW", "PROPOSAL_PREPARED", "CLARIFICATION_REQUIRED", "PROPOSAL_SENT"].includes(row.status)) fail("A proposal can be prepared only while the request is under review.", 409);
  validateProposal(input);
  return inSystemTransaction(async (c) => {
    const values = [input.scopeOfServices, input.correctiveActivities, input.deliverables, input.estimatedTimeline, input.targetCompletionDate, input.commercialTerms, input.feeAmountPaise, input.validUntil];
    let id = proposalId;
    let version: number;
    if (proposalId) {
      const res = await c.query<{ version: number }>(
        `UPDATE remediation_proposals SET scope_of_services = $3, corrective_activities = $4, deliverables = $5, estimated_timeline = $6,
           target_completion_date = $7, commercial_terms = $8, fee_amount_paise = $9, valid_until = $10, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND request_id = $2 AND status = 'DRAFT' RETURNING version;`,
        [proposalId, requestId, ...values]
      );
      if (res.rowCount === 0) fail("Only draft proposals can be edited; create a new version instead.", 409);
      version = res.rows[0].version;
    } else {
      id = crypto.randomUUID();
      version = Number((await c.query("SELECT COALESCE(MAX(version), 0) + 1 AS v FROM remediation_proposals WHERE request_id = $1;", [requestId])).rows[0].v);
      await c.query(
        `INSERT INTO remediation_proposals (id, request_id, version, status, scope_of_services, corrective_activities, deliverables, estimated_timeline,
           target_completion_date, commercial_terms, fee_amount_paise, valid_until, prepared_by_user_id)
         VALUES ($1, $2, $3, 'DRAFT', $4, $5, $6, $7, $8, $9, $10, $11, $12);`,
        [id, requestId, version, ...values, session.userId]
      );
    }
    if (row.status !== "PROPOSAL_SENT") {
      await c.query("UPDATE remediation_requests SET status = 'PROPOSAL_PREPARED', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status IN ('UNDER_REVIEW', 'CLARIFICATION_REQUIRED');", [requestId]);
    }
    await writeAudit(c, { tenantId: row.tenant_id, userId: session.userId, action: "REMEDIATION_PROPOSAL_DRAFTED", entityType: "remediation_requests", entityId: requestId, details: { proposalId: id, version } });
    return { id: id!, version };
  });
}

async function visibleProposal(session: SessionUser, proposalId: string) {
  const p = await executeWithRls(session, async (c) => (await c.query("SELECT * FROM remediation_proposals WHERE id = $1;", [proposalId])).rows[0]);
  if (!p) fail("Proposal not found.", 404);
  return { proposal: p, request: await visibleRequest(session, p.request_id) };
}

export async function sendProposal(session: SessionUser, proposalId: string): Promise<void> {
  if (!PROPOSAL_AUTHORS.includes(session.role)) fail("Only a lead consultant can send proposals.", 403);
  const { proposal, request } = await visibleProposal(session, proposalId);
  if (proposal.status !== "DRAFT") fail("This proposal has already been sent.", 409);
  await inSystemTransaction(async (c) => {
    await c.query("UPDATE remediation_proposals SET status = 'SUPERSEDED', updated_at = CURRENT_TIMESTAMP WHERE request_id = $1 AND status IN ('SENT', 'CLARIFICATION_REQUESTED');", [request.id]);
    await c.query("UPDATE remediation_proposals SET status = 'SENT', sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status = 'DRAFT';", [proposalId]);
    await setStatus(c, request, ["PROPOSAL_PREPARED", "UNDER_REVIEW", "CLARIFICATION_REQUIRED", "PROPOSAL_SENT"], "PROPOSAL_SENT");
    await notify(c, request, "PROPOSAL_SENT", "CLIENT", proposalId);
    await writeAudit(c, { tenantId: request.tenant_id, userId: session.userId, action: "REMEDIATION_PROPOSAL_SENT", entityType: "remediation_requests", entityId: request.id, details: { proposalId, version: proposal.version } });
  });
}

export type ProposalDecision = "ACCEPT" | "DECLINE" | "CLARIFY";

export async function respondToProposal(session: SessionUser, proposalId: string, decision: ProposalDecision, note = ""): Promise<void> {
  assertClientWriter(session);
  if (decision !== "CLARIFY" && session.role !== "CLIENT_ADMIN") fail("Only your organisation's administrator can accept or decline a proposal.", 403);
  const { proposal, request } = await visibleProposal(session, proposalId);
  if (proposal.status !== "SENT") fail("This proposal is no longer open for a response.", 409);
  const validUntil = proposal.valid_until instanceof Date ? proposal.valid_until : new Date(proposal.valid_until);
  if (decision === "ACCEPT" && validUntil.getTime() + 86_400_000 < Date.now()) fail("This proposal has expired; ask TLI for a revised proposal.", 409);
  if (decision === "CLARIFY" && note.trim().length < 2) fail("Please add your question.", 400);
  const next = { ACCEPT: ["ACCEPTED", "ACCEPTED", "PROPOSAL_ACCEPTED"], DECLINE: ["DECLINED", "DECLINED", "PROPOSAL_DECLINED"], CLARIFY: ["CLARIFICATION_REQUESTED", "UNDER_REVIEW", "PROPOSAL_QUESTION"] }[decision];
  await inSystemTransaction(async (c) => {
    await c.query(
      `UPDATE remediation_proposals SET status = $2, responded_at = CURRENT_TIMESTAMP, responded_by_user_id = $3, response_note = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'SENT';`,
      [proposalId, next[0], session.userId, note.slice(0, 2000) || null]
    );
    if (decision === "ACCEPT") await setStatus(c, request, ["PROPOSAL_SENT"], "ACCEPTED", ", accepted_proposal_id = $4", [proposalId]);
    else await setStatus(c, request, ["PROPOSAL_SENT"], next[1] as RequestStatus);
    if (note.trim()) await addMessageRow(c, request.id, session, decision === "CLARIFY" ? "PROPOSAL_QUESTION" : "STATUS_NOTE", note.trim());
    await notify(c, request, next[2], "TLI", proposalId);
    await writeAudit(c, { tenantId: request.tenant_id, userId: session.userId, action: `REMEDIATION_PROPOSAL_${decision}`, entityType: "remediation_requests", entityId: request.id, details: { proposalId, version: proposal.version, note: note.slice(0, 200) } });
  });
}

// ---------- Engagement ----------

async function startEngagement(session: SessionUser, row: RequestRow): Promise<void> {
  if (!PROPOSAL_AUTHORS.includes(session.role)) fail("Only a lead consultant can start an engagement.", 403);
  if (row.status !== "ACCEPTED" || !row.accepted_proposal_id) fail("The engagement starts after the customer accepts a proposal.", 409);
  await inSystemTransaction(async (c) => {
    const proposal = (await c.query("SELECT * FROM remediation_proposals WHERE id = $1;", [row.accepted_proposal_id])).rows[0];
    const gaps = (await c.query<{ question_code: string; gap_title: string; gap_severity: string }>("SELECT * FROM remediation_request_gaps WHERE request_id = $1 AND remediation_task_id IS NULL;", [row.id])).rows;
    const target = proposal.target_completion_date instanceof Date
      ? `${proposal.target_completion_date.getFullYear()}-${String(proposal.target_completion_date.getMonth() + 1).padStart(2, "0")}-${String(proposal.target_completion_date.getDate()).padStart(2, "0")}`
      : String(proposal.target_completion_date);
    for (const g of gaps) {
      const taskId = crypto.randomUUID();
      // Tasks start OPEN: the gap is addressed only when work is done and closed only on TLI validation.
      await c.query(
        `INSERT INTO remediation_tasks (id, tenant_id, assessment_id, question_code, title, description, priority, target_date, status, remediation_request_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'OPEN', $9);`,
        [taskId, row.tenant_id, row.assessment_id, g.question_code, `Remediate ${g.question_code}: ${g.gap_title}`.slice(0, 200), String(proposal.corrective_activities).slice(0, 5000), PRIORITY[g.gap_severity] ?? "MEDIUM", target, row.id]
      );
      await c.query("UPDATE remediation_request_gaps SET remediation_task_id = $3 WHERE request_id = $1 AND question_code = $2;", [row.id, g.question_code, taskId]);
    }
    await setStatus(c, row, ["ACCEPTED"], "IN_PROGRESS", ", engagement_started_at = CURRENT_TIMESTAMP");
    await notify(c, row, "ENGAGEMENT_STARTED", "CLIENT", "1");
    await writeAudit(c, { tenantId: row.tenant_id, userId: session.userId, action: "REMEDIATION_START_ENGAGEMENT", entityType: "remediation_requests", entityId: row.id, details: { proposalId: row.accepted_proposal_id, tasks: gaps.length } });
  });
}

// ---------- Documents ----------

const validator = new FileValidator();

export async function uploadRemediationDocument(
  session: SessionUser,
  requestId: string,
  input: { kind: "SUPPORTING_DOCUMENT" | "CORRECTIVE_EVIDENCE"; taskId?: string | null; fileName: string; mimeType: string; content: Buffer }
): Promise<{ id: string }> {
  const row = await visibleRequest(session, requestId);
  if (!isTliRole(session.role)) assertClientWriter(session);
  if (CLOSED.includes(row.status)) fail("This request is closed.", 409);
  if (input.kind === "CORRECTIVE_EVIDENCE") {
    if (row.status !== "IN_PROGRESS") fail("Corrective evidence is added during an active engagement.", 409);
    const task = (await pool.query("SELECT id FROM remediation_tasks WHERE id = $1 AND remediation_request_id = $2;", [input.taskId ?? "", requestId])).rows[0];
    if (!task) fail("Choose the corrective action this evidence belongs to.", 400);
  }
  const { sanitizedFilename, normalizedMime } = validator.validateMetadata(input.fileName, input.mimeType, input.content.length);
  validator.verifyMagicBytes(input.content, normalizedMime);
  const scanner = getConfiguredScanner();
  if (scanner) {
    const result = await scanner.scan(input.content);
    if (!result.clean) throw new MalwareDetectedError();
  }
  const id = crypto.randomUUID();
  const key = `remediation/${row.tenant_id}/${requestId}/${id}`;
  const saved = await getLocalStorageAdapter().saveFile(key, input.content);
  try {
    await inSystemTransaction(async (c) => {
      await c.query(
        `INSERT INTO remediation_documents (id, tenant_id, request_id, remediation_task_id, kind, file_name, mime_type, file_size_bytes, sha256, storage_key, uploaded_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);`,
        [id, row.tenant_id, requestId, input.kind === "CORRECTIVE_EVIDENCE" ? input.taskId : null, input.kind, sanitizedFilename, normalizedMime, saved.bytesWritten, saved.sha256, key, session.userId]
      );
      await writeAudit(c, { tenantId: row.tenant_id, userId: session.userId, action: "REMEDIATION_DOCUMENT_UPLOADED", entityType: "remediation_requests", entityId: requestId, details: { documentId: id, kind: input.kind, taskId: input.taskId ?? null, sha256: saved.sha256 } });
    });
  } catch (err) {
    await getLocalStorageAdapter().deleteFile(key).catch(() => undefined);
    throw err;
  }
  return { id };
}

export async function downloadRemediationDocument(session: SessionUser, documentId: string): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
  const doc = await executeWithRls(session, async (c) => (await c.query("SELECT * FROM remediation_documents WHERE id = $1;", [documentId])).rows[0]);
  if (!doc || (!isTliRole(session.role) && doc.tenant_id !== session.tenantId)) fail("Document not found.", 404);
  const buffer = await getLocalStorageAdapter().readFile(doc.storage_key);
  if (crypto.createHash("sha256").update(buffer).digest("hex") !== doc.sha256) fail("The document failed its integrity check.", 500);
  return { buffer, fileName: doc.file_name, mimeType: doc.mime_type };
}

// ---------- Read models ----------

export interface RequestSummary {
  id: string;
  status: RequestStatus;
  organisation: string;
  tenantId: string;
  engagementCode: string;
  assessmentId: string;
  requestedBy: string;
  assignedAssessor: string | null;
  gapCount: number;
  closedGapCount: number;
  awaitingVerification: number;
  wantsConsultation: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function listRemediationRequests(session: SessionUser, filters: { status?: string; tenantId?: string; assessorId?: string } = {}): Promise<RequestSummary[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, v: unknown) => { params.push(v); where.push(sql.replace("?", `$${params.length}`)); };
  if (filters.status) add("r.status = ?", filters.status);
  if (filters.tenantId) add("r.tenant_id = ?", filters.tenantId);
  if (filters.assessorId) add("r.assigned_assessor_id = ?", filters.assessorId);
  return executeWithRls(session, async (c) => {
    const res = await c.query(
      `SELECT r.*, t.name AS organisation, a.engagement_code, u.full_name AS requested_by, au.full_name AS assessor,
         (SELECT COUNT(*) FROM remediation_request_gaps g WHERE g.request_id = r.id) AS gap_count,
         (SELECT COUNT(*) FROM remediation_tasks rt WHERE rt.remediation_request_id = r.id AND rt.status = 'VALIDATED_CLOSED') AS closed_count,
         (SELECT COUNT(*) FROM remediation_tasks rt WHERE rt.remediation_request_id = r.id AND rt.status = 'SUBMITTED_FOR_CLOSURE') AS awaiting
       FROM remediation_requests r
       LEFT JOIN tenants t ON t.id = r.tenant_id
       LEFT JOIN assessments a ON a.id = r.assessment_id
       LEFT JOIN users u ON u.id = r.requested_by_user_id
       LEFT JOIN users au ON au.id = r.assigned_assessor_id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY r.updated_at DESC LIMIT 500;`,
      params
    );
    return res.rows.map((r) => ({
      id: r.id,
      status: r.status,
      organisation: r.organisation ?? "",
      tenantId: r.tenant_id,
      engagementCode: r.engagement_code ?? "",
      assessmentId: r.assessment_id,
      requestedBy: r.requested_by ?? "",
      assignedAssessor: r.assessor ?? null,
      gapCount: Number(r.gap_count),
      closedGapCount: Number(r.closed_count),
      awaitingVerification: Number(r.awaiting),
      wantsConsultation: Boolean(r.wants_consultation),
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
    }));
  });
}

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
const day = (v: unknown) => (v instanceof Date ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}` : v ? String(v) : null);

export async function getRemediationRequest(session: SessionUser, id: string) {
  const summary = (await listRemediationRequests(session)).find((r) => r.id === id);
  if (!summary) fail("Remediation request not found.", 404);
  const staff = isTliRole(session.role);
  return executeWithRls(session, async (c) => {
    const base = (await c.query("SELECT help_description, accepted_proposal_id, submitted_at, engagement_started_at, completed_at FROM remediation_requests WHERE id = $1;", [id])).rows[0];
    const gaps = (await c.query(
      `SELECT g.question_code, g.gap_title, g.gap_severity, g.remediation_task_id, rt.status AS task_status, rt.target_date, rt.closure_validation_notes, rt.validated_at
       FROM remediation_request_gaps g LEFT JOIN remediation_tasks rt ON rt.id = g.remediation_task_id WHERE g.request_id = $1 ORDER BY g.question_code;`,
      [id]
    )).rows;
    const messages = (await c.query(
      `SELECT m.id, m.author_side, m.kind, m.body, m.created_at, u.full_name AS author FROM remediation_messages m
       LEFT JOIN users u ON u.id = m.author_user_id WHERE m.request_id = $1 ORDER BY m.created_at;`,
      [id]
    )).rows;
    const proposals = (await c.query(
      `SELECT p.*, u.full_name AS prepared_by FROM remediation_proposals p LEFT JOIN users u ON u.id = p.prepared_by_user_id
       WHERE p.request_id = $1 ORDER BY p.version DESC;`,
      [id]
    )).rows;
    const documents = (await c.query(
      `SELECT d.id, d.kind, d.file_name, d.file_size_bytes, d.remediation_task_id, d.created_at, u.full_name AS uploaded_by
       FROM remediation_documents d LEFT JOIN users u ON u.id = d.uploaded_by_user_id WHERE d.request_id = $1 ORDER BY d.created_at;`,
      [id]
    )).rows;
    return {
      ...summary!,
      helpDescription: base.help_description,
      acceptedProposalId: base.accepted_proposal_id,
      submittedAt: iso(base.submitted_at),
      engagementStartedAt: iso(base.engagement_started_at),
      completedAt: iso(base.completed_at),
      viewerIsStaff: staff,
      gaps: gaps.map((g) => ({
        questionCode: g.question_code,
        title: g.gap_title,
        severity: g.gap_severity,
        taskId: g.remediation_task_id,
        // Stage of the gap: selected → addressed → submitted for verification → verified and closed.
        taskStatus: g.task_status ?? null,
        targetDate: day(g.target_date),
        verifiedAt: iso(g.validated_at),
        verificationNotes: g.closure_validation_notes ?? null,
      })),
      messages: messages.map((m) => ({ id: m.id, side: m.author_side, kind: m.kind, body: m.body, author: m.author ?? "", createdAt: iso(m.created_at) })),
      proposals: proposals.map((p) => ({
        id: p.id,
        version: p.version,
        status: p.status,
        scopeOfServices: p.scope_of_services,
        correctiveActivities: p.corrective_activities,
        deliverables: p.deliverables,
        estimatedTimeline: p.estimated_timeline,
        targetCompletionDate: day(p.target_completion_date),
        commercialTerms: p.commercial_terms,
        feeAmountPaise: p.fee_amount_paise,
        validUntil: day(p.valid_until),
        preparedBy: p.prepared_by ?? "",
        sentAt: iso(p.sent_at),
        respondedAt: iso(p.responded_at),
        responseNote: p.response_note,
      })),
      documents: documents.map((d) => ({ id: d.id, kind: d.kind, fileName: d.file_name, size: d.file_size_bytes, taskId: d.remediation_task_id, uploadedBy: d.uploaded_by ?? "", createdAt: iso(d.created_at) })),
    };
  });
}

export type RemediationRequestDetail = Awaited<ReturnType<typeof getRemediationRequest>>;
