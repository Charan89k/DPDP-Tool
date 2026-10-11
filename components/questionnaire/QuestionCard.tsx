"use client";

import React, { useState } from "react";
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

interface QuestionCardProps {
  question: CanonicalQuestion;
  response?: RespondentQuestionResponse;
  assessmentId: string;
  evidenceItems?: AttachedEvidenceItem[];
  isAssessor?: boolean;
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
  isAssessor = true,
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

  // Default sample evidence for preview matching reference screenshot
  const initialEvidence: AttachedEvidenceItem[] =
    evidenceItems.length > 0
      ? evidenceItems
      : [
          {
            id: `ev-sample-1-${question.code}`,
            fileName: "Data_Protection_Policy.pdf",
            fileSizeBytes: 842000,
            mimeType: "application/pdf",
            sha256: "8e92bc7190",
            status: "Reviewed",
            uploadedAt: "20 Aug 2024",
            description: "Data protection policy v1.0",
            fileType: "PDF",
          },
          {
            id: `ev-sample-2-${question.code}`,
            fileName: "Org_Structure.png",
            fileSizeBytes: 312000,
            mimeType: "image/png",
            sha256: "4c718b9102",
            status: "Received",
            uploadedAt: "20 Aug 2024",
            description: "Organisation structure showing DPO",
            fileType: "Image",
          },
        ];

  const [currentEvidenceList, setCurrentEvidenceList] = useState<AttachedEvidenceItem[]>(initialEvidence);

  const handleSelectOption = (option: CanonicalResponseOption) => {
    onUpdateResponse({
      questionCode: question.code,
      selectedOption: option,
      commentsAndJustification,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleCommentsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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
      formData.append("controlCode", question.canonicalControlId || question.code);

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

  const handleDeleteEvidence = (id: string) => {
    setCurrentEvidenceList((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div
      id={`question-${question.code}`}
      className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5"
    >
      {/* 1. Top Bar: Question Code, Title & Domain Badge */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="space-y-1.5 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold text-white bg-[#0066FF] px-2.5 py-1 rounded shadow-2xs">
              {question.code}
            </span>
            <span className="text-sm font-bold text-slate-900">
              {question.text}
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
                onClick={() => handleSelectOption("Implemented")}
                className={`py-2 px-2 rounded-lg text-xs font-semibold text-center transition-all border ${
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
                onClick={() => handleSelectOption("Partially implemented")}
                className={`py-2 px-2 rounded-lg text-xs font-semibold text-center transition-all border ${
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
                onClick={() => handleSelectOption("Not implemented")}
                className={`py-2 px-2 rounded-lg text-xs font-semibold text-center transition-all border ${
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
                onClick={() => handleSelectOption("Unknown / not verified")}
                className={`py-2 px-2 rounded-lg text-xs font-medium text-center transition-all border ${
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
                onClick={() => handleSelectOption("Not applicable — justification required")}
                className={`py-2 px-2 rounded-lg text-xs font-medium text-center transition-all border ${
                  selectedOption === "Not applicable — justification required"
                    ? "bg-slate-800 text-white border-slate-800 shadow-xs ring-2 ring-slate-300 font-semibold"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                }`}
              >
                Not Applicable
              </button>
            </div>
          </div>

          {/* Assessor Notes & Comments */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900">
                Assessor Notes <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400 font-mono">
                {commentsAndJustification.length} / 1000
              </span>
            </div>

            {isNA && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
                <strong>Mandatory Justification:</strong> Document factual reasons why this control does not apply.
              </div>
            )}

            <textarea
              rows={4}
              maxLength={1000}
              value={commentsAndJustification}
              onChange={handleCommentsChange}
              placeholder="Organisation has a formal data protection governance structure. Roles and responsibilities are defined in the Data Protection Policy. Board approvals available..."
              className={`w-full p-3 text-xs rounded-lg border transition-colors ${
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

      {/* 4. Embedded Evidence Table */}
      <div className="pt-4 border-t border-slate-100 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Paperclip className="w-4 h-4 text-slate-500" />
            <h4 className="font-bold text-xs text-slate-900">
              Evidence
            </h4>
          </div>

          <button
            type="button"
            onClick={() => setShowUploadModal(!showUploadModal)}
            className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-[#0066FF] bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Evidence</span>
          </button>
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
                        title="Download / Preview"
                        className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDeleteEvidence(item.id)}
                        title="Delete"
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
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
      </div>
    </div>
  );
}
