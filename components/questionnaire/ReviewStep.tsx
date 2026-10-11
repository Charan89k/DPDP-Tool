"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  AlertCircle,
  FileCheck2,
  Clock,
  ArrowLeft,
  Send,
  Shield,
  FileText,
} from "lucide-react";
import type {
  QuestionnaireSection,
  QuestionResponse,
  SectionProgressSummary,
} from "@/lib/questionnaire/types";

interface ReviewStepProps {
  sections: QuestionnaireSection[];
  responses: Record<string, QuestionResponse>;
  progress: {
    totalQuestions: number;
    totalAnswered: number;
    totalUnanswered: number;
    totalExcluded: number;
    completionPercentage: number;
    sectionSummaries: SectionProgressSummary[];
  };
  onJumpToQuestion: (sectionIndex: number) => void;
  onSubmitAssessment: () => void;
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

  const handleSubmit = () => {
    onSubmitAssessment();
    setSubmissionSuccess(true);
  };

  // Find unanswered questions
  const unansweredList: Array<{
    sectionIndex: number;
    sectionTitle: string;
    controlId: string;
    questionTitle: string;
  }> = [];

  // Find proposed exclusions
  const exclusionsList: Array<{
    sectionIndex: number;
    controlId: string;
    questionTitle: string;
    justification: string;
  }> = [];

  // Find evidence count
  let totalEvidenceAttached = 0;

  sections.forEach((section, sIdx) => {
    section.questions.forEach((q) => {
      const resp = responses[q.controlId];
      if (resp?.evidenceItems) {
        totalEvidenceAttached += resp.evidenceItems.length;
      }

      if (!resp || (!resp.selectedOption && !resp.isExcluded)) {
        unansweredList.push({
          sectionIndex: sIdx,
          sectionTitle: section.domainTitle,
          controlId: q.controlId,
          questionTitle: q.title,
        });
      } else if (resp.isExcluded) {
        exclusionsList.push({
          sectionIndex: sIdx,
          controlId: q.controlId,
          questionTitle: q.title,
          justification: resp.exclusionJustification || "No justification provided",
        });
      }
    });
  });

  const canSubmit = unansweredList.length === 0;

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
              Verify questionnaire completeness and evidentiary artifacts before consultant handoff.
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
              Total Controls
            </span>
            <span className="text-xl font-mono font-bold text-stone-900 mt-1 block">
              {progress.totalQuestions}
            </span>
            <span className="text-[11px] text-stone-500">Across 13 domains</span>
          </div>

          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-lg">
            <span className="text-[10px] font-mono uppercase font-semibold text-emerald-700 block">
              Answered Controls
            </span>
            <span className="text-xl font-mono font-bold text-emerald-950 mt-1 block">
              {progress.totalAnswered}
            </span>
            <span className="text-[11px] text-emerald-700">Maturity evaluated</span>
          </div>

          <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-lg">
            <span className="text-[10px] font-mono uppercase font-semibold text-purple-700 block">
              Proposed Exclusions
            </span>
            <span className="text-xl font-mono font-bold text-purple-950 mt-1 block">
              {progress.totalExcluded}
            </span>
            <span className="text-[11px] text-purple-700">Awaiting TLI approval</span>
          </div>

          <div className="p-4 bg-stone-50 border border-stone-200 rounded-lg">
            <span className="text-[10px] font-mono uppercase font-semibold text-stone-500 block">
              Evidence Attached
            </span>
            <span className="text-xl font-mono font-bold text-stone-900 mt-1 block">
              {totalEvidenceAttached}
            </span>
            <span className="text-[11px] text-stone-500">In vault storage</span>
          </div>
        </div>
      </div>

      {/* Unanswered Controls Section */}
      {unansweredList.length > 0 ? (
        <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-amber-700 flex-shrink-0" />
            <h3 className="font-serif text-base font-bold text-amber-950">
              {unansweredList.length} Unanswered Questions Require Completion
            </h3>
          </div>
          <p className="text-xs text-amber-900 mb-4 leading-relaxed">
            All 30 statutory controls must be answered with a maturity level or marked with a formal exclusion justification before the assessment can be submitted to TLI consultants.
          </p>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {unansweredList.map((item) => (
              <div
                key={item.controlId}
                className="flex items-center justify-between p-3 bg-white border border-amber-200 rounded-lg text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-stone-900 bg-stone-100 px-1.5 py-0.2 rounded">
                      {item.controlId}
                    </span>
                    <span className="font-semibold text-stone-800">
                      {item.questionTitle}
                    </span>
                  </div>
                  <span className="text-[11px] text-stone-500 block mt-0.5">
                    Section: {item.sectionTitle}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onJumpToQuestion(item.sectionIndex)}
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
              All 30 Controls Evaluated
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
              Proposed Control Exclusions ({exclusionsList.length})
            </h3>
          </div>
          <p className="text-xs text-stone-500 mb-4">
            Under DEC-01 and DEC-08, exclusions are not self-executing and require formal validation by a TLI Lead Consultant.
          </p>

          <div className="space-y-3">
            {exclusionsList.map((ex) => (
              <div
                key={ex.controlId}
                className="p-3.5 bg-purple-50/50 border border-purple-200 rounded-lg text-xs"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono font-bold text-purple-950">
                    {ex.controlId} — {ex.questionTitle}
                  </span>
                  <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-mono font-semibold">
                    Awaiting TLI Approval
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
          Upon submitting this assessment, the questionnaire state will transition to <strong>CONSULTANT_REVIEW</strong>. Truth Labs International will perform an independent verification of responses, inspect attached evidentiary artifacts, validate proposed exclusions, and compute statutory compliance gap scores according to the DPDPA 2023 evaluation model.
        </p>

        {submissionSuccess ? (
          <div className="p-4 bg-emerald-100 border border-emerald-300 rounded-lg text-xs text-emerald-900 font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 flex-shrink-0" />
            <span>Assessment successfully submitted to Truth Labs International review workspace!</span>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <span className="text-xs text-stone-500 font-mono">
              Status will update from DATA_GATHERING → CONSULTANT_REVIEW
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

