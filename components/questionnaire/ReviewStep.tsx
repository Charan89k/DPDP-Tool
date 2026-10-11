"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  Shield,
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
    } catch (err: any) {
      setSubmitError(err.message || "Failed to submit assessment.");
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
      } else if (resp.selectedOption === "Not applicable — justification required") {
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
    });
  });

  const canSubmit = unansweredList.length === 0 && missingJustificationList.length === 0;

  return (
    <div className="space-y-6">
      {/* Review Header Banner */}
      <div className="bg-white border border-stone-200 rounded-xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-stone-200">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-stone-500 font-bold block mb-1">
              Final Pre-Submission Review
            </span>
            <h2 className="font-serif text-2xl font-bold text-stone-900">
              Assessment Response Summary
            </h2>
            <p className="text-xs text-stone-500 mt-1">
              Verify questionnaire completeness and mandatory justifications before submission to Truth Labs.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="block text-2xl font-mono font-bold text-stone-900">
                {progress.completionPercentage}%
              </span>
              <span className="text-[10px] font-mono text-stone-500 uppercase tracking-wider">
                Completion Rate
              </span>
            </div>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
          <div className="p-4 bg-stone-50 border border-stone-200 rounded-lg">
            <span className="text-[10px] font-mono uppercase font-semibold text-stone-500 block">
              Total Questions
            </span>
            <span className="text-xl font-mono font-bold text-stone-900 mt-1 block">
              {progress.totalQuestions}
            </span>
            <span className="text-[11px] text-stone-500">Across 8 sections</span>
          </div>

          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-lg">
            <span className="text-[10px] font-mono uppercase font-semibold text-emerald-700 block">
              Answered Questions
            </span>
            <span className="text-xl font-mono font-bold text-emerald-950 mt-1 block">
              {progress.totalAnswered}
            </span>
            <span className="text-[11px] text-emerald-700">State evaluated</span>
          </div>

          <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-lg">
            <span className="text-[10px] font-mono uppercase font-semibold text-purple-700 block">
              Proposed Exclusions (N/A)
            </span>
            <span className="text-xl font-mono font-bold text-purple-950 mt-1 block">
              {progress.totalExcluded}
            </span>
            <span className="text-[11px] text-purple-700">With justification</span>
          </div>

          <div className="p-4 bg-stone-50 border border-stone-200 rounded-lg">
            <span className="text-[10px] font-mono uppercase font-semibold text-stone-500 block">
              Unanswered
            </span>
            <span className="text-xl font-mono font-bold text-stone-900 mt-1 block">
              {progress.totalUnanswered}
            </span>
            <span className="text-[11px] text-stone-500">Remaining</span>
          </div>
        </div>
      </div>

      {/* Validation Error: Missing Justification for Not Applicable */}
      {missingJustificationList.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-rose-700 flex-shrink-0" />
            <h3 className="font-serif text-base font-bold text-rose-950">
              {missingJustificationList.length} Questions Missing Mandatory Justification
            </h3>
          </div>
          <p className="text-xs text-rose-900 mb-4 leading-relaxed">
            Selecting “Not applicable — justification required” mandates a non-empty written justification. Please provide justifications for the following questions before submitting:
          </p>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {missingJustificationList.map((item) => (
              <div
                key={item.questionCode}
                className="flex items-center justify-between p-3 bg-white border border-rose-200 rounded-lg text-xs"
              >
                <div className="pr-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-rose-900 bg-rose-100 px-1.5 py-0.2 rounded">
                      {item.questionCode}
                    </span>
                    <span className="font-semibold text-stone-800">
                      {item.questionText}
                    </span>
                  </div>
                  <span className="text-[11px] text-stone-500 block mt-0.5">
                    Section: {item.sectionTitle}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onJumpToQuestion(item.sectionIndex, item.questionCode)}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-rose-800 text-stone-50 hover:bg-rose-900 rounded transition-colors flex-shrink-0"
                >
                  Add Justification
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unanswered Questions List */}
      {unansweredList.length > 0 ? (
        <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-amber-700 flex-shrink-0" />
            <h3 className="font-serif text-base font-bold text-amber-950">
              {unansweredList.length} Unanswered Questions Require Completion
            </h3>
          </div>
          <p className="text-xs text-amber-900 mb-4 leading-relaxed">
            All 60 questions must be evaluated with a current state selection before the assessment can be submitted to Truth Labs consultants.
          </p>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {unansweredList.map((item) => (
              <div
                key={item.questionCode}
                className="flex items-center justify-between p-3 bg-white border border-amber-200 rounded-lg text-xs"
              >
                <div className="pr-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-stone-900 bg-stone-100 px-1.5 py-0.2 rounded">
                      {item.questionCode}
                    </span>
                    <span className="font-semibold text-stone-800">
                      {item.questionText}
                    </span>
                  </div>
                  <span className="text-[11px] text-stone-500 block mt-0.5">
                    Section: {item.sectionTitle}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onJumpToQuestion(item.sectionIndex, item.questionCode)}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-stone-900 text-stone-50 hover:bg-stone-800 rounded transition-colors flex-shrink-0"
                >
                  Complete Question
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-5 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-700 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-emerald-950 text-sm">
              All 60 Questions Evaluated
            </h4>
            <p className="text-xs text-emerald-800 mt-0.5">
              The questionnaire is complete and ready for formal consultant submission.
            </p>
          </div>
        </div>
      )}

      {/* Proposed Exclusions Review */}
      {exclusionsList.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-purple-700" />
            <h3 className="font-serif text-base font-bold text-stone-900">
              Proposed Exclusions / Not Applicable ({exclusionsList.length})
            </h3>
          </div>
          <p className="text-xs text-stone-500 mb-4">
            Under project governance, proposing an exclusion does not mark a control as compliant and requires assessor review and written approval.
          </p>

          <div className="space-y-3">
            {exclusionsList.map((ex) => (
              <div
                key={ex.questionCode}
                className="p-3.5 bg-purple-50/50 border border-purple-200 rounded-lg text-xs"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono font-bold text-purple-950">
                    {ex.questionCode} — {ex.questionText}
                  </span>
                  <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-mono font-semibold">
                    Awaiting Assessor Review
                  </span>
                </div>
                <p className="text-stone-700 italic text-[11px] leading-relaxed">
                  "{ex.justification}"
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submission Confirmation & Transition Notice */}
      <div className="bg-[#f6f4ee] border border-stone-200 rounded-xl p-6">
        <h4 className="font-serif text-sm font-bold text-stone-900 mb-2">
          Statutory Assessment Handoff Notice
        </h4>
        <p className="text-xs text-stone-600 leading-relaxed mb-6">
          Upon submission, responses and attached evidentiary artifacts will be saved to the Truth Labs assessment vault for independent consultant evaluation.
        </p>

        {submitError && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {submissionSuccess ? (
          <div className="p-4 bg-emerald-100 border border-emerald-300 rounded-lg text-xs text-emerald-900 font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 flex-shrink-0" />
            <span>Assessment responses successfully saved and submitted to Truth Labs International review workspace!</span>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <span className="text-xs text-stone-500 font-mono">
              Status: DATA_GATHERING
            </span>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              className="w-full sm:w-auto px-6 py-2.5 bg-[#16191f] hover:bg-stone-800 disabled:opacity-50 text-stone-50 text-xs font-semibold rounded-md shadow-sm transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <span className="inline-block w-4 h-4 border-2 border-stone-400 border-t-white rounded-full animate-spin"></span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit Assessment to TLI Review</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
