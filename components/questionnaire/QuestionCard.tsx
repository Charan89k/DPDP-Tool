"use client";

import React, { useState, useEffect } from "react";
import {
  Shield,
  FileText,
  Upload,
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  Trash2,
  Plus,
  Paperclip,
  Info,
  MessageSquare,
  Send,
  AlertTriangle,
} from "lucide-react";
import type {
  CanonicalQuestion,
  CanonicalResponseOption,
  RespondentQuestionResponse,
} from "@/lib/questionnaire/types";

interface AttachedEvidenceItem {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  sha256: string;
  status: string;
  uploadedAt: string;
  description?: string;
  fileType?: string;
}

interface QuestionClarificationThread {
  id: string;
  title: string;
  status: string;
  raisedByName: string;
  createdAt: string;
  messages: Array<{
    id: string;
    authorName: string;
    authorRole: string;
    messageText: string;
    createdAt: string;
  }>;
}

interface QuestionCardProps {
  question: CanonicalQuestion;
  response?: RespondentQuestionResponse;
  assessmentId: string;
  evidenceItems?: AttachedEvidenceItem[];
  isAssessor?: boolean;
  canEdit?: boolean;
  userRole?: string;
  onUpdateResponse: (updated: RespondentQuestionResponse) => void;
  onAttachEvidence?: (evidence: AttachedEvidenceItem) => void;
  onNextQuestion?: () => void;
  onPrevQuestion?: () => void;
  questionNumber?: number;
  totalQuestions?: number;
}

