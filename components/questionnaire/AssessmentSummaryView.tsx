"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  MinusCircle,
  Eye,
  FileDown,
  ArrowLeft,
  ChevronDown,
  Building,
  Check,
  Search,
  Filter,
  Shield,
  AlertTriangle,
  Paperclip,
  User,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { AssessmentLifecycleControls } from "@/components/lifecycle/AssessmentLifecycleControls";
import { getCanonicalQuestionnaireSections } from "@/lib/questionnaire/data";
import { isTliRole } from "@/lib/auth/rbac";

interface AssessmentSummaryViewProps {
  assessmentId: string;
  tenantName?: string;
  assessmentCode?: string;
  visitDate?: string;
  leadConsultantName?: string;
  industry?: string;
  assessmentStatus?: string;
  userRole?: string;
  onBackToEvidence?: () => void;
  onSubmitValidation?: () => Promise<void>;
}

export function AssessmentSummaryView({
  assessmentId,
  tenantName = "ABC Private Limited",
  assessmentCode = "DPDP-2024-006",
  visitDate = "20 Aug 2024",
  leadConsultantName = "Anita Sharma",
  industry = "IT / ITES",
  assessmentStatus = "DATA_GATHERING",
  userRole = "CLIENT_ADMIN",
}: AssessmentSummaryViewProps) {
  const isConsultant = isTliRole(userRole as any);

  // Real backend states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [scoringData, setScoringData] = useState<any>(null);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [evidenceList, setEvidenceList] = useState<any[]>([]);
  const [clarifications, setClarifications] = useState<any[]>([]);

  // Filtering & search
  const [selectedSection, setSelectedSection] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Submitting transition state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string>(assessmentStatus);

  // Authoritative 60 questions from canonical manifest
  const canonicalSections = useMemo(() => {
    try {
      return getCanonicalQuestionnaireSections();
    } catch {
      return [];
    }
  }, []);

  const allQuestions = useMemo(() => {
    return canonicalSections.flatMap((s) => s.questions);
  }, [canonicalSections]);

  // Load real data from APIs
  const loadSummaryData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Scoring calculation
      const scoringRes = await fetch(`/api/assessments/${assessmentId}/scoring`);
      if (scoringRes.ok) {
        const scData = await scoringRes.json();
        if (scData.success) {
          setScoringData(scData);
        }
      }

      // 2. Client responses
      const respRes = await fetch(`/api/assessments/${assessmentId}/responses`);
      if (respRes.ok) {
        const rData = await respRes.json();
        if (rData.success && rData.responses) {
          setResponses(rData.responses);
        }
      }

      // 3. Evidence items
      const evRes = await fetch(`/api/assessments/${assessmentId}/evidence`);
      if (evRes.ok) {
        const evData = await evRes.json();
        if (evData.items) {
          setEvidenceList(evData.items);
        }
      }

      // 4. Clarifications
      const clRes = await fetch(`/api/assessments/${assessmentId}/clarifications`);
      if (clRes.ok) {
        const clData = await clRes.json();
        if (clData.threads) {
          setClarifications(clData.threads);
        }
      }

      // 5. Current lifecycle state
      const trRes = await fetch(`/api/assessments/${assessmentId}/transition`);
      if (trRes.ok) {
        const trData = await trRes.json();
        if (trData.success && trData.state?.status) {
          setCurrentStatus(trData.state.status);
        }
      }
    } catch (err: any) {
      console.error("Failed to load summary data:", err);
      setError(err.message || "Failed to load assessment summary data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummaryData();
  }, [assessmentId]);

  // Handle Client Submission to SUBMITTED_FOR_REVIEW
  const handleSubmitForReview = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch(`/api/assessments/${assessmentId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetStatus: "SUBMITTED_FOR_REVIEW",
          reason: "Questionnaire completed and submitted by client compliance coordinator.",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        const msg = data.error || (data.validationErrors ? data.validationErrors.join(" • ") : "Submission failed.");
        setSubmitError(msg);
        return;
      }

      setCurrentStatus("SUBMITTED_FOR_REVIEW");
      await loadSummaryData();
    } catch (err: any) {
      setSubmitError(err.message || "Network error while submitting assessment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Compute live counts and metrics
  const totalQuestions = allQuestions.length || 60;
  const answeredCount = Object.values(responses).filter((r: any) => r && r.selectedOption).length;
  const answeredPct = Math.round((answeredCount / totalQuestions) * 100);

  const implementedCount = scoringData?.summary?.counts?.implemented ??
    Object.values(responses).filter((r: any) => r?.selectedOption === "Implemented").length;

  const partiallyCount = scoringData?.summary?.counts?.partiallyImplemented ??
    Object.values(responses).filter((r: any) => r?.selectedOption === "Partially implemented").length;

  const notImplementedCount = scoringData?.summary?.counts?.notImplemented ??
    Object.values(responses).filter((r: any) => r?.selectedOption === "Not implemented").length;

  const notApplicableCount = scoringData?.summary?.counts?.notApplicable ??
    Object.values(responses).filter((r: any) => r?.selectedOption?.startsWith("Not applicable")).length;

  const readinessPct = scoringData?.calculation?.indicativeReadinessPct ?? 0;
  const maturityScore = scoringData?.calculation?.indicativeMaturityScore ?? 0;

  // Filtered Questions for Table
  const filteredQuestions = useMemo(() => {
    return allQuestions.filter((q) => {
      const matchSection = selectedSection === "ALL" || q.sectionCode === selectedSection;
      const matchSearch =
        !searchQuery.trim() ||
        q.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.sectionTitle.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSection && matchSearch;
    });
  }, [allQuestions, selectedSection, searchQuery]);

  // Evidence Map per question
  const evidenceCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const ev of evidenceList) {
      if (ev.questionCode) {
        map.set(ev.questionCode, (map.get(ev.questionCode) || 0) + 1);
      }
      if (ev.controlCode) {
        map.set(ev.controlCode, (map.get(ev.controlCode) || 0) + 1);
      }
    }
    return map;
  }, [evidenceList]);

  const getOptionBadge = (option: string | null | undefined) => {
    if (!option) {
      return {
        label: "Unanswered",
        className: "bg-slate-100 text-slate-500 border-slate-200",
        score: "-",
      };
    }
    switch (option) {
      case "Implemented":
        return {
          label: "Implemented",
          className: "bg-emerald-50 text-emerald-700 border-emerald-200",
          score: 100,
        };
      case "Partially implemented":
        return {
          label: "Partially Implemented",
          className: "bg-amber-50 text-amber-800 border-amber-200",
          score: 50,
        };
      case "Not implemented":
        return {
          label: "Not Implemented",
          className: "bg-rose-50 text-rose-700 border-rose-200",
          score: 0,
        };
      case "Not applicable — justification required":
        return {
          label: "Not Applicable",
          className: "bg-slate-100 text-slate-700 border-slate-300",
          score: "N/A",
        };
      case "Unknown / not verified":
        return {
          label: "Unknown / Unverified",
          className: "bg-slate-100 text-slate-600 border-slate-200",
          score: "Unscored",
        };
      default:
        return {
          label: option,
          className: "bg-slate-100 text-slate-600 border-slate-200",
          score: "-",
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Top Context Bar & 4-Step Stepper */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <nav className="text-xs text-slate-500 font-medium mb-1">
            <Link href="/dashboard/assessments" className="hover:text-blue-600">
              Assessments
            </Link>{" "}
            &gt; <span className="text-slate-800">{tenantName}</span> &gt;{" "}
            <span className="text-slate-800">Summary & Review</span>
          </nav>
          <p className="text-xs font-semibold text-slate-600">
            {tenantName} | Assessment ID: <span className="font-mono text-slate-900">{assessmentCode}</span> | Visit Date: {visitDate}
          </p>
        </div>

        {/* 4-Step Stepper */}
        <div className="flex items-center space-x-3 self-start md:self-auto select-none">
          {/* Step 1: Customer Details */}
          <Link href="/dashboard/assessments/new" className="flex items-center space-x-1.5">
            <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px] font-bold">
              ✓
            </div>
            <span className="text-xs font-medium text-slate-600">
              Customer Details
            </span>
          </Link>

          <div className="w-8 h-0.5 bg-emerald-500" />

          {/* Step 2: Questionnaire */}
          <Link
            href={`/dashboard/assessments/${assessmentId}/questionnaire`}
            className="flex items-center space-x-1.5"
          >
            <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px] font-bold">
              ✓
            </div>
            <span className="text-xs font-medium text-slate-600">
              Questionnaire
            </span>
          </Link>

          <div className="w-8 h-0.5 bg-emerald-500" />

          {/* Step 3: Evidence */}
          <Link
            href={`/dashboard/assessments/${assessmentId}/evidence`}
            className="flex items-center space-x-1.5"
          >
            <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px] font-bold">
              ✓
            </div>
            <span className="text-xs font-medium text-slate-600">
              Evidence
            </span>
          </Link>

          <div className="w-8 h-0.5 bg-blue-500" />

          {/* Step 4: Review & Submit (Active) */}
          <div className="flex items-center space-x-1.5">
            <div className="w-5 h-5 rounded-full bg-[#0066FF] text-white flex items-center justify-center text-[11px] font-bold">
              4
            </div>
            <span className="text-xs font-semibold text-[#0066FF]">
              Review & Submit
            </span>
          </div>

          {/* Action CTAs */}
          <Link
            href={`/dashboard/assessments/${assessmentId}/evidence`}
            className="ml-3 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors"
          >
            &larr; Back to Evidence
          </Link>

          {currentStatus === "DATA_GATHERING" && (
            <button
              type="button"
              onClick={handleSubmitForReview}
              disabled={isSubmitting}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-[#0066FF] hover:bg-[#0052CC] disabled:opacity-50 rounded-lg shadow-sm transition-colors flex items-center space-x-1"
            >
              <span>{isSubmitting ? "Submitting..." : "Submit for TLI Review"}</span>
            </button>
          )}

          {currentStatus !== "DATA_GATHERING" && (
            <span className="px-3 py-1 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-lg">
              Status: {currentStatus}
            </span>
          )}
        </div>
      </div>

      {/* Submission Alert / Blocker Banner */}
      {submitError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1.5">
          <div className="flex items-center space-x-2 font-bold text-rose-900">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>Submission Validation Blocked</span>
          </div>
          <p className="leading-relaxed">{submitError}</p>
        </div>
      )}

      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Assessment Summary & Gap Analysis
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Comprehensive diagnostic summary of client representations, attached evidentiary records, and preliminary compliance posture.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href={`/dashboard/reports/${assessmentId}`}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            <span>View Full Report</span>
          </Link>
        </div>
      </div>

      {/* Assessment Lifecycle & Transition Controls */}
      <AssessmentLifecycleControls
        assessmentId={assessmentId}
        onStatusChanged={() => loadSummaryData()}
      />

      {/* 2. Top 5 Real Status KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {/* Total Questions */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center space-x-3 mb-1">
            <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <span className="text-2xl font-bold text-slate-900 block leading-tight">
                {totalQuestions}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Total Canonical
              </span>
            </div>
          </div>
          <span className="text-[11px] text-blue-600 font-medium block">
            {answeredCount}/{totalQuestions} answered ({answeredPct}%)
          </span>
        </div>

        {/* Implemented */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center space-x-3 mb-1">
            <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-2xl font-bold text-slate-900 block leading-tight">
                {implementedCount}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Implemented
              </span>
            </div>
          </div>
          <span className="text-[11px] text-emerald-600 font-medium block">
            {totalQuestions > 0 ? Math.round((implementedCount / totalQuestions) * 100) : 0}% of scope
          </span>
        </div>

        {/* Partially Implemented */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center space-x-3 mb-1">
            <div className="w-9 h-9 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <span className="text-2xl font-bold text-slate-900 block leading-tight">
                {partiallyCount}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Partially Implemented
              </span>
            </div>
          </div>
          <span className="text-[11px] text-amber-600 font-medium block">
            Partial Deficits
          </span>
        </div>

        {/* Not Implemented */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center space-x-3 mb-1">
            <div className="w-9 h-9 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
              <XCircle className="w-4 h-4" />
            </div>
            <div>
              <span className="text-2xl font-bold text-slate-900 block leading-tight">
                {notImplementedCount}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Not Implemented
              </span>
            </div>
          </div>
          <span className="text-[11px] text-rose-600 font-medium block">
            Critical Gaps
          </span>
        </div>

        {/* Not Applicable */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center space-x-3 mb-1">
            <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center flex-shrink-0">
              <MinusCircle className="w-4 h-4" />
            </div>
            <div>
              <span className="text-2xl font-bold text-slate-900 block leading-tight">
                {notApplicableCount}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Not Applicable
              </span>
            </div>
          </div>
          <span className="text-[11px] text-slate-500 font-medium block">
            Exclusion Justified
          </span>
        </div>
      </div>

      {/* 3. Middle Section: Domain Results, Readiness Gauge, & Assessment Metadata */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Area (8 cols): 3 cards in row */}
        <div className="lg:col-span-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Domain-wise Results (Real Canonical Sections) */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
              <h4 className="font-bold text-xs text-slate-900">
                Statutory Section Breakdown
              </h4>
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {(scoringData?.domainRollups || canonicalSections).map((sec: any) => {
                  const secCode = sec.sectionCode || sec.code;
                  const secTitle = sec.title;
                  const secQuestions = allQuestions.filter((q) => q.sectionCode === secCode);
                  const secAnswered = secQuestions.filter((q) => responses[q.code]?.selectedOption).length;
                  const secTotal = secQuestions.length || 1;
                  const pct = Math.round((secAnswered / secTotal) * 100);

                  return (
                    <div key={secCode}>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <div className="flex items-center space-x-1.5 truncate">
                          <span className="w-7 h-4.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold font-mono flex items-center justify-center shrink-0">
                            {secCode}
                          </span>
                          <span className="font-medium text-slate-700 truncate" title={secTitle}>
                            {secTitle}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full ${
                              pct === 100 ? "bg-emerald-500" : pct > 0 ? "bg-amber-500" : "bg-slate-300"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono shrink-0">
                          {secAnswered}/{secTotal} {pct}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Preliminary Readiness Score (Real Scoring Engine Donut Gauge) */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3 flex flex-col justify-between">
              <div>
                <h4 className="font-bold text-xs text-slate-900">
                  Indicative Readiness Score
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Provisional Model v1.0
                </p>
              </div>

              <div className="flex flex-col items-center justify-center py-1">
                <div className="relative w-28 h-28 flex items-center justify-center">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="14" fill="transparent" stroke="#F1F5F9" strokeWidth="4.5" />
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      fill="transparent"
                      stroke={readinessPct >= 80 ? "#10B981" : readinessPct >= 50 ? "#F59E0B" : "#EF4444"}
                      strokeWidth="4.5"
                      strokeDasharray={`${(readinessPct / 100) * 88} 88`}
                      strokeDashoffset="0"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-xl font-bold text-slate-900 leading-none">
                      {readinessPct.toFixed(1)}%
                    </span>
                    <span className="text-[9px] text-slate-500 font-medium mt-0.5">
                      Maturity {maturityScore.toFixed(2)}/5.0
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] mt-2 w-full">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-slate-600 truncate">Impl.</span>
                    <span className="font-bold ml-auto">{implementedCount}</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-slate-600 truncate">Part.</span>
                    <span className="font-bold ml-auto">{partiallyCount}</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span className="text-slate-600 truncate">Not Impl.</span>
                    <span className="font-bold ml-auto">{notImplementedCount}</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-300" />
                    <span className="text-slate-600 truncate">N/A</span>
                    <span className="font-bold ml-auto">{notApplicableCount}</span>
                  </div>
                </div>
              </div>

              <div className="text-[9px] text-slate-400 italic text-center border-t border-slate-100 pt-1">
                Diagnostic baseline pending formal TLI methodology ratification (DEC-01).
              </div>
            </div>

            {/* Assessment Status & Lead Assessor Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3 flex flex-col justify-between">
              <div>
                <h4 className="font-bold text-xs text-slate-900">
                  Engagement Governance
                </h4>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="block text-[11px] text-slate-500 font-medium mb-1">
                    Canonical Lifecycle Status
                  </span>
                  <div className="inline-block px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200 rounded-lg">
                    {currentStatus}
                  </div>
                </div>

                <div>
                  <span className="block text-[11px] text-slate-500 font-medium mb-0.5">
                    Lead Forensic Consultant
                  </span>
                  <div className="flex items-center space-x-2 mt-1">
                    <div className="w-6 h-6 rounded-full bg-[#0066FF] text-white flex items-center justify-center text-[10px] font-bold">
                      {leadConsultantName.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="font-semibold text-slate-800 text-xs">
                      {leadConsultantName}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="block text-[11px] text-slate-500 font-medium mb-0.5">
                    Evidence Attached
                  </span>
                  <span className="font-semibold text-slate-800 text-xs">
                    {evidenceList.length} supporting files
                  </span>
                </div>

                {clarifications.length > 0 && (
                  <div>
                    <span className="block text-[11px] text-purple-700 font-medium mb-0.5">
                      Clarification Inquiries
                    </span>
                    <span className="font-semibold text-purple-900 text-xs">
                      {clarifications.length} active threads
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Link
                  href={`/dashboard/assessments/${assessmentId}/gaps`}
                  className="w-full text-center py-1.5 px-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg text-xs font-semibold text-rose-700 transition-colors flex items-center justify-center space-x-1.5"
                >
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Gap Analysis & Risk Dashboard</span>
                </Link>
                <Link
                  href={`/dashboard/assessments/${assessmentId}/questionnaire`}
                  className="w-full text-center py-1.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition-colors block"
                >
                  Open Questionnaire Editor
                </Link>
              </div>
            </div>
          </div>

          {/* Question-wise Summary Table (All 60 Questions) */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  Question-wise Compliance Evaluation ({filteredQuestions.length} of {allQuestions.length})
                </h3>
              </div>

              <div className="flex items-center space-x-2">
                {/* Search */}
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search question code or text..."
                    className="pl-7 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 w-48 sm:w-56"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2 pointer-events-none" />
                </div>

                {/* Section Filter */}
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white font-medium text-slate-700"
                >
                  <option value="ALL">All Sections</option>
                  {canonicalSections.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code} - {s.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Question Code</th>
                    <th className="py-2.5 px-3">Section</th>
                    <th className="py-2.5 px-3 min-w-[240px]">Question</th>
                    <th className="py-2.5 px-3">Response</th>
                    <th className="py-2.5 px-3">Evidence</th>
                    <th className="py-2.5 px-3">Score</th>
                    {isConsultant && <th className="py-2.5 px-3 min-w-[160px]">Assessor Notes</th>}
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredQuestions.map((q, idx) => {
                    const resp = responses[q.code];
                    const opt = resp?.selectedOption;
                    const optInfo = getOptionBadge(opt);
                    const evCount = evidenceCountMap.get(q.code) || 0;

                    return (
                      <tr key={q.code} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {q.code}
                        </td>
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                          <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px]">
                            {q.sectionCode}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-700 leading-normal">
                          <p className="line-clamp-2" title={q.text}>
                            {q.text}
                          </p>
                          {resp?.commentsAndJustification && (
                            <p className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-1">
                              Justification: {resp.commentsAndJustification}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border ${optInfo.className}`}
                          >
                            {optInfo.label}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {evCount > 0 ? (
                            <span className="inline-flex items-center space-x-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-semibold">
                              <Paperclip className="w-3 h-3" />
                              <span>{evCount} attached</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px] italic">None</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                          {optInfo.score}
                        </td>
                        {isConsultant && (
                          <td className="py-3 px-3 text-slate-600 text-[11px]">
                            <span className="text-slate-400 italic">Visible in Review Workspace</span>
                          </td>
                        )}
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <Link
                            href={`/dashboard/assessments/${assessmentId}/questionnaire`}
                            className="p-1 text-slate-400 hover:text-blue-600 inline-block"
                            title="Open Question"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Customer Details, Key Observations, Next Steps */}
        <div className="lg:col-span-4 space-y-5">
          {/* Customer & Assessment Metadata Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="font-bold text-xs text-slate-900">
                Customer & Assessment
              </h4>
              <span className="text-[10px] font-mono text-slate-400">
                Verified Perimeter
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Customer Name</span>
                <span className="font-semibold text-slate-900">{tenantName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Assessment ID</span>
                <span className="font-mono font-medium text-slate-800">{assessmentCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Visit Date</span>
                <span className="font-medium text-slate-800">{visitDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Questionnaire Version</span>
                <span className="font-medium text-slate-800">v1.0 (60 Canonical Questions)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Industry</span>
                <span className="font-medium text-slate-800">{industry}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Assessment Scope</span>
                <span className="font-medium text-slate-800">Digital Personal Data within India</span>
              </div>
            </div>
          </div>

          {/* Statutory Deficits & Key Observations Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="font-bold text-xs text-slate-900">
                Statutory Observations & Deficits
              </h4>
              <span className="text-[10px] font-mono text-rose-600 font-bold">
                Non-Compensatory
              </span>
            </div>

            {scoringData?.statutoryDeficits && scoringData.statutoryDeficits.length > 0 ? (
              <div className="space-y-2">
                {scoringData.statutoryDeficits.slice(0, 3).map((def: any, i: number) => (
                  <div key={i} className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs space-y-1">
                    <div className="flex items-center justify-between font-bold text-rose-900 text-[11px]">
                      <span>{def.questionCode}</span>
                      <span className="text-[10px] bg-rose-200 px-1.5 py-0.2 rounded">
                        {def.deficitType}
                      </span>
                    </div>
                    <p className="text-rose-800 text-[11px] leading-normal">{def.statutoryDeficit}</p>
                    <p className="text-[10px] text-rose-600 font-mono">
                      Statutory Focus: {def.statutoryReference}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <ul className="list-disc pl-4 space-y-1.5 text-xs text-slate-600 leading-normal">
                <li>Organisation has initialized the DPDP compliance evaluation.</li>
                <li>Complete all 60 canonical questions to compile the comprehensive Deficit Register.</li>
                <li>Technical security safeguards (Section 8(4)) and breach notification protocols (Section 8(6)) are evaluated under strict non-compensatory rules.</li>
              </ul>
            )}
          </div>

          {/* Next Steps Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h4 className="font-bold text-xs text-slate-900 pb-2 border-b border-slate-100">
              Next Steps & Milestones
            </h4>

            <ol className="space-y-2.5 text-xs text-slate-700 list-none pl-0">
              <li className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                  1
                </span>
                <span>Complete all 60 questionnaire responses and attach supporting evidence.</span>
              </li>
              <li className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                  2
                </span>
                <span>Submit engagement for formal TLI Assessor Review.</span>
              </li>
              <li className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                  3
                </span>
                <span>Assessor conducts evidence verification and raises any clarification requests.</span>
              </li>
              <li className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                  4
                </span>
                <span>TLI Lead Consultant approves and issues final cryptographic compliance report.</span>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
