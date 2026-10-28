"use client";

import React, { useEffect, useState } from "react";
import { MessageSquare, Paperclip, ChevronDown } from "lucide-react";
import type {
  CanonicalQuestionnaireSection,
  CanonicalResponseOption,
  RespondentQuestionResponse,
} from "@/lib/questionnaire/types";
import { QuestionCard, belongsTo } from "./QuestionCard";

const NOT_APPLICABLE: CanonicalResponseOption = "Not applicable — justification required";

/** One tick column per answer, in the order respondents read them. */
const COLUMNS: Array<{ option: CanonicalResponseOption; label: string; accent: string }> = [
  { option: "Implemented", label: "Implemented", accent: "accent-emerald-600" },
  { option: "Partially implemented", label: "Partial", accent: "accent-amber-500" },
  { option: "Not implemented", label: "Not implemented", accent: "accent-rose-600" },
  { option: "Unknown / not verified", label: "Unknown", accent: "accent-slate-700" },
  { option: NOT_APPLICABLE, label: "N/A", accent: "accent-slate-700" },
];

// Question text, five tick columns, then the comments/evidence button.
const ROW_GRID = "md:grid md:grid-cols-[minmax(0,1fr)_repeat(5,4.75rem)_6.5rem] md:items-center";

interface QuestionTableProps {
  section: CanonicalQuestionnaireSection;
  responses: Record<string, RespondentQuestionResponse>;
  assessmentId: string;
  canEdit: boolean;
  isAssessor: boolean;
  userRole?: string;
  expandedCode: string | null;
  onExpand: (code: string | null) => void;
  onUpdateResponse: (updated: RespondentQuestionResponse) => void;
}

interface EvidenceRef {
  questionCode: string;
}

export function QuestionTable({
  section,
  responses,
  assessmentId,
  canEdit,
  isAssessor,
  userRole,
  expandedCode,
  onExpand,
  onUpdateResponse,
}: QuestionTableProps) {
  const [evidence, setEvidence] = useState<EvidenceRef[]>([]);
  const [evidenceVersion, setEvidenceVersion] = useState(0);

  // Evidence counts for the paperclip badges; refreshed when a details panel opens, closes or uploads.
  useEffect(() => {
    let isMounted = true;
    fetch(`/api/assessments/${assessmentId}/evidence`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { items?: EvidenceRef[] } | null) => {
        if (isMounted && Array.isArray(data?.items)) setEvidence(data.items);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [assessmentId, expandedCode, evidenceVersion]);

  const select = (code: string, option: CanonicalResponseOption) => {
    const current = responses[code];
    onUpdateResponse({
      questionCode: code,
      selectedOption: option,
      commentsAndJustification: current?.commentsAndJustification ?? "",
      updatedAt: new Date().toISOString(),
    });
    // "Not applicable" needs a written reason, so open the comment box right away.
    if (option === NOT_APPLICABLE && !(current?.commentsAndJustification ?? "").trim()) onExpand(code);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Column headings (wide screens; on phones each choice carries its own label) */}
      <div className={`hidden ${ROW_GRID} gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600`} aria-hidden="true">
        <span>Question</span>
        {COLUMNS.map((c) => (
          <span key={c.option} className="text-center leading-tight">{c.label}</span>
        ))}
        <span className="text-center">Details</span>
      </div>

      <ol className="divide-y divide-slate-100">
        {section.questions.map((q) => {
          const response = responses[q.code];
          const comment = (response?.commentsAndJustification ?? "").trim();
          const missingReason = response?.selectedOption === NOT_APPLICABLE && !comment;
          const evidenceCount = evidence.filter((e) => belongsTo(q.code, q.canonicalControlId, e.questionCode)).length;
          const isOpen = expandedCode === q.code;
          const textId = `q-${q.code}-text`;
          const panelId = `q-${q.code}-details`;

          return (
            <li key={q.code} id={`question-${q.code}`} className={missingReason ? "bg-amber-50/60" : undefined}>
              <div className={`${ROW_GRID} gap-2 px-4 py-3 space-y-3 md:space-y-0`}>
                <p id={textId} className="text-xs text-slate-800 leading-relaxed">
                  <span className="font-mono text-[11px] font-bold text-slate-900 mr-2">{q.code}</span>
                  {q.text}
                  {missingReason && (
                    <span className="block mt-1 text-[11px] font-semibold text-amber-800">
                      Add a reason for &ldquo;Not applicable&rdquo; in the comment box.
                    </span>
                  )}
                </p>

                <div role="radiogroup" aria-labelledby={textId} className="grid grid-cols-5 gap-1 md:col-span-5 md:gap-2">
                  {COLUMNS.map((c) => (
                    <label
                      key={c.option}
                      className={`flex flex-col items-center gap-1 py-1 rounded-md ${canEdit ? "cursor-pointer hover:bg-slate-50" : "cursor-default"}`}
                    >
                      <input
                        type="radio"
                        name={`answer-${q.code}`}
                        aria-label={`${q.code}: ${c.option}`}
                        checked={response?.selectedOption === c.option}
                        disabled={!canEdit}
                        onChange={() => select(q.code, c.option)}
                        className={`h-5 w-5 ${c.accent} disabled:opacity-60`}
                      />
                      <span className="md:hidden text-[10px] text-slate-600 text-center leading-tight">{c.label}</span>
                    </label>
                  ))}
                </div>

                <div className="flex md:justify-center">
                  <button
                    type="button"
                    onClick={() => onExpand(isOpen ? null : q.code)}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    aria-label={`Comments and evidence for ${q.code}`}
                    className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${
                      isOpen
                        ? "bg-blue-50 border-blue-200 text-blue-800"
                        : missingReason
                          ? "bg-amber-100 border-amber-300 text-amber-900"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span className="inline-flex items-center gap-0.5">
                      <MessageSquare className={`w-3.5 h-3.5 ${comment ? "text-blue-600" : ""}`} aria-hidden="true" />
                      {comment ? <span className="w-1.5 h-1.5 rounded-full bg-blue-600" aria-hidden="true" /> : null}
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                      <Paperclip className="w-3.5 h-3.5" aria-hidden="true" />
                      {evidenceCount}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                </div>
              </div>

              {isOpen && (
                <div id={panelId} className="px-4 pb-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                    <QuestionCard
                      embedded
                      question={q}
                      response={response}
                      assessmentId={assessmentId}
                      isAssessor={isAssessor}
                      canEdit={canEdit}
                      userRole={userRole}
                      onUpdateResponse={onUpdateResponse}
                      onAttachEvidence={() => setEvidenceVersion((v) => v + 1)}
                    />
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
