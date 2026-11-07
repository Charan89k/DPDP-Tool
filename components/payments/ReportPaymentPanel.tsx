"use client";

import React, { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Download, Lock, Mail, RefreshCw, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { readJsonResponse } from "@/lib/http/responses";
import { formatInr } from "@/lib/payments/format";
import { formatDateTime } from "@/lib/format/dates";
import type { ReportAccessView } from "@/lib/payments/queries";
import type { CheckoutOrder, VerificationResult } from "@/lib/payments/service";
import { PaymentStatusBadge, DeliveryStatusBadge } from "./status-badges";

const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", handler: (response: { error?: { description?: string } }) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

/** Loads Razorpay Checkout once; created by this (nonce-trusted) bundle, so the CSP allows it. */
function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Razorpay Checkout could not be loaded. Check your connection and try again."));
    document.body.appendChild(script);
  });
}

interface ReportPaymentPanelProps {
  assessmentId: string;
  engagementCode: string;
  view: ReportAccessView;
}

export function ReportPaymentPanel({ assessmentId, engagementCode, view }: ReportPaymentPanelProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "info" | "error" | "success"; text: string } | null>(null);

  const verify = useCallback(
    async (response: RazorpayResponse) => {
      setNotice({ tone: "info", text: "Confirming your payment with Razorpay…" });
      const res = await fetch("/api/payments/razorpay/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(response),
      }).catch(() => null);
      setBusy(false);
      if (!res) {
        setNotice({ tone: "error", text: "We could not confirm the payment because the connection dropped. Use “Check payment status”; you will not be charged twice." });
        return;
      }
      const { data, errorMessage } = await readJsonResponse<VerificationResult>(res);
      if (errorMessage) {
        setNotice({ tone: "error", text: errorMessage });
        return;
      }
      setNotice({ tone: data.status === "PAID" ? "success" : data.status === "FAILED" ? "error" : "info", text: data.message });
      router.refresh();
    },
    [router]
  );

  const pay = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/payments`, { method: "POST" }).catch(() => null);
      if (!res) throw new Error("Unable to reach the TLI platform. Please try again.");
      const { data: order, errorMessage } = await readJsonResponse<CheckoutOrder>(res);
      if (errorMessage) throw new Error(errorMessage);
      await loadCheckout();
      if (!window.Razorpay) throw new Error("Razorpay Checkout is unavailable.");
      const checkout = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amountPaise,
        currency: order.currency,
        name: "Truth Labs International",
        description: order.description,
        prefill: order.prefill,
        notes: { assessment_reference: engagementCode },
        theme: { color: "#0B3B6F" },
        handler: (response: RazorpayResponse) => void verify(response),
        modal: {
          ondismiss: () => {
            setBusy(false);
            setNotice({ tone: "info", text: "Payment was not completed. Your report stays locked; you can try again at any time." });
          },
        },
      });
      checkout.on("payment.failed", (response) => {
        setNotice({ tone: "error", text: `Payment failed: ${response.error?.description || "declined"}. You can try again.` });
      });
      checkout.open();
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : "The payment could not be started." });
      setBusy(false);
    }
  };

  const checkStatus = async () => {
    setBusy(true);
    const res = await fetch(`/api/assessments/${assessmentId}/payments/reconcile`, { method: "POST" }).catch(() => null);
    const result = res ? await readJsonResponse<{ settledPaymentIds: string[] }>(res) : null;
    setBusy(false);
    if (!result || result.errorMessage) {
      setNotice({ tone: "error", text: result?.errorMessage || "Unable to reach the TLI platform. Please try again." });
      return;
    }
    const settled = result.data.settledPaymentIds.length > 0;
    setNotice({
      tone: settled ? "success" : "info",
      text: settled ? "Payment confirmed. Your report is unlocked." : "No completed payment was found yet.",
    });
    router.refresh();
  };

  const hasPending = view.payments.some((p) => p.status === "PENDING");
  const noticeStyles = {
    info: "bg-blue-50 border-blue-200 text-blue-900",
    error: "bg-rose-50 border-rose-200 text-rose-900",
    success: "bg-emerald-50 border-emerald-200 text-emerald-900",
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5" aria-labelledby="report-access-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {view.unlocked ? <ShieldCheck className="w-6 h-6 text-emerald-600 mt-0.5" /> : <Lock className="w-6 h-6 text-slate-500 mt-0.5" />}
          <div>
            <h2 id="report-access-heading" className="text-lg font-bold text-slate-900">
              {view.unlocked ? "Your final report is unlocked" : view.reportReady ? "Your final report is ready" : "Your final report is being prepared"}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {view.unlocked
                ? "Download it below. A copy was also emailed to the administrator who paid."
                : view.reportReady
                  ? "TLI has reviewed and issued your report. It is released once payment is confirmed."
                  : "TLI is reviewing your assessment. You can request the report once it has been issued."}
            </p>
          </div>
        </div>
        {view.mode === "test" && <Badge variant="amber">Razorpay test mode</Badge>}
      </div>

      {view.unlocked ? (
        <a
          href={`/api/assessments/${assessmentId}/reports/download?draft=false`}
          download
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-[#0B3B6F] hover:bg-[#0A3260] text-white rounded-md"
        >
          <Download className="w-4 h-4" /> Download final report (.docx)
        </a>
      ) : view.reportReady ? (
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Amount payable</div>
            <div className="text-2xl font-bold text-slate-900">{view.pricePaise ? formatInr(view.pricePaise) : "Price not set"}</div>
          </div>
          {view.canPay ? (
            <button
              type="button"
              onClick={pay}
              disabled={busy || !view.paymentsConfigured || !view.pricePaise}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-[#0B3B6F] hover:bg-[#0A3260] disabled:opacity-50 text-white rounded-md"
            >
              <CreditCard className="w-4 h-4" />
              {view.payments.some((p) => p.status === "FAILED" || p.status === "PENDING") ? "Retry payment" : "Pay and get the report"}
            </button>
          ) : (
            <p className="text-sm text-slate-600">Ask your organisation&apos;s administrator to complete the payment.</p>
          )}
          {hasPending && (
            <button
              type="button"
              onClick={checkStatus}
              disabled={busy}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" /> Check payment status
            </button>
          )}
          {!view.paymentsConfigured && <p className="text-sm text-amber-800">Online payment is not available yet. Please contact TLI.</p>}
        </div>
      ) : null}

      {notice && (
        <div role="status" className={`p-3 border rounded-md text-sm ${noticeStyles[notice.tone]}`}>
          {notice.text}
        </div>
      )}

      {view.payments.length > 0 && (
        <div className="overflow-x-auto">
          <h3 className="text-sm font-semibold text-slate-800 mb-2">Payment history</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Amount</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Reference</th>
                <th className="py-2">Report email</th>
              </tr>
            </thead>
            <tbody>
              {view.payments.map((p) => {
                const clientDelivery = p.deliveries.find((d) => d.recipientType === "CLIENT");
                return (
                  <tr key={p.id} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap">{formatDateTime(p.paidAt ?? p.createdAt)}</td>
                    <td className="py-2 pr-3">{formatInr(p.amountPaise)}</td>
                    <td className="py-2 pr-3"><PaymentStatusBadge status={p.status} /></td>
                    <td className="py-2 pr-3 font-mono text-xs break-all">{p.razorpayPaymentId ?? p.razorpayOrderId}</td>
                    <td className="py-2">
                      {clientDelivery ? (
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-500" />
                          <DeliveryStatusBadge status={clientDelivery.status} />
                          <span className="text-xs text-slate-500">{clientDelivery.recipientEmail}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
