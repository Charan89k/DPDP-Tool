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
  XCircle,
  FileCheck,
} from "lucide-react";
import type {
  QuestionControl,
  QuestionResponse,
  ResponseOptionKey,
  AttachedEvidenceItem,
} from "@/lib/questionnaire/types";

interface QuestionCardProps {
  question: QuestionControl;
  response?: QuestionResponse;
  assessmentId: string;
  onUpdateResponse: (updated: QuestionResponse) => void;
}

export function QuestionCard({
  question,
  response,
  assessmentId,
  onUpdateResponse,
}: QuestionCardProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showExclusionBox, setShowExclusionBox] = useState(Boolean(response?.isExcluded));
  const [exclusionText, setExclusionText] = useState(response?.exclusionJustification || "");
  const [notesText, setNotesText] = useState(response?.notes || "");

  const selectedOption = response?.selectedOption;
  const isExcluded = Boolean(response?.isExcluded);
  const evidenceItems = response?.evidenceItems || [];

  // Determine status
  const isAnswered = Boolean(selectedOption) && !isExcluded;
  const hasEvidence = evidenceItems.length > 0;
  const isEvidencePending = isAnswered && question.acceptableEvidence.length > 0 && !hasEvidence;

  const handleSelectOption = (key: ResponseOptionKey) => {
    const opt = question.options.find((o) => o.key === key);
    onUpdateResponse({
      controlId: question.controlId,
      selectedOption: key,
      selfMaturityScore: opt?.maturityScore || 0,
      notes: notesText,
      isExcluded: false,
      exclusionJustification: undefined,
      evidenceItems,
    });
    setShowExclusionBox(false);
  };

  const handleToggleExclusion = () => {
    if (showExclusionBox) {
      // Canceling exclusion
      setShowExclusionBox(false);
      onUpdateResponse({
        controlId: question.controlId,
        selectedOption: undefined,
        selfMaturityScore: 0,
        notes: notesText,
        isExcluded: false,
        exclusionJustification: undefined,
        evidenceItems,
      });
    } else {
      setShowExclusionBox(true);
      onUpdateResponse({
        controlId: question.controlId,
        selectedOption: undefined,
        selfMaturityScore: 0,
        notes: notesText,
        isExcluded: true,
        exclusionJustification: exclusionText,
        evidenceItems,
      });
    }
  };

  const handleExclusionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setExclusionText(val);
    onUpdateResponse({
      controlId: question.controlId,
      selectedOption: undefined,
      selfMaturityScore: 0,
      notes: notesText,
      isExcluded: true,
      exclusionJustification: val,
      evidenceItems,
    });
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNotesText(val);
    onUpdateResponse({
      ...(response || { controlId: question.controlId }),
      notes: val,
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
      formData.append("controlCode", question.controlId);

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

      const updatedEvidenceList = [...evidenceItems, newEvidence];

      onUpdateResponse({
        ...(response || { controlId: question.controlId }),
        evidenceItems: updatedEvidenceList,
      });

      setIsUploading(false);
      // Clear file input
      e.target.value = "";
    } catch (err) {
      console.error("Upload network error:", err);
      setUploadError("Network error occurred while connecting to the evidence vault.");
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-6 sm:p-7 shadow-sm transition-all hover:border-stone-300">
      {/* Control Header & Statutory Citations */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-stone-200/80">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="font-mono text-xs font-bold text-stone-900 bg-stone-100 px-2.5 py-0.5 rounded border border-stone-300">
              {question.controlId}
            </span>
            <span className="text-xs font-semibold text-stone-600 bg-stone-50 px-2 py-0.5 rounded border border-stone-200">
              {question.sourceProvision}
            </span>
            <span className="text-[11px] font-mono text-stone-500">
              v{question.controlVersion}
            </span>
          </div>
          <h3 className="font-serif text-lg font-bold text-stone-900">
            {question.title}
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            {question.objective}
          </p>
        </div>

        {/* Status Pill */}
        <div className="self-start sm:self-auto flex-shrink-0">
          {isExcluded ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
              <Clock className="w-3.5 h-3.5" />
              Exclusion Proposed
            </span>
          ) : isAnswered ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Answered
              </span>
              {isEvidencePending && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                  <AlertCircle className="w-3 h-3 text-amber-600" />
                  Evidence Pending
                </span>
              )}
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-600 border border-stone-200">
              <Clock className="w-3.5 h-3.5 text-stone-400" />
              Unanswered
            </span>
          )}
        </div>
      </div>

      {/* Prominent Assessment Question */}
      <div className="my-5 p-4 bg-[#fbfaf8] border-l-4 border-stone-800 rounded-r-md">
        <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-stone-500 block mb-1">
          Compliance Evaluation Inquest
        </span>
        <p className="text-sm font-medium text-stone-900 leading-relaxed">
          {question.assessmentQuestion}
        </p>
      </div>

      {/* Multiple-Choice Options (Strictly 4 choices) */}
      <div className="space-y-2.5 mb-6">
        <span className="text-[11px] uppercase tracking-wider font-semibold text-stone-600 block mb-2">
          Select Operational Maturity Level:
        </span>
        {question.options.map((opt) => {
          const isSelected = selectedOption === opt.key && !isExcluded;
          return (
            <label
              key={opt.key}
              onClick={() => handleSelectOption(opt.key)}
              className={`block p-3.5 rounded-lg border text-xs cursor-pointer transition-all ${
                isSelected
                  ? "bg-stone-50 border-stone-900 ring-1 ring-stone-900 text-stone-950"
                  : "bg-white border-stone-200 hover:border-stone-400 text-stone-800"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="pt-0.5">
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      isSelected
                        ? "border-stone-900 bg-stone-900"
                        : "border-stone-400 bg-white"
                    }`}
                  >
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-stone-900">
                      {opt.label}
                    </span>
                    <span className="font-mono text-[10px] text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200">
                      Score: {opt.maturityScore}/5
                    </span>
                  </div>
                  <p className="text-stone-600 mt-1 leading-normal">
                    {opt.description}
                  </p>
                </div>
              </div>
            </label>
          );
        })}
      </div>

      {/* Propose Exclusion Toggle */}
      <div className="pt-3 border-t border-stone-200">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleToggleExclusion}
            className={`text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              showExclusionBox ? "text-purple-700" : "text-stone-600 hover:text-stone-900"
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>{showExclusionBox ? "Cancel Proposed Exclusion" : "Propose Control Exclusion"}</span>
          </button>
          <span className="text-[11px] text-stone-400 font-mono">
            Requires Consultant Approval (DEC-01)
          </span>
        </div>

        {showExclusionBox && (
          <div className="mt-3 p-3.5 bg-purple-50/60 border border-purple-200 rounded-lg space-y-2 text-xs">
            <p className="text-purple-900 text-[11px] leading-relaxed">
              <strong>Mandatory Exemption Rationale:</strong> State the statutory basis why this control is not applicable to the entity's data processing activities. Note that proposing an exclusion does not mark the control as compliant and will be reviewed by TLI.
            </p>
            <textarea
              rows={3}
              value={exclusionText}
              onChange={handleExclusionChange}
              placeholder="e.g., The entity does not process personal data of children or persons with disabilities pursuant to Section 9..."
              className="w-full p-2.5 bg-white border border-purple-300 rounded text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-purple-700 text-xs"
            />
          </div>
        )}
      </div>

      {/* Assessor Explanatory Notes */}
      <div className="mt-4 pt-4 border-t border-stone-200">
        <label className="block text-xs font-semibold text-stone-700 mb-1.5">
          Assessor Explanatory Notes & Implementation Observations:
        </label>
        <textarea
          rows={2}
          value={notesText}
          onChange={handleNotesChange}
          placeholder="Document technical safeguards, RoPA references, or operational caveats for consultant evaluation..."
          className="w-full p-2.5 text-xs bg-stone-50 border border-stone-200 rounded text-stone-900 placeholder-stone-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-800 transition-colors"
        />
      </div>

      {/* Real Evidence Vault Attachment Section */}
      <div className="mt-4 pt-4 border-t border-stone-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-800">
            <FileText className="w-3.5 h-3.5 text-stone-600" />
            <span>Evidentiary Artifacts ({evidenceItems.length} Attached)</span>
          </div>
          {question.acceptableEvidence.length > 0 && (
            <span className="text-[11px] text-stone-500 font-mono">
              Accepted Types: {question.acceptableEvidence.join(", ")}
            </span>
          )}
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
                  Upload compliance evidence (PDF, DOCX, XLSX, PNG, JPG • 100B–50MB)
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

