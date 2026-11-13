/**
 * TLI — Remediation requests, proposals, engagements and gap verification.
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../lib/db/pool.ts";
import { executeWithRls } from "../lib/db/rls.ts";
import type { SessionUser } from "../lib/auth/types.ts";
import { getAssessmentGapAnalysis } from "../lib/gaps/index.ts";
import { updateRemediationProgress, validateRemediationClosure } from "../lib/remediation/index.ts";
import { ReportLockedError } from "../lib/payments/access.ts";
import {
  RemediationRequestError,
  createRemediationRequest,
  downloadRemediationDocument,
  getRemediationRequest,
  listRemediationRequests,
  performRequestAction,
  postMessage,
  respondToProposal,
  saveProposalDraft,
  sendProposal,
  updateDraftRequest,
  uploadRemediationDocument,
} from "../lib/remediation-requests/service.ts";
import type { ProposalInput } from "../lib/remediation-requests/service.ts";
import { markReportPaidForTests } from "./helpers/paid_report.ts";

const TLI = "018f3a5b-7c8d-7e90-8000-000000000001";
const ALPHA = "018f3a5b-7c8d-7e90-8000-000000000002";
const BETA = "018f3a5b-7c8d-7e90-8000-000000000003";
const s = (userId: string, tenantId: string, role: SessionUser["role"]): SessionUser => ({
  userId, tenantId, email: `${userId}@example.com`, fullName: role, role, tenantType: tenantId === TLI ? "TLI" : "CLIENT", tenantName: "t", tenantSlug: "t", isSdf: false,
});
const LEAD = s("018f3a5b-7c8d-7e90-8000-000000000102", TLI, "TLI_LEAD_CONSULTANT");
const REVIEWER = s("018f3a5b-7c8d-7e90-8000-000000000103", TLI, "TLI_REVIEWER");
const ALPHA_ADMIN = s("018f3a5b-7c8d-7e90-8000-000000000111", ALPHA, "CLIENT_ADMIN");
const ALPHA_LEAD = s("018f3a5b-7c8d-7e90-8000-000000000112", ALPHA, "CLIENT_BU_LEAD");
const ALPHA_VIEWER = s("018f3a5b-7c8d-7e90-8000-000000000114", ALPHA, "CLIENT_VIEWER");
const BETA_ADMIN = s("018f3a5b-7c8d-7e90-8000-000000000121", BETA, "CLIENT_ADMIN");
const ALPHA_ASSESSMENT = "018f3a5b-7c8d-7e90-8000-000000000201";
const BETA_ASSESSMENT = "018f3a5b-7c8d-7e90-8000-000000000202";

const isErr = (status: number) => (e: unknown) => e instanceof RemediationRequestError && e.status === status;
const PDF = Buffer.from(`%PDF-1.7\nCorrective evidence\n${"A".repeat(200)}\n%%EOF`);
const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const proposal = (extra: Partial<ProposalInput> = {}): ProposalInput => ({
  scopeOfServices: "Remediate selected governance gaps",
  correctiveActivities: "Draft policies, train staff, configure controls",
  deliverables: "Approved privacy policy; training records",
  estimatedTimeline: "6 weeks",
  targetCompletionDate: future(60),
  commercialTerms: "Fixed fee, invoiced separately on acceptance",
  feeAmountPaise: 25_000_000,
  validUntil: future(30),
  ...extra,
});
const status = async (id: string) => (await pool.query("SELECT status FROM remediation_requests WHERE id = $1;", [id])).rows[0].status;

describe("Remediation requests", () => {
  let codes: string[] = [];
  let requestId = "";

  before(async () => {
    codes = (await getAssessmentGapAnalysis(LEAD, ALPHA_ASSESSMENT)).gaps.slice(0, 3).map((g) => g.questionCode);
  });

  it("is available only after the report has been paid for", async () => {
    await assert.rejects(
      () => createRemediationRequest(ALPHA_ADMIN, { assessmentId: ALPHA_ASSESSMENT, questionCodes: codes, helpDescription: "Help us fix these gaps please", wantsConsultation: false, submit: true }),
      (e: unknown) => e instanceof ReportLockedError
    );
    await markReportPaidForTests(ALPHA_ASSESSMENT);
  });

  it("validates selected gaps, roles and organisation ownership", async () => {
    const base = { assessmentId: ALPHA_ASSESSMENT, helpDescription: "Help us fix these gaps please", wantsConsultation: false, submit: true };
    await assert.rejects(() => createRemediationRequest(ALPHA_ADMIN, { ...base, questionCodes: [] }), isErr(400));
    await assert.rejects(() => createRemediationRequest(ALPHA_ADMIN, { ...base, questionCodes: ["XYZ-999"] }), isErr(400));
    await assert.rejects(() => createRemediationRequest(ALPHA_VIEWER, { ...base, questionCodes: codes }), isErr(403));
    await assert.rejects(() => createRemediationRequest(ALPHA_ADMIN, { ...base, questionCodes: codes, helpDescription: "short" }), isErr(400));
    await assert.rejects(() => createRemediationRequest(BETA_ADMIN, { ...base, questionCodes: codes }), (e: unknown) => isErr(404)(e) || e instanceof ReportLockedError);
  });

  it("creates a draft with several gaps, edits it and submits it", async () => {
    ({ id: requestId } = await createRemediationRequest(ALPHA_ADMIN, { assessmentId: ALPHA_ASSESSMENT, questionCodes: codes.slice(0, 1), helpDescription: "", wantsConsultation: true, submit: false }));
    assert.equal(await status(requestId), "DRAFT");
    await updateDraftRequest(ALPHA_ADMIN, requestId, { questionCodes: codes, helpDescription: "We need help with policy and training gaps" });
    await performRequestAction(ALPHA_ADMIN, requestId, "SUBMIT");
    const detail = await getRemediationRequest(ALPHA_ADMIN, requestId);
    assert.equal(detail.status, "SUBMITTED");
    assert.deepEqual(detail.gaps.map((g) => g.questionCode).sort(), [...codes].sort());
    assert.ok(detail.gaps.every((g) => g.taskStatus === null), "no gap is addressed yet");
    const queued = await pool.query("SELECT kind, recipient_role FROM notification_deliveries WHERE entity_id = $1;", [requestId]);
    assert.ok(queued.rows.some((r) => r.kind === "REQUEST_SUBMITTED" && r.recipient_role === "TLI"));
  });

  it("is invisible to other organisations", async () => {
    await assert.rejects(() => getRemediationRequest(BETA_ADMIN, requestId), isErr(404));
    await assert.rejects(() => performRequestAction(BETA_ADMIN, requestId, "CANCEL"), isErr(404));
    assert.equal((await listRemediationRequests(BETA_ADMIN)).filter((r) => r.id === requestId).length, 0);
    await assert.rejects(() => executeWithRls(ALPHA_ADMIN, (c) => c.query("UPDATE remediation_requests SET status = 'COMPLETED';")), /permission denied/);
  });

  it("lets TLI review and ask for clarification, and the customer reply", async () => {
    await assert.rejects(() => performRequestAction(ALPHA_ADMIN, requestId, "START_REVIEW"), isErr(403));
    await performRequestAction(REVIEWER, requestId, "START_REVIEW");
    await assert.rejects(() => performRequestAction(REVIEWER, requestId, "REQUEST_CLARIFICATION", ""), isErr(400));
    await performRequestAction(REVIEWER, requestId, "REQUEST_CLARIFICATION", "Which business units are in scope?");
    assert.equal(await status(requestId), "CLARIFICATION_REQUIRED");
    await performRequestAction(ALPHA_LEAD, requestId, "RESPOND", "Clinical and engineering units.");
    assert.equal(await status(requestId), "UNDER_REVIEW");
    await postMessage(ALPHA_ADMIN, requestId, "Thanks, looking forward to the proposal.");
    const detail = await getRemediationRequest(ALPHA_ADMIN, requestId);
    assert.deepEqual(detail.messages.map((m) => m.kind), ["CLARIFICATION_REQUEST", "CLARIFICATION_RESPONSE", "MESSAGE"]);
  });

  it("keeps draft proposals hidden from the customer and restricts who can prepare and send them", async () => {
    await assert.rejects(() => saveProposalDraft(ALPHA_ADMIN, requestId, proposal()), isErr(403));
    await assert.rejects(() => saveProposalDraft(REVIEWER, requestId, proposal()), isErr(403));
    await assert.rejects(() => saveProposalDraft(LEAD, requestId, proposal({ validUntil: "2020-01-01" })), isErr(400));
    const v1 = await saveProposalDraft(LEAD, requestId, proposal());
    assert.equal(v1.version, 1);
    assert.equal(await status(requestId), "PROPOSAL_PREPARED");
    assert.equal((await getRemediationRequest(ALPHA_ADMIN, requestId)).proposals.length, 0, "draft hidden from the customer");
    assert.equal((await getRemediationRequest(LEAD, requestId)).proposals.length, 1);
    await saveProposalDraft(LEAD, requestId, proposal({ estimatedTimeline: "8 weeks" }), v1.id);
    await assert.rejects(() => sendProposal(REVIEWER, v1.id), isErr(403));
    await sendProposal(LEAD, v1.id);
    assert.equal(await status(requestId), "PROPOSAL_SENT");
    const seen = (await getRemediationRequest(ALPHA_ADMIN, requestId)).proposals[0];
    assert.equal(seen.estimatedTimeline, "8 weeks");
    assert.equal(seen.feeAmountPaise, 25_000_000);
    await assert.rejects(() => saveProposalDraft(LEAD, requestId, proposal(), v1.id), isErr(409), "sent proposals cannot be edited");
    await assert.rejects(
      () => pool.query("UPDATE remediation_proposals SET commercial_terms = 'changed' WHERE id = $1;", [v1.id]),
      /FORENSIC_INTEGRITY_VIOLATION/,
      "frozen in the database too"
    );
  });

  it("records a customer question, then a revised version that supersedes the first", async () => {
    const v1 = (await getRemediationRequest(LEAD, requestId)).proposals[0];
    await assert.rejects(() => respondToProposal(ALPHA_ADMIN, v1.id, "CLARIFY", ""), isErr(400));
    await respondToProposal(ALPHA_LEAD, v1.id, "CLARIFY", "Does the fee include training materials?");
    assert.equal(await status(requestId), "UNDER_REVIEW");
    const v2 = await saveProposalDraft(LEAD, requestId, proposal({ commercialTerms: "Fixed fee including training materials" }));
    assert.equal(v2.version, 2);
    await sendProposal(LEAD, v2.id);
    const proposals = (await getRemediationRequest(ALPHA_ADMIN, requestId)).proposals;
    assert.deepEqual(proposals.map((p) => [p.version, p.status]), [[2, "SENT"], [1, "SUPERSEDED"]]);
    await assert.rejects(() => respondToProposal(ALPHA_ADMIN, v1.id, "ACCEPT"), isErr(409), "an old version cannot be accepted");
  });

  it("only the customer administrator accepts, and acceptance closes no gap and charges nothing", async () => {
    const v2 = (await getRemediationRequest(ALPHA_ADMIN, requestId)).proposals[0];
    await assert.rejects(() => respondToProposal(ALPHA_LEAD, v2.id, "ACCEPT"), isErr(403));
    await assert.rejects(() => respondToProposal(BETA_ADMIN, v2.id, "ACCEPT"), isErr(404));
    const paymentsBefore = Number((await pool.query("SELECT COUNT(*) AS n FROM report_payments;")).rows[0].n);
    await respondToProposal(ALPHA_ADMIN, v2.id, "ACCEPT", "Approved by the board");
    assert.equal(await status(requestId), "ACCEPTED");
    const detail = await getRemediationRequest(ALPHA_ADMIN, requestId);
    assert.equal(detail.acceptedProposalId, v2.id);
    assert.ok(detail.gaps.every((g) => g.taskStatus === null), "no gap is resolved by acceptance");
    assert.equal(Number((await pool.query("SELECT COUNT(*) AS n FROM report_payments;")).rows[0].n), paymentsBefore, "no charge");
  });

  it("starts the engagement with one open corrective action per gap", async () => {
    await assert.rejects(() => performRequestAction(ALPHA_ADMIN, requestId, "START_ENGAGEMENT"), isErr(403));
    await assert.rejects(() => performRequestAction(REVIEWER, requestId, "START_ENGAGEMENT"), isErr(403));
    await performRequestAction(LEAD, requestId, "START_ENGAGEMENT");
    const detail = await getRemediationRequest(ALPHA_ADMIN, requestId);
    assert.equal(detail.status, "IN_PROGRESS");
    assert.equal(detail.gaps.length, codes.length);
    assert.ok(detail.gaps.every((g) => g.taskStatus === "OPEN" && g.taskId), "tasks start open");
    await assert.rejects(() => performRequestAction(LEAD, requestId, "COMPLETE"), isErr(409), "cannot complete before every gap is verified");
  });

  it("tracks corrective evidence and only a TLI assessor can verify and close a gap", async () => {
    const [first, ...rest] = (await getRemediationRequest(ALPHA_ADMIN, requestId)).gaps;
    await assert.rejects(() => uploadRemediationDocument(ALPHA_ADMIN, requestId, { kind: "CORRECTIVE_EVIDENCE", taskId: null, fileName: "x.pdf", mimeType: "application/pdf", content: PDF }), isErr(400));
    await assert.rejects(() => uploadRemediationDocument(ALPHA_VIEWER, requestId, { kind: "CORRECTIVE_EVIDENCE", taskId: first.taskId, fileName: "x.pdf", mimeType: "application/pdf", content: PDF }), isErr(403));
    const { id: docId } = await uploadRemediationDocument(ALPHA_ADMIN, requestId, { kind: "CORRECTIVE_EVIDENCE", taskId: first.taskId, fileName: "policy-v2.pdf", mimeType: "application/pdf", content: PDF });
    assert.deepEqual((await downloadRemediationDocument(LEAD, docId)).buffer, PDF);
    await assert.rejects(() => downloadRemediationDocument(BETA_ADMIN, docId), isErr(404));

    // Addressed, then submitted for verification by the customer: still not closed.
    await updateRemediationProgress(ALPHA_ADMIN, first.taskId!, { status: "IN_REMEDIATION", assessmentId: ALPHA_ASSESSMENT });
    await updateRemediationProgress(ALPHA_ADMIN, first.taskId!, { status: "SUBMITTED_FOR_CLOSURE", closureSubmissionNotes: "Policy approved", assessmentId: ALPHA_ASSESSMENT });
    assert.equal((await listRemediationRequests(LEAD)).find((r) => r.id === requestId)?.awaitingVerification, 1, "in the verification queue");
    await assert.rejects(() => validateRemediationClosure(ALPHA_ADMIN, first.taskId!, { action: "VALIDATE_CLOSE", validationNotes: "self" }), /Authority violation/);
    await assert.rejects(() => updateRemediationProgress(ALPHA_ADMIN, first.taskId!, { status: "VALIDATED_CLOSED" as never }), /cannot validate|not allowed|invalid/i);

    await validateRemediationClosure(LEAD, first.taskId!, { action: "VALIDATE_CLOSE", validationNotes: "Evidence reviewed and accepted" });
    let detail = await getRemediationRequest(ALPHA_ADMIN, requestId);
    assert.equal(detail.gaps.find((g) => g.questionCode === first.questionCode)?.taskStatus, "VALIDATED_CLOSED");
    assert.equal(detail.closedGapCount, 1);

    for (const gap of rest) {
      await updateRemediationProgress(ALPHA_ADMIN, gap.taskId!, { status: "SUBMITTED_FOR_CLOSURE", closureSubmissionNotes: "Done", assessmentId: ALPHA_ASSESSMENT });
      await validateRemediationClosure(LEAD, gap.taskId!, { action: "VALIDATE_CLOSE", validationNotes: "Verified" });
    }
    await assert.rejects(() => performRequestAction(ALPHA_ADMIN, requestId, "COMPLETE"), isErr(403));
    await performRequestAction(LEAD, requestId, "COMPLETE");
    detail = await getRemediationRequest(ALPHA_ADMIN, requestId);
    assert.equal(detail.status, "COMPLETED");
    assert.equal(detail.closedGapCount, codes.length);
    const audit = (await pool.query("SELECT action FROM audit_logs WHERE entity_id = $1;", [requestId])).rows.map((r) => r.action);
    for (const a of ["REMEDIATION_REQUEST_DRAFTED", "REMEDIATION_SUBMIT", "REMEDIATION_PROPOSAL_SENT", "REMEDIATION_PROPOSAL_ACCEPT", "REMEDIATION_START_ENGAGEMENT", "REMEDIATION_DOCUMENT_UPLOADED", "REMEDIATION_COMPLETE"]) {
      assert.ok(audit.includes(a), `audited: ${a}`);
    }
  });

  it("handles declined proposals and cancelled requests", async () => {
    await markReportPaidForTests(BETA_ASSESSMENT).catch(() => undefined);
    const { id } = await createRemediationRequest(ALPHA_ADMIN, { assessmentId: ALPHA_ASSESSMENT, questionCodes: codes.slice(0, 1), helpDescription: "Second request for help please", wantsConsultation: false, submit: true });
    await performRequestAction(LEAD, id, "START_REVIEW");
    const p = await saveProposalDraft(LEAD, id, proposal());
    await sendProposal(LEAD, p.id);
    await respondToProposal(ALPHA_ADMIN, p.id, "DECLINE", "Not in budget this year");
    assert.equal(await status(id), "DECLINED");
    await assert.rejects(() => postMessage(ALPHA_ADMIN, id, "hello"), isErr(409));
    const { id: other } = await createRemediationRequest(ALPHA_ADMIN, { assessmentId: ALPHA_ASSESSMENT, questionCodes: codes.slice(0, 1), helpDescription: "Third request for help please", wantsConsultation: false, submit: true });
    await performRequestAction(ALPHA_ADMIN, other, "CANCEL", "Handled internally");
    assert.equal(await status(other), "CANCELLED");
    await assert.rejects(() => performRequestAction(ALPHA_ADMIN, other, "SUBMIT"), isErr(409));
  });
});
