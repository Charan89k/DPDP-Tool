"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Shield,
  ShieldAlert,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  FileText,
  Search,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Download,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Paperclip,
  Layers,
} from "lucide-react";
import type { GapAnalysisOutput } from "@/lib/gaps/types";
import { isTliRole } from "@/lib/auth/rbac";
import type { UserRole } from "@/lib/auth/types";

interface GapDashboardProps {
  initialData: GapAnalysisOutput;
  userRole: UserRole;
  userName: string;
}

export function GapAnalysisDashboardClient({
  initialData,
  userRole,
}: GapDashboardProps) {
  const data = initialData;
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [sectionFilter, setSectionFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [expandedGapId, setExpandedGapId] = useState<string | null>(null);
  const [showDomainMatrix, setShowDomainMatrix] = useState(false);
  const [showDisclaimerDetails, setShowDisclaimerDetails] = useState(false);

  const isAssessor = isTliRole(userRole);

  const toggleRow = (id: string) => {
    setExpandedGapId((prev) => (prev === id ? null : id));
  };

  // Filtered gaps list
  const filteredGaps = useMemo(() => {
    return data.gaps.filter((g) => {
      // Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesCode = g.questionCode.toLowerCase().includes(query);
        const matchesText = g.questionText.toLowerCase().includes(query);
        const matchesControl = (g.mappedControlId || "").toLowerCase().includes(query);
        const matchesDomain = (g.statutoryDomain || "").toLowerCase().includes(query);
        if (!matchesCode && !matchesText && !matchesControl && !matchesDomain) {
          return false;
        }
      }

      // Severity filter
      if (severityFilter !== "ALL" && g.gapSeverity !== severityFilter) {
        return false;
      }

      // Section filter
      if (sectionFilter !== "ALL" && g.sectionCode !== sectionFilter) {
        return false;
      }

      // Gap type filter
      if (typeFilter !== "ALL") {
        if (typeFilter === "EVIDENCE_DEFICIENCY" && g.gapType !== "EVIDENCE_DEFICIENCY") {
          return false;
        } else if (typeFilter === "UNRESOLVED_MAPPING" && !g.isUnresolvedMapping) {
          return false;
        } else if (typeFilter !== "EVIDENCE_DEFICIENCY" && typeFilter !== "UNRESOLVED_MAPPING" && g.gapType !== typeFilter) {
          return false;
        }
      }

      return true;
    });
  }, [data.gaps, searchQuery, severityFilter, sectionFilter, typeFilter]);

  const summary = data.summary;
  const trend = data.trendComparison;

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "CRITICAL_GAP":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            CRITICAL GAP
          </span>
        );
      case "HIGH_DEFICIT":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            HIGH DEFICIT
          </span>
        );
      case "MEDIUM_DEFICIT":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            MEDIUM DEFICIT
          </span>
        );
      case "LOW_DEFICIT":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
            LOW DEFICIT
          </span>
        );
      case "INFORMATIONAL":
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-stone-100 text-stone-600 border border-stone-200">
            INFORMATIONAL
          </span>
        );
    }
  };

  const getFindingStageBadge = (stage: string) => {
    switch (stage) {
      case "APPROVED_FOR_REPORTING":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Report Approved
          </span>
        );
      case "ASSESSOR_REVIEWED":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            Assessor Reviewed
          </span>
        );
      case "PROVISIONAL_OBSERVATION":
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
            Provisional Observation
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Navigation Context */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Link
              href="/dashboard/assessments"
              className="text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              Assessments
            </Link>
            <span className="text-slate-400 text-xs">/</span>
            <Link
              href={`/dashboard/assessments/${data.assessmentId}/summary`}
              className="text-xs font-semibold text-[#0066FF] hover:underline"
            >
              {data.engagementCode}
            </Link>
            <span className="text-slate-400 text-xs">/</span>
            <span className="text-xs font-semibold text-slate-800">
              Gap Analysis & Risk Prioritization
            </span>
          </div>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Compliance Gap Analysis & Risk Engine
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              {data.assessmentStatus}
            </span>
            {data.isSdf && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                SDF (Section 10)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Data Fiduciary: <strong>{data.tenantName}</strong> • Evaluated under <strong>{data.frameworkName}</strong> • Assessment lead: <strong>{data.leadConsultantName}</strong>
          </p>
        </div>

        {/* Quick action shortcuts */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <Link
            href={`/dashboard/assessments/${data.assessmentId}/questionnaire`}
            className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-colors inline-flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span>Questionnaire</span>
          </Link>
          <Link
            href={`/dashboard/assessments/${data.assessmentId}/evidence`}
            className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-colors inline-flex items-center gap-1.5"
          >
            <Paperclip className="w-3.5 h-3.5 text-slate-500" />
            <span>Evidence Vault</span>
          </Link>
          {isAssessor && (
            <Link
              href={`/dashboard/assessments/${data.assessmentId}/review`}
              className="px-3 py-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold shadow-2xs transition-colors inline-flex items-center gap-1.5"
            >
              <Shield className="w-3.5 h-3.5 text-blue-600" />
              <span>Assessor Review</span>
            </Link>
          )}
        </div>
      </div>

      {/* 2. Governance Alert & Provisional Methodology Watermark */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 shadow-xs space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-amber-950">PROVISIONAL SCORING & GAP METHODOLOGY:</span>
                <span className="font-mono text-[11px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded border border-amber-300">
                  Model: {summary.scoringModelCode} ({summary.scoringModelVersion})
                </span>
                <span className="font-mono text-[10px] text-amber-700">
                  Hash: {summary.calculationHash.slice(0, 12)}...
                </span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Calculations represent diagnostic engineering measurements under governance decisions DEC-01, DEC-08, and DEC-10.
                Scores and gap classifications do NOT constitute legal determinations of statutory violation nor immunity certificates from the DPBI.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowDisclaimerDetails(!showDisclaimerDetails)}
            className="text-[11px] font-semibold text-amber-800 hover:underline flex-shrink-0"
          >
            {showDisclaimerDetails ? "Hide Details" : "View Governance Notice"}
          </button>
        </div>

        {showDisclaimerDetails && (
          <div className="pt-2 mt-2 border-t border-amber-200/80 font-mono text-[11px] text-amber-900 space-y-1.5">
            <p><strong>Statutory Base:</strong> Digital Personal Data Protection Act, 2023 (DPDPA 2023) r/w Draft Rules 2025.</p>
            <p><strong>Non-Compensatory Evaluation:</strong> High operational maturity in administrative policies does not compensate for statutory safeguard deficits under Section 8(4) or breach reporting delays under Section 8(6).</p>
            <p><strong>Unresolved Mappings:</strong> Questions GOV-005, GOV-006, GOV-008, APP-006 remain isolated pending official Excel build sheet mappings.</p>
            <p className="italic text-amber-800 pt-1">{summary.statutoryDisclaimer}</p>
          </div>
        )}
      </div>

      {/* 3. Top 5 Key Risk & Gap KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Total Gaps */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="text-2xl font-bold text-slate-900 leading-tight block">
                {summary.totalGapsCount}
              </span>
              <span className="text-xs text-slate-500 font-medium">Total Gaps</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            Across 60 canonical questions
          </p>
        </div>

        {/* Critical Gaps */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-2xl font-bold text-rose-700 leading-tight block">
                {summary.criticalGapsCount}
              </span>
              <span className="text-xs text-slate-500 font-medium">Critical Gaps</span>
            </div>
          </div>
          <p className="text-[10px] text-rose-600 font-medium mt-2">
            Absent Tier 1/2 safeguards
          </p>
        </div>

        {/* Evidence Deficiencies */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
              <Paperclip className="w-5 h-5" />
            </div>
            <div>
              <span className="text-2xl font-bold text-amber-800 leading-tight block">
                {summary.evidenceDeficienciesCount}
              </span>
              <span className="text-xs text-slate-500 font-medium">Evidence Gaps</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            Missing or rejected artifacts
          </p>
        </div>

        {/* Uncertainty & Unapproved NA */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-2xl font-bold text-purple-700 leading-tight block">
                {summary.unverifiedUnknownsCount + summary.unapprovedExclusionsCount}
              </span>
              <span className="text-xs text-slate-500 font-medium">Uncertainty</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            Unknowns ({summary.unverifiedUnknownsCount}) • Unverified NA ({summary.unapprovedExclusionsCount})
          </p>
        </div>

        {/* Assessment Completeness */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 text-[#0066FF] flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-2xl font-bold text-slate-900 leading-tight block">
                {summary.completenessPct}%
              </span>
              <span className="text-xs text-slate-500 font-medium">Completeness</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            {summary.answeredQuestions} of 60 questions answered
          </p>
        </div>
      </div>

      {/* 4. Multi-Metric Separation Ledger (Keeps Completeness, Evidence, Readiness Separate) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-sm text-slate-900">
              Multi-Metric Evaluation Ledger
            </h3>
            <p className="text-xs text-slate-500">
              Under the CloudE5 methodology, assessment completeness, evidence coverage, readiness scoring, and gap counts are evaluated as independent measures.
            </p>
          </div>
          <span className="font-mono text-[11px] text-slate-400">
            Audit Standard DEC-01
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          {/* Metric 1 */}
          <div className="p-3 bg-slate-50/75 rounded-lg border border-slate-200/80 space-y-1">
            <span className="text-slate-500 font-medium block">1. Assessment Completeness</span>
            <span className="text-lg font-bold text-slate-900 font-mono block">
              {summary.completenessPct}%
            </span>
            <p className="text-[11px] text-slate-500">
              {summary.answeredQuestions} answered • {summary.unansweredQuestions} remaining
            </p>
          </div>

          {/* Metric 2 */}
          <div className="p-3 bg-slate-50/75 rounded-lg border border-slate-200/80 space-y-1">
            <span className="text-slate-500 font-medium block">2. Response Coverage</span>
            <span className="text-lg font-bold text-slate-900 font-mono block">
              {summary.responseCoveragePct}%
            </span>
            <p className="text-[11px] text-slate-500">
              Scorable questions + verified exclusions
            </p>
          </div>

          {/* Metric 3 */}
          <div className="p-3 bg-slate-50/75 rounded-lg border border-slate-200/80 space-y-1">
            <span className="text-slate-500 font-medium block">3. Evidence Coverage</span>
            <span className="text-lg font-bold text-slate-900 font-mono block">
              {summary.evidenceCoveragePct}%
            </span>
            <p className="text-[11px] text-slate-500">
              Questions with uploaded artifacts
            </p>
          </div>

          {/* Metric 4 */}
          <div className="p-3 bg-slate-50/75 rounded-lg border border-slate-200/80 space-y-1">
            <span className="text-slate-500 font-medium block">4. Indicative Readiness</span>
            <span className="text-lg font-bold text-[#0066FF] font-mono block">
              {summary.provisionalReadinessPct}%
            </span>
            <p className="text-[11px] text-slate-500">
              Maturity: <strong className="text-slate-800">{summary.provisionalMaturityScore.toFixed(2)}</strong> / 5.00
            </p>
          </div>
        </div>
      </div>

      {/* 5. Statutory Penalty Ceilings & Historical Trend Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Statutory Penalty Ceilings (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>Statutory Penalty Exposure Categories (Section 33(1))</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Maximum potential statutory fine limits specified in the Schedule of DPDPA 2023. Not automatic penalties.
              </p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-2.5 bg-rose-50/60 rounded-lg border border-rose-200/80">
              <div>
                <span className="font-bold text-rose-950 block">Tier 1: Security Safeguards Deficit</span>
                <span className="text-[11px] text-rose-800">Section 33(1) r/w Schedule Item 1 (Failure to take reasonable security safeguards under Section 8(4))</span>
              </div>
              <div className="text-right">
                <span className="font-mono font-bold text-rose-700 text-sm block">Up to ₹250 Cr</span>
                <span className="text-[10px] text-rose-600 font-medium">Statutory Maximum</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-amber-50/60 rounded-lg border border-amber-200/80">
              <div>
                <span className="font-bold text-amber-950 block">Tier 2: Breach Notification / Children Data</span>
                <span className="text-[11px] text-amber-800">Section 33(1) r/w Schedule Items 2 & 3 (Failure to notify breach under Section 8(6) or Section 9 obligations)</span>
              </div>
              <div className="text-right">
                <span className="font-mono font-bold text-amber-700 text-sm block">Up to ₹200 Cr</span>
                <span className="text-[10px] text-amber-600 font-medium">Statutory Maximum</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-purple-50/60 rounded-lg border border-purple-200/80">
              <div>
                <span className="font-bold text-purple-950 block">Tier 3: Significant Data Fiduciary Mandates</span>
                <span className="text-[11px] text-purple-800">Section 33(1) r/w Schedule Item 4 (Failure to fulfill additional duties under Section 10)</span>
              </div>
              <div className="text-right">
                <span className="font-mono font-bold text-purple-700 text-sm block">Up to ₹150 Cr</span>
                <span className="text-[10px] text-purple-600 font-medium">Statutory Maximum</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <span className="font-bold text-slate-800 block">Tier 4: General Statutory Duties</span>
                <span className="text-[11px] text-slate-600">Section 33(1) r/w Schedule Item 6 (General non-compliance with statutory provisions or rules)</span>
              </div>
              <div className="text-right">
                <span className="font-mono font-bold text-slate-700 text-sm block">Up to ₹50 Cr</span>
                <span className="text-[10px] text-slate-500 font-medium">Statutory Maximum</span>
              </div>
            </div>
          </div>
        </div>

        {/* Historical Trends (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span>Assessment Cycle Trends</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Comparison against baseline audit cycles
              </p>
            </div>
          </div>

          {trend.hasPriorAssessment ? (
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200">
                <span className="text-[11px] font-semibold text-blue-900 block">
                  Baseline Engagement: {trend.priorEngagementCode}
                </span>
                <p className="text-[11px] text-blue-800 mt-0.5 leading-relaxed">
                  {trend.comparisonNotes}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase block">Readiness Shift</span>
                  <div className="flex items-center gap-1 mt-1 font-bold">
                    {(trend.readinessPctDelta ?? 0) >= 0 ? (
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                    )}
                    <span className={(trend.readinessPctDelta ?? 0) >= 0 ? "text-emerald-700" : "text-rose-700"}>
                      {(trend.readinessPctDelta ?? 0) >= 0 ? "+" : ""}{trend.readinessPctDelta}%
                    </span>
                  </div>
                </div>

                <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase block">Critical Gaps Delta</span>
                  <div className="flex items-center gap-1 mt-1 font-bold">
                    {(trend.criticalGapsDelta ?? 0) <= 0 ? (
                      <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <TrendingUp className="w-3.5 h-3.5 text-rose-600" />
                    )}
                    <span className={(trend.criticalGapsDelta ?? 0) <= 0 ? "text-emerald-700" : "text-rose-700"}>
                      {(trend.criticalGapsDelta ?? 0) > 0 ? "+" : ""}{trend.criticalGapsDelta}
                    </span>
                  </div>
                </div>
              </div>

              {trend.remediatedQuestions.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-semibold text-emerald-800 block mb-1">
                    Remediated Questions ({trend.remediatedQuestions.length}):
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {trend.remediatedQuestions.map((q) => (
                      <span key={q} className="font-mono text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded border border-emerald-200">
                        {q}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-500 space-y-1.5">
              <Minus className="w-6 h-6 text-slate-300 mx-auto" />
              <p className="font-medium text-slate-700">Baseline Assessment</p>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                This is the initial evaluation cycle. Re-audit trends will automatically populate in subsequent cycles.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 6. Statutory Domain Matrix Toggle */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => setShowDomainMatrix(!showDomainMatrix)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center space-x-2.5">
            <Layers className="w-4 h-4 text-[#0066FF]" />
            <h3 className="font-bold text-sm text-slate-900">
              Domain-by-Domain Compliance & Gap Matrix (13 Statutory Domains)
            </h3>
            <span className="text-xs text-slate-400">({data.domainSummaries.length} domains)</span>
          </div>
          {showDomainMatrix ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {showDomainMatrix && (
          <div className="p-4 pt-0 overflow-x-auto border-t border-slate-100">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Statutory Domain</th>
                  <th className="py-2.5 px-3">Provision</th>
                  <th className="py-2.5 px-3 text-center">Questions</th>
                  <th className="py-2.5 px-3 text-center">Implemented</th>
                  <th className="py-2.5 px-3 text-center">Partial</th>
                  <th className="py-2.5 px-3 text-center">Not Impl</th>
                  <th className="py-2.5 px-3 text-center">Gaps</th>
                  <th className="py-2.5 px-3 text-right">Readiness</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {data.domainSummaries.map((ds) => (
                  <tr key={ds.domainCode} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-3 font-sans font-semibold text-slate-800">
                      {ds.domainTitle}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                      {ds.statutoryProvision}
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-700">
                      {ds.totalQuestions}
                    </td>
                    <td className="py-2.5 px-3 text-center text-emerald-700 font-bold">
                      {ds.implementedCount}
                    </td>
                    <td className="py-2.5 px-3 text-center text-amber-700">
                      {ds.partiallyImplementedCount}
                    </td>
                    <td className="py-2.5 px-3 text-center text-rose-700 font-bold">
                      {ds.notImplementedCount}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        ds.totalGapsCount > 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                      }`}>
                        {ds.totalGapsCount}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-sans font-bold text-slate-900">
                      {ds.readinessPct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 7. Comprehensive Explainable Gaps Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-sm text-slate-900">
              Explainable Compliance Findings & Risk Ledger
            </h3>
            <p className="text-xs text-slate-500">
              Showing {filteredGaps.length} of {data.gaps.length} identified findings. Click any row to expand evidence, mapping, and remediation details.
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search code, text, control..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF]"
            />
          </div>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Severity Filter */}
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
            <span className="text-[11px] text-slate-400 font-medium px-1.5">Severity:</span>
            {["ALL", "CRITICAL_GAP", "HIGH_DEFICIT", "MEDIUM_DEFICIT", "LOW_DEFICIT", "INFORMATIONAL"].map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => setSeverityFilter(sev)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  severityFilter === sev
                    ? "bg-white text-slate-900 font-semibold shadow-2xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {sev === "ALL" ? "All" : sev.replace("_", " ")}
              </button>
            ))}
          </div>

          {/* Section Filter */}
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-medium focus:outline-none"
          >
            <option value="ALL">All Sections (8)</option>
            {data.sectionSummaries.map((sec) => (
              <option key={sec.sectionCode} value={sec.sectionCode}>
                {sec.sectionCode} — {sec.sectionTitle}
              </option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-medium focus:outline-none"
          >
            <option value="ALL">All Gap Types</option>
            <option value="NEGATIVE_RESPONSE">Not Implemented</option>
            <option value="PARTIAL_RESPONSE">Partially Implemented</option>
            <option value="INFORMATION_UNCERTAINTY">Unknown / Not Verified</option>
            <option value="UNAPPROVED_EXCLUSION">Unapproved N/A</option>
            <option value="EVIDENCE_DEFICIENCY">Evidence Deficiencies</option>
            <option value="UNRESOLVED_MAPPING">Unresolved Mappings</option>
          </select>
        </div>

        {/* Findings Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          {filteredGaps.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="font-semibold text-slate-800">No Compliance Gaps Match Filter</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Adjust your search or filter pills above to view other findings.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/75 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 w-28">Question Code</th>
                  <th className="py-3 px-3">Question & Statutory Basis</th>
                  <th className="py-3 px-3 w-32">Response</th>
                  <th className="py-3 px-3 w-28">Evidence</th>
                  <th className="py-3 px-3 w-32">Severity</th>
                  <th className="py-3 px-3 w-28">Stage</th>
                  <th className="py-3 px-2 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredGaps.map((item) => {
                  const isExpanded = expandedGapId === item.id;

                  return (
                    <React.Fragment key={item.id}>
                      <tr
                        onClick={() => toggleRow(item.id)}
                        className={`cursor-pointer transition-colors ${
                          isExpanded ? "bg-blue-50/50" : "hover:bg-slate-50/70"
                        }`}
                      >
                        {/* Question Code */}
                        <td className="py-3 px-3 font-mono font-semibold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[#0066FF] hover:underline">
                              {item.questionCode}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              ({item.sectionCode})
                            </span>
                          </div>
                        </td>

                        {/* Question Text & Control Mapping */}
                        <td className="py-3 px-3 space-y-0.5">
                          <p className="font-semibold text-slate-800 line-clamp-1">
                            {item.questionText}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            {item.isUnresolvedMapping ? (
                              <span className="font-mono text-[10px] bg-amber-50 text-amber-800 px-1.5 py-0.2 rounded border border-amber-200">
                                Unresolved Mapping (Excel Build Sheet Pending)
                              </span>
                            ) : (
                              <>
                                <span className="font-mono font-medium text-slate-700">
                                  {item.mappedControlId}
                                </span>
                                <span>•</span>
                                <span>{item.sourceProvision}</span>
                              </>
                            )}
                          </div>
                        </td>

                        {/* Response */}
                        <td className="py-3 px-3">
                          <span className="font-medium text-slate-700">
                            {item.selectedOption || "Unanswered"}
                          </span>
                        </td>

                        {/* Evidence */}
                        <td className="py-3 px-3 font-mono text-[11px]">
                          {item.evidenceCount > 0 ? (
                            <span className={`inline-flex items-center gap-1 font-semibold ${
                              item.evidenceStatus === "EVIDENCE_VERIFIED"
                                ? "text-emerald-700"
                                : item.evidenceStatus === "EVIDENCE_REJECTED"
                                ? "text-rose-700"
                                : "text-amber-700"
                            }`}>
                              <Paperclip className="w-3 h-3" />
                              <span>{item.evidenceCount} {item.evidenceCount === 1 ? "file" : "files"}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">No files</span>
                          )}
                        </td>

                        {/* Severity */}
                        <td className="py-3 px-3">
                          {getSeverityBadge(item.gapSeverity)}
                        </td>

                        {/* Stage */}
                        <td className="py-3 px-3">
                          {getFindingStageBadge(item.findingStage)}
                        </td>

                        {/* Chevron */}
                        <td className="py-3 px-2 text-slate-400">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-600" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </td>
                      </tr>

                      {/* Expanded Finding Detail Card */}
                      {isExpanded && (
                        <tr className="bg-slate-50/60 border-b border-slate-200">
                          <td colSpan={7} className="p-4 pl-12 space-y-4">
                            <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-2xs space-y-3.5">
                              {/* 1. Observation & Provenance */}
                              <div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider mb-1">
                                  1. Factual Observation & Statutory Basis
                                </span>
                                <p className="text-xs text-slate-800 leading-relaxed font-medium">
                                  {item.factualObservation}
                                </p>
                                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                                  {item.explanation}
                                </p>
                              </div>

                              {/* 2. Respondent Representation */}
                              {item.commentsAndJustification && (
                                <div className="p-2.5 bg-slate-50 rounded border border-slate-200/80">
                                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider mb-0.5">
                                    Respondent Justification / Comment
                                  </span>
                                  <p className="text-xs text-slate-700 font-sans italic">
                                    &ldquo;{item.commentsAndJustification}&rdquo;
                                  </p>
                                </div>
                              )}

                              {/* 3. Evidence Audit & Artifacts */}
                              <div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider mb-1">
                                  2. Attached Evidence Artifacts ({item.evidenceCount})
                                </span>
                                {item.evidenceItems.length > 0 ? (
                                  <div className="space-y-1.5">
                                    {item.evidenceItems.map((ev) => (
                                      <div
                                        key={ev.id}
                                        className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200 text-xs font-mono"
                                      >
                                        <div className="flex items-center space-x-2">
                                          <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                                          <span className="font-semibold text-slate-800">{ev.fileName}</span>
                                          <span className="text-slate-400 text-[10px]">
                                            ({(ev.fileSizeBytes / 1024).toFixed(0)} KB)
                                          </span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                          <span className={`px-2 py-0.2 rounded text-[10px] font-bold ${
                                            ev.status === "VERIFIED"
                                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                              : ev.status === "REJECTED"
                                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                                              : "bg-blue-50 text-blue-700 border border-blue-200"
                                          }`}>
                                            {ev.status}
                                          </span>
                                          <a
                                            href={`/api/evidence/${ev.id}/download`}
                                            className="text-[#0066FF] hover:underline"
                                            title="Download Artifact"
                                          >
                                            <Download className="w-3.5 h-3.5" />
                                          </a>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-500 italic">
                                    No documentary proof uploaded. Self-attestation is unsubstantiated.
                                  </p>
                                )}
                              </div>

                              {/* 4. Assessor Review Findings (Segregated: CloudE5 assessors only) */}
                              {item.assessorReview && isAssessor && (
                                <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-200/80 space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] uppercase font-bold text-blue-900 block tracking-wider">
                                      Assessor Review Notes (Confidential Internal View)
                                    </span>
                                    <span className="font-mono text-[10px] text-blue-700 font-semibold">
                                      Status: {item.assessorReview.reviewStatus || "Under Evaluation"}
                                    </span>
                                  </div>
                                  {item.assessorReview.reviewFindings && (
                                    <p className="text-xs text-slate-800 leading-relaxed">
                                      <strong>Findings:</strong> {item.assessorReview.reviewFindings}
                                    </p>
                                  )}
                                  {item.assessorReview.evidenceDeficiencyNotes && (
                                    <p className="text-xs text-rose-800 leading-relaxed">
                                      <strong>Deficiency Notes:</strong> {item.assessorReview.evidenceDeficiencyNotes}
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* 5. Potential Penalty Ceiling Exposure */}
                              {item.potentialPenaltyCeiling && (
                                <div className="p-2.5 bg-rose-50/50 rounded border border-rose-200 text-xs">
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="font-bold text-rose-950">
                                      Statutory Exposure Category: {item.potentialPenaltyCeiling.tier?.replace("_", " ")}
                                    </span>
                                    <span className="font-mono font-bold text-rose-700">
                                      Ceiling: Up to ₹{item.potentialPenaltyCeiling.ceilingCrores} Cr
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-rose-800 leading-relaxed">
                                    {item.potentialPenaltyCeiling.disclaimer}
                                  </p>
                                </div>
                              )}

                              {/* 6. Remediation Guidance */}
                              <div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider mb-1">
                                  3. Recommended Remediation Action
                                </span>
                                <p className="text-xs text-slate-700 leading-relaxed font-sans">
                                  {item.remediationGuidance}
                                </p>
                              </div>

                              {/* Drill-down action links */}
                              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-3 text-xs font-semibold">
                                <Link
                                  href={`/dashboard/assessments/${data.assessmentId}/questionnaire`}
                                  className="text-[#0066FF] hover:underline inline-flex items-center gap-1"
                                >
                                  <span>View in Questionnaire</span>
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </Link>
                                <Link
                                  href={`/dashboard/assessments/${data.assessmentId}/evidence`}
                                  className="text-slate-700 hover:underline inline-flex items-center gap-1"
                                >
                                  <span>Inspect Evidence Vault</span>
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </Link>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

