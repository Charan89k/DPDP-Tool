"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Save,
  Info,
} from "lucide-react";
import {
  getCanonicalQuestionnaireSections,
  calculateQuestionnaireProgress,
} from "@/lib/questionnaire/data";
import type {
  RespondentQuestionResponse,
  CanonicalQuestion,
} from "@/lib/questionnaire/types";
import { QuestionCard } from "./QuestionCard";
import { SectionNavigator } from "./SectionNavigator";
import { ReviewStep } from "./ReviewStep";
import { errorMessage } from "@/lib/http/errors";

interface QuestionnaireClientProps {
  assessmentId: string;
  assessmentTitle: string;
  tenantName: string;
  engagementCode: string;
  startedAt: string;
  targetCompletionDate?: string | null;
  isAssessor?: boolean;
  canEdit?: boolean;
  userRole?: string;
  assessmentStatus?: string;
}

const NOT_APPLICABLE = "Not applicable — justification required";

function needsJustification(response: RespondentQuestionResponse | undefined): boolean {
  return (
    response?.selectedOption === NOT_APPLICABLE && !(response.commentsAndJustification ?? "").trim()
  );
}

function formatDisplayDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function QuestionnaireClient({
  assessmentId,
  tenantName,
  engagementCode,
  startedAt,
  targetCompletionDate = null,
  isAssessor = false,
  canEdit = true,
  userRole,
  assessmentStatus,
}: QuestionnaireClientProps) {
  const sections = getCanonicalQuestionnaireSections();
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [isReviewStep, setIsReviewStep] = useState(false);
  const [responses, setResponses] = useState<Record<string, RespondentQuestionResponse>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const currentSection = sections[activeSectionIndex] || sections[0];
  const currentQuestion: CanonicalQuestion =
    currentSection.questions[activeQuestionIndex] || currentSection.questions[0];

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
      } catch {}

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
      // "Not applicable" requires a justification before it can be saved. Incomplete N/A answers
      // stay in this browser (and are flagged in the question list) so they never block saving
      // every other answer.
      const persistable = Object.fromEntries(
        Object.entries(latestResponses).filter(([, r]) => !needsJustification(r))
      );
      setSaveStatus("saving");
      try {
        const res = await fetch(`/api/assessments/${assessmentId}/responses`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ responses: persistable }),
        });

        if (res.ok) {
          setSaveStatus("saved");
          setSaveMessage("Saved");
          setTimeout(() => setSaveStatus("idle"), 2500);
        } else {
          const errData = await res.json().catch(() => ({}));
          setSaveStatus("error");
          setSaveMessage(errData.error || "Failed to save response to server");
          setTimeout(() => setSaveStatus("idle"), 4000);
        }
      } catch (err) {
        setSaveStatus("error");
        setSaveMessage(errorMessage(err) || "Network error while saving response");
        setTimeout(() => setSaveStatus("idle"), 4000);
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

      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        persistToServer(next);
      }, 800);

      return next;
    });
  };

  const handlePrevQuestion = () => {
    if (activeQuestionIndex > 0) {
      setActiveQuestionIndex((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (activeSectionIndex > 0) {
      const prevSectionIdx = activeSectionIndex - 1;
      setActiveSectionIndex(prevSectionIdx);
      setActiveQuestionIndex(sections[prevSectionIdx].questions.length - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleNextQuestion = () => {
    if (activeQuestionIndex < currentSection.questions.length - 1) {
      setActiveQuestionIndex((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (activeSectionIndex < sections.length - 1) {
      setActiveSectionIndex((prev) => prev + 1);
      setActiveQuestionIndex(0);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setIsReviewStep(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSelectSection = (idx: number) => {
    setIsReviewStep(false);
    setActiveSectionIndex(idx);
    setActiveQuestionIndex(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleJumpToQuestion = (sectionIdx: number, questionCode?: string) => {
    setIsReviewStep(false);
    setActiveSectionIndex(sectionIdx);
    if (questionCode) {
      const qIdx = sections[sectionIdx].questions.findIndex((q) => q.code === questionCode);
      if (qIdx !== -1) {
        setActiveQuestionIndex(qIdx);
      }
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  // Calculate current overall question order (1 to 60)
  let overallQuestionNumber = 1;
  for (let i = 0; i < activeSectionIndex; i++) {
    overallQuestionNumber += sections[i].questions.length;
  }
  overallQuestionNumber += activeQuestionIndex;

  return (
    <div className="space-y-6">
      {/* 1. Header Bar: Context Subtitle, Stepper & Save & Exit CTA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <nav className="text-xs text-slate-500 font-medium mb-1">
            <Link href="/dashboard/assessments" className="hover:text-blue-600">
              Assessments
            </Link>{" "}
            &gt; <span className="text-slate-800">{tenantName}</span> &gt;{" "}
            <span className="text-slate-800">Questionnaire</span>
          </nav>
          <p className="text-xs font-semibold text-slate-600">
            {tenantName} | Assessment ID: <span className="font-mono text-slate-900">{engagementCode}</span> | Started:{" "}
            {formatDisplayDate(startedAt)}
            {targetCompletionDate ? ` | Target: ${formatDisplayDate(targetCompletionDate)}` : ""}
          </p>
        </div>

        {/* 3-Step Stepper (matching 03_questionnaire_workspace.jpeg) */}
        <div className="flex items-center space-x-3 self-start md:self-auto select-none">
          {/* Step 1: Customer Details (Completed) */}
          <Link href="/dashboard/assessments/new" className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
              ✓
            </div>
            <span className="text-xs font-medium text-slate-600">
              Customer Details
            </span>
          </Link>

          <div className="w-10 h-0.5 bg-emerald-500" />

          {/* Step 2: Questionnaire (Active) */}
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-full bg-[#0066FF] text-white flex items-center justify-center text-xs font-bold">
              2
            </div>
            <span className="text-xs font-semibold text-[#0066FF]">
              Questionnaire
            </span>
          </div>

          <div className="w-10 h-0.5 bg-slate-200" />

          {/* Step 3: Review & Submit */}
          <button
            type="button"
            onClick={handleSelectReview}
            className="flex items-center space-x-2"
          >
            <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold">
              3
            </div>
            <span className="text-xs font-medium text-slate-500 hover:text-slate-800">
              Review & Submit
            </span>
          </button>

          {/* Save & Exit Button */}
          <Link
            href="/dashboard/assessments"
            className="ml-4 inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors"
          >
            <Save className="w-3.5 h-3.5 text-slate-500" />
            <span>Save & Exit</span>
          </Link>
        </div>
      </div>

      {/* 2. Main Content Grid (3 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (3 cols): Section Navigator */}
        <div className="lg:col-span-3 sticky top-6">
          <SectionNavigator
            sections={sections}
            summaries={progress.sectionSummaries}
            activeSectionIndex={activeSectionIndex}
            isReviewStep={isReviewStep}
            onSelectSection={handleSelectSection}
            onSelectReview={handleSelectReview}
          />
        </div>

        {/* Center Column (6 cols): Active Question Workspace */}
        <div className="lg:col-span-6 space-y-4">
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
              {/* Question Navigation Bar */}
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    Question {overallQuestionNumber} of {progress.totalQuestions}
                  </h3>
                  {saveStatus === "saving" && (
                    <span className="text-[11px] text-slate-400 font-mono animate-pulse">
                      Saving...
                    </span>
                  )}
                  {saveStatus === "saved" && (
                    <span className="text-[11px] text-emerald-600 font-medium" role="status">
                      ✓ Saved
                    </span>
                  )}
                  {saveStatus === "error" && (
                    <span className="text-[11px] text-rose-600 font-medium" role="alert">
                      Not saved: {saveMessage}
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handlePrevQuestion}
                    disabled={activeSectionIndex === 0 && activeQuestionIndex === 0}
                    className="px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1"
                  >
                    <span>&larr; Previous</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleNextQuestion}
                    className="px-4 py-1.5 bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center space-x-1"
                  >
                    <span>
                      {overallQuestionNumber === progress.totalQuestions
                        ? "Review & Submit"
                        : "Next"}
                    </span>
                    <span>&rarr;</span>
                  </button>
                </div>
              </div>

              {/* Active Question Card Component */}
              <QuestionCard
                question={currentQuestion}
                response={responses[currentQuestion.code]}
                assessmentId={assessmentId}
                isAssessor={isAssessor}
                canEdit={canEdit && !["FINAL_ISSUED", "ARCHIVED", "REMEDIATION_ACTIVE"].includes(assessmentStatus || "")}
                userRole={userRole}
                onUpdateResponse={handleUpdateResponse}
                onNextQuestion={handleNextQuestion}
                onPrevQuestion={handlePrevQuestion}
                questionNumber={overallQuestionNumber}
                totalQuestions={progress.totalQuestions}
              />
            </>
          )}
        </div>

        {/* Right Column (3 cols): Assessment Progress & Question Jump List */}
        <div className="lg:col-span-3 space-y-4 sticky top-6">
          {/* Progress Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
            <h4 className="font-bold text-xs text-slate-900">
              Assessment Progress
            </h4>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                <span className="text-slate-500">
                  {progress.totalAnswered + progress.totalExcluded} of {progress.totalQuestions} questions completed
                </span>
                <span className="font-bold text-[#0066FF]">
                  {progress.completionPercentage}%
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#0066FF] h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress.completionPercentage}%` }}
                />
              </div>
            </div>
          </div>

          {/* Questions in Current Section List */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="font-bold text-xs text-slate-900">
                Questions
              </h4>
              <span className="text-[11px] text-slate-400 font-mono">
                {currentSection.code}
              </span>
            </div>

            <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
              {currentSection.questions.map((q, qIdx) => {
                const resp = responses[q.code];
                const incomplete = needsJustification(resp);
                const isAnswered = Boolean(resp?.selectedOption) && !incomplete;
                const isCurrent = qIdx === activeQuestionIndex && !isReviewStep;

                return (
                  <button
                    key={q.code}
                    type="button"
                    onClick={() => {
                      setIsReviewStep(false);
                      setActiveQuestionIndex(qIdx);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className={`w-full text-left p-2 rounded-lg text-xs transition-colors flex items-start space-x-2.5 ${
                      isCurrent
                        ? "bg-blue-50 border border-blue-200 text-blue-900"
                        : "hover:bg-slate-50 text-slate-700 border border-transparent"
                    }`}
                  >
                    <div className="flex-shrink-0 pt-0.5">
                      {incomplete ? (
                        <div
                          className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold"
                          title="Justification required"
                          aria-label="Justification required"
                        >
                          !
                        </div>
                      ) : isAnswered ? (
                        <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold" aria-label="Answered">
                          ✓
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-slate-300 bg-white" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <span className="font-mono text-[11px] font-bold block text-slate-900">
                        {q.code}
                      </span>
                      <p className="text-[11px] text-slate-500 truncate leading-snug">
                        {q.text}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Navigation Helper Box */}
          <div className="bg-[#F0F7FF] rounded-xl border border-blue-200/80 p-4 shadow-xs space-y-2">
            <div className="flex items-center space-x-2 text-blue-900 font-bold text-xs">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span>Question Navigation</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Use the section list or Previous / Next buttons to navigate between questions. Your responses are saved automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
