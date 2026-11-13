import React from "react";
import Link from "next/link";
import { CalendarCheck, ClipboardCheck, Layers } from "lucide-react";

/** Shown to customers on a paid report: the three ways TLI can help next. */
export function ComplianceJourney({ assessmentId }: { assessmentId: string }) {
  const options = [
    {
      icon: CalendarCheck,
      title: "Book a consultation",
      body: "Understand your findings, discuss compliance risks and get professional guidance from a TLI assessor.",
      href: `/dashboard/consultations?type=REPORT_WALKTHROUGH&assessment=${assessmentId}`,
      cta: "Choose a time",
    },
    {
      icon: ClipboardCheck,
      title: "Get help fixing compliance gaps",
      body: "Select the gaps you want fixed, explain what you need and receive a remediation proposal from TLI.",
      href: `/dashboard/remediation-requests/new?assessment=${assessmentId}`,
      cta: "Select gaps",
    },
    {
      icon: Layers,
      title: "Consultation + remediation",
      body: "Request remediation help and book a planning consultation together.",
      href: `/dashboard/remediation-requests/new?assessment=${assessmentId}&consult=1`,
      cta: "Start both",
    },
  ];
  return (
    <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4" aria-labelledby="journey-heading">
      <div>
        <h2 id="journey-heading" className="text-lg font-bold text-slate-900">Continue Your Compliance Journey with Truth Labs International</h2>
        <p className="text-sm text-slate-600 mt-1">Nothing here is charged automatically; any remediation work is agreed through a proposal first.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {options.map(({ icon: Icon, title, body, href, cta }) => (
          <Link key={title} href={href} className="group border border-slate-200 rounded-lg p-4 hover:border-[#0B3B6F] hover:shadow-sm transition">
            <Icon className="w-6 h-6 text-[#0B3B6F]" aria-hidden="true" />
            <h3 className="font-semibold text-slate-900 mt-2">{title}</h3>
            <p className="text-sm text-slate-600 mt-1">{body}</p>
            <span className="inline-block text-sm font-semibold text-[#0B3B6F] mt-3 group-hover:underline">{cta} →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
