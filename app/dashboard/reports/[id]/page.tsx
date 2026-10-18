import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { executeWithRls } from "@/lib/db/rls";
import { getAssessmentGapAnalysis } from "@/lib/gaps";
import { getAssessmentReportSnapshots } from "@/lib/reports";
import { CANONICAL_DOMAINS } from "@/lib/questionnaire/data";
import type { GapAnalysisOutput } from "@/lib/gaps/types";
import type { ReportSnapshotRecord } from "@/lib/reports/types";
import {
  FileText,
  Shield,
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface ReportDetailPageProps {
  params: Promise<{ id: string }>;
}

interface ReportAssessmentRow {
  id: string;
  tenant_id: string;
  title: string;
  status: string;
  target_framework: string;
  start_date: Date | null;
  target_completion_date: Date | null;
  lead_consultant_name: string | null;
  dpo_contact_name: string | null;
  created_at: Date | null;
  tenant_name: string | null;
  tenant_slug: string | null;
  industry: string | null;
  is_sdf: boolean;
}

export default async function ReportDetailPage({ params }: ReportDetailPageProps) {
  const sessionUser = await getCurrentSession();
  const { id } = await params;

  if (!sessionUser) {
    redirect(`/login?redirect=/dashboard/reports/${id}`);
  }


  // Fetch the assessment through the tenant policy layer
  let assessment: ReportAssessmentRow | null = null;

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

  let gapData: GapAnalysisOutput | null = null;
  if (assessment) {
    try {
      gapData = await getAssessmentGapAnalysis(sessionUser, id);
    } catch (err) {
      console.error("Error fetching gap analysis for report:", err);
    }
  }

  let reportSnapshots: ReportSnapshotRecord[] = [];
  if (assessment) {
    try {
      reportSnapshots = await getAssessmentReportSnapshots(sessionUser, id);
    } catch (err) {
      console.error("Error fetching report snapshots:", err);
    }
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
          This report does not exist, or your account does not have access to it.
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

  const isFinalIssued = assessment.status === "FINAL_ISSUED";

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

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/dashboard/assessments/${assessment.id}/gaps`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-800 rounded transition-colors"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            <span>Gap Analysis & Risk</span>
          </Link>
          <Link
            href={`/dashboard/assessments/${assessment.id}/remediation`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 rounded transition-colors"
          >
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>Remediation & CAPA</span>
          </Link>
          <a
            href={`/api/assessments/${assessment.id}/reports/download?draft=${!isFinalIssued}`}
            download
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#16191f] hover:bg-stone-800 text-white rounded transition-colors shadow-2xs"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{isFinalIssued ? "Download Official Report (.docx)" : "Download Draft Report (.docx)"}</span>
          </a>
        </div>
      </div>

      {/* Synthetic Preview / Watermark Notice */}
      {!isFinalIssued ? (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong>DRAFT EVALUATION REPORT (FOR REVIEW ONLY):</strong> This document is generated for consulting evaluation and review under DPDPA 2023 guidelines. In accordance with methodology decisions DEC-01 and DEC-08, numeric scores are advisory pending formal Lead Consultant approval.
          </div>
        </div>
      ) : (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-950 flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong>OFFICIALLY ISSUED REGULATORY COMPLIANCE REPORT:</strong> This report has been formally approved and issued by the CloudE5 lead consultant. The dataset snapshot is sealed and permanently immutable under PostgreSQL database triggers.
          </div>
        </div>
      )}

      {/* Formal Document Container */}
      <article className="bg-white border border-stone-300 rounded-xl p-8 sm:p-12 shadow-xs space-y-10 text-stone-900">
        
        {/* Document Header */}
        <header className="border-b-2 border-stone-900 pb-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded border border-stone-400 bg-stone-900 flex items-center justify-center text-white font-serif font-bold text-sm tracking-tight">
                CE5
              </div>
              <div>
                <h1 className="font-serif text-lg font-bold tracking-tight text-stone-900">
                  CloudE5
                </h1>
                <p className="text-[11px] font-mono text-stone-500 uppercase tracking-widest">
                  Forensic Privacy & Compliance Advisory
                </p>
              </div>
            </div>

            <div className="text-right font-mono text-xs text-stone-500 space-y-0.5">
              <div>REF: <strong className="text-stone-800">CE5-REP-{assessment.id.slice(0, 8).toUpperCase()}</strong></div>
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
              <span className="text-stone-800 font-sans text-xs">{assessment.lead_consultant_name || "Assigned by CloudE5"}</span>
            </div>
          </div>
        </section>

        {/* Section 2: Executive Summary & Non-Compensatory Evaluation */}
        <section className="space-y-4">
          <h3 className="font-serif text-base font-bold text-stone-900 pb-1 border-b border-stone-200">
            2. Executive Evaluation Summary
          </h3>
          <p className="text-xs text-stone-700 leading-relaxed">
            The Digital Personal Data Protection Act, 2023 establishes mandatory, non-negotiable obligations for entities processing digital personal data. In accordance with the CloudE5 methodology, statutory compliance is evaluated on a <strong>non-compensatory standard</strong>: high operational maturity in administrative areas (e.g., privacy policies) does not cure or mitigate material technical deficiencies in mandatory statutory safeguards (such as Section 8(4) security controls or Section 8(6) breach notifications).
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
            <div className="p-3 bg-stone-50 rounded border border-stone-200">
              <span className="text-stone-500 block text-[10px]">Indicative Readiness:</span>
              <strong className="text-stone-900 text-sm">
                {gapData ? `${gapData.summary.provisionalReadinessPct}%` : "Pending"}
              </strong>
            </div>
            <div className="p-3 bg-stone-50 rounded border border-stone-200">
              <span className="text-stone-500 block text-[10px]">Maturity Score:</span>
              <strong className="text-stone-900 text-sm">
                {gapData ? `${gapData.summary.provisionalMaturityScore.toFixed(2)} / 5.00` : "Pending"}
              </strong>
            </div>
            <div className="p-3 bg-rose-50 rounded border border-rose-200">
              <span className="text-rose-700 block text-[10px]">Critical Gaps:</span>
              <strong className="text-rose-900 text-sm">
                {gapData ? `${gapData.summary.criticalGapsCount} Deficits` : "0 Deficits"}
              </strong>
            </div>
            <div className="p-3 bg-stone-50 rounded border border-stone-200">
              <span className="text-stone-500 block text-[10px]">Completeness:</span>
              <strong className="text-stone-900 text-sm">
                {gapData ? `${gapData.summary.completenessPct}%` : "Pending"}
              </strong>
            </div>
          </div>
          <div className="p-3 bg-stone-50 rounded border border-stone-200 text-xs text-stone-700 font-mono flex items-center justify-between">
            <span>Evaluated Scope: 60 Canonical Questions across 8 Sections & 13 Statutory Domains</span>
            <span className="text-stone-500">{gapData ? `${gapData.summary.totalGapsCount} Total Gaps Identified` : ""}</span>
          </div>
        </section>

        {/* Section 3: Domain-by-Domain Compliance Findings */}
        <section className="space-y-4">
          <div className="flex items-center justify-between pb-1 border-b border-stone-200">
            <h3 className="font-serif text-base font-bold text-stone-900">
              3. Domain Findings & Statutory Breakdown
            </h3>
            <span className="font-mono text-[11px] text-stone-500">
              {gapData ? `${gapData.domainSummaries.length} Statutory Domains` : "13 Domains"}
            </span>
          </div>
          <div className="space-y-3">
            {gapData && gapData.domainSummaries.length > 0 ? (
              gapData.domainSummaries.map((domain, index: number) => (
                <div
                  key={domain.domainCode}
                  className="p-3.5 bg-white border border-stone-200 rounded-lg text-xs space-y-1.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold bg-stone-100 text-stone-800 px-1.5 py-0.5 rounded border border-stone-300">
                        Domain {index + 1}
                      </span>
                      <h4 className="font-serif font-bold text-stone-900 text-xs">
                        {domain.domainTitle}
                      </h4>
                    </div>
                    <span className="font-mono text-[10px] text-stone-500">
                      Domain Weight: {domain.domainWeight.toFixed(2)}x
                    </span>
                  </div>
                  <p className="text-stone-600 text-[11px] leading-relaxed">
                    <strong>Statutory Provision:</strong> {domain.statutoryProvision}
                  </p>
                  <div className="text-[11px] text-stone-500 flex items-center justify-between pt-1 border-t border-stone-100 font-mono">
                    <span>
                      Impl: <strong className="text-emerald-700">{domain.implementedCount}</strong> • Part: <strong className="text-amber-700">{domain.partiallyImplementedCount}</strong> • Not Impl: <strong className="text-rose-700">{domain.notImplementedCount}</strong>
                    </span>
                    <span className="font-sans font-semibold text-stone-900">
                      Readiness: {domain.readinessPct}%
                    </span>
                  </div>
                </div>
              ))
            ) : (
              CANONICAL_DOMAINS.map((domain, index) => (
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
                </div>
              ))
            )}
          </div>
        </section>

        {/* Section 4: Evidence Limitations & Verification Ledger */}
        <section className="space-y-4">
          <h3 className="font-serif text-base font-bold text-stone-900 pb-1 border-b border-stone-200">
            4. Evidence Limitations & Vault Observations
          </h3>
          <div className="space-y-2.5 text-xs text-stone-700 leading-relaxed">
            <p>
              Under the CloudE5 methodology, self-attestations and policy manuals without demonstrable technical implementation logs or automated enforcement do not constitute satisfactory proof of compliance.
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

        {/* Section 6: Issued Immutable Report Snapshots */}
        {reportSnapshots && reportSnapshots.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between pb-1 border-b border-stone-200">
              <h3 className="font-serif text-base font-bold text-stone-900">
                6. Issued Immutable Report Snapshots
              </h3>
              <span className="font-mono text-[11px] text-stone-500">
                {reportSnapshots.length} Formal Snapshots
              </span>
            </div>
            <div className="space-y-2.5">
              {reportSnapshots.map((snap) => (
                <div
                  key={snap.id}
                  className="p-3.5 bg-stone-50 border border-stone-200 rounded-lg text-xs space-y-2 font-mono"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                        {snap.reportType} • {snap.versionLabel}
                      </span>
                      <strong className="text-stone-900 font-sans text-xs">
                        Issued on {new Date(snap.createdAt).toLocaleString("en-IN")}
                      </strong>
                    </div>
                    <span className="text-stone-500 text-[10px]">
                      Approver: {snap.leadApproverName || "Lead Consultant"}
                    </span>
                  </div>
                  <div className="text-[10px] text-stone-600 space-y-0.5 break-all">
                    <div>Dataset SHA-256: <code>{snap.datasetSha256Hash}</code></div>
                    <div>File SHA-256: <code>{snap.fileSha256Hash}</code></div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Section 7: Consultant Sign-off & Audit Disclaimer */}
        <footer className="pt-6 border-t-2 border-stone-900 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <span className="font-mono text-[10px] uppercase font-bold text-stone-500 block">
                Issuing Forensic Authority
              </span>
              <strong className="text-stone-900 font-serif block mt-1">CloudE5</strong>
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

