import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { isTliRole } from "@/lib/auth/rbac";
import { executeWithRls } from "@/lib/db/rls";
import { listRemediationRequests } from "@/lib/remediation-requests/service";
import { RequestStatusBadge } from "@/components/remediation-requests/RequestDetailClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Remediation requests" };

const STATUSES = ["SUBMITTED", "UNDER_REVIEW", "CLARIFICATION_REQUIRED", "PROPOSAL_PREPARED", "PROPOSAL_SENT", "ACCEPTED", "IN_PROGRESS", "COMPLETED", "DECLINED", "CANCELLED", "DRAFT"];

interface Props {
  searchParams: Promise<{ status?: string; org?: string }>;
}

export default async function RemediationRequestsPage({ searchParams }: Props) {
  const session = await getCurrentSession();
  if (!session) redirect("/login?redirect=/dashboard/remediation-requests");
  const staff = isTliRole(session.role);
  const q = await searchParams;
  const status = STATUSES.includes(q.status ?? "") ? q.status : undefined;
  const [requests, orgs] = await Promise.all([
    listRemediationRequests(session, { status, tenantId: staff ? q.org || undefined : undefined }),
    staff ? executeWithRls(session, async (c) => (await c.query<{ id: string; name: string }>("SELECT id, name FROM tenants WHERE type = 'CLIENT' ORDER BY name;")).rows) : Promise.resolve([]),
  ]);
  const queue = requests.filter((r) => r.awaitingVerification > 0);
  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-12">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{staff ? "Remediation management" : "Remediation requests"}</h1>
          <p className="text-sm text-slate-600 mt-1">{staff ? "Customer requests, proposals, engagements and the verification queue." : "Ask TLI for help fixing gaps from your paid report, review proposals and track corrective actions."}</p>
        </div>
        <form className="flex flex-wrap gap-2 text-sm" method="get">
          {staff && <select name="org" defaultValue={q.org ?? ""} aria-label="Organisation" className="border border-slate-300 rounded-md px-2 py-1"><option value="">All organisations</option>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>}
          <select name="status" defaultValue={status ?? ""} aria-label="Status" className="border border-slate-300 rounded-md px-2 py-1"><option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ").toLowerCase()}</option>)}</select>
          <button type="submit" className="px-3 py-1 border border-slate-300 rounded-md">Filter</button>
        </form>
      </header>
      {staff && queue.length > 0 && (
        <section className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-sm" aria-label="Verification queue">
          <h2 className="font-semibold text-indigo-900 mb-2">Verification queue</h2>
          <ul className="space-y-1">{queue.map((r) => <li key={r.id}><Link href={`/dashboard/remediation-requests/${r.id}`} className="text-indigo-800 underline">{r.organisation} · {r.engagementCode}</Link>: {r.awaitingVerification} corrective action{r.awaitingVerification === 1 ? "" : "s"} awaiting verification</li>)}</ul>
        </section>
      )}
      <section className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200"><th className="p-3">Organisation / assessment</th><th className="p-3">Status</th><th className="p-3">Gaps closed</th><th className="p-3">TLI assessor</th><th className="p-3">Updated</th></tr></thead>
          <tbody>
            {requests.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-500">No remediation requests{status ? " with this status" : ""}.{!staff && " Open a paid report and choose “Get help fixing compliance gaps”."}</td></tr>}
            {requests.map((r) => (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="p-3"><Link href={`/dashboard/remediation-requests/${r.id}`} className="font-semibold text-blue-800 hover:underline">{r.organisation}</Link><div className="text-xs text-slate-500">{r.engagementCode} · {r.requestedBy}</div></td>
                <td className="p-3"><RequestStatusBadge status={r.status} />{r.awaitingVerification > 0 && <div className="text-xs text-indigo-700 mt-1">{r.awaitingVerification} awaiting verification</div>}</td>
                <td className="p-3">{r.closedGapCount} / {r.gapCount}</td>
                <td className="p-3">{r.assignedAssessor ?? "Not assigned"}</td>
                <td className="p-3 text-xs text-slate-500">{new Date(r.updatedAt).toLocaleDateString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
