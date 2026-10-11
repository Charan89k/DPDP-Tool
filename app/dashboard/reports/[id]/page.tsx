import React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { executeWithRls } from "@/lib/db/rls";
import { isTliRole, canFinalizeAssessment } from "@/lib/auth/rbac";
import { CANONICAL_DOMAINS } from "@/lib/questionnaire/data";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Shield,
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Building,
  User,
  ArrowLeft,
  Lock,
  Printer,
  FileCheck,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface ReportDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ReportDetailPage({ params }: ReportDetailPageProps) {
  const sessionUser = await getCurrentSession();
  const { id } = await params;

  if (!sessionUser) {
    redirect(`/login?redirect=/dashboard/reports/${id}`);
  }

  const isConsultant = isTliRole(sessionUser.role);
  const canFinalize = canFinalizeAssessment(sessionUser.role);

  // Fetch assessment under PostgreSQL RLS
  let assessment: any = null;

  try {
    assessment = await executeWithRls(sessionUser, async (client) => {
      const sql = `
        SELECT 
          a.id,
          a.tenant_id,
          a.title,
          a.status,
          fv.name AS target_framework,
          a.created_at AS start_date,
          a.target_completion_date,
          u.full_name AS lead_consultant_name,
          t.dpo_name AS dpo_contact_name,
          a.created_at,
          t.name AS tenant_name,
          t.slug AS tenant_slug,
          t.industry,
          t.is_sdf
        FROM assessments a
        JOIN framework_versions fv ON fv.id = a.framework_version_id
        LEFT JOIN users u ON u.id = a.lead_consultant_id
        LEFT JOIN tenants t ON t.id = a.tenant_id
        WHERE a.id = $1
        LIMIT 1;
      `;
      const res = await client.query(sql, [id]);
      return res.rows[0] || null;
    });
  } catch (err) {
    console.error("Error fetching report under RLS:", err);
  }

  // Cross-tenant boundary enforcement:
  // If not found under RLS, or if customer tries to access another tenant's report
  if (!assessment) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center bg-white border border-stone-200 rounded-xl my-12">
        <AlertCircle className="w-10 h-10 text-rose-600 mx-auto mb-3" />
        <h2 className="font-serif text-xl font-bold text-stone-900">
          Access Restricted / Report Not Found
        </h2>
        <p className="text-xs text-stone-600 max-w-md mx-auto mt-2 leading-relaxed">
          PostgreSQL Row-Level Security policy prohibits access to this report record or it does not exist within your tenant scope.
        </p>
        <Link
          href="/dashboard/reports"
          className="inline-flex items-center gap-1.5 px-4 py-2 mt-6 text-xs font-semibold bg-[#16191f] text-white rounded-md"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Reports List</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Navigation & Actions Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-200">
        <Link
          href="/dashboard/reports"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to All Reports</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/assessments/${assessment.id}/questionnaire`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-stone-300 hover:bg-stone-50 text-stone-800 rounded transition-colors"
          >
            <span>Open Inquest Questionnaire</span>
          </Link>
        </div>
      </div>

      {/* Synthetic Preview Watermark Alert */}
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong>PROVISIONAL AUDIT PREVIEW (SYNTHETIC FIXTURE):</strong> This document is generated for evaluation and validation purposes under DPDPA 2023 guidelines. In accordance with TLI governance decisions DEC-01 and DEC-08, numeric scores are advisory and pending formal methodology ratification.
        </div>
      </div>

      {/* Formal Document Container */}
      <article className="bg-white border border-stone-300 rounded-xl p-8 sm:p-12 shadow-xs space-y-10 text-stone-900">
        
        {/* Document Header */}
        <header className="border-b-2 border-stone-900 pb-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded border border-stone-400 bg-stone-900 flex items-center justify-center text-white font-serif font-bold text-sm tracking-tight">
                TLI
              </div>
              <div>
                <h1 className="font-serif text-lg font-bold tracking-tight text-stone-900">
                  Truth Labs International
                </h1>
                <p className="text-[11px] font-mono text-stone-500 uppercase tracking-widest">
                  Forensic Privacy & Compliance Advisory
                </p>
              </div>
            </div>

            <div className="text-right font-mono text-xs text-stone-500 space-y-0.5">
              <div>REF: <strong className="text-stone-800">TLI-DPDP-REP-{assessment.id.slice(0, 8).toUpperCase()}</strong></div>
              <div>DATE: {new Date().toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })}</div>
              <div>STATUS: <strong className="text-stone-900">{assessment.status}</strong></div>
            </div>
          </div>

          <div className="pt-4">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-stone-500 block mb-1">
              Independent Statutory Compliance Evaluation Report
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">
              {assessment.title}
            </h2>
            <p className="text-xs text-stone-600 mt-1">
              Evaluated Entity: <strong>{assessment.tenant_name}</strong> • Framework: <strong>{assessment.target_framework}</strong>
            </p>
          </div>
        </header>

        {/* Section 1: Scope & Engagement Perimeter */}
        <section className="space-y-4">
          <h3 className="font-serif text-base font-bold text-stone-900 pb-1 border-b border-stone-200">
            1. Scope & Engagement Perimeter
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono bg-stone-50 p-4 rounded-lg border border-stone-200">
            <div>
              <span className="text-stone-500 block text-[10px]">Data Fiduciary Entity:</span>
              <strong className="text-stone-900 font-sans text-xs">{assessment.tenant_name}</strong>
            </div>
            <div>
              <span className="text-stone-500 block text-[10px]">Fiduciary Classification:</span>
              <strong className="text-stone-900 font-sans text-xs">
                {assessment.is_sdf ? "Significant Data Fiduciary (SDF) — Section 10" : "Standard Data Fiduciary"}
              </strong>
            </div>
            <div>
              <span className="text-stone-500 block text-[10px]">Territorial & Material Perimeter:</span>
              <span className="text-stone-800 font-sans text-xs">Digital Personal Data within India (Section 3)</span>
            </div>
            <div>
              <span className="text-stone-500 block text-[10px]">Lead Forensic Consultant:</span>
              <span className="text-stone-800 font-sans text-xs">{assessment.lead_consultant_name || "Assigned by TLI"}</span>
            </div>
          </div>
        </section>

        {/* Section 2: Executive Summary & Non-Compensatory Evaluation */}
        <section className="space-y-4">
          <h3 className="font-serif text-base font-bold text-stone-900 pb-1 border-b border-stone-200">
            2. Executive Evaluation Summary
          </h3>
          <p className="text-xs text-stone-700 leading-relaxed">
            The Digital Personal Data Protection Act, 2023 establishes mandatory, non-negotiable obligations for entities processing digital personal data. In accordance with TLI forensic methodology, statutory compliance is evaluated on a <strong>non-compensatory standard</strong>: high operational maturity in administrative areas (e.g., privacy policies) does not cure or mitigate material technical deficiencies in mandatory statutory safeguards (such as Section 8(4) security controls or Section 8(6) breach notifications).
          </p>
          <div className="p-3 bg-stone-50 rounded border border-stone-200 text-xs text-stone-700 font-mono">
            Evaluated Scope: 30 Canonical Controls across 13 Statutory Domains • Evidence Vault Verified
          </div>
        </section>

        {/* Section 3: Domain-by-Domain Compliance Findings */}
        <section className="space-y-4">
          <h3 className="font-serif text-base font-bold text-stone-900 pb-1 border-b border-stone-200">
            3. Domain Findings & Statutory Breakdown
          </h3>
          <div className="space-y-3">
            {CANONICAL_DOMAINS.map((domain, index) => (
              <div
                key={domain.code}
                className="p-3.5 bg-white border border-stone-200 rounded-lg text-xs space-y-1.5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold bg-stone-100 text-stone-800 px-1.5 py-0.5 rounded border border-stone-300">
                      Domain {index + 1}
                    </span>
                    <h4 className="font-serif font-bold text-stone-900 text-xs">
                      {domain.title}
                    </h4>
                  </div>
                  <span className="font-mono text-[10px] text-stone-500">
                    Domain Weight: {domain.weight.toFixed(2)}x
                  </span>
                </div>
                <p className="text-stone-600 text-[11px] leading-relaxed">
                  <strong>Statutory Provision:</strong> {domain.statutoryFocus}
                </p>
                <div className="text-[11px] text-stone-500 flex items-center justify-between pt-1 border-t border-stone-100 font-mono">
                  <span>Evaluation: Controls Scoped and Operational</span>
                  <span className="text-emerald-700 font-sans font-semibold">Active Inquest Scope</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: Evidence Limitations & Verification Ledger */}
        <section className="space-y-4">
          <h3 className="font-serif text-base font-bold text-stone-900 pb-1 border-b border-stone-200">
            4. Evidence Limitations & Vault Observations
          </h3>
          <div className="space-y-2.5 text-xs text-stone-700 leading-relaxed">
            <p>
              Under TLI forensic standards, self-attestations and policy manuals without demonstrable technical implementation logs or automated enforcement do not constitute satisfactory proof of compliance.
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-stone-600 text-[11px]">
              <li><strong>Notice & Transparency:</strong> Generic commercial terms of service bundling data consent violate Section 5(1) itemized requirements.</li>
              <li><strong>Security Safeguards (Section 8(4)):</strong> Encryption must be backed by documented KMS key-management governance and tenant-isolated vaults.</li>
              <li><strong>Breach Readiness (Section 8(6)):</strong> Unwritten or untested escalation procedures do not fulfill the dual notification standard.</li>
            </ul>
          </div>
        </section>

        {/* Section 5: Remediation Guidance */}
        <section className="space-y-4">
          <h3 className="font-serif text-base font-bold text-stone-900 pb-1 border-b border-stone-200">
            5. Recommended Remediation Sequence
          </h3>
          <ol className="list-decimal pl-5 space-y-2 text-xs text-stone-700 leading-relaxed">
            <li><strong>Tier 1 Statutory Controls (Penalty Ceiling: ₹250 Cr):</strong> Immediately implement reasonable security safeguards under Section 8(4) and configure technical access controls.</li>
            <li><strong>Tier 2 Breach Notification Protocol (Penalty Ceiling: ₹200 Cr):</strong> Formulate immediate Data Protection Board and Data Principal breach notification playbooks.</li>
            <li><strong>Pre-Consent Notice Standardization:</strong> Separate marketing consent from primary operational processing touchpoints in accordance with Section 5(1).</li>
          </ol>
        </section>

        {/* Section 6: Consultant Sign-off & Audit Disclaimer */}
        <footer className="pt-6 border-t-2 border-stone-900 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <span className="font-mono text-[10px] uppercase font-bold text-stone-500 block">
                Issuing Forensic Authority
              </span>
              <strong className="text-stone-900 font-serif block mt-1">Truth Labs International</strong>
              <p className="text-stone-500 text-[11px] mt-0.5">DPDP Compliance & Forensic Evaluation Practice</p>
            </div>
            <div>
              <span className="font-mono text-[10px] uppercase font-bold text-stone-500 block">
                Review Governance Status
              </span>
              <strong className="text-stone-900 block mt-1 font-mono">{assessment.status}</strong>
              <p className="text-stone-500 text-[11px] mt-0.5 font-mono">Governed by DEC-01 through DEC-10 Register</p>
            </div>
          </div>

          <p className="text-[10px] text-stone-400 font-serif italic pt-4 border-t border-stone-200 leading-relaxed">
            Disclaimer: This report constitutes a forensic compliance gap evaluation and does not constitute formal legal representation. Statutory penalties under the Digital Personal Data Protection Act, 2023 are adjudicated exclusively by the Data Protection Board of India.
          </p>
        </footer>
      </article>
    </div>
  );
}