export function QuestionCard({
  question,
  response,
  assessmentId,
  evidenceItems = [],
  isAssessor = false,
  canEdit = true,
  userRole,
  onUpdateResponse,
  onAttachEvidence,
  onNextQuestion,
  onPrevQuestion,
  questionNumber = 1,
  totalQuestions = 60,
}: QuestionCardProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [evidenceDescription, setEvidenceDescription] = useState("");

  const selectedOption = response?.selectedOption;
  const commentsAndJustification = response?.commentsAndJustification || "";

  const isNA = selectedOption === "Not applicable — justification required";
  const isMissingNAJustification = isNA && commentsAndJustification.trim().length === 0;

  // Real evidence state for this question
  const [currentEvidenceList, setCurrentEvidenceList] = useState<AttachedEvidenceItem[]>(evidenceItems);

  // Real clarifications state for this question
  const [clarificationThreads, setClarificationThreads] = useState<QuestionClarificationThread[]>([]);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [isSendingReply, setIsSendingReply] = useState<Record<string, boolean>>({});

  // Fetch real evidence and clarifications for this specific question
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      // 1. Evidence items
      try {
        const evRes = await fetch(`/api/assessments/${assessmentId}/evidence`);
        if (evRes.ok) {
          const evData = await evRes.json();
          if (evData.items && Array.isArray(evData.items) && isMounted) {
            const matched = evData.items.filter(
              (it: any) =>
                it.questionCode === question.code ||
                (question.canonicalControlId && it.controlCode === question.canonicalControlId)
            );
            setCurrentEvidenceList(
              matched.map((m: any) => ({
                id: m.id,
                fileName: m.fileName,
                fileSizeBytes: m.fileSizeBytes,
                mimeType: m.mimeType,
                sha256: m.sha256 || "",
                status: m.status === "VERIFIED" ? "Reviewed" : "Received",
                uploadedAt: m.createdAt
                  ? new Date(m.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                  : "Recent",
                description: m.description || m.fileName,
                fileType: m.fileName.split(".").pop()?.toUpperCase() || "File",
              }))
            );
          }
        }
      } catch {}

      // 2. Clarifications
      try {
        const clRes = await fetch(`/api/assessments/${assessmentId}/clarifications`);
        if (clRes.ok) {
          const clData = await clRes.json();
          if (clData.threads && Array.isArray(clData.threads) && isMounted) {
            const matched = clData.threads.filter(
              (th: any) =>
                th.questionCode === question.code ||
                (question.canonicalControlId && th.controlCode === question.canonicalControlId)
            );
            setClarificationThreads(
              matched.map((th: any) => ({
                id: th.id,
                title: th.title,
                status: th.status,
                raisedByName: th.raisedByName || "Assessor",
                createdAt: th.createdAt,
                messages: (th.messages || []).map((msg: any) => ({
                  id: msg.id,
                  authorName: msg.authorName || "User",
                  authorRole: msg.authorRole || "",
                  messageText: msg.messageText,
                  createdAt: msg.createdAt,
                })),
              }))
            );
          }
        }
      } catch {}
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [assessmentId, question.code, question.canonicalControlId]);

  const handleSelectOption = (option: CanonicalResponseOption) => {
    if (!canEdit) return;
    onUpdateResponse({
      questionCode: question.code,
      selectedOption: option,
      commentsAndJustification,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleCommentsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!canEdit) return;
    const val = e.target.value;
    onUpdateResponse({
      questionCode: question.code,
      selectedOption,
      commentsAndJustification: val,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("assessmentId", assessmentId);
      formData.append("questionCode", question.code);
      if (question.canonicalControlId) {
        formData.append("controlCode", question.canonicalControlId);
      }
      formData.append("description", evidenceDescription || file.name);
      formData.append("category", "Policy / Procedure");

      const res = await fetch("/api/evidence/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setUploadError(data.error || "File upload failed.");
        setIsUploading(false);
        return;
      }

      const newEvidence: AttachedEvidenceItem = {
        id: data.evidence.id,
        fileName: data.evidence.fileName,
        fileSizeBytes: data.evidence.fileSizeBytes,
        mimeType: data.evidence.mimeType,
        sha256: data.evidence.sha256,
        status: "Received",
        uploadedAt: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        description: evidenceDescription || file.name,
        fileType: file.name.split(".").pop()?.toUpperCase() || "File",
      };

      setCurrentEvidenceList((prev) => [...prev, newEvidence]);
      if (onAttachEvidence) {
        onAttachEvidence(newEvidence);
      }

      setIsUploading(false);
      setShowUploadModal(false);
      setEvidenceDescription("");
      e.target.value = "";
    } catch (err) {
      console.error("Upload error:", err);
      setUploadError("Network error while connecting to evidence vault.");
      setIsUploading(false);
    }
  };

  const handleDeleteEvidence = async (id: string) => {
    if (!canEdit) return;
    try {
      const res = await fetch(`/api/evidence/${id}`, { method: "DELETE" });
      if (res.ok) {
        setCurrentEvidenceList((prev) => prev.filter((item) => item.id !== id));
      }
    } catch {
      setCurrentEvidenceList((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const handleSendClarificationReply = async (threadId: string) => {
    const message = replyText[threadId]?.trim();
    if (!message) return;

    setIsSendingReply((prev) => ({ ...prev, [threadId]: true }));
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/clarifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          message,
        }),
      });

      if (res.ok) {
        setReplyText((prev) => ({ ...prev, [threadId]: "" }));
        // Refresh clarification threads
        const clRes = await fetch(`/api/assessments/${assessmentId}/clarifications`);
        if (clRes.ok) {
          const clData = await clRes.json();
          if (clData.threads) {
            const matched = clData.threads.filter(
              (th: any) =>
                th.questionCode === question.code ||
                (question.canonicalControlId && th.controlCode === question.canonicalControlId)
            );
            setClarificationThreads(
              matched.map((th: any) => ({
                id: th.id,
                title: th.title,
                status: th.status,
                raisedByName: th.raisedByName || "Assessor",
                createdAt: th.createdAt,
                messages: (th.messages || []).map((msg: any) => ({
                  id: msg.id,
                  authorName: msg.authorName || "User",
                  authorRole: msg.authorRole || "",
                  messageText: msg.messageText,
                  createdAt: msg.createdAt,
                })),
              }))
            );
          }
        }
      }
    } finally {
      setIsSendingReply((prev) => ({ ...prev, [threadId]: false }));
    }
  };

  return (
    <div
      id={`question-${question.code}`}
      className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5"
    >
      {/* Read-Only Notice if editing is not permitted */}
      {!canEdit && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Info className="w-4 h-4 text-slate-400" />
            <span>
              <strong>Read-Only Mode:</strong> Questionnaire responses cannot be modified under your current role or assessment lifecycle state.
            </span>
          </div>
          <span className="text-[10px] font-mono uppercase bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
            Locked
          </span>
        </div>
      )}

      {/* 1. Top Bar: Question Code, Title & Domain Badge */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="space-y-1.5 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold bg-slate-900 text-white px-2.5 py-0.5 rounded">
              {question.code}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              Question {questionNumber} of {totalQuestions}
            </span>
            <span className="text-xs text-slate-300">•</span>
            <span className="text-xs font-semibold text-slate-700">
              {question.sectionTitle}
            </span>
          </div>

          {question.sectionTitle && (
            <div className="flex items-center gap-2 pt-0.5">
              <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full">
                Domain: {question.sectionTitle}
              </span>
              {question.canonicalControlId && (
                <span className="text-[11px] font-mono text-slate-400">
                  Control Ref: {question.canonicalControlId}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Question Narrative & Statutory Guidance */}
      <div className="space-y-2">
        <p className="text-xs text-slate-700 leading-relaxed font-normal">
          {question.text}
        </p>
        <p className="text-[11px] text-slate-500 italic">
          (DPDP Act, 2023 Statutory Reference: Section 6, 7 & 8; Accountability & Governance Framework)
        </p>
      </div>

      {/* 3. Grid: Left: Response Pills & Notes | Right: Assessor Guidance Sub-Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Options & Notes */}
        <div className={isAssessor ? "lg:col-span-7 space-y-4" : "lg:col-span-12 space-y-4"}>
          <div>
            <label className="block text-xs font-bold text-slate-900 mb-2">
              Response <span className="text-rose-500">*</span>
            </label>

            {/* Top Row: 3 Primary Options */}
            <div className="grid grid-cols-3 gap-2 mb-2">
              {/* Implemented */}
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => handleSelectOption("Implemented")}
                className={`py-2 px-2 rounded-lg text-xs font-semibold text-center transition-all border disabled:opacity-60 ${
                  selectedOption === "Implemented"
                    ? "bg-[#059669] text-white border-[#059669] shadow-xs ring-2 ring-emerald-200"
                    : "bg-emerald-50/70 hover:bg-emerald-100/70 text-emerald-900 border-emerald-200"
                }`}
              >
                ✓ Implemented
              </button>

              {/* Partially Implemented */}
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => handleSelectOption("Partially implemented")}
                className={`py-2 px-2 rounded-lg text-xs font-semibold text-center transition-all border disabled:opacity-60 ${
                  selectedOption === "Partially implemented"
                    ? "bg-[#F59E0B] text-slate-950 border-[#F59E0B] shadow-xs ring-2 ring-amber-200 font-bold"
                    : "bg-amber-50/70 hover:bg-amber-100/70 text-amber-900 border-amber-200"
                }`}
              >
                Partially Implemented
              </button>

              {/* Not Implemented */}
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => handleSelectOption("Not implemented")}
                className={`py-2 px-2 rounded-lg text-xs font-semibold text-center transition-all border disabled:opacity-60 ${
                  selectedOption === "Not implemented"
                    ? "bg-[#EF4444] text-white border-[#EF4444] shadow-xs ring-2 ring-rose-200"
                    : "bg-rose-50/70 hover:bg-rose-100/70 text-rose-900 border-rose-200"
                }`}
              >
                Not Implemented
              </button>
            </div>

            {/* Bottom Row: 2 Secondary Options */}
            <div className="grid grid-cols-2 gap-2">
              {/* Unknown / Not Verified */}
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => handleSelectOption("Unknown / not verified")}
                className={`py-2 px-2 rounded-lg text-xs font-medium text-center transition-all border disabled:opacity-60 ${
                  selectedOption === "Unknown / not verified"
                    ? "bg-slate-800 text-white border-slate-800 shadow-xs ring-2 ring-slate-300 font-semibold"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                }`}
              >
                Unknown / Not Verified
              </button>

              {/* Not Applicable */}
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => handleSelectOption("Not applicable — justification required")}
                className={`py-2 px-2 rounded-lg text-xs font-medium text-center transition-all border disabled:opacity-60 ${
                  selectedOption === "Not applicable — justification required"
                    ? "bg-slate-800 text-white border-slate-800 shadow-xs ring-2 ring-slate-300 font-semibold"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                }`}
              >
                Not Applicable
              </button>
            </div>
          </div>

          {/* Response Comments & Mandatory Justification */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900">
                {isAssessor ? "Assessor Review Notes" : "Comments & Justification"}{" "}
                {isNA && <span className="text-rose-500">*</span>}
              </label>
              <span className="text-[11px] text-slate-400 font-mono">
                {commentsAndJustification.length} / 1000
              </span>
            </div>

            {isNA && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <strong>Mandatory Statutory Justification:</strong> You have marked this control as Not Applicable. You must record factual business or legal rationale explaining why this obligation does not apply to your organization.
                </div>
              </div>
            )}

            <textarea
              rows={4}
              maxLength={1000}
              disabled={!canEdit}
              value={commentsAndJustification}
              onChange={handleCommentsChange}
              placeholder={
                isNA
                  ? "Detail factual justification explaining why this statutory control does not apply to your operations..."
                  : "Detail current operational status, governance artifacts, key systems, or implementation notes..."
              }
              className={`w-full p-3 text-xs rounded-lg border transition-colors disabled:bg-slate-50 disabled:text-slate-500 ${
                isMissingNAJustification
                  ? "border-amber-400 bg-amber-50/40 text-slate-900"
                  : "border-slate-300 focus:outline-none focus:border-[#0066FF] focus:ring-1 focus:ring-[#0066FF]"
              }`}
            />
          </div>
        </div>

        {/* Right Column: Guidance for Assessors Box (Visible strictly for authorized Assessors) */}
        {isAssessor && (
          <div className="lg:col-span-5 bg-[#F0F7FF] rounded-xl border border-blue-200/80 p-4 shadow-xs space-y-3.5">
            <div className="flex items-center space-x-2 text-blue-900 font-bold text-xs">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span>Guidance for Assessors</span>
            </div>

            <div className="space-y-1.5 text-xs text-slate-700">
              <span className="font-bold text-slate-900 block text-[11px]">
                What to look for:
              </span>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-600 leading-normal">
                <li>Documented governance structure</li>
                <li>Defined roles (e.g. Data Protection Officer, steering committee)</li>
                <li>Board or executive management approval</li>
                <li>Integration with existing enterprise risk, compliance, and security</li>
              </ul>
            </div>

            <div className="space-y-1.5 text-xs text-slate-700 pt-2 border-t border-blue-200/60">
              <span className="font-bold text-slate-900 block text-[11px]">
                Expected Evidence:
              </span>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-600 leading-normal">
                <li>Data protection policy</li>
                <li>Organisation structure chart</li>
                <li>Roles and responsibilities charter</li>
                <li>Board or management meeting minutes</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* 4. Active Clarification Inquiries Section (If Assessor requested clarifications) */}
      {clarificationThreads.length > 0 && (
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center space-x-2 text-purple-900 font-bold text-xs">
            <MessageSquare className="w-4 h-4 text-purple-600" />
            <span>Assessor Clarification Inquiries ({clarificationThreads.length})</span>
          </div>

          <div className="space-y-3">
            {clarificationThreads.map((thread) => (
              <div
                key={thread.id}
                className="bg-purple-50/60 border border-purple-200 rounded-xl p-4 text-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-purple-950 text-xs">{thread.title}</h5>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      thread.status === "OPEN"
                        ? "bg-purple-200 text-purple-900"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {thread.status}
                  </span>
                </div>

                {/* Messages timeline */}
                <div className="space-y-2 bg-white rounded-lg p-3 border border-purple-100 max-h-48 overflow-y-auto">
                  {thread.messages.map((msg) => (
                    <div key={msg.id} className="text-xs space-y-0.5 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span className="font-semibold text-slate-800">
                          {msg.authorName} {msg.authorRole ? `(${msg.authorRole})` : ""}
                        </span>
                        {msg.createdAt && (
                          <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        )}
                      </div>
                      <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{msg.messageText}</p>
                    </div>
                  ))}
                </div>

                {/* Reply Form */}
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={replyText[thread.id] || ""}
                    onChange={(e) => setReplyText((prev) => ({ ...prev, [thread.id]: e.target.value }))}
                    placeholder="Type clarification response to the TLI assessor..."
                    className="flex-1 px-3 py-1.5 text-xs bg-white border border-purple-200 rounded-lg focus:outline-none focus:border-purple-600"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendClarificationReply(thread.id);
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={isSendingReply[thread.id] || !replyText[thread.id]?.trim()}
                    onClick={() => handleSendClarificationReply(thread.id)}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1"
                  >
                    <Send className="w-3 h-3" />
                    <span>{isSendingReply[thread.id] ? "Sending..." : "Reply"}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Embedded Evidence Table */}
      <div className="pt-4 border-t border-slate-100 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Paperclip className="w-4 h-4 text-slate-500" />
            <h4 className="font-bold text-xs text-slate-900">
              Evidence Vault Artifacts ({currentEvidenceList.length})
            </h4>
          </div>

          {canEdit && (
            <button
              type="button"
              onClick={() => setShowUploadModal(!showUploadModal)}
              className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-[#0066FF] bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Evidence</span>
            </button>
          )}
        </div>

        {/* Upload Modal / Dropzone Inline */}
        {showUploadModal && (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <h5 className="text-xs font-bold text-slate-800">
              Attach Supporting Evidence
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Evidence description (e.g. Data Protection Charter v1.0)..."
                value={evidenceDescription}
                onChange={(e) => setEvidenceDescription(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF]"
              />
              <div className="relative">
                <input
                  type="file"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#0066FF] file:text-white hover:file:bg-[#0052CC]"
                />
              </div>
            </div>
            {uploadError && (
              <p className="text-xs text-rose-600 font-medium">{uploadError}</p>
            )}
          </div>
        )}

        {/* Evidence Items Table */}
        {currentEvidenceList.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 border-dashed rounded-lg p-4 text-center text-xs text-slate-500">
            <p>No supporting evidence documents attached to this question yet.</p>
            {canEdit && (
              <p className="text-[11px] text-slate-400 mt-0.5">
                Click &ldquo;Add Evidence&rdquo; to attach policies, architectural diagrams, or configuration screenshots.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">File Name</th>
                  <th className="py-2.5 px-3">File Type</th>
                  <th className="py-2.5 px-3">Uploaded On</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentEvidenceList.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      {item.fileName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 uppercase font-mono text-[11px]">
                      {item.fileType || "Document"}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {item.uploadedAt}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {item.description || "Uploaded evidence"}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          item.status === "Reviewed"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-blue-50 text-blue-700 border border-blue-200"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <a
                          href={`/api/evidence/${item.id}/download`}
                          target="_blank"
                          rel="noreferrer"
                          title="Download / Preview"
                          className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </a>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => handleDeleteEvidence(item.id)}
                            title="Delete"
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
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
  );
}
