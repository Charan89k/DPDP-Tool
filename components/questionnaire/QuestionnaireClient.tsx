"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Save } from "lucide-react";
import {
  getCanonicalQuestionnaireSections,
  calculateQuestionnaireProgress,
} from "@/lib/questionnaire/data";
import type { RespondentQuestionResponse } from "@/lib/questionnaire/types";
import { QuestionTable } from "./QuestionTable";
import { ReviewStep } from "./ReviewStep";
import { errorMessage } from "@/lib/http/errors";
import { formatDate } from "@/lib/format/dates";
import { LEGACY_RESPONSE_CACHE_PREFIX } from "@/lib/questionnaire/legacy_cache";

// Mirrors OPEN_STATUSES in lib/db/sqlite/policies.ts, which decides whether response writes are allowed.
const OPEN_STATUSES = ["DRAFT", "SCOPING", "SCOPE_LOCKED", "DATA_GATHERING"];

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
  /** The assessment has a recorded submission (`submitted_at`). */
  hasSubmission?: boolean;
}

const NOT_APPLICABLE = "Not applicable — justification required";

function needsJustification(response: RespondentQuestionResponse | undefined): boolean {
  return (
    response?.selectedOption === NOT_APPLICABLE && !(response.commentsAndJustification ?? "").trim()
  );
}

