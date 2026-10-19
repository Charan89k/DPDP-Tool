"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { readJsonResponse } from "@/lib/http/responses";
import type { UploadedEvidence } from "@/lib/storage/upload_response";
import Link from "next/link";
import {
  Paperclip,
  UploadCloud,
  FileText,
  FileCheck,
  Eye,
  Download,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  AlertCircle,
  Clock,
  ChevronRight,
  ShieldCheck,
  Check,
} from "lucide-react";
import { getCanonicalQuestionnaireSections } from "@/lib/questionnaire/data";
import { formatDate } from "@/lib/format/dates";

interface EvidenceItem {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  questionCode: string;
  category: string;
  description: string;
  uploadedOn: string;
  uploadedBy: string;
  status: "Reviewed" | "Received" | "Not Received";
  rawStatus?: string;
  verificationNotes?: string | null;
  verifiedByName?: string | null;
}

/** Coverage metrics as returned by GET /api/assessments/[id]/evidence. */
interface EvidenceCoverage {
  totalQuestions: number;
  questionsWithEvidence: number;
  coveragePercentage: number;
  totalEvidence: number;
  verifiedCount: number;
  activeCount: number;
  rejectedCount: number;
}

/** Evidence item as returned by GET /api/assessments/[id]/evidence. */
interface EvidenceApiItem {
  id: string;
  questionCode: string;
  category: string;
  description: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  status: string;
  uploadedByName: string;
  verifiedByName: string | null;
  verificationNotes: string | null;
  createdAt: string | null;
}

interface EvidenceManagementClientProps {
  assessmentId: string;
  tenantName: string;
  assessmentCode?: string;
  visitDate?: string;
  userRole?: string;
  userName?: string;
}

