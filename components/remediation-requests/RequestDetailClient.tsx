"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileText, MessageSquare, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";
import type { RemediationRequestDetail } from "@/lib/remediation-requests/service";
import { formatInr } from "@/lib/payments/format";
import { postJson, fmtDateTime } from "@/components/consultations/shared";

type Variant = NonNullable<BadgeProps["variant"]>;
const REQUEST_STATUS: Record<string, [string, Variant]> = {
  DRAFT: ["Draft", "slate"], SUBMITTED: ["Submitted", "blue"], UNDER_REVIEW: ["Under TLI review", "blue"],
  CLARIFICATION_REQUIRED: ["Clarification required", "amber"], PROPOSAL_PREPARED: ["Proposal being prepared", "blue"],
  PROPOSAL_SENT: ["Proposal sent", "indigo"], ACCEPTED: ["Accepted", "emerald"], IN_PROGRESS: ["In progress", "indigo"],
  COMPLETED: ["Completed", "emerald"], DECLINED: ["Declined", "rose"], CANCELLED: ["Cancelled", "slate"],
};
// The gap's stage comes from its corrective-action task.
const GAP_STAGE: Record<string, [string, Variant]> = {
  NONE: ["Selected", "slate"], OPEN: ["Action planned", "blue"], IN_REMEDIATION: ["Being addressed", "amber"],
  SUBMITTED_FOR_CLOSURE: ["Submitted for verification", "indigo"], VALIDATED_CLOSED: ["Verified and closed", "emerald"], REJECTED_REOPENED: ["Reopened by TLI", "rose"],
};
export function RequestStatusBadge({ status }: { status: string }) {
  const [label, v] = REQUEST_STATUS[status] ?? [status, "slate" as Variant];
  return <Badge variant={v} size="sm">{label}</Badge>;
}

interface Props {
  detail: RemediationRequestDetail;
  canWrite: boolean; // customer roles that may act
  isClientAdmin: boolean;
  isAuthor: boolean; // TLI lead consultant / super admin
}

const EMPTY_PROPOSAL = { scopeOfServices: "", correctiveActivities: "", deliverables: "", estimatedTimeline: "", targetCompletionDate: "", commercialTerms: "", feeAmountRupees: "", validUntil: "" };

