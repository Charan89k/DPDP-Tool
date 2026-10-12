"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  ClipboardList,
  Search,
  Calendar,
  User,
  Info,
  Plus,
  Trash2,
  Edit2,
  Download,
  ArrowRight,
  FileText,
  FileCheck,
  CheckCircle2,
  Users,
} from "lucide-react";
import type { SessionUser } from "@/lib/auth/types";
import { canCreateCustomer } from "@/lib/auth/rbac";

interface TenantOption {
  id: string;
  name: string;
  slug: string;
  industry?: string;
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
  phone?: string | null;
}

interface CreateAssessmentFormProps {
  sessionUser: SessionUser;
  tenants: TenantOption[];
  users?: UserOption[];
  initialTenantId?: string | null;
  frameworkId?: string | null;
  fallbackAssessmentId?: string | null;
}

export function CreateAssessmentForm({
  sessionUser,
  tenants,
  users = [],
  initialTenantId,
  frameworkId,
  fallbackAssessmentId,
}: CreateAssessmentFormProps) {
  const router = useRouter();

  // Find initial tenant
  const defaultTenant =
    (initialTenantId && tenants.find((t) => t.id === initialTenantId)) ||
    tenants[0] || {
      id: sessionUser.tenantId,
      name: "Customer Organisation",
      slug: "customer-org",
      industry: "Healthcare",
      is_sdf: false,
    };

  const [selectedTenantId, setSelectedTenantId] = useState<string>(defaultTenant.id);
  const [customerName, setCustomerName] = useState(defaultTenant.name);
  const [industry, setIndustry] = useState(defaultTenant.industry || "Healthcare");
  const [isSdf, setIsSdf] = useState(Boolean(defaultTenant.is_sdf));
  const [orgSize, setOrgSize] = useState("500 - 1,000 employees");
  const [email, setEmail] = useState(defaultTenant.dpo_email || "");
  const [phone, setPhone] = useState("+91 98765 43210");
  const [address, setAddress] = useState("India Operations");

  const [assessmentId, setAssessmentId] = useState(
    `DPDP-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`
  );
  const [assessmentType, setAssessmentType] = useState("DPDP Gap Assessment");
  const [status, setStatus] = useState("Draft");
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split("T")[0]);
  const [questionnaireVersion, setQuestionnaireVersion] = useState("v1.0 (60 Questions)");
  const [targetReportDate, setTargetReportDate] = useState(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [assessor, setAssessor] = useState(sessionUser.fullName || "Anita Sharma");
  const [coAssessor, setCoAssessor] = useState("");
  const [engagementRef, setEngagementRef] = useState("Customer PO / Engagement Scope");
  const [assessmentScope, setAssessmentScope] = useState("India operations");

  // Assigned Coordinators: Track user IDs assigned from the target customer
  const [assignedCoordinatorIds, setAssignedCoordinatorIds] = useState<string[]>(() => {
    const tenantUsers = users.filter((u) => u.tenant_id === defaultTenant.id);
    return tenantUsers.slice(0, 1).map((u) => u.id);
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Handle changing customer organization
  const handleTenantChange = (newTenantId: string) => {
    setSelectedTenantId(newTenantId);
    const chosen = tenants.find((t) => t.id === newTenantId);
    if (chosen) {
      setCustomerName(chosen.name);
      setIndustry(chosen.industry || "Healthcare");
      setIsSdf(Boolean(chosen.is_sdf));
      setEmail(chosen.dpo_email || "");

      // Auto-assign the first available user of this tenant
      const tenantUsers = users.filter((u) => u.tenant_id === chosen.id);
      setAssignedCoordinatorIds(tenantUsers.slice(0, 1).map((u) => u.id));
    }
  };

  // Toggle coordinator assignment
  const toggleCoordinator = (userId: string) => {
    if (assignedCoordinatorIds.includes(userId)) {
      setAssignedCoordinatorIds(assignedCoordinatorIds.filter((id) => id !== userId));
    } else {
      setAssignedCoordinatorIds([...assignedCoordinatorIds, userId]);
    }
  };

  // Auto-generate Assessment ID handler
  const handleAutoGenerateId = () => {
    const year = new Date().getFullYear();
    const randomNum = Math.floor(100 + Math.random() * 900);
    setAssessmentId(`DPDP-${year}-${randomNum}`);
  };

  // Available users for the selected tenant
  const currentTenantUsers = users.filter((u) => u.tenant_id === selectedTenantId);

  // Documents Table State
  const [documents, setDocuments] = useState([
    {
      id: "1",
      fileName: "Engagement_Scope.pdf",
      type: "PDF",
      uploadedOn: "12 Aug 2024",
    },
    {
      id: "2",
      fileName: "NDA_Signed.pdf",
      type: "PDF",
      uploadedOn: "12 Aug 2024",
    },
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${customerName} DPDP Gap Assessment`,
          engagementCode: assessmentId,
          targetCompletionDate: targetReportDate,
          tenantId: selectedTenantId,
          assignedUserIds: assignedCoordinatorIds,
        }),
      });

      const data = await res.json();
      if (res.ok && data.assessment?.id) {
        router.push(`/dashboard/assessments/${data.assessment.id}/questionnaire`);
      } else if (fallbackAssessmentId) {
        router.push(`/dashboard/assessments/${fallbackAssessmentId}/questionnaire`);
      } else {
        router.push("/dashboard/assessments");
      }
    } catch (err: any) {
      console.error("Failed to create assessment engagement:", err);
      setFormError("Network error initializing assessment engagement.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Top Bar with Stepper */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
        <div>
          <nav className="text-xs text-slate-500 font-medium mb-1">
            <Link href="/dashboard/assessments" className="hover:text-blue-600">
              Assessments
            </Link>{" "}
            &gt; <span className="text-slate-800">New Assessment</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Create New Assessment
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Select customer organization, assign coordinators, and configure evaluation scope.
          </p>
        </div>

        {/* 3-Step Stepper */}
        <div className="flex items-center space-x-3 self-start md:self-auto select-none">
          {/* Step 1: Customer Details (Active) */}
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-full bg-[#0066FF] text-white flex items-center justify-center text-xs font-bold shadow-xs">
              1
            </div>
            <span className="text-xs font-semibold text-[#0066FF]">
              Customer Details
            </span>
          </div>

          <div className="w-12 h-0.5 bg-blue-300" />

          {/* Step 2: Questionnaire */}
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold">
              2
            </div>
            <span className="text-xs font-medium text-slate-500">
              Questionnaire
            </span>
          </div>

          <div className="w-12 h-0.5 bg-slate-200" />

          {/* Step 3: Review & Submit */}
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold">
              3
            </div>
            <span className="text-xs font-medium text-slate-500">
              Review & Submit
            </span>
          </div>
        </div>
      </div>

      {formError && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Customer Info & Assessment Details */}
        <div className="lg:col-span-8 space-y-6">
          {/* Panel 1: Customer Information */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <Building2 className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  Customer Organisation & Scope
                </h3>
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Customer Selector Dropdown */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Customer Organisation <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedTenantId}
                  onChange={(e) => handleTenantChange(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF] bg-white font-medium text-slate-900"
                >
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.is_sdf ? " (SDF)" : ""} — {t.industry || "Enterprise"}
                    </option>
                  ))}
                </select>
              </div>

              {/* Industry */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Industry / Sector <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* DPO Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  DPO / Primary Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF]"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF]"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jurisdiction Scope
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF]"
                />
              </div>
            </div>
          </div>

          {/* Panel 2: Assessment Details */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100">
              <ClipboardList className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-sm text-slate-900">
                Assessment Engagement Details
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Assessment ID */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assessment ID <span className="text-rose-500">*</span>
                </label>
                <div className="flex space-x-1.5">
                  <input
                    type="text"
                    value={assessmentId}
                    onChange={(e) => setAssessmentId(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-[#0066FF]"
                  />
                  <button
                    type="button"
                    onClick={handleAutoGenerateId}
                    className="px-2.5 py-1.5 text-[11px] font-semibold text-[#0066FF] bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 whitespace-nowrap"
                  >
                    Auto
                  </button>
                </div>
              </div>

              {/* Assessment Type */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assessment Type <span className="text-rose-500">*</span>
                </label>
                <select
                  value={assessmentType}
                  onChange={(e) => setAssessmentType(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF] bg-white"
                >
                  <option value="DPDP Gap Assessment">DPDP Gap Assessment</option>
                  <option value="Statutory SDF Audit">Statutory SDF Audit</option>
                  <option value="Readiness Health Check">Readiness Health Check</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Initial Status
                </label>
                <input
                  type="text"
                  disabled
                  value="DRAFT"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-500 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Visit Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Commencement Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF]"
                />
              </div>

              {/* Questionnaire Version */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Questionnaire Framework <span className="text-rose-500">*</span>
                </label>
                <select
                  value={questionnaireVersion}
                  onChange={(e) => setQuestionnaireVersion(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF] bg-white font-medium"
                >
                  <option value="v1.0 (60 Questions)">v1.0 (60 Canonical Questions)</option>
                </select>
              </div>

              {/* Target Report Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Completion Date
                </label>
                <input
                  type="date"
                  value={targetReportDate}
                  onChange={(e) => setTargetReportDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Lead Assessor */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lead TLI Assessor <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  disabled
                  value={sessionUser.fullName}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-800 font-medium"
                />
              </div>

              {/* Engagement Reference */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Engagement Reference / PO Number
                </label>
                <input
                  type="text"
                  value={engagementRef}
                  onChange={(e) => setEngagementRef(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF]"
                />
              </div>
            </div>

            {/* Assessment Scope */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Assessment Scope Description
              </label>
              <textarea
                rows={2}
                value={assessmentScope}
                onChange={(e) => setAssessmentScope(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF]"
              />
            </div>
          </div>

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
              className="px-6 py-2.5 text-xs font-semibold text-white bg-[#0066FF] hover:bg-[#0052CC] active:bg-[#0047B3] disabled:opacity-60 rounded-lg shadow-sm transition-colors flex items-center space-x-2"
            >
              <span>{isSubmitting ? "Initializing Assessment..." : "Create Assessment & Open Questionnaire"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Column (4 cols): Assigned Customer Coordinators & Documents */}
        <div className="lg:col-span-4 space-y-6">
          {/* Panel 1: Customer Coordinators Assignment */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-[#0066FF]" />
                <h4 className="font-bold text-xs text-slate-900">
                  Assign Customer Coordinators
                </h4>
              </div>
              <Link
                href={`/dashboard/customers/${selectedTenantId}`}
                className="text-[11px] font-semibold text-[#0066FF] hover:underline"
              >
                Manage Team
              </Link>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Selected users receive client coordinator assignment to participate in questionnaire responses and evidence submissions.
            </p>

            {currentTenantUsers.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center space-y-2">
                <p className="text-[11px] text-slate-500">
                  No provisioned users found for this organization yet.
                </p>
                <Link
                  href={`/dashboard/customers/${selectedTenantId}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#0066FF] hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Onboard Customer Users</span>
                </Link>
              </div>
            ) : (
              <div className="space-y-2 pt-1 max-h-60 overflow-y-auto">
                {currentTenantUsers.map((u) => {
                  const isChecked = assignedCoordinatorIds.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
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
                      <div className="text-left leading-tight">
                        <span className="font-semibold text-xs text-slate-800 block">
                          {u.full_name}
                        </span>
                        <span className="text-[10px] text-slate-500 block truncate">
                          {u.email} • {u.role}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Panel 2: Guidance Box */}
          <div className="bg-[#F0F7FF] rounded-xl border border-blue-200/80 p-5 shadow-xs space-y-3">
            <div className="flex items-center space-x-2 text-blue-900 font-bold text-xs">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span>Assessment Next Steps</span>
            </div>

            <ol className="space-y-2 text-xs text-slate-700 list-none pl-0">
              <li className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[11px] flex-shrink-0 mt-0.5">
                  1
                </span>
                <span>Assessment created in DRAFT under PostgreSQL RLS boundary.</span>
              </li>
              <li className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[11px] flex-shrink-0 mt-0.5">
                  2
                </span>
                <span>Client coordinators gain access to the 60 canonical questions.</span>
              </li>
              <li className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[11px] flex-shrink-0 mt-0.5">
                  3
                </span>
                <span>Assessor conducts evaluation, scores gaps, and issues reports.</span>
              </li>
            </ol>
          </div>
        </div>
      </form>
    </div>
  );
}
