"use client";

import { errorMessage } from "@/lib/http/errors";
import React, { useState } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  FileText,
  XCircle,
  MinusCircle,
} from "lucide-react";
import type {
  CanonicalQuestionnaireSection,
  RespondentQuestionResponse,
  QuestionnaireProgress,
} from "@/lib/questionnaire/types";

interface ReviewStepProps {
  sections: CanonicalQuestionnaireSection[];
  responses: Record<string, RespondentQuestionResponse>;
  progress: QuestionnaireProgress;
  onJumpToQuestion: (sectionIndex: number, questionCode?: string) => void;
  onSubmitAssessment: () => Promise<void>;
  isSubmitting?: boolean;
}

export function ReviewStep({
  sections,
  responses,
  progress,
  onJumpToQuestion,
  onSubmitAssessment,
  isSubmitting = false,
}: ReviewStepProps) {
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitError(null);
    try {
      await onSubmitAssessment();
      setSubmissionSuccess(true);
    } catch (err) {
      setSubmitError(errorMessage(err) || "Failed to submit assessment.");
    }
  };

  // Find unanswered questions
  const unansweredList: Array<{
    sectionIndex: number;
    sectionTitle: string;
    questionCode: string;
    questionText: string;
  }> = [];

  // Find missing justification questions
  const missingJustificationList: Array<{
    sectionIndex: number;
    sectionTitle: string;
    questionCode: string;
    questionText: string;
  }> = [];

  // Find proposed exclusions
  const exclusionsList: Array<{
    sectionIndex: number;
    questionCode: string;
    questionText: string;
    justification: string;
  }> = [];

  let implementedCount = 0;
  let partiallyImplementedCount = 0;
  let notImplementedCount = 0;
  let notApplicableCount = 0;

  sections.forEach((section, sIdx) => {
    section.questions.forEach((q) => {
      const resp = responses[q.code];

      if (!resp || !resp.selectedOption) {
        unansweredList.push({
          sectionIndex: sIdx,
          sectionTitle: section.title,
          questionCode: q.code,
          questionText: q.text,
        });
      } else {
        if (resp.selectedOption === "Implemented") implementedCount++;
        else if (resp.selectedOption === "Partially implemented") partiallyImplementedCount++;
        else if (resp.selectedOption === "Not implemented") notImplementedCount++;
        else if (resp.selectedOption === "Not applicable — justification required") {
          notApplicableCount++;
          const hasJustification =
            Boolean(resp.commentsAndJustification) &&
            resp.commentsAndJustification!.trim().length > 0;

          if (!hasJustification) {
            missingJustificationList.push({
              sectionIndex: sIdx,
              sectionTitle: section.title,
              questionCode: q.code,
              questionText: q.text,
            });
          } else {
            exclusionsList.push({
              sectionIndex: sIdx,
              questionCode: q.code,
              questionText: q.text,
              justification: resp.commentsAndJustification!,
            });
          }
        }
      }
    });
  });

  const canSubmit = unansweredList.length === 0 && missingJustificationList.length === 0;

  return (
    <div className="space-y-6">
      {/* 1. Top 5 Executive Metric Cards (matching 05_assessment_summary_review_submit.jpeg) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center space-x-2.5 mb-1">
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xl font-bold text-slate-900 block leading-tight">
                {progress.totalQuestions}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Total Questions
              </span>
            </div>
          </div>
          <span className="text-[11px] text-blue-600 font-semibold block">
            {progress.completionPercentage}% completed
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center space-x-2.5 mb-1">
            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xl font-bold text-slate-900 block leading-tight">
                {implementedCount}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Implemented
              </span>
            </div>
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold block">
            {Math.round((implementedCount / (progress.totalQuestions || 1)) * 100)}%
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center space-x-2.5 mb-1">
            <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xl font-bold text-slate-900 block leading-tight">
                {partiallyImplementedCount}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Partially
              </span>
            </div>
          </div>
          <span className="text-[11px] text-amber-600 font-semibold block">
            {Math.round((partiallyImplementedCount / (progress.totalQuestions || 1)) * 100)}%
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center space-x-2.5 mb-1">
            <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
              <XCircle className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xl font-bold text-slate-900 block leading-tight">
                {notImplementedCount}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Not Implemented
              </span>
            </div>
          </div>
          <span className="text-[11px] text-rose-600 font-semibold block">
            {Math.round((notImplementedCount / (progress.totalQuestions || 1)) * 100)}%
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center space-x-2.5 mb-1">
            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center flex-shrink-0">
              <MinusCircle className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xl font-bold text-slate-900 block leading-tight">
                {notApplicableCount}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Not Applicable
              </span>
            </div>
          </div>
          <span className="text-[11px] text-slate-500 font-semibold block">
            {Math.round((notApplicableCount / (progress.totalQuestions || 1)) * 100)}%
          </span>
        </div>
      </div>

      {/* Validation Warnings if any */}
      {missingJustificationList.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 space-y-2">
          <div className="flex items-center space-x-2 text-rose-800 font-bold text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{missingJustificationList.length} Questions Missing Mandatory Justification</span>
          </div>
          <p className="text-xs text-rose-700 leading-relaxed">
            Selecting “Not applicable” requires a written factual justification under DPDP Act governance.
          </p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {missingJustificationList.map((item) => (
              <div
                key={item.questionCode}
                className="flex items-center justify-between p-2 bg-white rounded border border-rose-200 text-xs"
              >
                <span className="font-mono font-bold text-rose-900">{item.questionCode}</span>
                <button
                  type="button"
                  onClick={() => onJumpToQuestion(item.sectionIndex, item.questionCode)}
                  className="px-2 py-0.5 bg-rose-700 text-white rounded text-[11px] font-semibold"
                >
                  Add Justification
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {unansweredList.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-2">
          <div className="flex items-center space-x-2 text-amber-800 font-bold text-xs">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>{unansweredList.length} Unanswered Questions Remaining</span>
          </div>
          <p className="text-xs text-amber-700 leading-relaxed">
            All questions must be reviewed before final submission to CloudE5.
          </p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {unansweredList.slice(0, 5).map((item) => (
              <div
                key={item.questionCode}
                className="flex items-center justify-between p-2 bg-white rounded border border-amber-200 text-xs"
              >
                <span className="font-mono font-bold text-slate-800">{item.questionCode}</span>
                <button
                  type="button"
                  onClick={() => onJumpToQuestion(item.sectionIndex, item.questionCode)}
                  className="px-2 py-0.5 bg-slate-900 text-white rounded text-[11px] font-semibold"
                >
                  Answer
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submission CTA Box */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="font-bold text-sm text-slate-900">
            Submit Assessment for Consultant Validation
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Responses and attached artifacts will be locked and routed to CloudE5 lead assessors.
          </p>
        </div>

        {submissionSuccess ? (
          <span className="px-4 py-2 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold flex items-center space-x-1.5">
            <CheckCircle2 className="w-4 h-4" />
            <span>Submitted for Validation ✓</span>
          </span>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className="px-6 py-2.5 bg-[#0066FF] hover:bg-[#0052CC] disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center space-x-2 whitespace-nowrap"
          >
            <span>{isSubmitting ? "Submitting..." : "Submit for Validation"}</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {submitError && (
        <p className="mt-3 text-xs font-medium text-rose-700" role="alert">
          {submitError}
        </p>
      )}
    </div>
  );
}
