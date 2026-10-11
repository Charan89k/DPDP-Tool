"use client";

import React from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
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
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
      <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-bold text-sm text-slate-900">
          Assessment Sections
        </h3>
        <span className="text-[11px] text-slate-400 font-medium">
          {sections.length} Sections
        </span>
      </div>

      <nav className="space-y-1.5">
        {sections.map((section, idx) => {
          const summary = summaries[idx];
          const isActive = activeSectionIndex === idx && !isReviewStep;
          const answered = (summary?.answeredCount || 0) + (summary?.excludedCount || 0);
          const total = section.questions.length;

          return (
            <button
              key={section.code}
              type="button"
              onClick={() => onSelectSection(idx)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all flex items-center justify-between gap-2.5 ${
                isActive
                  ? "bg-[#0066FF] text-white shadow-xs font-semibold"
                  : "bg-white hover:bg-slate-50 text-slate-700 border border-transparent hover:border-slate-200"
              }`}
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                    isActive
                      ? "bg-white text-[#0066FF]"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {idx + 1}
                </div>
                <span className="truncate font-medium">{section.title}</span>
              </div>

              <div className="flex-shrink-0">
                <span
                  className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full ${
                    isActive
                      ? "bg-blue-700/60 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {answered}/{total}
                </span>
              </div>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
