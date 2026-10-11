"use client";

import React, { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  FileCheck2,
  CheckCircle2,
  Save,
} from "lucide-react";
import {
  getCanonicalQuestionnaireSections,
  calculateQuestionnaireProgress,
} from "@/lib/questionnaire/data";
import type {
  QuestionResponse,
  QuestionnaireSection,
} from "@/lib/questionnaire/types";
import { QuestionCard } from "./QuestionCard";
import { SectionNavigator } from "./SectionNavigator";
import { ReviewStep } from "./ReviewStep";

interface QuestionnaireClientProps {
  assessmentId: string;
  assessmentTitle: string;
  tenantName: string;
}

export function QuestionnaireClient({
  assessmentId,
  assessmentTitle,
  tenantName,
}: QuestionnaireClientProps) {
  const sections = getCanonicalQuestionnaireSections();
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [isReviewStep, setIsReviewStep] = useState(false);
  const [responses, setResponses] = useState<Record<string, QuestionResponse>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  const currentSection = sections[activeSectionIndex];
  const progress = calculateQuestionnaireProgress(sections, responses);

  const handleUpdateResponse = (updated: QuestionResponse) => {
    setResponses((prev) => ({
      ...prev,
      [updated.controlId]: updated,
    }));
    setSaveFeedback("Progress saved locally");
    setTimeout(() => setSaveFeedback(null), 2500);
  };

  const handlePrev = () => {
    if (isReviewStep) {
      setIsReviewStep(false);
      setActiveSectionIndex(sections.length - 1);
    } else if (activeSectionIndex > 0) {
      setActiveSectionIndex((prev) => prev - 1);
    }
  };

  const handleNext = () => {
    if (activeSectionIndex < sections.length - 1) {
      setActiveSectionIndex((prev) => prev + 1);
    } else {
      setIsReviewStep(true);
    }
  };

  const handleSelectSection = (idx: number) => {
    setIsReviewStep(false);
    setActiveSectionIndex(idx);
  };

  const handleSelectReview = () => {
    setIsReviewStep(true);
  };

  const handleSubmitAssessment = async () => {
    setIsSubmitting(true);
    // In future milestone or current endpoint, POST to /api/assessments/[id]/submit
    setTimeout(() => {
      setIsSubmitting(false);
    }, 800);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Assessment Context */}
      <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[10px] uppercase font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                Assessment Inquest
              </span>
              <span className="text-xs text-stone-500 font-mono">
                Organization: <strong className="text-stone-800">{tenantName}</strong>
              </span>
            </div>
            <h1 className="font-serif text-xl sm:text-2xl font-bold text-stone-900">
              {assessmentTitle}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {saveFeedback && (
              <span className="text-xs font-mono text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{saveFeedback}</span>
              </span>
            )}
            <div className="text-right">
              <span className="text-xs font-semibold text-stone-800 font-mono">
                {progress.totalAnswered + progress.totalExcluded} / {progress.totalQuestions} Controls
              </span>
              <span className="block text-[11px] text-stone-500 font-mono">
                {progress.completionPercentage}% Completed
              </span>
            </div>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="w-full bg-stone-100 h-2 rounded-full mt-4 overflow-hidden border border-stone-200">
          <div
            className="bg-[#16191f] h-full transition-all duration-300 rounded-full"
            style={{ width: `${progress.completionPercentage}%` }}
          />
        </div>
      </div>

      {/* Main Questionnaire Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Section Navigator Sidebar */}
        <div className="lg:col-span-4 sticky top-6">
          <SectionNavigator
            sections={sections}
            summaries={progress.sectionSummaries}
            activeSectionIndex={activeSectionIndex}
            isReviewStep={isReviewStep}
            onSelectSection={handleSelectSection}
            onSelectReview={handleSelectReview}
          />
        </div>

        {/* Right Column: Questions or Review Step */}
        <div className="lg:col-span-8 space-y-6">
          {isReviewStep ? (
            <ReviewStep
              sections={sections}
              responses={responses}
              progress={progress}
              onJumpToQuestion={handleSelectSection}
              onSubmitAssessment={handleSubmitAssessment}
              isSubmitting={isSubmitting}
            />
          ) : (
            <>
              {/* Section Header Card */}
              <div className="bg-[#f6f4ee] border border-stone-200 rounded-xl p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold bg-stone-900 text-stone-50 px-2.5 py-0.5 rounded">
                      Section {activeSectionIndex + 1} of {sections.length}
                    </span>
                    <span className="font-mono text-xs text-stone-600 bg-stone-200 px-2 py-0.5 rounded">
                      Weight: {currentSection.domainWeight.toFixed(2)}x
                    </span>
                  </div>

                  <span className="text-xs font-mono text-stone-600">
                    {currentSection.questions.length} Questions (Max 4 per Section)
                  </span>
                </div>

                <h2 className="font-serif text-xl font-bold text-stone-900">
                  {currentSection.domainTitle}
                </h2>
                <p className="text-xs text-stone-600 mt-1">
                  {currentSection.statutoryFocus}
                </p>
              </div>

              {/* Question Cards (Strictly <= 4 questions in this section) */}
              <div className="space-y-6">
                {currentSection.questions.map((q) => (
                  <QuestionCard
                    key={q.controlId}
                    question={q}
                    response={responses[q.controlId]}
                    assessmentId={assessmentId}
                    onUpdateResponse={handleUpdateResponse}
                  />
                ))}
              </div>

              {/* Prev / Next Section Navigation Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-stone-200">
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={activeSectionIndex === 0 && !isReviewStep}
                  className="px-4 py-2 border border-stone-300 bg-white hover:bg-stone-50 disabled:opacity-40 text-stone-800 text-xs font-semibold rounded-md shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous Section</span>
                </button>

                <button
                  type="button"
                  onClick={handleNext}
                  className="px-5 py-2 bg-[#16191f] hover:bg-stone-800 text-stone-50 text-xs font-semibold rounded-md shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <span>
                    {activeSectionIndex === sections.length - 1
                      ? "Proceed to Final Review"
                      : "Next Section"}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