function formatDisplayDate(iso: string): string {
  return formatDate(iso);
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
  hasSubmission = false,
}: QuestionnaireClientProps) {
  const sections = getCanonicalQuestionnaireSections();
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [isReviewStep, setIsReviewStep] = useState(false);
  const [responses, setResponses] = useState<Record<string, RespondentQuestionResponse>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const currentSection = sections[activeSectionIndex] || sections[0];
  const isLastSection = activeSectionIndex === sections.length - 1;

  const progress = calculateQuestionnaireProgress(sections, responses);

  // 1. Initial Load: answers live only in memory and on the server. Earlier versions cached them in
  // localStorage, which outlives sign-out, so any copy left from those versions is removed.
  useEffect(() => {
    let isMounted = true;

    async function loadResponses() {
      try {
        localStorage.removeItem(`${LEGACY_RESPONSE_CACHE_PREFIX}${assessmentId}`);
      } catch {}

      try {
        const res = await fetch(`/api/assessments/${assessmentId}/responses`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.responses && isMounted) {
            setResponses((prev) => ({ ...prev, ...data.responses }));
          }
        }
      } catch (err) {
        console.warn("Could not load saved responses from the assessment responses API.", err);
      }
    }

    loadResponses();
    return () => {
      isMounted = false;
    };
  }, [assessmentId]);

  // Debounce server persistence
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const persistToServer = useCallback(
    async (latestResponses: Record<string, RespondentQuestionResponse>) => {
      // "Not applicable" requires a justification before it can be saved. Incomplete N/A answers
      // stay in this page (and are flagged in the question list) so they never block saving every
      // other answer.
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

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        persistToServer(next);
      }, 800);

      return next;
    });
  };

  const handleSelectSection = (idx: number) => {
    setIsReviewStep(false);
    setActiveSectionIndex(idx);
    setExpandedCode(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleJumpToQuestion = (sectionIdx: number, questionCode?: string) => {
    setIsReviewStep(false);
    setActiveSectionIndex(sectionIdx);
    setExpandedCode(questionCode ?? null);
    // Bring the reopened question into view once the domain's table has rendered.
    setTimeout(() => {
      const row = questionCode ? document.getElementById(`question-${questionCode}`) : null;
      if (row) row.scrollIntoView({ behavior: "smooth", block: "start" });
      else window.scrollTo({ top: 0, behavior: "smooth" });
    }, 0);
  };

  const handleSelectReview = () => {
    setIsReviewStep(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmitAssessment = async () => {
    // A pending autosave would otherwise reach the server after the assessment is locked for review.
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    setIsSubmitting(true);
    let saved = false;
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/responses`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save responses before submitting.");
      }
      saved = true;

      // Saving alone does not submit: move the assessment to review so it is locked and routed to
      // the assessors, and surface the lifecycle guard's reasons if it refuses.
      const transition = await fetch(`/api/assessments/${assessmentId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStatus: "SUBMITTED_FOR_REVIEW" }),
      });
      const result = await transition.json().catch(() => ({}));
      if (!transition.ok || !result.success) {
        const reasons: string[] = Array.isArray(result.validationErrors) ? result.validationErrors : [];
        throw new Error(reasons.length > 0 ? reasons.join(" ") : result.error || "Failed to submit assessment.");
      }
      setIsSubmitted(true);
    } finally {
      // Nothing was saved (error response or network failure): retry the autosave so recent edits are not left only in this page.
      if (!saved) saveTimeoutRef.current = setTimeout(() => persistToServer(responses), 800);
      setIsSubmitting(false);
    }
  };

  // Customers can only change answers while the assessment is open; a reload after submitting must stay locked too.
  const isLocked = isSubmitted || (assessmentStatus ? !OPEN_STATUSES.includes(assessmentStatus) : false);
  const canEditAnswers = canEdit && !isLocked;
  // Cancelled or archived assessments may never have been submitted, so rely on the recorded submission.
  const wasSubmitted = isSubmitted || (isLocked && hasSubmission);

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
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 self-start md:self-auto select-none">
          {/* Step 1: Customer Details (Completed) */}
          <Link href="/dashboard/assessments/new" className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
              ✓
            </div>
            <span className="sr-only sm:not-sr-only text-xs font-medium text-slate-600">
              Customer Details
            </span>
          </Link>

          <div className="w-4 sm:w-10 h-0.5 bg-emerald-500" />

          {/* Step 2: Questionnaire (Active) */}
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-full bg-[#0066FF] text-white flex items-center justify-center text-xs font-bold">
              2
            </div>
            <span className="text-xs font-semibold text-[#0066FF]">
              Questionnaire
            </span>
          </div>

          <div className="w-4 sm:w-10 h-0.5 bg-slate-200" />

          {/* Step 3: Review & Submit */}
          <button
            type="button"
            onClick={handleSelectReview}
            className="flex items-center space-x-2"
          >
            <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold">
              3
            </div>
            <span className="sr-only sm:not-sr-only text-xs font-medium text-slate-500 hover:text-slate-800">
              Review & Submit
            </span>
          </button>

          {/* Save & Exit Button */}
          <Link
            href="/dashboard/assessments"
            className="sm:ml-4 inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors"
          >
            <Save className="w-3.5 h-3.5 text-slate-500" />
            <span>Save & Exit</span>
          </Link>
        </div>
      </div>

      {/* 2. Progress and save status */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-2 font-medium">
          <span className="text-slate-600">
            {progress.totalAnswered + progress.totalExcluded} of {progress.totalQuestions} questions answered
            <span className="ml-2" aria-live="polite">
              {saveStatus === "saving" && <span className="text-slate-400 font-mono">Saving...</span>}
              {saveStatus === "saved" && <span className="text-emerald-600" role="status">✓ Saved</span>}
            </span>
            {saveStatus === "error" && (
              <span className="ml-2 text-rose-600" role="alert">Not saved: {saveMessage}</span>
            )}
          </span>
          <span className="font-bold text-[#0066FF]">{progress.completionPercentage}%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
          <div
            className="bg-[#0066FF] h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress.completionPercentage}%` }}
          />
        </div>
        {!canEditAnswers && (
          <p className="mt-3 text-xs text-slate-600">
            <strong>Read only:</strong> answers cannot be changed under your role or at this stage of the assessment.
          </p>
        )}
      </div>

      {/* 3. Domain tabs */}
      <nav aria-label="Questionnaire domains" className="-mx-1 overflow-x-auto">
        <ol className="flex gap-2 px-1 pb-1 min-w-max">
          {sections.map((section, idx) => {
            const summary = progress.sectionSummaries[idx];
            const done = (summary?.answeredCount || 0) + (summary?.excludedCount || 0);
            const isActive = idx === activeSectionIndex && !isReviewStep;
            const needsReason = (summary?.missingJustificationCount || 0) > 0;
            return (
              <li key={section.code}>
                <button
                  type="button"
                  onClick={() => handleSelectSection(idx)}
                  aria-current={isActive ? "step" : undefined}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors max-w-[15rem] ${
                    isActive
                      ? "bg-[#0066FF] border-[#0066FF] text-white font-semibold shadow-xs"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                      isActive ? "bg-white text-[#0066FF]" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className="truncate">{section.title}</span>
                  <span
                    className={`shrink-0 font-mono text-[11px] ${
                      isActive ? "text-blue-100" : needsReason ? "text-amber-700" : done === section.questions.length ? "text-emerald-700" : "text-slate-400"
                    }`}
                  >
                    {done}/{section.questions.length}
                  </span>
                </button>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={handleSelectReview}
              aria-current={isReviewStep ? "step" : undefined}
              className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                isReviewStep
                  ? "bg-[#0066FF] border-[#0066FF] text-white shadow-xs"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              Review & Submit
            </button>
          </li>
        </ol>
      </nav>

      {/* 4. Domain questions as a table, or the review step */}
      {isReviewStep ? (
        <ReviewStep
          sections={sections}
          responses={responses}
          progress={progress}
          onJumpToQuestion={handleJumpToQuestion}
          onSubmitAssessment={handleSubmitAssessment}
          isSubmitting={isSubmitting}
          isSubmitted={wasSubmitted}
          isLocked={isLocked}
        />
      ) : (
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-900">
            {activeSectionIndex + 1}. {currentSection.title}
          </h2>
          <QuestionTable
            section={currentSection}
            responses={responses}
            assessmentId={assessmentId}
            canEdit={canEditAnswers}
            isAssessor={isAssessor}
            userRole={userRole}
            expandedCode={expandedCode}
            onExpand={setExpandedCode}
            onUpdateResponse={handleUpdateResponse}
          />
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => handleSelectSection(activeSectionIndex - 1)}
              disabled={activeSectionIndex === 0}
              className="px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
            >
              &larr; Previous domain
            </button>
            <button
              type="button"
              onClick={() => (isLastSection ? handleSelectReview() : handleSelectSection(activeSectionIndex + 1))}
              className="px-4 py-1.5 bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              {isLastSection ? "Review & Submit" : "Next domain"} &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
