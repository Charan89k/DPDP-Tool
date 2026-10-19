"use client";

import { errorMessage } from "@/lib/http/errors";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  History,
  ArrowRight,
  RefreshCw,
  Lock,
  AlertCircle,
  Copy,
} from "lucide-react";
import type {
  AssessmentStateSummary,
  AllowedTransitionOption,
  TransitionAuditLogEntry,
  AssessmentStatus,
} from "@/lib/lifecycle/types";
import { formatDateTime } from "@/lib/format/dates";

interface AssessmentLifecycleControlsProps {
  assessmentId: string;
  onStatusChanged?: (newStatus: AssessmentStatus) => void;
  className?: string;
}

export function AssessmentLifecycleControls({
  assessmentId,
  onStatusChanged,
  className = "",
}: AssessmentLifecycleControlsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [lifecycle, setLifecycle] = useState<AssessmentStateSummary | null>(null);
  const [history, setHistory] = useState<TransitionAuditLogEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Transition modal state
  const [activeTransition, setActiveTransition] = useState<AllowedTransitionOption | null>(null);
  const [transitionReason, setTransitionReason] = useState("");

  // Re-audit clone modal state
  const [showReauditModal, setShowReauditModal] = useState(false);
  const [reauditTitle, setReauditTitle] = useState("");
  const [reauditCode, setReauditCode] = useState("");
  const [copyResponses, setCopyResponses] = useState(true);
  const [cloning, setCloning] = useState(false);

  const fetchLifecycleState = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/assessments/${assessmentId}/transition`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load assessment lifecycle details.");
      }

      setLifecycle(data.lifecycle);
      setHistory(data.history || []);
    } catch (err) {
      console.error(err);
      setError(errorMessage(err) || "Failed to load assessment lifecycle state.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Loads server data for the selected assessment; the loader is also used after transitions.
    if (assessmentId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchLifecycleState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId]);

  const handleOpenTransitionModal = (opt: AllowedTransitionOption) => {
    setError(null);
    setValidationErrors([]);
    setSuccessMessage(null);
    setActiveTransition(opt);
    setTransitionReason("");
  };

  const handleExecuteTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTransition) return;

    if (activeTransition.requiresReason && !transitionReason.trim()) {
      setError(activeTransition.reasonPrompt || "A mandatory reason or justification is required.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setValidationErrors([]);

      const res = await fetch(`/api/assessments/${assessmentId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetStatus: activeTransition.targetStatus,
          reason: transitionReason.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.validationErrors && Array.isArray(data.validationErrors) && data.validationErrors.length > 0) {
          setValidationErrors(data.validationErrors);
        }
        throw new Error(data.error || "Failed to execute lifecycle transition.");
      }

      setLifecycle(data.lifecycle);
      setSuccessMessage(`Assessment transitioned to ${activeTransition.targetStatus} successfully.`);
      setActiveTransition(null);
      setTransitionReason("");

      if (onStatusChanged) {
        onStatusChanged(data.lifecycle.currentStatus);
      }

      // Refresh history
      fetchLifecycleState();
    } catch (err) {
      setError(errorMessage(err) || "Transition rejected by lifecycle policy.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloneForReaudit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCloning(true);
      setError(null);
      const res = await fetch(`/api/assessments/${assessmentId}/re-audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: reauditTitle.trim() || undefined,
          engagementCode: reauditCode.trim() || undefined,
          copyResponses,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to clone assessment for re-audit.");
      }

      setSuccessMessage(`New re-audit assessment created: ${data.assessment.engagementCode}.`);
      setShowReauditModal(false);
      router.push(`/dashboard/assessments/${data.assessment.id}/review`);
    } catch (err) {
      setError(errorMessage(err) || "Failed to initiate re-audit cycle.");
    } finally {
      setCloning(false);
    }
  };

  const getStatusBadge = (status: AssessmentStatus) => {
    switch (status) {
      case "DRAFT":
        return { label: "Draft Engagement", color: "bg-slate-100 text-slate-700 border-slate-300" };
      case "SCOPING":
        return { label: "Scoping Active", color: "bg-blue-50 text-blue-700 border-blue-200" };
      case "SCOPE_LOCKED":
        return { label: "Scope Locked", color: "bg-indigo-50 text-indigo-700 border-indigo-200" };
      case "DATA_GATHERING":
        return { label: "Data Gathering", color: "bg-cyan-50 text-cyan-800 border-cyan-200" };
      case "SUBMITTED_FOR_REVIEW":
        return { label: "Submitted for Review", color: "bg-amber-50 text-amber-800 border-amber-200" };
      case "UNDER_REVIEW":
        return { label: "Under Assessor Review", color: "bg-purple-50 text-purple-700 border-purple-200" };
      case "CLARIFICATION_PENDING":
        return { label: "Clarification Pending", color: "bg-orange-50 text-orange-800 border-orange-200" };
      case "REVIEW_COMPLETED":
        return { label: "Review Completed", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
      case "DRAFT_REPORT_GENERATED":
        return { label: "Draft Report Generated", color: "bg-blue-50 text-blue-800 border-blue-200" };
      case "LEAD_APPROVED":
        return { label: "Lead Approved", color: "bg-emerald-100 text-emerald-800 border-emerald-300 font-bold" };
      case "FINAL_ISSUED":
        return { label: "Final Report Issued (Immutable)", color: "bg-teal-50 text-teal-800 border-teal-300 font-bold" };
      case "REMEDIATION_ACTIVE":
        return { label: "Remediation Active", color: "bg-amber-100 text-amber-900 border-amber-300" };
      case "CANCELLED":
        return { label: "Cancelled", color: "bg-rose-100 text-rose-800 border-rose-300" };
      case "ARCHIVED":
        return { label: "Archived (Locked)", color: "bg-slate-200 text-slate-800 border-slate-400 font-medium" };
      default:
        return { label: status, color: "bg-slate-100 text-slate-700 border-slate-200" };
    }
  };

  if (loading) {
    return (
      <div className={`p-4 bg-white rounded-xl border border-slate-200 flex items-center justify-between ${className}`}>
        <div className="flex items-center space-x-2 text-xs text-slate-500">
          <RefreshCw className="w-4 h-4 animate-spin text-[#0066FF]" />
          <span>Loading lifecycle controls...</span>
        </div>
      </div>
    );
  }

  if (!lifecycle) return null;

  const currentBadge = getStatusBadge(lifecycle.currentStatus);
  const canReaudit = ["LEAD_APPROVED", "FINAL_ISSUED", "REMEDIATION_ACTIVE", "ARCHIVED"].includes(lifecycle.currentStatus);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Success alert */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center space-x-2 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main Lifecycle Control Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Current State Indicator */}
          <div className="flex items-center space-x-3">
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Lifecycle Status
              </span>
              <div className="flex items-center space-x-2 mt-0.5">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${currentBadge.color}`}
                >
                  {lifecycle.isImmutable && <Lock className="w-3 h-3 mr-1 text-slate-600" />}
                  {currentBadge.label}
                </span>
                {lifecycle.isPartialAssessment && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                    Partial Assessment (Rapid Diagnostic)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Permitted Next Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {lifecycle.allowedTransitions.map((opt) => {
              const isDestructive = opt.isDestructive;
              return (
                <button
                  key={opt.targetStatus}
                  type="button"
                  onClick={() => handleOpenTransitionModal(opt)}
                  disabled={submitting}
                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-2xs transition-colors ${
                    isDestructive
                      ? "bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100"
                      : opt.targetStatus === "LEAD_APPROVED" || opt.targetStatus === "FINAL_ISSUED"
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "bg-[#0066FF] text-white hover:bg-[#0052CC]"
                  }`}
                  title={opt.description}
                >
                  <span>{opt.label}</span>
                  <ArrowRight className="w-3 h-3 ml-0.5" />
                </button>
              );
            })}

            {/* Re-audit button for immutable finalized engagements */}
            {canReaudit && (
              <button
                type="button"
                onClick={() => {
                  setReauditCode(`${lifecycle.engagementCode}-REAUDIT`);
                  setReauditTitle(`${lifecycle.title} (Year 2 Re-assessment)`);
                  setShowReauditModal(true);
                }}
                className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg shadow-2xs transition-colors"
                title="Clone finalized assessment forward into a new versioned re-assessment engagement (parent_assessment_id relationship)."
              >
                <Copy className="w-3.5 h-3.5 mr-1 text-slate-600" />
                <span>Initiate Re-audit Cycle</span>
              </button>
            )}

            {/* Toggle History Button */}
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
              title="View full transition audit log"
            >
              <History className="w-3.5 h-3.5" />
              <span>History ({history.length})</span>
            </button>
          </div>
        </div>

        {/* Global / Validation Error Display */}
        {(error || validationErrors.length > 0) && (
          <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 space-y-1">
            <div className="flex items-center space-x-1.5 font-semibold text-rose-900">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Transition Precondition Guard Failed</span>
            </div>
            {error && <p>{error}</p>}
            {validationErrors.length > 0 && (
              <ul className="list-disc list-inside space-y-0.5 pl-1 pt-1 text-rose-700">
                {validationErrors.map((ve, idx) => (
                  <li key={idx}>{ve}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Transition Confirmation & Reason Modal */}
      {activeTransition && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {activeTransition.label}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Transition assessment from <strong className="font-mono text-slate-800">{lifecycle.currentStatus}</strong> to{" "}
                  <strong className="font-mono text-slate-800">{activeTransition.targetStatus}</strong>.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
              {activeTransition.description}
            </p>

            <form onSubmit={handleExecuteTransition} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {activeTransition.requiresReason ? (
                    <span className="text-rose-600 font-bold">* Mandatory Written Rationale / Justification:</span>
                  ) : (
                    "Optional Transition Notes / Comments:"
                  )}
                </label>
                <textarea
                  value={transitionReason}
                  onChange={(e) => setTransitionReason(e.target.value)}
                  placeholder={activeTransition.reasonPrompt || "Enter transition justification for the forensic audit log..."}
                  rows={3}
                  required={activeTransition.requiresReason}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveTransition(null)}
                  disabled={submitting}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || (activeTransition.requiresReason && !transitionReason.trim())}
                  className={`px-4 py-1.5 text-xs font-semibold text-white rounded-lg transition-colors flex items-center space-x-1.5 ${
                    activeTransition.isDestructive
                      ? "bg-rose-600 hover:bg-rose-700"
                      : "bg-[#0066FF] hover:bg-[#0052CC]"
                  }`}
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{submitting ? "Executing..." : "Confirm & Execute Transition"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Re-audit Clone Modal */}
      {showReauditModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                <Copy className="w-4 h-4 text-blue-600" />
                <span>Initiate Periodic Re-audit Engagement</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                The current engagement <strong className="font-mono text-slate-700">({lifecycle.engagementCode})</strong> is finalized and permanently immutable.
                A re-audit creates a brand new assessment linked via <strong className="font-mono text-slate-700">parent_assessment_id</strong> for delta comparison.
              </p>
            </div>

            <form onSubmit={handleCloneForReaudit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Engagement Code:
                </label>
                <input
                  type="text"
                  value={reauditCode}
                  onChange={(e) => setReauditCode(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Engagement Title:
                </label>
                <input
                  type="text"
                  value={reauditTitle}
                  onChange={(e) => setReauditTitle(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300"
                  required
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="copyResponses"
                  checked={copyResponses}
                  onChange={(e) => setCopyResponses(e.target.checked)}
                  className="rounded border-slate-300 text-[#0066FF] focus:ring-[#0066FF]"
                />
                <label htmlFor="copyResponses" className="text-xs text-slate-700">
                  Pre-populate previous questionnaire responses as starting baseline
                </label>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowReauditModal(false)}
                  disabled={cloning}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={cloning}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#0066FF] hover:bg-[#0052CC] rounded-lg flex items-center space-x-1.5"
                >
                  {cloning && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{cloning ? "Cloning..." : "Create Re-audit Engagement"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transition History Drawer / Timeline */}
      {showHistory && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <History className="w-4 h-4 text-slate-500" />
              <span>Immutable Forensic Transition History</span>
            </h4>
            <span className="text-[11px] text-slate-400">Append-Only Audit Trail</span>
          </div>

          {history.length === 0 ? (
            <p className="text-xs text-slate-500 py-3 text-center">
              No recorded state transitions yet. Initial state: {lifecycle.currentStatus}.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {history.map((entry) => (
                <div key={entry.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-slate-500 text-[11px]">{entry.previousStatus}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span className="font-mono font-bold text-slate-900 text-[11px]">{entry.newStatus}</span>
                      {entry.userRole && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 text-slate-600 border border-slate-200">
                          {entry.userRole}
                        </span>
                      )}
                    </div>
                    {entry.reason && (
                      <p className="text-slate-600 text-[11px] italic">
                        &quot;{entry.reason}&quot;
                      </p>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono shrink-0">
                    {formatDateTime(entry.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