export function RequestDetailClient({ detail: d, canWrite, isClientAdmin, isAuthor }: Props) {
  const router = useRouter();
  const staff = d.viewerIsStaff;
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [message, setMessage] = useState("");
  const draft = d.proposals.find((p) => p.status === "DRAFT");
  const [proposal, setProposal] = useState(() => (draft ? { ...draft, feeAmountRupees: draft.feeAmountPaise === null ? "" : String(draft.feeAmountPaise / 100), targetCompletionDate: draft.targetCompletionDate ?? "", validUntil: draft.validUntil ?? "" } : EMPTY_PROPOSAL));
  const [file, setFile] = useState<{ kind: string; taskId: string }>({ kind: "SUPPORTING_DOCUMENT", taskId: "" });

  const call = async (url: string, body: unknown, done: string, method = "POST") => {
    setBusy(true);
    const { error } = await postJson(url, body, method);
    setBusy(false);
    setNotice(error ? { ok: false, text: error } : { ok: true, text: done });
    if (!error) router.refresh();
    return !error;
  };
  const action = (name: string, done: string, needsMessage = false) => {
    if (needsMessage && message.trim().length < 2) return setNotice({ ok: false, text: "Write a message first." });
    void call(`/api/remediation-requests/${d.id}`, { action: name, message }, done).then((ok) => ok && setMessage(""));
  };
  const taskUpdate = (taskId: string, body: Record<string, unknown>, done: string) => call(`/api/assessments/${d.assessmentId}/remediations/${taskId}`, body, done, "PATCH");
  const upload = async (input: HTMLInputElement) => {
    const f = input.files?.[0];
    if (!f) return;
    const form = new FormData();
    form.set("file", f);
    form.set("kind", file.kind);
    if (file.taskId) form.set("taskId", file.taskId);
    setBusy(true);
    const res = await fetch(`/api/remediation-requests/${d.id}/documents`, { method: "POST", body: form }).catch(() => null);
    setBusy(false);
    input.value = "";
    const body = res ? await res.json().catch(() => ({})) : {};
    setNotice(res?.ok ? { ok: true, text: "Document uploaded." } : { ok: false, text: body.error || "Upload failed." });
    if (res?.ok) router.refresh();
  };
  const active = !["COMPLETED", "DECLINED", "CANCELLED", "DRAFT"].includes(d.status);
  const input = "border border-slate-300 rounded-md px-2 py-1.5 text-sm w-full";
  const can = (s: string[]) => s.includes(d.status);

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-12">
      <Link href="/dashboard/remediation-requests" className="text-xs font-semibold text-slate-600">← All remediation requests</Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Remediation request</h1>
          <p className="text-sm text-slate-600 mt-1">{d.organisation} · assessment {d.engagementCode} · requested by {d.requestedBy}{d.assignedAssessor ? ` · TLI assessor ${d.assignedAssessor}` : ""}</p>
        </div>
        <RequestStatusBadge status={d.status} />
      </header>
      {notice && <div role="status" className={`p-3 rounded-md border text-sm ${notice.ok ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-rose-50 border-rose-200 text-rose-900"}`}>{notice.text}</div>}

      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
        <h2 className="text-base font-semibold">Request</h2>
        <p className="text-sm text-slate-700 whitespace-pre-wrap">{d.helpDescription || "No description yet."}</p>
        {d.wantsConsultation && !staff && <Link className="text-sm text-blue-700 underline" href={`/dashboard/consultations?type=REMEDIATION_PLANNING&assessment=${d.assessmentId}&request=${d.id}`}>Book the remediation planning consultation</Link>}
        <div className="flex flex-wrap gap-2 pt-2">
          {canWrite && d.status === "DRAFT" && <button disabled={busy} onClick={() => action("SUBMIT", "Request submitted to TLI.")} className="px-3 py-1.5 text-sm bg-[#0B3B6F] text-white rounded-md">Submit request</button>}
          {canWrite && can(["DRAFT", "SUBMITTED", "UNDER_REVIEW", "CLARIFICATION_REQUIRED", "PROPOSAL_PREPARED", "PROPOSAL_SENT"]) && <button disabled={busy} onClick={() => window.confirm("Cancel this request?") && action("CANCEL", "Request cancelled.")} className="px-3 py-1.5 text-sm border border-slate-300 rounded-md">Cancel request</button>}
          {staff && d.status === "SUBMITTED" && <button disabled={busy} onClick={() => action("START_REVIEW", "Review started.")} className="px-3 py-1.5 text-sm bg-[#0B3B6F] text-white rounded-md">Start review</button>}
          {isAuthor && d.status === "ACCEPTED" && <button disabled={busy} onClick={() => action("START_ENGAGEMENT", "Engagement started; corrective actions created.")} className="px-3 py-1.5 text-sm bg-[#0B3B6F] text-white rounded-md">Start engagement</button>}
          {isAuthor && d.status === "IN_PROGRESS" && <button disabled={busy || d.closedGapCount < d.gapCount} title={d.closedGapCount < d.gapCount ? "Every gap must be verified and closed first" : undefined} onClick={() => action("COMPLETE", "Engagement completed.")} className="px-3 py-1.5 text-sm border border-emerald-400 text-emerald-800 rounded-md disabled:opacity-50">Complete engagement</button>}
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-5" aria-labelledby="gaps-heading">
        <h2 id="gaps-heading" className="text-base font-semibold mb-1">Compliance gaps ({d.closedGapCount} of {d.gapCount} verified and closed)</h2>
        <p className="text-xs text-slate-500 mb-3">A gap is closed only when a TLI assessor verifies the corrective evidence. Accepting a proposal does not close any gap.</p>
        <ul className="divide-y divide-slate-100">
          {d.gaps.map((g) => {
            const [label, v] = GAP_STAGE[g.taskStatus ?? "NONE"] ?? [g.taskStatus ?? "", "slate" as Variant];
            return (
              <li key={g.questionCode} className="py-3 flex flex-col md:flex-row md:items-start justify-between gap-2">
                <div className="text-sm">
                  <span className="font-mono text-xs font-semibold mr-2">{g.questionCode}</span>{g.title}
                  <div className="text-xs text-slate-500 mt-0.5">{g.severity.replace(/_/g, " ").toLowerCase()}{g.targetDate ? ` · target ${g.targetDate}` : ""}{g.verifiedAt ? ` · verified ${fmtDateTime(g.verifiedAt)}` : ""}</div>
                  {g.verificationNotes && <div className="text-xs text-slate-600 mt-0.5">TLI: {g.verificationNotes}</div>}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <Badge variant={v} size="sm">{label}</Badge>
                  {g.taskId && canWrite && (g.taskStatus === "OPEN" || g.taskStatus === "REJECTED_REOPENED") && <button disabled={busy} onClick={() => taskUpdate(g.taskId!, { status: "IN_REMEDIATION" }, "Marked as being addressed.")} className="px-2 py-1 border border-slate-300 rounded">Mark being addressed</button>}
                  {g.taskId && canWrite && (g.taskStatus === "IN_REMEDIATION" || g.taskStatus === "OPEN" || g.taskStatus === "REJECTED_REOPENED") && <button disabled={busy} onClick={() => { const notes = window.prompt("What was done? (shown to the TLI assessor)") ?? null; if (notes !== null) void taskUpdate(g.taskId!, { status: "SUBMITTED_FOR_CLOSURE", closureSubmissionNotes: notes }, "Submitted for TLI verification."); }} className="px-2 py-1 border border-indigo-300 text-indigo-800 rounded">Submit for verification</button>}
                  {g.taskId && staff && g.taskStatus === "SUBMITTED_FOR_CLOSURE" && <>
                    <button disabled={busy} onClick={() => { const notes = window.prompt("Verification notes") ?? null; if (notes !== null) void taskUpdate(g.taskId!, { action: "VALIDATE_CLOSE", validationNotes: notes }, "Gap verified and closed."); }} className="px-2 py-1 bg-emerald-700 text-white rounded inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Verify and close</button>
                    <button disabled={busy} onClick={() => { const notes = window.prompt("Why is the evidence insufficient?") ?? null; if (notes) void taskUpdate(g.taskId!, { action: "REJECT_REOPEN", validationNotes: notes }, "Reopened."); }} className="px-2 py-1 border border-rose-300 text-rose-700 rounded">Reopen</button>
                  </>}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3" aria-labelledby="proposals-heading">
        <h2 id="proposals-heading" className="text-base font-semibold">Proposals</h2>
        {d.proposals.filter((p) => p.status !== "DRAFT" || staff).length === 0 && <p className="text-sm text-slate-500">{staff ? "No proposal yet." : "TLI has not sent a proposal yet."}</p>}
        {d.proposals.filter((p) => p.status !== "DRAFT").map((p) => (
          <article key={p.id} className={`border rounded-lg p-4 text-sm space-y-2 ${p.status === "SENT" ? "border-indigo-300" : "border-slate-200"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong>Version {p.version}</strong>
              <Badge variant={p.status === "ACCEPTED" ? "emerald" : p.status === "SENT" ? "indigo" : p.status === "DECLINED" ? "rose" : "slate"} size="sm">{p.status.replace(/_/g, " ").toLowerCase()}</Badge>
            </div>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
              {[["Scope of services", p.scopeOfServices], ["Corrective activities", p.correctiveActivities], ["Deliverables", p.deliverables], ["Estimated timeline", `${p.estimatedTimeline} (target ${p.targetCompletionDate})`], ["Commercial terms", `${p.commercialTerms}${p.feeAmountPaise !== null ? ` · ${formatInr(p.feeAmountPaise)}` : ""}`], ["Valid until", p.validUntil ?? ""], ["Prepared by", p.preparedBy]].map(([k, v]) => (
                <div key={k}><dt className="text-xs font-semibold text-slate-500">{k}</dt><dd className="whitespace-pre-wrap text-slate-800">{v}</dd></div>
              ))}
            </dl>
            {p.responseNote && <p className="text-xs text-slate-600">Response: {p.responseNote}</p>}
            {p.status === "SENT" && canWrite && (
              <div className="flex flex-wrap gap-2 pt-1">
                {isClientAdmin && <button disabled={busy} onClick={() => window.confirm("Accept this proposal? No payment is taken in the platform.") && call(`/api/remediation-proposals/${p.id}`, { action: "ACCEPT", note: message }, "Proposal accepted. TLI will start the engagement.")} className="px-3 py-1.5 bg-emerald-700 text-white rounded-md">Accept</button>}
                {isClientAdmin && <button disabled={busy} onClick={() => window.confirm("Decline this proposal?") && call(`/api/remediation-proposals/${p.id}`, { action: "DECLINE", note: message }, "Proposal declined.")} className="px-3 py-1.5 border border-rose-300 text-rose-700 rounded-md">Decline</button>}
                <button disabled={busy || message.trim().length < 2} onClick={() => call(`/api/remediation-proposals/${p.id}`, { action: "CLARIFY", note: message }, "Question sent to TLI.").then((ok) => ok && setMessage(""))} className="px-3 py-1.5 border border-slate-300 rounded-md disabled:opacity-50">Ask a question (uses the message box below)</button>
              </div>
            )}
          </article>
        ))}
        {isAuthor && can(["UNDER_REVIEW", "PROPOSAL_PREPARED", "CLARIFICATION_REQUIRED", "PROPOSAL_SENT"]) && (
          <form className="border border-dashed border-slate-300 rounded-lg p-4 space-y-2 text-sm" onSubmit={(e) => { e.preventDefault(); void call(`/api/remediation-requests/${d.id}/proposals`, { ...proposal, proposalId: draft?.id, feeAmountRupees: proposal.feeAmountRupees === "" ? null : Number(proposal.feeAmountRupees) }, draft ? "Draft updated." : "Draft created."); }}>
            <h3 className="font-semibold">{draft ? `Draft version ${draft.version} (not visible to the customer)` : "Prepare a proposal"}</h3>
            {(["scopeOfServices", "correctiveActivities", "deliverables", "commercialTerms"] as const).map((k) => (
              <label key={k} className="block">{k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}<textarea required rows={2} value={proposal[k]} onChange={(e) => setProposal({ ...proposal, [k]: e.target.value })} className={input} /></label>
            ))}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <label>Estimated timeline<input required value={proposal.estimatedTimeline} onChange={(e) => setProposal({ ...proposal, estimatedTimeline: e.target.value })} className={input} /></label>
              <label>Target completion<input required type="date" value={proposal.targetCompletionDate} onChange={(e) => setProposal({ ...proposal, targetCompletionDate: e.target.value })} className={input} /></label>
              <label>Fee (₹, optional)<input type="number" min={0} step="0.01" value={proposal.feeAmountRupees} onChange={(e) => setProposal({ ...proposal, feeAmountRupees: e.target.value })} className={input} /></label>
              <label>Valid until<input required type="date" value={proposal.validUntil} onChange={(e) => setProposal({ ...proposal, validUntil: e.target.value })} className={input} /></label>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="px-3 py-1.5 border border-slate-300 rounded-md">{draft ? "Save draft" : "Create draft"}</button>
              {draft && <button type="button" disabled={busy} onClick={() => window.confirm("Send this proposal to the customer? It cannot be edited afterwards.") && call(`/api/remediation-proposals/${draft.id}`, { action: "SEND" }, "Proposal sent to the customer.")} className="px-3 py-1.5 bg-[#0B3B6F] text-white rounded-md">Send to customer</button>}
            </div>
          </form>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3" aria-labelledby="docs-heading">
        <h2 id="docs-heading" className="text-base font-semibold flex items-center gap-2"><FileText className="w-4 h-4" /> Documents and corrective evidence</h2>
        {d.documents.length === 0 ? <p className="text-sm text-slate-500">No documents yet.</p> : (
          <ul className="text-sm divide-y divide-slate-100">
            {d.documents.map((doc) => (
              <li key={doc.id} className="py-1.5 flex flex-wrap justify-between gap-2">
                <span>{doc.fileName} · {doc.kind === "CORRECTIVE_EVIDENCE" ? `corrective evidence${doc.taskId ? ` for ${d.gaps.find((g) => g.taskId === doc.taskId)?.questionCode ?? "a gap"}` : ""}` : "supporting document"} · {doc.uploadedBy}</span>
                <a href={`/api/remediation-documents/${doc.id}`} className="text-blue-700 text-xs">Download</a>
              </li>
            ))}
          </ul>
        )}
        {(canWrite || staff) && active && (
          <div className="flex flex-wrap items-end gap-2 text-sm">
            <label>Type<select value={file.kind} onChange={(e) => setFile({ ...file, kind: e.target.value })} className="border border-slate-300 rounded-md px-2 py-1 block">
              <option value="SUPPORTING_DOCUMENT">Supporting document</option>
              {d.status === "IN_PROGRESS" && <option value="CORRECTIVE_EVIDENCE">Corrective evidence</option>}
            </select></label>
            {file.kind === "CORRECTIVE_EVIDENCE" && <label>For gap<select value={file.taskId} onChange={(e) => setFile({ ...file, taskId: e.target.value })} className="border border-slate-300 rounded-md px-2 py-1 block"><option value="">Choose…</option>{d.gaps.filter((g) => g.taskId).map((g) => <option key={g.taskId!} value={g.taskId!}>{g.questionCode}</option>)}</select></label>}
            <label className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded-md cursor-pointer"><Upload className="w-3.5 h-3.5" /> Upload file<input type="file" className="sr-only" disabled={busy || (file.kind === "CORRECTIVE_EVIDENCE" && !file.taskId)} onChange={(e) => void upload(e.currentTarget)} /></label>
          </div>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3" aria-labelledby="messages-heading">
        <h2 id="messages-heading" className="text-base font-semibold flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Messages</h2>
        {d.messages.length === 0 ? <p className="text-sm text-slate-500">No messages yet.</p> : (
          <ul className="space-y-2">
            {d.messages.map((m) => (
              <li key={m.id} className={`p-3 rounded-lg text-sm ${m.side === "TLI" ? "bg-blue-50 border border-blue-100" : "bg-slate-50 border border-slate-200"}`}>
                <div className="text-xs text-slate-500 mb-1">{m.author} ({m.side === "TLI" ? "TLI" : d.organisation}) · {m.createdAt ? fmtDateTime(m.createdAt) : ""}{m.kind !== "MESSAGE" ? ` · ${m.kind.replace(/_/g, " ").toLowerCase()}` : ""}</div>
                <p className="whitespace-pre-wrap">{m.body}</p>
              </li>
            ))}
          </ul>
        )}
        {(canWrite || staff) && active && (
          <div className="space-y-2">
            <textarea aria-label="Message" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={5000} className={input} placeholder="Write a message" />
            <div className="flex flex-wrap gap-2 text-sm">
              {canWrite && d.status === "CLARIFICATION_REQUIRED" ? <button disabled={busy} onClick={() => action("RESPOND", "Reply sent to TLI.", true)} className="px-3 py-1.5 bg-[#0B3B6F] text-white rounded-md">Send reply</button> : <button disabled={busy} onClick={() => action("MESSAGE", "Message sent.", true)} className="px-3 py-1.5 border border-slate-300 rounded-md">Send message</button>}
              {staff && can(["UNDER_REVIEW", "PROPOSAL_PREPARED"]) && <button disabled={busy} onClick={() => action("REQUEST_CLARIFICATION", "Question sent to the customer.", true)} className="px-3 py-1.5 border border-amber-400 text-amber-800 rounded-md">Ask the customer for clarification</button>}
              {isAuthor && can(["SUBMITTED", "UNDER_REVIEW", "CLARIFICATION_REQUIRED", "PROPOSAL_PREPARED"]) && <button disabled={busy} onClick={() => window.confirm("Decline this request?") && action("DECLINE_REQUEST", "Request declined.", true)} className="px-3 py-1.5 border border-rose-300 text-rose-700 rounded-md">Decline request (uses message)</button>}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
