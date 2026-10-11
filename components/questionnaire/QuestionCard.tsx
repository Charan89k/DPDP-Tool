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
  FileCheck,
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
}

interface QuestionCardProps {
  question: CanonicalQuestion;
  response?: RespondentQuestionResponse;
  assessmentId: string;
  evidenceItems?: AttachedEvidenceItem[];
  onUpdateResponse: (updated: RespondentQuestionResponse) => void;
  onAttachEvidence?: (evidence: AttachedEvidenceItem) => void;
}

export function QuestionCard({
  question,
  response,
  assessmentId,
  evidenceItems = [],
  onUpdateResponse,
  onAttachEvidence,
}: QuestionCardProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const selectedOption = response?.selectedOption;
  const commentsAndJustification = response?.commentsAndJustification || "";

  const isNA = selectedOption === "Not applicable — justification required";
  const isMissingNAJustification = isNA && commentsAndJustification.trim().length === 0;
  const isAnswered = Boolean(selectedOption) && !isMissingNAJustification;

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
        status: data.evidence.status,
        uploadedAt: data.evidence.uploadedAt,
      };

      if (onAttachEvidence) {
        onAttachEvidence(newEvidence);
      }

      setIsUploading(false);
      e.target.value = "";
    } catch (err) {
      console.error("Upload network error:", err);
      setUploadError("Network error occurred while connecting to the evidence vault.");
      setIsUploading(false);
    }
  };

  return (
    <div
      id={`question-${question.code}`}
      className={`bg-white border rounded-xl p-6 sm:p-7 shadow-sm transition-all ${
        isMissingNAJustification
          ? "border-amber-400 ring-1 ring-amber-400"
          : "border-stone-200 hover:border-stone-300"
      }`}
    >
      {/* Header with Question Code & Section Reference */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-stone-200/80">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="font-mono text-xs font-bold text-stone-900 bg-stone-100 px-2.5 py-0.5 rounded border border-stone-300">
              {question.code}
            </span>
            <span className="text-xs font-semibold text-stone-600 bg-stone-50 px-2 py-0.5 rounded border border-stone-200">
              Section {question.sectionCode}
            </span>
            <span className="text-[11px] font-mono text-stone-500">
              Question #{question.order} of 60
            </span>
            {question.canonicalControlId && (
              <span className="text-[10px] font-mono text-stone-500 bg-stone-100/70 px-1.5 py-0.5 rounded">
                Ref: {question.canonicalControlId}
              </span>
            )}
          </div>
          <h3 className="font-serif text-lg font-bold text-stone-900 leading-snug pt-1">
            {question.text}
          </h3>
        </div>

        {/* Status Pill */}
        <div className="self-start sm:self-auto flex-shrink-0">
          {isMissingNAJustification ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-300">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              Justification Required
            </span>
          ) : isNA ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
              <Shield className="w-3.5 h-3.5" />
              Not Applicable
            </span>
          ) : isAnswered ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Answered
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-600 border border-stone-200">
              <Clock className="w-3.5 h-3.5 text-stone-400" />
              Unanswered
            </span>
          )}
        </div>
      </div>

      {/* Multiple-Choice Options (Exact 5 Canonical Choices) */}
      <div className="space-y-2.5 my-5">
        <span className="text-[11px] uppercase tracking-wider font-semibold text-stone-600 block mb-2">
          Select Applicable Current State:
        </span>
        {question.options.map((opt) => {
          const isSelected = selectedOption === opt;
          return (
            <label
              key={opt}
              onClick={() => handleSelectOption(opt)}
              className={`block p-3.5 rounded-lg border text-xs cursor-pointer transition-all ${
                isSelected
                  ? "bg-stone-50 border-stone-900 ring-1 ring-stone-900 text-stone-950 font-medium"
                  : "bg-white border-stone-200 hover:border-stone-400 text-stone-800"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                    isSelected
                      ? "border-stone-900 bg-stone-900"
                      : "border-stone-400 bg-white"
                  }`}
                >
                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div className="flex-1">
                  <span className="text-stone-900 font-semibold">{opt}</span>
                </div>
              </div>
            </label>
          );
        })}
      </div>

      {/* Follow-up / Comment Field (Exact Canonical Follow-up Text) */}
      <div className="pt-4 border-t border-stone-200">
        <label className="block text-xs font-semibold text-stone-800 mb-1.5">
          {question.followUpPrompt}
          {isNA && (
            <span className="text-rose-600 font-bold ml-1">* (Mandatory)</span>
          )}
        </label>

        {isNA && (
          <div className="mb-2 p-2.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 leading-relaxed">
            <strong>Mandatory Justification:</strong> You have selected <em>Not applicable</em>. Under DPDP compliance governance, a specific factual or statutory justification must be documented explaining why this control does not apply to the organisation’s processing activities.
          </div>
        )}

        <textarea
          rows={3}
          value={commentsAndJustification}
          onChange={handleCommentsChange}
          placeholder="Enter assessor/respondent comments, implementation caveats, or mandatory justification if Not applicable..."
          className={`w-full p-2.5 text-xs rounded transition-colors ${
            isMissingNAJustification
              ? "bg-amber-50/50 border border-amber-400 focus:bg-white focus:ring-1 focus:ring-amber-600 text-stone-900 placeholder-amber-700/60"
              : "bg-stone-50 border border-stone-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-800 text-stone-900 placeholder-stone-400"
          }`}
        />
        {isMissingNAJustification && (
          <p className="text-[11px] text-amber-700 font-medium mt-1">
            Please enter a justification before proceeding to submission.
          </p>
        )}
      </div>

      {/* Evidentiary Artifacts Section */}
      <div className="mt-4 pt-4 border-t border-stone-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-800">
            <FileText className="w-3.5 h-3.5 text-stone-600" />
            <span>Evidentiary Artifacts ({evidenceItems.length} Attached)</span>
          </div>
        </div>

        {uploadError && (
          <div className="mb-3 p-2 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        {/* Existing Attached Evidence List */}
        {evidenceItems.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {evidenceItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2 bg-[#f8f6f0] border border-stone-200 rounded text-xs"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <FileCheck className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                  <div className="truncate">
                    <span className="font-semibold text-stone-900 truncate block">
                      {item.fileName}
                    </span>
                    <span className="text-[10px] text-stone-500 font-mono">
                      {(item.fileSizeBytes / 1024).toFixed(1)} KB • SHA-256: {item.sha256.slice(0, 12)}...
                    </span>
                  </div>
                </div>

                <a
                  href={`/api/evidence/${item.id}/download`}
                  download={item.fileName}
                  className="flex items-center gap-1 text-[11px] text-stone-700 hover:text-stone-950 px-2 py-1 bg-white border border-stone-200 rounded hover:border-stone-400 transition-colors font-medium ml-2 flex-shrink-0"
                >
                  <Download className="w-3 h-3" />
                  <span>Download</span>
                </a>
              </div>
            ))}
          </div>
        )}

        {/* Upload Trigger Dropzone */}
        <div className="relative border border-dashed border-stone-300 rounded-lg p-3 bg-stone-50/60 hover:bg-stone-50 transition-colors text-center">
          <input
            type="file"
            onChange={handleFileUpload}
            disabled={isUploading}
            accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />
          <div className="flex items-center justify-center gap-2 text-xs text-stone-600">
            {isUploading ? (
              <span className="inline-flex items-center gap-2 text-stone-700">
                <span className="w-3.5 h-3.5 border-2 border-stone-400 border-t-stone-800 rounded-full animate-spin"></span>
                <span>Verifying and saving artifact to evidence vault...</span>
              </span>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5 text-stone-500" />
                <span>
                  Upload supporting evidence (PDF, DOCX, XLSX, PNG, JPG • 100B–50MB)
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
