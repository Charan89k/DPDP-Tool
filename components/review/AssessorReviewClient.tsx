"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Clock,
  MessageSquare,
  Paperclip,
  Save,
  Search,
  Filter,
  ArrowLeft,
  FileText,
  Send,
  Eye,
  Download,
  AlertCircle,
  User,
  Calendar,
  Building,
  Check,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

interface CanonicalQuestion {
  code: string;
  order: number;
  sectionCode: string;
  sectionTitle: string;
  text: string;
  options: string[];
  followUpPrompt: string;
  canonicalControlId: string | null;
  mappingStatus: string;
  mappingNotes?: string;
  clientResponse: {
    selectedOption: string | null;
    commentsAndJustification: string | null;
    questionnaireVersion: string;
    updatedAt: string | null;
  } | null;
  assessorReview: {
    id?: string;
    reviewStatus: string;
    reviewFindings: string;
    evidenceDeficiencyNotes: string;
    requiresFurtherValidation: boolean;
    reviewedByUserName: string | null;
    reviewedAt: string | null;
  };
  evidence: Array<{
    id: string;
    fileName: string;
    fileSizeBytes: number;
    mimeType: string;
    status: string;
    questionCode: string | null;
    controlCode: string | null;
    createdAt: string | null;
    verifiedAt: string | null;
    verificationNotes: string | null;
  }>;
  clarifications: Array<{
    id: string;
    questionCode: string | null;
    controlCode: string | null;
    title: string;
    status: string;
    createdAt: string | null;
    raisedByUserName: string;
    messages: Array<{
      id: string;
      authorUserId: string;
      authorName: string;
      authorRole: string;
      messageText: string;
      createdAt: string | null;
    }>;
  }>;
}

interface ReviewWorkspaceProps {
  assessmentId: string;
}

const REVIEW_STATUS_OPTIONS = [
  { value: "PENDING_REVIEW", label: "Pending Review", badge: "bg-slate-100 text-slate-700 border-slate-300" },
  { value: "UNDER_REVIEW", label: "Under Review", badge: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "VERIFIED_COMPLIANT", label: "Verified Compliant", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "PARTIALLY_COMPLIANT", label: "Partially Compliant", badge: "bg-amber-50 text-amber-800 border-amber-200" },
  { value: "NON_COMPLIANT", label: "Non-Compliant (Deficit)", badge: "bg-rose-50 text-rose-700 border-rose-200" },
  { value: "CLARIFICATION_REQUESTED", label: "Clarification Requested", badge: "bg-purple-50 text-purple-700 border-purple-200" },
  { value: "EXCLUSION_VERIFIED", label: "Exclusion Verified (N/A)", badge: "bg-slate-100 text-slate-700 border-slate-300" },
];

