"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Save,
  Info,
} from "lucide-react";
import {
  getCanonicalQuestionnaireSections,
  calculateQuestionnaireProgress,
  QUESTIONNAIRE_METADATA,
} from "@/lib/questionnaire/data";
import type {
  RespondentQuestionResponse,
  CanonicalQuestionnaireSection,
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
  const [responses, setResponses] = useState<Record<string, RespondentQuestionResponse>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const currentSection = sections[activeSectionIndex];
  const progress = calculateQuestionnaireProgress(sections, responses);

  // Storage key for client-side persistence fallback
  const storageKey = `tli_dpdp_responses_${assessmentId}`;

  // 1. Initial Load: Restore from server DB with localStorage fallback
  useEffect(() => {
    let isMounted = true;

    async function loadResponses() {
      // First try localStorage for instant responsive paint
      try {
        const localCached = localStorage.getItem(storageKey);
        if (localCached) {
          const parsed = JSON.parse(localCached);
          if (parsed && typeof parsed === "object") {
            setResponses(parsed);
          }
        }
      } catch {
        // LocalStorage access restricted or unavailable
      }

      // Then fetch authoritative state from server API
      try {
        const res = await fetch(`/api/assessments/${assessmentId}/responses`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.responses && isMounted) {
            setResponses((prev) => {
              const merged = { ...prev, ...data.responses };
              try {
                localStorage.setItem(storageKey, JSON.stringify(merged));
              } catch {}
              return merged;
            });
          }
        }
      } catch (err) {
        console.warn("Could not sync with assessment responses API, using local state.", err);
      }
    }

    loadResponses();
    return () => {
      isMounted = false;
    };
  }, [assessmentId, storageKey]);

  // Debounce server persistence
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const persistToServer = useCallback(
    async (latestResponses: Record<string, RespondentQuestionResponse>) => {
      setSaveStatus("saving");
      try {
        const res = await fetch(`/api/assessments/${assessmentId}/responses`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ responses: latestResponses }),
        });

        if (res.ok) {
          setSaveStatus("saved");
          setSaveMessage("Saved to server");
          setTimeout(() => setSaveStatus("idle"), 2500);
        } else {
          setSaveStatus("saved"); // Persisted locally
          setSaveMessage("Saved locally");
          setTimeout(() => setSaveStatus("idle"), 2500);
        }
      } catch {
        setSaveStatus("saved");
        setSaveMessage("Saved locally");
        setTimeout(() => setSaveStatus("idle"), 2500);
      }
    },
    [assessmentId]
  );

  const handleUpdateResponse = (updated: RespondentQuestionResponse) => {
    setResponses((prev) => {
      const next = {
        ...prev,
        [updated.questionCode]: updated,
      };

      // Always save to localStorage immediately
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}

      // Debounce server PUT
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        persistToServer(next);
      }, 800);

      return next;
    });
  };

  const handlePrev = () => {
    if (isReviewStep) {
      setIsReviewStep(false);
      setActiveSectionIndex(sections.length - 1);
    } else if (activeSectionIndex > 0) {
      setActiveSectionIndex((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleNext = () => {
    if (activeSectionIndex < sections.length - 1) {
      setActiveSectionIndex((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setIsReviewStep(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSelectSection = (idx: number) => {
    setIsReviewStep(false);
    setActiveSectionIndex(idx);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleJumpToQuestion = (sectionIdx: number, questionCode?: string) => {
    setIsReviewStep(false);
    setActiveSectionIndex(sectionIdx);
    setTimeout(() => {
      if (questionCode) {
        const el = document.getElementById(`question-${questionCode}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }, 100);
  };

  const handleSelectReview = () => {
    setIsReviewStep(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmitAssessment = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/responses`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit assessment.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Assessment Context */}
      <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[10px] uppercase font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                {QUESTIONNAIRE_METADATA.versionId}
              </span>
              <span className="text-xs text-stone-500 font-mono">
                Organization: <strong className="text-stone-800">{tenantName}</strong>
              </span>
            </div>
            <h1 className="font-serif text-xl sm:text-2xl font-bold text-stone-900">
              {assessmentTitle}
            </h1>
            <p className="text-xs text-stone-500 mt-0.5">
              {QUESTIONNAIRE_METADATA.title} • {QUESTIONNAIRE_METADATA.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {saveStatus === "saving" && (
              <span className="text-xs font-mono text-stone-600 bg-stone-100 px-2 py-1 rounded border border-stone-200 flex items-center gap-1">
                <span className="w-2.5 h-2.5 border-2 border-stone-400 border-t-stone-800 rounded-full animate-spin"></span>
                <span>Saving...</span>
              </span>
            )}
            {saveStatus === "saved" && saveMessage && (
              <span className="text-xs font-mono text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{saveMessage}</span>
              </span>
            )}
            <div className="text-right">
              <span className="text-xs font-semibold text-stone-800 font-mono">
                {progress.totalAnswered + progress.totalExcluded} / {progress.totalQuestions} Questions
              </span>
              <span className="block text-[11px] text-stone-500 font-mono">
                {progress.completionPercentage}% Completed
              </span>
            </div>
          </div>
        </div>

        {/* Canonical Respondent Instructions Banner */}
        <div className="mt-4 p-3.5 bg-[#fbfaf8] border border-stone-200 rounded-lg flex items-start gap-2.5">
          <Info className="w-4 h-4 text-stone-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-stone-700 leading-relaxed">
            <strong className="text-stone-900 font-semibold block mb-0.5">Respondent Instructions:</strong>
            {QUESTIONNAIRE_METADATA.respondentInstructions}
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
              onJumpToQuestion={handleJumpToQuestion}
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
                    <span className="font-mono text-xs font-bold text-stone-700 bg-stone-200 px-2 py-0.5 rounded">
                      {currentSection.code}
                    </span>
                  </div>

                  <span className="text-xs font-mono text-stone-600">
                    {currentSection.questions.length} Questions in Section
                  </span>
                </div>

                <h2 className="font-serif text-xl font-bold text-stone-900">
                  {currentSection.title}
                </h2>
              </div>

              {/* Question Cards for Current Section */}
              <div className="space-y-6">
                {currentSection.questions.map((q) => (
                  <QuestionCard
                    key={q.code}
                    question={q}
                    response={responses[q.code]}
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
