"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Plus,
  ArrowLeft,
  Calendar,
  Filter,
  ShieldAlert,
} from "lucide-react";
import type { RemediationTask, RemediationStatus, RemediationPriority } from "@/lib/remediation/types";
import type { SessionUser } from "@/lib/auth/types";
import { errorMessage } from "@/lib/http/errors";
import { formatDateTime } from "@/lib/format/dates";

interface Props {
  assessment: {
    id: string;
    engagementCode: string;
    title: string;
    tenantName: string;
    status: string;
  };
  initialRemediations: RemediationTask[];
  sessionUser: SessionUser;
  questionOptions: Array<{ code: string; text: string }>;
}

export function RemediationManagementClient({
  assessment,
  initialRemediations,
  sessionUser,
  questionOptions,
}: Props) {
  const [remediations, setRemediations] = useState<RemediationTask[]>(initialRemediations);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTaskForUpdate, setSelectedTaskForUpdate] = useState<RemediationTask | null>(null);
  const [selectedTaskForValidation, setSelectedTaskForValidation] = useState<RemediationTask | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states for Create
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newQuestionCode, setNewQuestionCode] = useState("");
  const [newPriority, setNewPriority] = useState<RemediationPriority>("HIGH");
  const [newTargetDate, setNewTargetDate] = useState("");

  // Form states for Client Update / Closure Submission
  const [updateStatus, setUpdateStatus] = useState<RemediationStatus>("IN_REMEDIATION");
  const [closureNotes, setClosureNotes] = useState("");

  // Form states for Assessor Validation
  const [validationAction, setValidationAction] = useState<"VALIDATE_CLOSE" | "REJECT_REOPEN">("VALIDATE_CLOSE");
  const [validationNotes, setValidationNotes] = useState("");

  const isConsultant = sessionUser.tenantType === "TLI";

  // KPIs
  const totalCount = remediations.length;
  const criticalHighCount = remediations.filter((r) => r.priority === "CRITICAL" || r.priority === "HIGH").length;
  const inProgressCount = remediations.filter((r) => r.status === "OPEN" || r.status === "IN_REMEDIATION").length;
  const submittedCount = remediations.filter((r) => r.status === "SUBMITTED_FOR_CLOSURE").length;
  const closedCount = remediations.filter((r) => r.status === "VALIDATED_CLOSED").length;

  const filteredTasks = remediations.filter((r) => {
    if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
    if (priorityFilter !== "ALL" && r.priority !== priorityFilter) return false;
    return true;
  });

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDesc.trim() || !newTargetDate) {
      setErrorMsg("Please fill in title, description, and target completion date.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/assessments/${assessment.id}/remediations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionCode: newQuestionCode || undefined,
          title: newTitle,
          description: newDesc,
          priority: newPriority,
          targetDate: newTargetDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create remediation task");

      setRemediations((prev) => [data.task, ...prev]);
      setShowCreateModal(false);
      setNewTitle("");
      setNewDesc("");
      setNewQuestionCode("");
      setNewTargetDate("");
    } catch (err) {
      setErrorMsg(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskForUpdate) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch(
        `/api/assessments/${assessment.id}/remediations/${selectedTaskForUpdate.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: updateStatus,
            closureSubmissionNotes: closureNotes || undefined,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update remediation task");

      setRemediations((prev) =>
        prev.map((t) => (t.id === selectedTaskForUpdate.id ? data.task : t))
      );
      setSelectedTaskForUpdate(null);
      setClosureNotes("");
    } catch (err) {
      setErrorMsg(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleValidateClosure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskForValidation) return;
    if (!validationNotes.trim()) {
      setErrorMsg("Assessor validation notes are mandatory.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch(
        `/api/assessments/${assessment.id}/remediations/${selectedTaskForValidation.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: validationAction,
            validationNotes,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to validate remediation task");

      setRemediations((prev) =>
        prev.map((t) => (t.id === selectedTaskForValidation.id ? data.task : t))
      );
      setSelectedTaskForValidation(null);
      setValidationNotes("");
    } catch (err) {
      setErrorMsg(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const getPriorityBadge = (p: RemediationPriority) => {
    switch (p) {
      case "CRITICAL":
        return <span className="bg-rose-100 text-rose-800 border border-rose-300 font-mono text-[10px] font-bold px-2 py-0.5 rounded">CRITICAL</span>;
      case "HIGH":
        return <span className="bg-amber-100 text-amber-800 border border-amber-300 font-mono text-[10px] font-bold px-2 py-0.5 rounded">HIGH</span>;
      case "MEDIUM":
        return <span className="bg-blue-100 text-blue-800 border border-blue-300 font-mono text-[10px] font-bold px-2 py-0.5 rounded">MEDIUM</span>;
      default:
        return <span className="bg-stone-100 text-stone-700 border border-stone-300 font-mono text-[10px] px-2 py-0.5 rounded">{p}</span>;
    }
  };

  const getStatusBadge = (s: RemediationStatus) => {
    switch (s) {
      case "OPEN":
        return <span className="bg-slate-100 text-slate-800 font-mono text-[10px] px-2 py-0.5 rounded border border-slate-300">OPEN</span>;
      case "IN_REMEDIATION":
        return <span className="bg-amber-50 text-amber-800 font-mono text-[10px] px-2 py-0.5 rounded border border-amber-200">IN REMEDIATION</span>;
      case "SUBMITTED_FOR_CLOSURE":
        return <span className="bg-blue-50 text-blue-800 font-mono text-[10px] px-2 py-0.5 rounded border border-blue-200">SUBMITTED FOR CLOSURE</span>;
      case "VALIDATED_CLOSED":
        return <span className="bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-300">VALIDATED CLOSED</span>;
      case "REJECTED_REOPENED":
        return <span className="bg-rose-100 text-rose-800 font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-rose-300">REOPENED / REJECTED</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Top Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href={`/dashboard/reports/${assessment.id}`}
              className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-900 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Assessment Report</span>
            </Link>
            <span className="text-stone-300">/</span>
            <span className="font-mono text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded border border-stone-200">
              Engagement: {assessment.engagementCode}
            </span>
          </div>
          <h1 className="font-serif text-2xl font-bold text-stone-900">
            Corrective Action Plan (CAPA) & Remediation Workspace
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Track, assign, and validate corrective actions for identified statutory compliance gaps.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/assessments/${assessment.id}/gaps`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-stone-300 hover:bg-stone-50 text-stone-800 rounded transition-colors"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            <span>Gap Analysis Ledger</span>
          </Link>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-[#16191f] hover:bg-stone-800 text-white rounded transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Action Item</span>
          </button>
        </div>
      </div>

      {/* Non-Compensatory & Immutability Notice */}
      <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-700 flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong>Independent Post-Assessment Remediation:</strong> Remediation workflows track organizational action plans. In line with the CloudE5 methodology, marking a remediation task complete does <em>not</em> retroactively mutate historical questionnaire responses or alter officially issued report snapshots.
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white border border-stone-200 rounded-lg p-3.5 shadow-2xs">
          <span className="font-mono text-[10px] text-stone-500 uppercase block">Total Action Items</span>
          <div className="font-serif text-xl font-bold text-stone-900 mt-1">{totalCount}</div>
        </div>
        <div className="bg-white border border-rose-200 rounded-lg p-3.5 shadow-2xs bg-rose-50/20">
          <span className="font-mono text-[10px] text-rose-700 uppercase block">Critical / High</span>
          <div className="font-serif text-xl font-bold text-rose-900 mt-1">{criticalHighCount}</div>
        </div>
        <div className="bg-white border border-amber-200 rounded-lg p-3.5 shadow-2xs bg-amber-50/20">
          <span className="font-mono text-[10px] text-amber-700 uppercase block">Active In Progress</span>
          <div className="font-serif text-xl font-bold text-amber-900 mt-1">{inProgressCount}</div>
        </div>
        <div className="bg-white border border-blue-200 rounded-lg p-3.5 shadow-2xs bg-blue-50/20">
          <span className="font-mono text-[10px] text-blue-700 uppercase block">Closure Submitted</span>
          <div className="font-serif text-xl font-bold text-blue-900 mt-1">{submittedCount}</div>
        </div>
        <div className="bg-white border border-emerald-200 rounded-lg p-3.5 shadow-2xs bg-emerald-50/20">
          <span className="font-mono text-[10px] text-emerald-700 uppercase block">Validated Closed</span>
          <div className="font-serif text-xl font-bold text-emerald-900 mt-1">{closedCount}</div>
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white border border-stone-200 rounded-lg text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-stone-500 font-mono text-[11px] flex items-center gap-1">
            <Filter className="w-3 h-3" /> Status:
          </span>
          {["ALL", "OPEN", "IN_REMEDIATION", "SUBMITTED_FOR_CLOSURE", "VALIDATED_CLOSED", "REJECTED_REOPENED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2 py-0.5 rounded font-mono text-[10px] transition-colors ${
                statusFilter === st
                  ? "bg-stone-900 text-white font-bold"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-stone-500 font-mono text-[11px]">Priority:</span>
          {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((pr) => (
            <button
              key={pr}
              onClick={() => setPriorityFilter(pr)}
              className={`px-2 py-0.5 rounded font-mono text-[10px] transition-colors ${
                priorityFilter === pr
                  ? "bg-stone-900 text-white font-bold"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {pr}
            </button>
          ))}
        </div>
      </div>

      {/* Remediations List */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-12 text-center text-xs text-stone-500 space-y-2">
          <CheckCircle2 className="w-8 h-8 text-stone-400 mx-auto" />
          <h3 className="font-serif font-bold text-stone-800 text-sm">No Matching Remediation Tasks</h3>
          <p className="max-w-sm mx-auto">
            {remediations.length === 0
              ? "No corrective action items configured yet. Click 'New Action Item' to seed remediation tracking."
              : "No tasks match the active status or priority filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className="bg-white border border-stone-200 rounded-xl p-5 hover:border-stone-400 transition-colors shadow-2xs space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-stone-100">
                <div className="flex items-center gap-2 flex-wrap">
                  {getPriorityBadge(task.priority)}
                  {getStatusBadge(task.status)}
                  {task.questionCode && (
                    <span className="font-mono text-[11px] font-bold text-stone-700 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                      Finding: {task.questionCode}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs font-mono text-stone-500">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Target: {task.targetDate || "None set"}</span>
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="font-serif font-bold text-base text-stone-900">{task.title}</h3>
                <p className="text-xs text-stone-700 leading-relaxed whitespace-pre-line">
                  {task.description}
                </p>
              </div>

              {/* Closure Submission Notes (if any) */}
              {task.closureSubmissionNotes && (
                <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-lg text-xs space-y-1 text-blue-900">
                  <div className="flex items-center justify-between font-mono text-[10px] text-blue-700">
                    <span className="font-bold">Client Closure Submission:</span>
                    <span>{task.closureSubmittedAt ? formatDateTime(task.closureSubmittedAt) : ""}</span>
                  </div>
                  <p className="text-stone-800 text-xs leading-relaxed">{task.closureSubmissionNotes}</p>
                </div>
              )}

              {/* Assessor Validation Notes (if any) */}
              {task.closureValidationNotes && (
                <div
                  className={`p-3 rounded-lg text-xs space-y-1 ${
                    task.status === "VALIDATED_CLOSED"
                      ? "bg-emerald-50/50 border border-emerald-100 text-emerald-950"
                      : "bg-rose-50/50 border border-rose-100 text-rose-950"
                  }`}
                >
                  <div className="flex items-center justify-between font-mono text-[10px] text-stone-600">
                    <span className="font-bold">
                      Assessor Validation ({task.closureValidatedByName || "CloudE5 Consultant"}):
                    </span>
                    <span>{task.validatedAt ? formatDateTime(task.validatedAt) : ""}</span>
                  </div>
                  <p className="text-stone-800 text-xs leading-relaxed">{task.closureValidationNotes}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-xs">
                <div className="text-stone-500 font-mono text-[11px]">
                  Owner: <strong className="text-stone-800">{task.ownerName || "Unassigned"}</strong>
                </div>

                <div className="flex items-center gap-2">
                  {/* Client / Owner Progress Button */}
                  {task.status !== "VALIDATED_CLOSED" && (
                    <button
                      onClick={() => {
                        setSelectedTaskForUpdate(task);
                        setUpdateStatus(
                          task.status === "OPEN" ? "IN_REMEDIATION" : task.status
                        );
                        setClosureNotes(task.closureSubmissionNotes || "");
                      }}
                      className="px-3 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded font-semibold text-xs transition-colors"
                    >
                      Update Progress / Submit
                    </button>
                  )}

                  {/* Assessor Validation Button */}
                  {isConsultant && task.status === "SUBMITTED_FOR_CLOSURE" && (
                    <button
                      onClick={() => {
                        setSelectedTaskForValidation(task);
                        setValidationAction("VALIDATE_CLOSE");
                        setValidationNotes("");
                      }}
                      className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-semibold text-xs transition-colors shadow-2xs"
                    >
                      Validate Closure
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-stone-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-stone-200">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <h3 className="font-serif font-bold text-base text-stone-900">New Corrective Action (CAPA)</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-stone-400 hover:text-stone-700 text-sm font-mono"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateTask} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-stone-700 font-semibold mb-1">Associated Finding / Question</label>
                <select
                  value={newQuestionCode}
                  onChange={(e) => setNewQuestionCode(e.target.value)}
                  className="w-full border border-stone-300 rounded px-2.5 py-1.5 text-xs font-mono bg-white"
                >
                  <option value="">General Assessment Corrective Action</option>
                  {questionOptions.map((q) => (
                    <option key={q.code} value={q.code}>
                      {q.code}: {q.text.slice(0, 70)}...
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Action Title *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Implement AES-256 database column encryption"
                  className="w-full border border-stone-300 rounded px-2.5 py-1.5 text-xs"
                />
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Detailed Description & CAPA Plan *</label>
                <textarea
                  required
                  rows={3}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Specify root cause analysis, technical controls to deploy, and acceptance criteria..."
                  className="w-full border border-stone-300 rounded px-2.5 py-1.5 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Priority Level *</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as RemediationPriority)}
                    className="w-full border border-stone-300 rounded px-2.5 py-1.5 text-xs font-mono bg-white"
                  >
                    <option value="CRITICAL">CRITICAL (Tier 1 Statutory)</option>
                    <option value="HIGH">HIGH (Tier 2/3 Statutory)</option>
                    <option value="MEDIUM">MEDIUM (Operational Deficit)</option>
                    <option value="LOW">LOW (Procedural)</option>
                    <option value="INFORMATIONAL">INFORMATIONAL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Target Completion Date *</label>
                  <input
                    type="date"
                    required
                    value={newTargetDate}
                    onChange={(e) => setNewTargetDate(e.target.value)}
                    className="w-full border border-stone-300 rounded px-2.5 py-1.5 text-xs font-mono bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 bg-stone-100 text-stone-700 rounded hover:bg-stone-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-3.5 py-1.5 bg-stone-900 text-white rounded font-semibold hover:bg-stone-800 transition-colors disabled:opacity-50"
                >
                  {loading ? "Creating..." : "Save Action Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPDATE / SUBMIT FOR CLOSURE MODAL */}
      {selectedTaskForUpdate && (
        <div className="fixed inset-0 bg-stone-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-stone-200">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <h3 className="font-serif font-bold text-base text-stone-900">
                Update Remediation Progress
              </h3>
              <button
                onClick={() => setSelectedTaskForUpdate(null)}
                className="text-stone-400 hover:text-stone-700 text-sm font-mono"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded">
                {errorMsg}
              </div>
            )}

            <div className="text-xs bg-stone-50 p-2.5 rounded border border-stone-200 space-y-1">
              <div className="font-serif font-bold text-stone-900">{selectedTaskForUpdate.title}</div>
              <div className="text-stone-600 font-mono text-[10px]">
                Priority: {selectedTaskForUpdate.priority} • Target: {selectedTaskForUpdate.targetDate}
              </div>
            </div>

            <form onSubmit={handleUpdateProgress} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-stone-700 font-semibold mb-1">Status Workflow *</label>
                <select
                  value={updateStatus}
                  onChange={(e) => setUpdateStatus(e.target.value as RemediationStatus)}
                  className="w-full border border-stone-300 rounded px-2.5 py-1.5 text-xs font-mono bg-white"
                >
                  <option value="OPEN">OPEN (Not yet active)</option>
                  <option value="IN_REMEDIATION">IN_REMEDIATION (Remediation active)</option>
                  <option value="SUBMITTED_FOR_CLOSURE">
                    SUBMITTED_FOR_CLOSURE (Ready for CloudE5 assessor validation)
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">
                  Closure Submission Notes & Evidentiary Proof
                </label>
                <textarea
                  rows={3}
                  value={closureNotes}
                  onChange={(e) => setClosureNotes(e.target.value)}
                  placeholder="Detail the technical implementation, configuration changes, or upload verification links..."
                  className="w-full border border-stone-300 rounded px-2.5 py-1.5 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setSelectedTaskForUpdate(null)}
                  className="px-3 py-1.5 bg-stone-100 text-stone-700 rounded hover:bg-stone-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-3.5 py-1.5 bg-stone-900 text-white rounded font-semibold hover:bg-stone-800 transition-colors disabled:opacity-50"
                >
                  {loading ? "Updating..." : "Submit Update"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSESSOR VALIDATION MODAL */}
      {selectedTaskForValidation && (
        <div className="fixed inset-0 bg-stone-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-stone-200">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <h3 className="font-serif font-bold text-base text-stone-900">
                Independent Assessor Remediation Validation
              </h3>
              <button
                onClick={() => setSelectedTaskForValidation(null)}
                className="text-stone-400 hover:text-stone-700 text-sm font-mono"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded">
                {errorMsg}
              </div>
            )}

            <div className="text-xs bg-stone-50 p-2.5 rounded border border-stone-200 space-y-1">
              <div className="font-serif font-bold text-stone-900">{selectedTaskForValidation.title}</div>
              <p className="text-stone-600 text-xs">{selectedTaskForValidation.description}</p>
              {selectedTaskForValidation.closureSubmissionNotes && (
                <div className="pt-2 text-stone-800 border-t border-stone-200">
                  <span className="font-mono text-[10px] text-stone-500 block">Client Submission Notes:</span>
                  {selectedTaskForValidation.closureSubmissionNotes}
                </div>
              )}
            </div>

            <form onSubmit={handleValidateClosure} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-stone-700 font-semibold mb-1">Validation Determination *</label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex items-center gap-2 p-2.5 rounded border cursor-pointer ${
                      validationAction === "VALIDATE_CLOSE"
                        ? "bg-emerald-50 border-emerald-400 text-emerald-900 font-bold"
                        : "bg-white border-stone-200 text-stone-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="valAction"
                      value="VALIDATE_CLOSE"
                      checked={validationAction === "VALIDATE_CLOSE"}
                      onChange={() => setValidationAction("VALIDATE_CLOSE")}
                      className="sr-only"
                    />
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    <span>Approve & Close</span>
                  </label>

                  <label
                    className={`flex items-center gap-2 p-2.5 rounded border cursor-pointer ${
                      validationAction === "REJECT_REOPEN"
                        ? "bg-rose-50 border-rose-400 text-rose-900 font-bold"
                        : "bg-white border-stone-200 text-stone-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="valAction"
                      value="REJECT_REOPEN"
                      checked={validationAction === "REJECT_REOPEN"}
                      onChange={() => setValidationAction("REJECT_REOPEN")}
                      className="sr-only"
                    />
                    <XCircle className="w-4 h-4 text-rose-700" />
                    <span>Reject & Reopen</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">
                  Mandatory Assessor Validation Finding Notes *
                </label>
                <textarea
                  required
                  rows={3}
                  value={validationNotes}
                  onChange={(e) => setValidationNotes(e.target.value)}
                  placeholder="Record formal verification observations, inspection of configuration, or reasons for rejection..."
                  className="w-full border border-stone-300 rounded px-2.5 py-1.5 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setSelectedTaskForValidation(null)}
                  className="px-3 py-1.5 bg-stone-100 text-stone-700 rounded hover:bg-stone-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-3.5 py-1.5 bg-stone-900 text-white rounded font-semibold hover:bg-stone-800 transition-colors disabled:opacity-50"
                >
                  {loading ? "Validating..." : "Confirm Determination"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