export function AssessorReviewClient({ assessmentId }: ReviewWorkspaceProps) {
  const [loading, setLoading] = useState(true);
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [saveSuccessCode, setSaveSuccessCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [assessment, setAssessment] = useState<any>(null);
  const [sections, setSections] = useState<any[]>([]);
  const [questions, setQuestions] = useState<CanonicalQuestion[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [isAssessor, setIsAssessor] = useState<boolean>(true);
  const [userRole, setUserRole] = useState<string>("");

  // Filters
  const [selectedSection, setSelectedSection] = useState<string>("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("ALL");
  const [onlyGaps, setOnlyGaps] = useState<boolean>(false);
  const [onlyValidation, setOnlyValidation] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Clarification active thread modal / slideout
  const [activeClarificationQuestion, setActiveClarificationQuestion] = useState<CanonicalQuestion | null>(null);
  const [clarificationTitle, setClarificationTitle] = useState("");
  const [clarificationMessage, setClarificationMessage] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const [sendingClarification, setSendingClarification] = useState(false);

  // Local draft state for edits
  const [reviewDrafts, setReviewDrafts] = useState<
    Record<
      string,
      {
        reviewStatus: string;
        reviewFindings: string;
        evidenceDeficiencyNotes: string;
        requiresFurtherValidation: boolean;
      }
    >
  >({});

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/assessments/${assessmentId}/reviews`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load assessor review workspace");
      }

      setAssessment(data.assessment);
      setSections(data.sections || []);
      setQuestions(data.questions || []);
      setMetrics(data.metrics || null);
      setIsAssessor(Boolean(data.isAssessor));
      setUserRole(data.userRole || "");

      // Initialize drafts
      const drafts: Record<string, any> = {};
      for (const q of data.questions) {
        drafts[q.code] = {
          reviewStatus: q.assessorReview.reviewStatus || "PENDING_REVIEW",
          reviewFindings: q.assessorReview.reviewFindings || "",
          evidenceDeficiencyNotes: q.assessorReview.evidenceDeficiencyNotes || "",
          requiresFurtherValidation: Boolean(q.assessorReview.requiresFurtherValidation),
        };
      }
      setReviewDrafts(drafts);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load review workspace.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [assessmentId]);

  const handleDraftChange = (code: string, field: string, value: any) => {
    setReviewDrafts((prev) => ({
      ...prev,
      [code]: {
        ...prev[code],
        [field]: value,
      },
    }));
  };

  const handleSaveReview = async (code: string) => {
    const draft = reviewDrafts[code];
    if (!draft) return;

    setSavingCode(code);
    setError(null);

    try {
      const res = await fetch(`/api/assessments/${assessmentId}/reviews`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionCode: code,
          reviewStatus: draft.reviewStatus,
          reviewFindings: draft.reviewFindings,
          evidenceDeficiencyNotes: draft.evidenceDeficiencyNotes,
          requiresFurtherValidation: draft.requiresFurtherValidation,
        }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error || "Failed to save review finding.");
      }

      setSaveSuccessCode(code);
      setTimeout(() => setSaveSuccessCode(null), 3000);

      // Refresh data silently to keep metrics in sync
      const refreshRes = await fetch(`/api/assessments/${assessmentId}/reviews`);
      const refreshData = await refreshRes.json();
      if (refreshRes.ok && refreshData.success) {
        setQuestions(refreshData.questions);
        setMetrics(refreshData.metrics);
      }
    } catch (err: any) {
      setError(err.message || "Failed to persist review evaluation.");
    } finally {
      setSavingCode(null);
    }
  };

  const handleCreateClarification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClarificationQuestion || !clarificationTitle.trim() || !clarificationMessage.trim()) return;

    setSendingClarification(true);
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/clarifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionCode: activeClarificationQuestion.code,
          title: clarificationTitle.trim(),
          message: clarificationMessage.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit clarification request.");
      }

      // Automatically update question review status to CLARIFICATION_REQUESTED if not set
      handleDraftChange(activeClarificationQuestion.code, "reviewStatus", "CLARIFICATION_REQUESTED");

      setClarificationTitle("");
      setClarificationMessage("");
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to create clarification thread.");
    } finally {
      setSendingClarification(false);
    }
  };

  const handleReplyClarification = async (threadId: string) => {
    if (!replyMessage.trim()) return;

    setSendingClarification(true);
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/clarifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          message: replyMessage.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to post message.");
      }

      setReplyMessage("");
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to post reply.");
    } finally {
      setSendingClarification(false);
    }
  };

  const handleToggleThreadStatus = async (threadId: string, currentStatus: string) => {
    const newStatus = currentStatus === "OPEN" ? "RESOLVED" : "OPEN";
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/clarifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          status: newStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update thread status.");
      }
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to update thread status.");
    }
  };

  // Filtered questions computation
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (selectedSection !== "ALL" && q.sectionCode !== selectedSection) {
        return false;
      }
      const draft = reviewDrafts[q.code];
      const status = draft?.reviewStatus || q.assessorReview.reviewStatus;

      if (selectedStatusFilter !== "ALL" && status !== selectedStatusFilter) {
        return false;
      }
      if (onlyGaps && status !== "PARTIALLY_COMPLIANT" && status !== "NON_COMPLIANT") {
        return false;
      }
      if (onlyValidation && !draft?.requiresFurtherValidation) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesCode = q.code.toLowerCase().includes(query);
        const matchesText = q.text.toLowerCase().includes(query);
        const matchesControl = q.canonicalControlId?.toLowerCase().includes(query);
        if (!matchesCode && !matchesText && !matchesControl) {
          return false;
        }
      }
      return true;
    });
  }, [questions, selectedSection, selectedStatusFilter, onlyGaps, onlyValidation, searchQuery, reviewDrafts]);

  const getStatusBadgeClass = (status: string) => {
    const opt = REVIEW_STATUS_OPTIONS.find((o) => o.value === status);
    return opt ? opt.badge : "bg-slate-100 text-slate-700 border-slate-300";
  };

  const getClientOptionBadgeClass = (option: string | null) => {
    switch (option) {
      case "Implemented":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Partially implemented":
        return "bg-amber-50 text-amber-800 border-amber-200";
      case "Not implemented":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "Unknown / not verified":
        return "bg-slate-100 text-slate-700 border-slate-200";
      case "Not applicable — justification required":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      default:
        return "bg-slate-50 text-slate-400 border-slate-200";
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-16 text-center shadow-xs">
        <RefreshCw className="w-8 h-8 text-[#0066FF] animate-spin mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-800">Loading Assessor Review Workspace</h3>
        <p className="text-xs text-slate-500 mt-1">Retrieving canonical questionnaire, client evidence, and statutory evaluations under PostgreSQL RLS...</p>
      </div>
    );
  }

  if (error && !assessment) {
    return (
      <div className="bg-white rounded-xl border border-rose-200 p-12 text-center shadow-xs">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-800">Unable to Load Review Workspace</h3>
        <p className="text-xs text-rose-600 mt-1 mb-4">{error}</p>
        <Link
          href="/dashboard/assessments"
          className="inline-flex items-center px-4 py-2 bg-slate-800 text-white text-xs font-semibold rounded-lg hover:bg-slate-900"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          <span>Return to Assessments</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header & Navigation Context Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-2 border-b border-slate-200">
        <div className="space-y-1">
          <nav className="text-xs text-slate-500 font-medium flex items-center space-x-2">
            <Link href="/dashboard" className="hover:text-slate-700">Dashboard</Link>
            <span>/</span>
            <Link href="/dashboard/assessments" className="hover:text-slate-700">Assessments</Link>
            <span>/</span>
            <span className="font-mono text-slate-700 font-semibold">{assessment?.engagement_code || "ENG"}</span>
            <span>/</span>
            <span className="text-[#0066FF] font-semibold">Assessor Review Workspace</span>
          </nav>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {assessment?.title || "Enterprise DPDP Readiness Review"}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              {assessment?.status || "DATA_GATHERING"}
            </span>
            {assessment?.is_sdf && (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                Significant Data Fiduciary (SDF)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5">
            <span className="flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-slate-400" />
              <span>Customer: <strong className="text-slate-800">{assessment?.tenant_name || "Client Organization"}</strong></span>
            </span>
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>Assessor: <strong className="text-slate-800">{assessment?.lead_consultant_name || "Lead Assessor"}</strong></span>
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Target: <strong className="text-slate-800">{assessment?.target_completion_date ? new Date(assessment.target_completion_date).toLocaleDateString() : "Pending"}</strong></span>
            </span>
          </p>
        </div>

        {/* Action Links */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/dashboard/assessments/${assessmentId}/questionnaire`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg shadow-2xs transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span>Questionnaire Workspace</span>
          </Link>
          <Link
            href={`/dashboard/assessments/${assessmentId}/evidence`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg shadow-2xs transition-colors"
          >
            <Paperclip className="w-3.5 h-3.5 text-slate-500" />
            <span>Evidence Vault</span>
          </Link>
          <Link
            href={`/dashboard/assessments/${assessmentId}/summary`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg shadow-2xs transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-slate-500" />
            <span>Summary & Review</span>
          </Link>
        </div>
      </div>

      {/* Role notice if viewer/client */}
      {!isAssessor && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start space-x-3 text-xs text-amber-900">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold">Client Review Mode:</strong> You are viewing assessor findings in transparent read-only mode ({userRole}). You can inspect assessor evaluations and respond to clarification queries, but review statuses and findings can only be recorded by certified TLI assessors.
          </div>
        </div>
      )}

      {/* 2. Review Progress & Outstanding Queue Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Canonical</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{metrics?.totalQuestions || 60}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">8 Statutory Sections</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Client Responses</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">
            {metrics?.clientAnsweredCount || 0}
            <span className="text-xs font-normal text-slate-500 ml-1">/ {metrics?.totalQuestions || 60}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">{metrics?.clientProgressPct || 0}% Completed</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Assessor Reviewed</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {metrics?.assessorReviewedCount || 0}
            <span className="text-xs font-normal text-slate-500 ml-1">/ {metrics?.totalQuestions || 60}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">{metrics?.assessorProgressPct || 0}% Verified</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Pending Review</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{metrics?.pendingReviewCount || 0}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Queue items</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Clarifications</div>
          <div className="text-2xl font-bold text-purple-600 mt-1">{metrics?.clarificationRequestedCount || 0}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Awaiting reply</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Gaps & Deficits</div>
          <div className="text-2xl font-bold text-rose-600 mt-1">{metrics?.deficienciesCount || 0}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">{metrics?.requiresValidationCount || 0} Flagged for visit</div>
        </div>
      </div>

      {/* 3. Filter Bar & Section Navigator */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-xs">
        {/* Section Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedSection("ALL")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 transition-colors ${
              selectedSection === "ALL"
                ? "bg-[#0066FF] text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Sections (60)
          </button>
          {sections.map((sec) => (
            <button
              key={sec.code}
              type="button"
              onClick={() => setSelectedSection(sec.code)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 transition-colors ${
                selectedSection === sec.code
                  ? "bg-[#0066FF] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {sec.code} ({sec.questionCount})
            </button>
          ))}
        </div>

        {/* Detailed Filter & Search row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-1.5 text-xs text-slate-500">
              <Filter className="w-3.5 h-3.5" />
              <span>Status:</span>
            </div>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-slate-700 font-medium focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Review Statuses</option>
              {REVIEW_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setOnlyGaps(!onlyGaps)}
              className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-colors ${
                onlyGaps
                  ? "bg-rose-50 border-rose-300 text-rose-700"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              Deficits Only
            </button>

            <button
              type="button"
              onClick={() => setOnlyValidation(!onlyValidation)}
              className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-colors ${
                onlyValidation
                  ? "bg-amber-50 border-amber-300 text-amber-800"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              Requires Validation
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search code, text, control..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      {/* Filter result notice */}
      <div className="text-xs text-slate-500 px-1 flex items-center justify-between">
        <span>Showing <strong>{filteredQuestions.length}</strong> of 60 questions</span>
        {(selectedSection !== "ALL" || selectedStatusFilter !== "ALL" || onlyGaps || onlyValidation || searchQuery) && (
          <button
            type="button"
            onClick={() => {
              setSelectedSection("ALL");
              setSelectedStatusFilter("ALL");
              setOnlyGaps(false);
              setOnlyValidation(false);
              setSearchQuery("");
            }}
            className="text-[#0066FF] hover:underline font-medium"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* 4. Canonical Question Review Cards List */}
      <div className="space-y-5">
        {filteredQuestions.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
            <HelpCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-slate-800">No Questions Match Current Filter</h4>
            <p className="text-xs text-slate-500 mt-1">Try adjusting your section selection or clear the active search filter.</p>
          </div>
        ) : (
          filteredQuestions.map((q) => {
            const draft = reviewDrafts[q.code] || {
              reviewStatus: q.assessorReview.reviewStatus,
              reviewFindings: q.assessorReview.reviewFindings,
              evidenceDeficiencyNotes: q.assessorReview.evidenceDeficiencyNotes,
              requiresFurtherValidation: q.assessorReview.requiresFurtherValidation,
            };
            const isSaving = savingCode === q.code;
            const isSaved = saveSuccessCode === q.code;
            const hasClarifications = q.clarifications.length > 0;
            const hasEvidence = q.evidence.length > 0;

            return (
              <div
                key={q.code}
                id={`card-${q.code}`}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs hover:border-slate-300 transition-colors"
              >
                {/* Question Header */}
                <div className="bg-slate-50/70 border-b border-slate-200 px-5 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                  <div className="flex items-center space-x-2.5 flex-wrap">
                    <span className="font-mono text-xs font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                      {q.code}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded">
                      Section {q.sectionCode}: {q.sectionTitle}
                    </span>
                    {q.canonicalControlId ? (
                      <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                        Control: {q.canonicalControlId}
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                        Unresolved Mapping
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${getStatusBadgeClass(draft.reviewStatus)}`}>
                      {REVIEW_STATUS_OPTIONS.find((o) => o.value === draft.reviewStatus)?.label || draft.reviewStatus}
                    </span>
                    {draft.requiresFurtherValidation && (
                      <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded">
                        Requires Validation
                      </span>
                    )}
                  </div>
                </div>

                {/* Canonical Question Text */}
                <div className="px-5 pt-4 pb-2">
                  <p className="text-sm font-semibold text-slate-900 leading-relaxed">
                    {q.order}. {q.text}
                  </p>
                </div>

                {/* Split Workspace: Client Submission & Evidence (Left) vs Assessor Evaluation (Right) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 border-t border-slate-100">
                  {/* Left Column: Client Submission & Evidence (5 columns) */}
                  <div className="lg:col-span-5 p-5 bg-slate-50/40 border-b lg:border-b-0 lg:border-r border-slate-200 space-y-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center justify-between">
                        <span>Client Response</span>
                        {q.clientResponse?.updatedAt && (
                          <span className="text-[10px] text-slate-400 normal-case font-normal">
                            Updated {new Date(q.clientResponse.updatedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      {q.clientResponse?.selectedOption ? (
                        <div className="space-y-2">
                          <span
                            className={`inline-block text-xs font-bold px-2.5 py-1 rounded-lg border ${getClientOptionBadgeClass(
                              q.clientResponse.selectedOption
                            )}`}
                          >
                            {q.clientResponse.selectedOption}
                          </span>

                          <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-700 leading-relaxed shadow-2xs">
                            <span className="block text-[10px] uppercase font-semibold text-slate-400 mb-0.5">Comments & Justification:</span>
                            {q.clientResponse.commentsAndJustification ? (
                              <p className="whitespace-pre-wrap">{q.clientResponse.commentsAndJustification}</p>
                            ) : (
                              <p className="text-slate-400 italic">No narrative justification provided.</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white border border-dashed border-slate-300 rounded-lg p-3 text-xs text-slate-400 italic text-center">
                          Awaiting client response to this question.
                        </div>
                      )}
                    </div>

                    {/* Associated Evidence */}
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center justify-between">
                        <span>Associated Evidence Vault</span>
                        <span className="text-[10px] text-slate-400 font-normal">({q.evidence.length} files)</span>
                      </div>

                      {hasEvidence ? (
                        <div className="space-y-1.5">
                          {q.evidence.map((ev) => (
                            <div
                              key={ev.id}
                              className="bg-white border border-slate-200 rounded-lg p-2.5 flex items-center justify-between gap-2 shadow-2xs text-xs"
                            >
                              <div className="flex items-center space-x-2 truncate">
                                <Paperclip className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                <span className="font-medium text-slate-800 truncate" title={ev.fileName}>
                                  {ev.fileName}
                                </span>
                              </div>
                              <div className="flex items-center space-x-2 shrink-0">
                                <span className="text-[10px] text-slate-400">
                                  {(ev.fileSizeBytes / 1024).toFixed(0)} KB
                                </span>
                                <Link
                                  href={`/api/evidence/${ev.id}/download`}
                                  className="text-[#0066FF] hover:underline inline-flex items-center gap-1 text-[11px] font-semibold"
                                  target="_blank"
                                >
                                  <Download className="w-3 h-3" />
                                  <span>View</span>
                                </Link>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-400 italic flex items-center space-x-2">
                          <Paperclip className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                          <span>No evidence attached by client for this question.</span>
                        </div>
                      )}
                    </div>

                    {/* Clarifications Summary on Left */}
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center justify-between">
                        <span>Clarification Inquiries</span>
                        <span className="text-[10px] text-slate-400 font-normal">({q.clarifications.length} active)</span>
                      </div>
                      {hasClarifications ? (
                        <div className="space-y-1.5">
                          {q.clarifications.map((th) => (
                            <div
                              key={th.id}
                              className="bg-white border border-purple-200 rounded-lg p-2.5 text-xs space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-purple-900 truncate">{th.title}</span>
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                    th.status === "OPEN"
                                      ? "bg-purple-100 text-purple-800"
                                      : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {th.status}
                                </span>
                              </div>
                              <p className="text-slate-600 text-[11px]">
                                {th.messages.length} message(s) exchanged
                              </p>
                              <button
                                type="button"
                                onClick={() => setActiveClarificationQuestion(q)}
                                className="text-[11px] font-semibold text-purple-700 hover:underline flex items-center gap-1"
                              >
                                <MessageSquare className="w-3 h-3" />
                                <span>Open Thread</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActiveClarificationQuestion(q)}
                          className="w-full text-xs text-slate-600 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg py-2 px-3 flex items-center justify-center space-x-1.5 font-semibold transition-colors"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                          <span>Request Client Clarification</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Assessor Evaluation Controls (7 columns) */}
                  <div className="lg:col-span-7 p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-700 block mb-1">
                          Assessor Review Status
                        </label>
                        <select
                          disabled={!isAssessor}
                          value={draft.reviewStatus}
                          onChange={(e) => handleDraftChange(q.code, "reviewStatus", e.target.value)}
                          className="text-xs bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800 font-semibold focus:outline-hidden focus:ring-1 focus:ring-blue-500 shadow-2xs disabled:bg-slate-100 disabled:text-slate-500"
                        >
                          {REVIEW_STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center space-x-2 pt-2 sm:pt-0">
                        <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            disabled={!isAssessor}
                            checked={draft.requiresFurtherValidation}
                            onChange={(e) =>
                              handleDraftChange(q.code, "requiresFurtherValidation", e.target.checked)
                            }
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 disabled:opacity-50"
                          />
                          <span>Flag for Onsite / Further Validation</span>
                        </label>
                      </div>
                    </div>

                    {/* Review Findings Textarea */}
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-700 block mb-1">
                        Compliance Audit Findings & Observations
                      </label>
                      <textarea
                        rows={3}
                        disabled={!isAssessor}
                        value={draft.reviewFindings}
                        onChange={(e) => handleDraftChange(q.code, "reviewFindings", e.target.value)}
                        placeholder="Record statutory compliance findings, non-delegable responsibility assessment, and audit observations..."
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-600"
                      />
                    </div>

                    {/* Evidence Deficiency Notes Textarea */}
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-700 block mb-1">
                        Evidence Deficiency & Remediation Notes
                      </label>
                      <textarea
                        rows={2}
                        disabled={!isAssessor}
                        value={draft.evidenceDeficiencyNotes}
                        onChange={(e) =>
                          handleDraftChange(q.code, "evidenceDeficiencyNotes", e.target.value)
                        }
                        placeholder="Detail any missing artifacts, uncertified redactions, or documentation required to substantiate compliance..."
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-600"
                      />
                    </div>

                    {/* Footer / Save Action */}
                    <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="text-[11px] text-slate-500">
                        {q.assessorReview.reviewedByUserName ? (
                          <span>
                            Evaluated by <strong>{q.assessorReview.reviewedByUserName}</strong>
                            {q.assessorReview.reviewedAt && (
                              <span> on {new Date(q.assessorReview.reviewedAt).toLocaleDateString()}</span>
                            )}
                          </span>
                        ) : (
                          <span className="italic text-slate-400">Not yet officially evaluated</span>
                        )}
                      </div>

                      {isAssessor && (
                        <div className="flex items-center space-x-2">
                          {isSaved && (
                            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" />
                              <span>Saved</span>
                            </span>
                          )}
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleSaveReview(q.code)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
                          >
                            {isSaving ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Saving...</span>
                              </>
                            ) : (
                              <>
                                <Save className="w-3.5 h-3.5" />
                                <span>Save Evaluation</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 5. Clarification Query Modal / Thread Manager */}
      {activeClarificationQuestion && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-300 shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="bg-slate-50 border-b border-slate-200 px-5 py-3.5 flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xs font-bold text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                    {activeClarificationQuestion.code}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">Clarification Inquiries & Communication</h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                  {activeClarificationQuestion.text}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveClarificationQuestion(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Active Threads or Form to Create */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {activeClarificationQuestion.clarifications.length > 0 ? (
                <div className="space-y-4">
                  {activeClarificationQuestion.clarifications.map((th) => (
                    <div key={th.id} className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50/50">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">{th.title}</h4>
                          <span className="text-[10px] text-slate-400">
                            Raised by {th.raisedByUserName} on {th.createdAt ? new Date(th.createdAt).toLocaleDateString() : ""}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              th.status === "OPEN" ? "bg-purple-100 text-purple-800" : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {th.status}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleThreadStatus(th.id, th.status)}
                            className="text-[11px] text-[#0066FF] hover:underline font-semibold"
                          >
                            Mark {th.status === "OPEN" ? "Resolved" : "Open"}
                          </button>
                        </div>
                      </div>

                      {/* Messages Flow */}
                      <div className="space-y-2 border-t border-slate-200 pt-2">
                        {th.messages.map((m) => (
                          <div key={m.id} className="bg-white rounded-lg p-3 border border-slate-200 text-xs space-y-1">
                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                              <span className="font-semibold text-slate-800">
                                {m.authorName} <span className="text-slate-400 font-normal">({m.authorRole})</span>
                              </span>
                              <span>{m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                            </div>
                            <p className="text-slate-700 whitespace-pre-wrap">{m.messageText}</p>
                          </div>
                        ))}
                      </div>

                      {/* Reply Box */}
                      {th.status === "OPEN" && (
                        <div className="flex items-center space-x-2 pt-1">
                          <input
                            type="text"
                            placeholder="Write a reply message..."
                            value={replyMessage}
                            onChange={(e) => setReplyMessage(e.target.value)}
                            className="flex-1 text-xs bg-white border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                          />
                          <button
                            type="button"
                            disabled={sendingClarification || !replyMessage.trim()}
                            onClick={() => handleReplyClarification(th.id)}
                            className="px-3 py-1.5 bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-semibold rounded-lg disabled:opacity-50 inline-flex items-center gap-1"
                          >
                            <Send className="w-3 h-3" />
                            <span>Reply</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Raise New Query Form */}
              <form onSubmit={handleCreateClarification} className="border-t border-slate-200 pt-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-[#0066FF]" />
                  <span>Raise Formal Clarification Query</span>
                </h4>
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">Subject / Question</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Missing schedule 8 translations in notice"
                    value={clarificationTitle}
                    onChange={(e) => setClarificationTitle(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">Inquiry Details</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Detail the specific clarification required from the client compliance coordinator..."
                    value={clarificationMessage}
                    onChange={(e) => setClarificationMessage(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2.5 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setActiveClarificationQuestion(null)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={sendingClarification}
                    className="px-4 py-1.5 bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Query to Client</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

