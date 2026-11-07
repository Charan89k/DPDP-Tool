"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { readJsonResponse } from "@/lib/http/responses";
import { formatInr } from "@/lib/payments/format";
import { formatDateTime } from "@/lib/format/dates";
import type { PaymentView, PaymentStatusFilter } from "@/lib/payments/queries";
import { DeliveryStatusBadge, PaymentStatusBadge } from "./status-badges";

export interface AwaitingPaymentRow {
  assessmentId: string;
  engagementCode: string;
  title: string;
  status: string;
  tenantName: string;
  issuedAt: string | null;
}

interface PaymentsDashboardClientProps {
  payments: PaymentView[];
  awaiting: AwaitingPaymentRow[];
  filter: PaymentStatusFilter;
  pricePaise: number | null;
  mode: string | null;
  assessorEmailConfigured: boolean;
  canEditPrice: boolean;
  canResend: boolean;
}

const FILTER_LABELS: Record<PaymentStatusFilter, string> = {
  ALL: "All",
  PENDING: "Pending",
  PAID: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
  DELIVERY_FAILED: "Email failed",
};

export function PaymentsDashboardClient(props: PaymentsDashboardClientProps) {
  const { payments, awaiting, filter, pricePaise, mode, assessorEmailConfigured, canEditPrice, canResend } = props;
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [price, setPrice] = useState(pricePaise ? String(pricePaise / 100) : "");

  const call = async (key: string, url: string, init: RequestInit, success: (data: Record<string, unknown>) => string) => {
    setBusy(key);
    setMessage(null);
    const res = await fetch(url, init).catch(() => null);
    const result = res ? await readJsonResponse(res) : null;
    setBusy(null);
    if (!result || result.errorMessage) {
      setMessage({ tone: "error", text: result?.errorMessage || "Unable to reach the TLI platform. Please try again." });
      return;
    }
    setMessage({ tone: "ok", text: success(result.data) });
    router.refresh();
  };

  const failedDeliveries = payments.flatMap((p) => p.deliveries.filter((d) => d.status === "FAILED").map((d) => ({ p, d })));

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Report payments</h1>
          <p className="text-sm text-slate-600 mt-1">Razorpay orders, report release and email delivery for every assessment you can see.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {mode === "test" && <Badge variant="amber">Razorpay test mode</Badge>}
          {mode === "live" && <Badge variant="emerald">Razorpay live mode</Badge>}
          {(mode === null || mode === "misconfigured") && <Badge variant="rose">Razorpay not configured</Badge>}
          {!assessorEmailConfigured && <Badge variant="rose">TLI_ASSESSOR_EMAIL not set</Badge>}
          <button
            type="button"
            disabled={busy !== null}
            onClick={() =>
              call("reconcile", "/api/payments/reconcile", { method: "POST" }, (d) => {
                const settled = Array.isArray(d.settledPaymentIds) ? d.settledPaymentIds.length : 0;
                return `Checked ${String(d.checked)} orders with Razorpay: ${settled} newly confirmed, ${String(d.refunded)} refunds recorded.`;
              })
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reconcile with Razorpay
          </button>
        </div>
      </header>

      {message && (
        <div role="status" className={`p-3 border rounded-md text-sm ${message.tone === "ok" ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-rose-50 border-rose-200 text-rose-900"}`}>
          {message.text}
        </div>
      )}

      {failedDeliveries.length > 0 && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-sm text-rose-900 flex items-start gap-2" role="alert">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <strong>{failedDeliveries.length} report email{failedDeliveries.length === 1 ? "" : "s"} failed.</strong>{" "}
            {failedDeliveries.map(({ p, d }) => `${p.tenantName} ${p.engagementCode} (${d.recipientType === "CLIENT" ? "customer" : "TLI assessor"})`).join(", ")}.
            Fix the cause shown in the table, then use Resend. The customer is not charged again.
          </div>
        </div>
      )}

      <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-end gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Final report price</div>
          <div className="text-xl font-bold text-slate-900">{pricePaise ? formatInr(pricePaise) : "Not set"}</div>
        </div>
        {canEditPrice && (
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void call(
                "price",
                "/api/payments/settings",
                { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amountRupees: Number(price) }) },
                () => "Report price saved. New orders use it; open orders keep their original amount."
              );
            }}
          >
            <label className="text-sm text-slate-700">
              <span className="block text-xs font-semibold mb-1">New price (₹, incl. taxes)</span>
              <input
                type="number"
                min="1"
                step="0.01"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-40 px-3 py-1.5 border border-slate-300 rounded-md text-sm"
              />
            </label>
            <button type="submit" disabled={busy !== null} className="px-3 py-1.5 text-sm font-semibold bg-[#0B3B6F] text-white rounded-md disabled:opacity-50">
              Save price
            </button>
          </form>
        )}
      </section>

      <nav aria-label="Filter payments" className="flex flex-wrap gap-2">
        {(Object.keys(FILTER_LABELS) as PaymentStatusFilter[]).map((key) => (
          <Link
            key={key}
            href={key === "ALL" ? "/dashboard/payments" : `/dashboard/payments?status=${key}`}
            aria-current={filter === key ? "page" : undefined}
            className={`px-3 py-1 text-xs font-semibold rounded-full border ${filter === key ? "bg-[#0B3B6F] text-white border-[#0B3B6F]" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"}`}
          >
            {FILTER_LABELS[key]}
          </Link>
        ))}
      </nav>

      <section className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
              <th className="p-3">Organisation / assessment</th>
              <th className="p-3">Review status</th>
              <th className="p-3">Payment</th>
              <th className="p-3">Transaction</th>
              <th className="p-3">Customer email</th>
              <th className="p-3">TLI assessor email</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-500">No payments match this filter.</td>
              </tr>
            )}
            {payments.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 align-top">
                <td className="p-3">
                  <div className="font-semibold text-slate-900">{p.tenantName}</div>
                  <Link href={`/dashboard/reports/${p.assessmentId}`} className="text-xs text-blue-700 hover:underline">{p.engagementCode}</Link>
                  <div className="text-xs text-slate-500">{p.requestedByName} · {p.requestedByEmail}</div>
                </td>
                <td className="p-3 text-xs font-mono">{p.assessmentStatus}</td>
                <td className="p-3">
                  <PaymentStatusBadge status={p.status} />
                  <div className="text-sm font-semibold mt-1">{formatInr(p.amountPaise)}</div>
                  <div className="text-xs text-slate-500">{formatDateTime(p.paidAt ?? p.createdAt)}{p.mode === "test" ? " · test" : ""}</div>
                  {p.failureReason && <div className="text-xs text-rose-700 mt-1">{p.failureReason}</div>}
                </td>
                <td className="p-3 font-mono text-xs break-all">
                  <div>{p.razorpayPaymentId ?? "—"}</div>
                  <div className="text-slate-500">{p.razorpayOrderId}</div>
                </td>
                {(["CLIENT", "ASSESSOR"] as const).map((type) => {
                  const d = p.deliveries.find((x) => x.recipientType === type);
                  return (
                    <td key={type} className="p-3">
                      {d ? (
                        <div className="space-y-1">
                          <DeliveryStatusBadge status={d.status} attempts={d.attempts} />
                          <div className="text-xs text-slate-500 break-all">{d.recipientEmail || "no address"}</div>
                          {d.sentAt && <div className="text-xs text-slate-500">Sent {formatDateTime(d.sentAt)}</div>}
                          {d.lastError && d.status === "FAILED" && <div className="text-xs text-rose-700">{d.lastError}</div>}
                          {canResend && p.status === "PAID" && d.status !== "SENDING" && (
                            <button
                              type="button"
                              disabled={busy !== null}
                              onClick={() => {
                                const alreadySent = d.status === "SENT";
                                if (alreadySent && !window.confirm(`This report was already emailed to ${d.recipientEmail || "this recipient"}. Send it again?`)) return;
                                void call(
                                  `resend-${d.id}`,
                                  `/api/payments/deliveries/${d.id}/resend`,
                                  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmAlreadySent: alreadySent }) },
                                  (r) => (r.outcome === "SENT" ? "Report email sent." : "Sending failed; see the error in the table.")
                                );
                              }}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline disabled:opacity-50"
                            >
                              <Send className="w-3 h-3" /> {d.status === "SENT" ? "Send again" : "Resend"}
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Issued reports awaiting payment ({awaiting.length})</h2>
        {awaiting.length === 0 ? (
          <p className="text-sm text-slate-500">Every issued report has been paid for.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {awaiting.map((a) => (
              <li key={a.assessmentId} className="py-2 flex flex-wrap justify-between gap-2">
                <span>
                  <strong>{a.tenantName}</strong> · <Link href={`/dashboard/reports/${a.assessmentId}`} className="text-blue-700 hover:underline">{a.engagementCode}</Link> · {a.title}
                </span>
                <span className="text-xs text-slate-500">{a.status}{a.issuedAt ? ` · issued ${formatDateTime(a.issuedAt)}` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
