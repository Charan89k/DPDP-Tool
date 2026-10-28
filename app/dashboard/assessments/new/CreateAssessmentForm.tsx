"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ClipboardList, Info, Plus, ArrowRight, Users } from "lucide-react";
import type { SessionUser } from "@/lib/auth/types";
import { canCreateCustomer, getRoleBadgeLabel } from "@/lib/auth/rbac";
import type { UserRole } from "@/lib/auth/types";

interface TenantOption {
  id: string;
  name: string;
  slug: string;
  industry?: string | null;
  is_sdf?: boolean;
  dpo_name?: string | null;
  dpo_email?: string | null;
}

interface UserOption {
  id: string;
  tenant_id: string;
  full_name: string;
  email: string;
  role: string;
}

interface CreateAssessmentFormProps {
  sessionUser: SessionUser;
  tenants: TenantOption[];
  users?: UserOption[];
  initialTenantId?: string | null;
  frameworkLabel?: string | null;
}

type FieldErrors = Record<string, string[] | undefined>;

const ENGAGEMENT_CODE_PATTERN = "[A-Za-z0-9][A-Za-z0-9._\\-]{2,63}";

function generateEngagementCode(): string {
  return `DPDP-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
}

function isoDateOffset(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
}

const inputClass =
  "w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20";
const readOnlyClass =
  "w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700";
const labelClass = "block text-xs font-semibold text-slate-700 mb-1";

export function CreateAssessmentForm({
  sessionUser,
  tenants,
  users = [],
  initialTenantId,
  frameworkLabel,
}: CreateAssessmentFormProps) {
  // Matches POST /api/assessments: a customer administrator's self-assessment opens ready for answers.
  const initialStatus = sessionUser.role === "CLIENT_ADMIN" ? "DATA_GATHERING" : "DRAFT";
  const router = useRouter();

  const defaultTenant =
    (initialTenantId && tenants.find((t) => t.id === initialTenantId)) || tenants[0] || null;

  const [selectedTenantId, setSelectedTenantId] = useState<string>(defaultTenant?.id ?? "");
  const [title, setTitle] = useState(
    defaultTenant ? `${defaultTenant.name} DPDP Gap Assessment` : ""
  );
  const [titleEdited, setTitleEdited] = useState(false);
  const [engagementCode, setEngagementCode] = useState(generateEngagementCode);
  const [targetCompletionDate, setTargetCompletionDate] = useState(isoDateOffset(14));
  const [assignedCoordinatorIds, setAssignedCoordinatorIds] = useState<string[]>(() =>
    users
      .filter((u) => u.tenant_id === defaultTenant?.id)
      .slice(0, 1)
      .map((u) => u.id)
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const selectedTenant = tenants.find((t) => t.id === selectedTenantId) || null;
  const currentTenantUsers = users.filter((u) => u.tenant_id === selectedTenantId);

  const handleTenantChange = (newTenantId: string) => {
    setSelectedTenantId(newTenantId);
    const chosen = tenants.find((t) => t.id === newTenantId);
    if (!chosen) return;
    if (!titleEdited) {
      setTitle(`${chosen.name} DPDP Gap Assessment`);
    }
    setAssignedCoordinatorIds(
      users
        .filter((u) => u.tenant_id === chosen.id)
        .slice(0, 1)
        .map((u) => u.id)
    );
  };

  const toggleCoordinator = (userId: string) => {
    setAssignedCoordinatorIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    if (!selectedTenantId) {
      setFormError("Select the customer organization this assessment is for.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          engagementCode: engagementCode.trim(),
          targetCompletionDate: targetCompletionDate || null,
          tenantId: selectedTenantId,
          assignedUserIds: assignedCoordinatorIds,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.assessment?.id) {
        router.push(`/dashboard/assessments/${data.assessment.id}/questionnaire`);
        return;
      }

      setFieldErrors((data.details as FieldErrors) || {});
      setFormError(data.error || "The assessment could not be created. Please review the form and try again.");
      setIsSubmitting(false);
    } catch (err) {
      console.error("Failed to create assessment engagement:", err);
      setFormError("Network error while creating the assessment. Check your connection and try again.");
      setIsSubmitting(false);
    }
  };

  const fieldError = (name: string) =>
    fieldErrors[name]?.length ? (
      <p className="mt-1 text-[11px] text-rose-600" id={`${name}-error`}>
        {fieldErrors[name]![0]}
      </p>
    ) : null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
        <div>
          <nav aria-label="Breadcrumb" className="text-xs text-slate-500 font-medium mb-1">
            <Link href="/dashboard/assessments" className="hover:text-blue-600">
              Assessments
            </Link>{" "}
            &gt; <span className="text-slate-800">New Assessment</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Create New Assessment
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Select the customer organization, name the engagement, and assign client coordinators.
          </p>
        </div>

        {/* 3-Step Stepper */}
        <ol className="flex flex-wrap items-center gap-x-3 gap-y-2 self-start md:self-auto select-none" aria-label="Assessment setup steps">
          <li className="flex items-center space-x-2" aria-current="step">
            <span className="w-7 h-7 rounded-full bg-[#0066FF] text-white flex items-center justify-center text-xs font-bold shadow-xs">
              1
            </span>
            <span className="text-xs font-semibold text-[#0066FF]">Engagement Setup</span>
          </li>
          <li aria-hidden="true" className="w-4 sm:w-12 h-0.5 bg-blue-300" />
          <li className="flex items-center space-x-2">
            <span className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold">
              2
            </span>
            <span className="sr-only sm:not-sr-only text-xs font-medium text-slate-500">Questionnaire</span>
          </li>
          <li aria-hidden="true" className="w-4 sm:w-12 h-0.5 bg-slate-200" />
          <li className="flex items-center space-x-2">
            <span className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold">
              3
            </span>
            <span className="sr-only sm:not-sr-only text-xs font-medium text-slate-500">Review & Submit</span>
          </li>
        </ol>
      </div>

      {formError && (
        <div
          role="alert"
          className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs"
        >
          {formError}
        </div>
      )}

      {tenants.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-3 shadow-xs">
          <Building2 className="w-8 h-8 text-slate-300 mx-auto" />
          <h2 className="text-sm font-bold text-slate-900">No active customer organizations</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            An assessment must belong to an onboarded customer organization.
          </p>
          {canCreateCustomer(sessionUser.role) && (
            <Link
              href="/dashboard/customers/new"
              className="inline-flex items-center gap-1 px-4 py-2 text-xs font-semibold text-white bg-[#0066FF] hover:bg-[#0052CC] rounded-lg"
            >
              <Plus className="w-3.5 h-3.5" />
              Onboard a Customer
            </Link>
          )}
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          noValidate={false}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
        >
          {/* Left Column: Customer & Engagement */}
          <div className="lg:col-span-8 space-y-6">
            {/* Panel 1: Customer Organisation */}
            <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2.5">
                  <Building2 className="w-4 h-4 text-blue-600" aria-hidden="true" />
                  <h2 className="font-bold text-sm text-slate-900">Customer Organisation</h2>
                </div>
                {canCreateCustomer(sessionUser.role) && (
                  <Link
                    href="/dashboard/customers/new"
                    className="text-[11px] font-semibold text-[#0066FF] hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Onboard New Customer</span>
                  </Link>
                )}
              </div>

              <div>
                <label htmlFor="tenantId" className={labelClass}>
                  Customer Organisation <span className="text-rose-500">*</span>
                </label>
                <select
                  id="tenantId"
                  value={selectedTenantId}
                  onChange={(e) => handleTenantChange(e.target.value)}
                  required
                  aria-describedby={fieldErrors.tenantId ? "tenantId-error" : undefined}
                  className={`${inputClass} bg-white font-medium text-slate-900`}
                >
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.is_sdf ? " (SDF)" : ""}
                      {t.industry ? ` — ${t.industry}` : ""}
                    </option>
                  ))}
                </select>
                {fieldError("tenantId")}
              </div>

              {selectedTenant && (
                <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <dt className="font-semibold text-slate-500 mb-1">Industry / Sector</dt>
                    <dd className={readOnlyClass}>{selectedTenant.industry || "Not recorded"}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-500 mb-1">Significant Data Fiduciary</dt>
                    <dd className={readOnlyClass}>
                      {selectedTenant.is_sdf ? "Yes — SDF obligations in scope" : "No"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-500 mb-1">DPO / Grievance Contact</dt>
                    <dd className={`${readOnlyClass} truncate`}>
                      {selectedTenant.dpo_email || selectedTenant.dpo_name || "Not recorded"}
                    </dd>
                  </div>
                </dl>
              )}
              <p className="text-[11px] text-slate-500">
                Organization details come from the customer profile.{" "}
                <Link
                  href={`/dashboard/customers/${selectedTenantId}`}
                  className="font-semibold text-[#0066FF] hover:underline"
                >
                  Open customer profile
                </Link>
              </p>
            </section>

            {/* Panel 2: Engagement Details */}
            <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100">
                <ClipboardList className="w-4 h-4 text-blue-600" aria-hidden="true" />
                <h2 className="font-bold text-sm text-slate-900">Assessment Engagement Details</h2>
              </div>

              <div>
                <label htmlFor="title" className={labelClass}>
                  Assessment Title <span className="text-rose-500">*</span>
                </label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setTitleEdited(true);
                  }}
                  required
                  minLength={3}
                  maxLength={255}
                  aria-describedby={fieldErrors.title ? "title-error" : undefined}
                  className={inputClass}
                />
                {fieldError("title")}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="engagementCode" className={labelClass}>
                    Assessment ID <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex space-x-1.5">
                    <input
                      id="engagementCode"
                      type="text"
                      value={engagementCode}
                      onChange={(e) => setEngagementCode(e.target.value)}
                      required
                      pattern={ENGAGEMENT_CODE_PATTERN}
                      title="3–64 characters: letters, numbers, '.', '_' or '-'."
                      aria-describedby={
                        fieldErrors.engagementCode ? "engagementCode-error" : "engagementCode-hint"
                      }
                      className={`${inputClass} font-mono`}
                    />
                    <button
                      type="button"
                      onClick={() => setEngagementCode(generateEngagementCode())}
                      className="px-2.5 py-1.5 text-[11px] font-semibold text-[#0066FF] bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 whitespace-nowrap"
                    >
                      Auto
                    </button>
                  </div>
                  {fieldError("engagementCode") || (
                    <p id="engagementCode-hint" className="mt-1 text-[11px] text-slate-400">
                      Must be unique across all engagements.
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="targetCompletionDate" className={labelClass}>
                    Target Completion Date
                  </label>
                  <input
                    id="targetCompletionDate"
                    type="date"
                    value={targetCompletionDate}
                    min={isoDateOffset(0)}
                    onChange={(e) => setTargetCompletionDate(e.target.value)}
                    aria-describedby={
                      fieldErrors.targetCompletionDate ? "targetCompletionDate-error" : undefined
                    }
                    className={inputClass}
                  />
                  {fieldError("targetCompletionDate")}
                </div>

                <div>
                  <span className={labelClass}>Initial Status</span>
                  <div className={`${readOnlyClass} font-mono`}>{initialStatus}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className={labelClass}>Questionnaire Framework</span>
                  <div className={readOnlyClass}>
                    {frameworkLabel || "Active DPDP framework"} · 60 canonical questions
                  </div>
                </div>
                <div>
                  <span className={labelClass}>Engagement Lead</span>
                  <div className={readOnlyClass}>
                    {sessionUser.fullName} · {getRoleBadgeLabel(sessionUser.role as UserRole).label}
                  </div>
                </div>
              </div>
            </section>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2">
              <Link
                href="/dashboard/assessments"
                className="px-5 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                className="px-6 py-2.5 text-xs font-semibold text-white bg-[#0066FF] hover:bg-[#0052CC] active:bg-[#0047B3] disabled:opacity-60 rounded-lg shadow-sm transition-colors flex items-center space-x-2"
              >
                <span>
                  {isSubmitting ? "Creating Assessment..." : "Create Assessment & Open Questionnaire"}
                </span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Right Column: Coordinators & Guidance */}
          <div className="lg:col-span-4 space-y-6">
            <fieldset className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <legend className="flex items-center space-x-2 float-left">
                  <Users className="w-4 h-4 text-[#0066FF]" aria-hidden="true" />
                  <span className="font-bold text-xs text-slate-900">Assign Customer Coordinators</span>
                </legend>
                <Link
                  href={`/dashboard/customers/${selectedTenantId}`}
                  className="text-[11px] font-semibold text-[#0066FF] hover:underline"
                >
                  Manage Team
                </Link>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed clear-both">
                Coordinators can answer the questionnaire and submit evidence for this assessment.
                {assignedCoordinatorIds.length > 0 && (
                  <span className="block mt-1 font-semibold text-slate-700">
                    {assignedCoordinatorIds.length} selected
                  </span>
                )}
              </p>

              {currentTenantUsers.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center space-y-2">
                  <p className="text-[11px] text-slate-500">
                    No active users for this organization yet. You can create the assessment now
                    and assign coordinators later.
                  </p>
                  <Link
                    href={`/dashboard/customers/${selectedTenantId}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#0066FF] hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Invite Customer Users</span>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2 pt-1 max-h-72 overflow-y-auto pr-1">
                  {currentTenantUsers.map((u) => {
                    const isChecked = assignedCoordinatorIds.includes(u.id);
                    return (
                      <label
                        key={u.id}
                        className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-[#0066FF]/30 ${
                          isChecked
                            ? "bg-blue-50/60 border-blue-200"
                            : "bg-white border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleCoordinator(u.id)}
                          className="mt-0.5 rounded text-[#0066FF] focus:ring-[#0066FF] h-3.5 w-3.5"
                        />
                        <span className="text-left leading-tight min-w-0">
                          <span className="font-semibold text-xs text-slate-800 block">
                            {u.full_name}
                          </span>
                          <span className="text-[10px] text-slate-500 block truncate">
                            {u.email} · {getRoleBadgeLabel(u.role as UserRole).label}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </fieldset>

            <div className="bg-[#F0F7FF] rounded-xl border border-blue-200/80 p-5 shadow-xs space-y-3">
              <div className="flex items-center space-x-2 text-blue-900 font-bold text-xs">
                <Info className="w-4 h-4 text-blue-600 flex-shrink-0" aria-hidden="true" />
                <span>What happens next</span>
              </div>
              <ol className="space-y-2 text-xs text-slate-700 list-none pl-0">
                {[
                  `The assessment is created in ${initialStatus} and is visible only to its customer, assigned CloudE5 staff and super administrators.`,
                  "Assigned coordinators answer the 60 canonical questions and upload supporting evidence.",
                  "CloudE5 reviewers evaluate responses and evidence, raise clarifications, and prepare the report.",
                ].map((step, index) => (
                  <li key={step} className="flex items-start space-x-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[11px] flex-shrink-0 mt-0.5">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