export function EvidenceManagementClient({
  assessmentId,
  tenantName,
  assessmentCode = "",
  visitDate = "",
  userRole,
  userName = "Anita Sharma",
}: EvidenceManagementClientProps) {
  const isAssessor = userRole
    ? ["TLI_LEAD_CONSULTANT", "TLI_REVIEWER", "TLI_SUPER_ADMIN"].includes(userRole)
    : false;

  // Real evidence records from database
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([]);

  // Selected Evidence for Right Preview Panel
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceItem | null>(null);
  const [selectedPage, setSelectedPage] = useState(1);
  const totalPages = 12;

  // Upload Form State
  const [selectedQuestion, setSelectedQuestion] = useState("GOV-01 - Governance structure for data protection");
  const [selectedCategory, setSelectedCategory] = useState("Policy / Procedure");
  const [uploadDescription, setUploadDescription] = useState("Data protection policy approved by management");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Assessor Review State
  const [verificationNotes, setVerificationNotes] = useState("");
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewFeedback, setReviewFeedback] = useState<string | null>(null);

  // Independent Evidence Coverage State
  const [coverage, setCoverage] = useState<EvidenceCoverage | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load authoritative canonical 60 questions for selector
  const canonicalQuestions = useMemo(() => {
    try {
      const sections = getCanonicalQuestionnaireSections();
      return sections.flatMap((s) => s.questions);
    } catch {
      return [];
    }
  }, []);

  // Fetch real evidence and coverage from database on mount
  const fetchEvidence = async () => {
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/evidence`);
      if (!res.ok) return;
      const data: { items?: EvidenceApiItem[]; metrics?: EvidenceCoverage } = await res.json();
      if (data.items && Array.isArray(data.items)) {
        const mapped: EvidenceItem[] = data.items.map((it) => ({
          id: it.id,
          fileName: it.fileName,
          fileSizeBytes: it.fileSizeBytes,
          mimeType: it.mimeType,
          questionCode: it.questionCode,
          category: it.category || "Policy / Procedure",
          description: it.description || "",
          uploadedOn: it.createdAt
            ? formatDate(it.createdAt)
            : "Today",
          uploadedBy: it.uploadedByName || userName,
          status:
            it.status === "VERIFIED"
              ? "Reviewed"
              : it.status === "ACTIVE"
              ? "Received"
              : "Not Received",
          rawStatus: it.status,
          verificationNotes: it.verificationNotes,
          verifiedByName: it.verifiedByName,
        }));
        setEvidenceList(mapped);
        setSelectedEvidence((prev) => {
          if (!prev) return mapped.length > 0 ? mapped[0] : null;
          const found = mapped.find((m) => m.id === prev.id);
          return found || (mapped.length > 0 ? mapped[0] : null);
        });
      }
      if (data.metrics) {
        setCoverage(data.metrics);
      }
    } catch {
      // Graceful fallback
    }
  };

  useEffect(() => {
    // Loads server data for the selected assessment; the loader is also used by refresh actions.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEvidence();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId]);

  // Status Counts
  const reviewedCount = coverage?.verifiedCount ?? evidenceList.filter((e) => e.status === "Reviewed").length;
  const receivedCount = coverage?.activeCount ?? evidenceList.filter((e) => e.status === "Received").length;
  const notReceivedCount = evidenceList.filter((e) => e.status === "Not Received").length;

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);

    // Client-side file bounds verification (100B - 50MB)
    if (file.size > 52_428_800) {
      setUploadError("File exceeds maximum permitted size of 50 MB.");
      setIsUploading(false);
      return;
    }
    if (file.size < 100) {
      setUploadError("File is too small (< 100 bytes).");
      setIsUploading(false);
      return;
    }

    try {
      const qCode = selectedQuestion.split(" - ")[0]?.trim() || "GOV-01";
      const formData = new FormData();
      formData.append("file", file);
      formData.append("assessmentId", assessmentId);
      formData.append("controlCode", qCode);
      formData.append("questionCode", qCode);
      formData.append("evidenceCategory", selectedCategory);
      formData.append("category", selectedCategory);
      formData.append("description", uploadDescription || file.name);

      const res = await fetch("/api/evidence/upload", {
        method: "POST",
        body: formData,
      });

      const { data, errorMessage } = await readJsonResponse<{ evidence: UploadedEvidence }>(res);
      if (errorMessage) {
        setUploadError(errorMessage);
        setIsUploading(false);
        return;
      }

      const newItem: EvidenceItem = {
        id: data.evidence.id,
        fileName: data.evidence.fileName,
        fileSizeBytes: data.evidence.fileSizeBytes,
        mimeType: data.evidence.mimeType,
        questionCode: qCode,
        category: selectedCategory,
        description: uploadDescription || file.name,
        uploadedOn: formatDate(new Date()),
        uploadedBy: userName,
        status: "Received",
        rawStatus: "ACTIVE",
      };

      setEvidenceList((prev) => [newItem, ...prev]);
      setSelectedEvidence(newItem);
      setIsUploading(false);
      fetchEvidence();
    } catch {
      setUploadError("Network error while connecting to evidence vault.");
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setUploadError(null);
    try {
      const res = await fetch(`/api/evidence/${id}`, { method: "DELETE" });
      const { errorMessage } = await readJsonResponse(res);
      if (errorMessage) {
        setUploadError(errorMessage);
        return;
      }
    } catch {
      setUploadError("Network error: the evidence item was not deleted. Please try again.");
      return;
    }
    const remaining = evidenceList.filter((item) => item.id !== id);
    setEvidenceList(remaining);
    if (selectedEvidence?.id === id) {
      setSelectedEvidence(remaining[0] || null);
    }
    fetchEvidence();
  };


  const handleReviewDecision = async (newStatus: "VERIFIED" | "REJECTED") => {
    if (!selectedEvidence?.id) return;
    setIsReviewing(true);
    setReviewFeedback(null);
    try {
      const res = await fetch(`/api/evidence/${selectedEvidence.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          verificationNotes: verificationNotes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReviewFeedback(data.error || "Failed to update review decision.");
        setIsReviewing(false);
        return;
      }
      setReviewFeedback(`Evidence marked as ${newStatus}.`);
      setVerificationNotes("");
      await fetchEvidence();
      setIsReviewing(false);
    } catch {
      setReviewFeedback("Network error while updating review decision.");
      setIsReviewing(false);
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (ext === "pdf") {
      return (
        <span className="w-6 h-6 rounded bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-[10px]">
          PDF
        </span>
      );
    }
    if (ext === "docx" || ext === "doc") {
      return (
        <span className="w-6 h-6 rounded bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px]">
          Wd
        </span>
      );
    }
    if (ext === "xlsx" || ext === "xls") {
      return (
        <span className="w-6 h-6 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">
          XL
        </span>
      );
    }
    return (
      <span className="w-6 h-6 rounded bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[10px]">
        DOC
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Bar: Subtitle, Stepper & Action CTAs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <nav className="text-xs text-slate-500 font-medium mb-1">
            <Link href="/dashboard/assessments" className="hover:text-blue-600">
              Assessments
            </Link>{" "}
            &gt; <span className="text-slate-800">{tenantName}</span> &gt;{" "}
            <span className="text-slate-800">Evidence</span>
          </nav>
          <p className="text-xs font-semibold text-slate-600">
            {tenantName} | Assessment ID: <span className="font-mono text-slate-900">{assessmentCode}</span> | Visit Date: {visitDate}
          </p>
        </div>

        {/* 3-Step Stepper (matching 04_evidence_management.jpeg) */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 self-start md:self-auto select-none">
          {/* Step 1: Customer Details */}
          <Link href="/dashboard/assessments/new" className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
              ✓
            </div>
            <span className="sr-only sm:not-sr-only text-xs font-medium text-slate-600">
              Customer Details
            </span>
          </Link>

          <div className="w-4 sm:w-10 h-0.5 bg-emerald-500" />

          {/* Step 2: Questionnaire */}
          <Link
            href={`/dashboard/assessments/${assessmentId}/questionnaire`}
            className="flex items-center space-x-2"
          >
            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
              ✓
            </div>
            <span className="sr-only sm:not-sr-only text-xs font-medium text-slate-600">
              Questionnaire
            </span>
          </Link>

          <div className="w-4 sm:w-10 h-0.5 bg-blue-500" />

          {/* Step 3: Review & Submit */}
          <Link
            href={`/dashboard/assessments/${assessmentId}/summary`}
            className="flex items-center space-x-2"
          >
            <div className="w-6 h-6 rounded-full bg-[#0066FF] text-white flex items-center justify-center text-xs font-bold">
              3
            </div>
            <span className="text-xs font-semibold text-[#0066FF]">
              Review & Submit
            </span>
          </Link>

          {/* Nav Buttons */}
          <Link
            href={`/dashboard/assessments/${assessmentId}/questionnaire`}
            className="sm:ml-3 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors"
          >
            &larr; Back to Questionnaire
          </Link>

          <Link
            href={`/dashboard/assessments/${assessmentId}/summary`}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-[#0066FF] hover:bg-[#0052CC] rounded-lg shadow-sm transition-colors flex items-center space-x-1"
          >
            <span>Next</span>
            <span>&rarr;</span>
          </Link>
        </div>
      </div>

      {/* Page Title & Subtitle */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Evidence Management
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Attach or reference customer documents to support the assessment responses.
        </p>
      </div>

      {/* 2. Top 4 Status KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Total Evidence */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-2xl font-bold text-slate-900 block leading-tight">
                {coverage ? coverage.totalEvidence : evidenceList.length}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Total Evidence
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-blue-500" />
        </div>

        {/* Reviewed */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-2xl font-bold text-slate-900 block leading-tight">
                {reviewedCount}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Reviewed
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-emerald-600" />
        </div>

        {/* Received */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-2xl font-bold text-slate-900 block leading-tight">
                {receivedCount}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Received
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-amber-500" />
        </div>

        {/* Not Received */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-2xl font-bold text-slate-900 block leading-tight">
                {notReceivedCount}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Not Received
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-rose-500" />
        </div>
      </div>

      {/* Independent Evidence Coverage KPI Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-500">
                Independent Evidence Coverage
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                Statutory Metric
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Assesses question-level supporting documentation independently from questionnaire completion and readiness scores.
            </p>
          </div>
          <div className="text-right">
            <span className="text-base font-bold text-slate-900">
              {coverage ? coverage.questionsWithEvidence : evidenceList.filter((e) => e.status !== "Not Received").length} / {coverage ? coverage.totalQuestions : 60}
            </span>
            <span className="text-xs text-slate-500 ml-1 font-semibold">
              ({coverage ? coverage.coveragePercentage : Math.round((evidenceList.filter((e) => e.status !== "Not Received").length / 60) * 100)}%)
            </span>
          </div>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
          <div
            className="bg-[#0066FF] h-2 rounded-full transition-all duration-300"
            style={{
              width: `${Math.min(100, coverage ? coverage.coveragePercentage : Math.round((evidenceList.filter((e) => e.status !== "Not Received").length / 60) * 100))}%`,
            }}
          />
        </div>
      </div>

      {/* 3. Main Grid: Left Area (8 cols) | Right Preview Area (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Upload Zone & Evidence List */}
        <div className="lg:col-span-8 space-y-6">
          {/* Upload Evidence Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center space-x-2.5 pb-2 border-b border-slate-100">
              <Paperclip className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-sm text-slate-900">
                Upload Evidence
              </h3>
            </div>

            {/* Drag & Drop Upload Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-blue-200 bg-[#F0F7FF]/50 hover:bg-[#F0F7FF] rounded-xl p-8 text-center cursor-pointer transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.docx,.doc,.xlsx,.xls,.png,.jpg,.jpeg"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-800">
                  Drag and drop files here or click to upload
                </p>
                <p className="text-[11px] text-slate-500">
                  Supported formats: PDF, DOCX, XLSX, PNG, JPG (Max 50 MB per file, recommended &lt; 20 MB)
                </p>
              </div>
            </div>

            {uploadError && (
              <p className="text-xs text-rose-600 font-medium">{uploadError}</p>
            )}

            {/* Three Input Fields Below Upload Zone */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end pt-1">
              {/* Question */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Question <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedQuestion}
                  onChange={(e) => setSelectedQuestion(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF] bg-white truncate"
                >
                  {canonicalQuestions.length > 0 ? (
                    canonicalQuestions.map((q) => (
                      <option key={q.code} value={`${q.code} - ${q.text.slice(0, 75)}`}>
                        {q.code} - {q.text.slice(0, 75)}...
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="GOV-01 - Governance structure for data protection">
                        GOV-01 - Governance structure for data protection
                      </option>
                      <option value="DAT-01 - Personal data inventory and processing">
                        DAT-01 - Personal data inventory and processing
                      </option>
                      <option value="SEC-01 - Security safeguards for personal data">
                        SEC-01 - Security safeguards for personal data
                      </option>
                    </>
                  )}
                </select>
              </div>

              {/* Evidence Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Evidence Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF] bg-white"
                >
                  <option value="Policy / Procedure">Policy / Procedure</option>
                  <option value="Organisational Document">Organisational Document</option>
                  <option value="Record / Log">Record / Log</option>
                  <option value="Technical Specification">Technical Specification</option>
                </select>
              </div>

              {/* Evidence Description & Upload Button */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Evidence Description <span className="text-rose-500">*</span>
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={uploadDescription}
                    onChange={(e) => setUploadDescription(e.target.value)}
                    placeholder="Enter description..."
                    className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF]"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="px-4 py-2 bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center space-x-1 whitespace-nowrap"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>{isUploading ? "Uploading..." : "Upload"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Evidence List Table */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  Evidence List ({evidenceList.length})
                </h3>
              </div>
            </div>

            {evidenceList.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-slate-700">No Evidence Records</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  No compliance artifacts have been uploaded for this assessment yet. Use the upload zone above to attach files.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">File Name</th>
                      <th className="py-2.5 px-3">Question Code</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3">Uploaded On</th>
                      <th className="py-2.5 px-3">Uploaded By</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {evidenceList.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => {
                          setSelectedEvidence(item);
                          setVerificationNotes(item.verificationNotes || "");
                          setReviewFeedback(null);
                        }}
                        className={`cursor-pointer transition-colors ${
                          selectedEvidence?.id === item.id
                            ? "bg-blue-50/60"
                            : "hover:bg-slate-50/70"
                        }`}
                      >
                      <td className="py-3 px-3 font-semibold text-slate-900">
                        <div className="flex items-center space-x-2">
                          {getFileIcon(item.fileName)}
                          <span className="truncate max-w-[140px]">{item.fileName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono font-medium text-slate-700">
                        {item.questionCode}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {item.category}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {item.description}
                      </td>
                      <td className="py-3 px-3 text-slate-500 font-medium">
                        {item.uploadedOn}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {item.uploadedBy}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            item.status === "Reviewed"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : item.status === "Received"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEvidence(item);
                              setVerificationNotes(item.verificationNotes || "");
                              setReviewFeedback(null);
                            }}
                            className="p-1 text-slate-400 hover:text-blue-600"
                            title="Preview"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={`/api/evidence/${item.id}/download`}
                            download={item.fileName}
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 text-slate-400 hover:text-slate-700"
                            title="Download"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(item.id);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

        {/* Right Column (4 cols): Selected Evidence Preview & Details */}
        <div className="lg:col-span-4 space-y-6">
          {selectedEvidence ? (
            <>
              {/* Panel 1: Selected Evidence Preview */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2 min-w-0">
                {getFileIcon(selectedEvidence.fileName)}
                <div className="truncate">
                  <h4 className="font-bold text-xs text-slate-900 truncate">
                    {selectedEvidence.fileName}
                  </h4>
                  <p className="text-[10px] text-slate-500 font-mono">
                    PDF • {(selectedEvidence.fileSizeBytes / 1024).toFixed(0)} KB
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* PDF Viewer Control Bar */}
            <div className="flex items-center justify-between bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs select-none">
              <div className="flex items-center space-x-2">
                <button type="button" className="p-1 hover:text-slate-300">
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button type="button" className="p-1 hover:text-slate-300">
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="text-[11px] font-mono">
                {selectedPage} / {totalPages}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedPage(Math.max(1, selectedPage - 1))}
                  className="px-1.5 py-0.5 hover:bg-slate-700 rounded"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPage(Math.min(totalPages, selectedPage + 1))}
                  className="px-1.5 py-0.5 hover:bg-slate-700 rounded"
                >
                  +
                </button>
                <button type="button" className="p-1 hover:text-slate-300">
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Document Rendered Content Preview */}
            <div className="border border-slate-200 rounded-lg p-5 bg-[#FAF8F5] min-h-[220px] space-y-3 font-serif">
              <div className="text-center pb-2 border-b border-slate-200">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-sans font-bold">
                  {tenantName}
                </p>
                <h5 className="font-bold text-sm text-slate-900 mt-1">
                  Data Protection Policy
                </h5>
                <p className="text-[10px] text-slate-500 font-sans mt-0.5">
                  Version 1.0 • Effective Date: 15 January 2024
                </p>
              </div>

              <div className="space-y-1.5 text-xs text-slate-700 leading-relaxed font-sans">
                <p className="font-bold text-slate-900 text-[11px]">
                  1. Purpose
                </p>
                <p className="text-[11px] text-slate-600 leading-normal">
                  This policy outlines the organisation’s approach to personal data protection in compliance with the Digital Personal Data Protection Act, 2023.
                </p>
              </div>
            </div>
          </div>

          {/* Panel 2: Evidence Details */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h4 className="font-bold text-xs text-slate-900 pb-2 border-b border-slate-100">
              Evidence Details
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Question Code
                </label>
                <input
                  type="text"
                  readOnly
                  value={selectedEvidence.questionCode}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded bg-slate-50 font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Evidence Category
                </label>
                <input
                  type="text"
                  readOnly
                  value={selectedEvidence.category}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded bg-slate-50 text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Status
              </label>
              <select
                value={selectedEvidence.status}
                onChange={(e) => {
                  const newStatus = e.target.value as EvidenceItem["status"];
                  setEvidenceList((prev) =>
                    prev.map((item) =>
                      item.id === selectedEvidence.id ? { ...item, status: newStatus } : item
                    )
                  );
                  setSelectedEvidence((prev) => (prev ? { ...prev, status: newStatus } : null));
                }}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF] bg-white font-medium"
              >
                <option value="Reviewed">Reviewed</option>
                <option value="Received">Received</option>
                <option value="Not Received">Not Received</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-600">
                  Description
                </label>
                <span className="text-[10px] text-slate-400 font-mono">
                  {selectedEvidence.description.length}/500
                </span>
              </div>
              <textarea
                rows={3}
                value={selectedEvidence.description}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedEvidence((prev) => (prev ? { ...prev, description: val } : null));
                  setEvidenceList((prev) =>
                    prev.map((item) =>
                      item.id === selectedEvidence.id ? { ...item, description: val } : item
                    )
                  );
                }}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF]"
              />
            </div>

            {/* Assessor Review Decision Section */}
            {isAssessor && (
              <div className="pt-3 border-t border-slate-100 space-y-2.5">
                <div className="flex items-center space-x-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-[11px] font-bold text-slate-900">
                    Assessor Review Decision
                  </span>
                </div>

                {selectedEvidence.verifiedByName && (
                  <p className="text-[10px] text-slate-500">
                    Verified by <span className="font-semibold">{selectedEvidence.verifiedByName}</span>
                  </p>
                )}

                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                    Verification Notes
                  </label>
                  <textarea
                    rows={2}
                    value={verificationNotes}
                    onChange={(e) => setVerificationNotes(e.target.value)}
                    placeholder="Enter verification finding or rejection deficiency note..."
                    className="w-full p-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF]"
                  />
                </div>

                {reviewFeedback && (
                  <p className="text-[11px] text-blue-600 font-medium">
                    {reviewFeedback}
                  </p>
                )}

                <div className="flex items-center space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleReviewDecision("VERIFIED")}
                    disabled={isReviewing}
                    className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors flex items-center justify-center space-x-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Verify Evidence</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReviewDecision("REJECTED")}
                    disabled={isReviewing}
                    className="flex-1 py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors flex items-center justify-center space-x-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reject Evidence</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          </>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500 shadow-xs space-y-2">
              <Paperclip className="w-8 h-8 text-slate-300 mx-auto" />
              <h4 className="font-bold text-slate-700 text-xs">No Artifact Selected</h4>
              <p className="text-[11px] text-slate-400">
                Select an evidence item from the list to preview details or record assessor validation.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
