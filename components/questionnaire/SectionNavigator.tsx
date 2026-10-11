"use client";

import React from "react";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";
import type {
  CanonicalQuestionnaireSection,
  SectionProgressSummary,
} from "@/lib/questionnaire/types";

interface SectionNavigatorProps {
  sections: CanonicalQuestionnaireSection[];
  summaries: SectionProgressSummary[];
  activeSectionIndex: number;
  isReviewStep: boolean;
  onSelectSection: (index: number) => void;
  onSelectReview: () => void;
}

export function SectionNavigator({
  sections,
  summaries,
  activeSectionIndex,
  isReviewStep,
  onSelectSection,
  onSelectReview,
}: SectionNavigatorProps) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
      <div className="pb-3 border-b border-stone-200">
        <h3 className="font-serif text-sm font-bold text-stone-900">
          Questionnaire Sections
        </h3>
        <p className="text-[11px] text-stone-500 font-mono mt-0.5">
          8 Canonical Sections • 60 Questions
        </p>
      </div>

      <nav className="mt-3 space-y-1 max-h-[calc(100vh-22rem)] overflow-y-auto pr-1">
        {sections.map((section, idx) => {
          const summary = summaries[idx];
          const isActive = activeSectionIndex === idx && !isReviewStep;
          const isComplete = summary?.isComplete;
          const hasJustificationError = (summary?.missingJustificationCount || 0) > 0;

          return (
            <button
              key={section.code}
              type="button"
              onClick={() => onSelectSection(idx)}
              className={`w-full text-left p-2.5 rounded-lg text-xs transition-all flex items-start justify-between gap-2 border ${
                isActive
                  ? "bg-stone-900 text-stone-50 border-stone-900 shadow-sm"
                  : hasJustificationError
                  ? "bg-amber-50/60 hover:bg-amber-100 text-amber-950 border-amber-300"
                  : isComplete
                  ? "bg-stone-50/60 hover:bg-stone-100 text-stone-800 border-stone-200/80"
                  : "bg-white hover:bg-stone-50 text-stone-700 border-transparent hover:border-stone-200"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span
                    className={`font-mono text-[10px] font-bold px-1.5 py-0.2 rounded ${
                      isActive
                        ? "bg-stone-800 text-stone-200"
                        : "bg-stone-100 text-stone-700 border border-stone-200"
                    }`}
                  >
                    {section.code}
                  </span>
                  <span className="font-semibold truncate block">
                    {section.title}
                  </span>
                </div>
                <div
                  className={`text-[10px] flex items-center gap-2 font-mono ${
                    isActive ? "text-stone-300" : "text-stone-500"
                  }`}
                >
                  <span>
                    {(summary?.answeredCount || 0) + (summary?.excludedCount || 0)}/
                    {section.questions.length} answered
                  </span>
                  {hasJustificationError && (
                    <span className="text-amber-600 font-sans font-semibold">
                      • Justification req.
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-shrink-0 pt-0.5">
                {hasJustificationError ? (
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                ) : isComplete ? (
                  <CheckCircle2
                    className={`w-4 h-4 ${
                      isActive ? "text-emerald-400" : "text-emerald-600"
                    }`}
                  />
                ) : (
                  <Clock
                    className={`w-4 h-4 ${
                      isActive ? "text-stone-400" : "text-stone-300"
                    }`}
                  />
                )}
              </div>
            </button>
          );
        })}

        {/* Review & Submission Link */}
        <div className="pt-2 border-t border-stone-200 mt-2">
          <button
            type="button"
            onClick={onSelectReview}
            className={`w-full text-left p-2.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-between border ${
              isReviewStep
                ? "bg-stone-900 text-stone-50 border-stone-900 shadow-sm"
                : "bg-[#f8f6f0] hover:bg-stone-100 text-stone-800 border-stone-200"
            }`}
          >
            <span>Review Assessment & Submit</span>
            <span
              className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                isReviewStep
                  ? "bg-stone-800 text-stone-200"
                  : "bg-stone-200 text-stone-700"
              }`}
            >
              Summary
            </span>
          </button>
        </div>
      </nav>
    </div>
  );
}
