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
} from "lucide-react";
import type { SessionUser } from "@/lib/auth/types";

interface TenantOption {
  id: string;
  name: string;
  slug: string;
  industry?: string;
  is_sdf?: boolean;
}

interface CreateAssessmentFormProps {
  sessionUser: SessionUser;
  tenants: TenantOption[];
  frameworkId?: string | null;
  fallbackAssessmentId?: string | null;
}

export function CreateAssessmentForm({
  sessionUser,
  tenants,
  frameworkId,
  fallbackAssessmentId,
}: CreateAssessmentFormProps) {
  const router = useRouter();

  // Form State initialized to reference UI defaults
  const [customerName, setCustomerName] = useState(
    tenants[0]?.name || "ABC Private Limited"
  );
  const [industry, setIndustry] = useState("IT / ITES");
  const [orgSize, setOrgSize] = useState("500 - 1,000 employees");
  const [email, setEmail] = useState("rohit.mehta@abc.com");
  const [phone, setPhone] = useState("+91 98765 43210");
  const [address, setAddress] = useState("Bengaluru, Karnataka");

  const [assessmentId, setAssessmentId] = useState("DPDP-2024-006");
  const [assessmentType, setAssessmentType] = useState("DPDP Gap Assessment");
  const [status, setStatus] = useState("Draft");
  const [visitDate, setVisitDate] = useState("2024-08-20");
  const [questionnaireVersion, setQuestionnaireVersion] = useState("v1.0 (60 Questions)");
  const [targetReportDate, setTargetReportDate] = useState("2024-08-23");
  const [assessor, setAssessor] = useState(sessionUser.fullName || "Anita Sharma");
  const [coAssessor, setCoAssessor] = useState("");
  const [engagementRef, setEngagementRef] = useState("Customer PO / Internal reference");
  const [assessmentScope, setAssessmentScope] = useState("India operations");

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-generate Assessment ID handler
  const handleAutoGenerateId = () => {
    const year = new Date().getFullYear();
    const randomNum = Math.floor(100 + Math.random() * 900);
    setAssessmentId(`DPDP-${year}-${randomNum}`);
  };

  // Contacts Table State
  const [contacts, setContacts] = useState([
    {
      id: "1",
      name: "Rohit Mehta",
      role: "IT Manager",
      email: "rohit.mehta@abc.com",
      phone: "98765 43210",
    },
    {
      id: "2",
      name: "Priya Nair",
      role: "Compliance Lead",
      email: "priya.nair@abc.com",
      phone: "98765 56789",
    },
  ]);

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
    {
      id: "3",
      fileName: "Client_Profile.docx",
      type: "Word",
      uploadedOn: "12 Aug 2024",
    },
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${customerName} DPDP Gap Assessment`,
          engagementCode: assessmentId,
          targetCompletionDate: targetReportDate,
          tenantId: tenants[0]?.id || sessionUser.tenantId,
        }),
      });

      const data = await res.json();
      if (res.ok && data.assessment?.id) {
        router.push(`/dashboard/assessments/${data.assessment.id}/questionnaire`);
      } else if (fallbackAssessmentId) {
        router.push(`/dashboard/assessments/${fallbackAssessmentId}/questionnaire`);
      } else {
        router.push("/dashboard/questionnaire");
      }
    } catch {
      if (fallbackAssessmentId) {
        router.push(`/dashboard/assessments/${fallbackAssessmentId}/questionnaire`);
      } else {
        router.push("/dashboard/questionnaire");
      }
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
            Enter customer and visit details to start the DPDP gap assessment.
          </p>
        </div>

        {/* 3-Step Stepper (matching 02_create_new_assessment.jpeg) */}
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

          {/* Line 1 -> 2 */}
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

          {/* Line 2 -> 3 */}
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

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Customer Info & Assessment Details */}
        <div className="lg:col-span-8 space-y-6">
          {/* Panel 1: Customer Information */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100">
              <Building2 className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-sm text-slate-900">
                Customer Information
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Customer Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Customer Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                    className="w-full px-3 py-2 pr-8 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF] focus:ring-1 focus:ring-[#0066FF]"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
                </div>
              </div>

              {/* Industry */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Industry <span className="text-rose-500">*</span>
                </label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF] focus:ring-1 focus:ring-[#0066FF] bg-white"
                >
                  <option value="IT / ITES">IT / ITES</option>
                  <option value="BFSI">Banking & Financial Services</option>
                  <option value="Healthcare">Healthcare & Pharmaceuticals</option>
                  <option value="Retail">E-Commerce & Retail</option>
                  <option value="Manufacturing">Manufacturing</option>
                  <option value="Telecommunications">Telecommunications</option>
                </select>
              </div>

              {/* Organisation Size */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Organisation Size <span className="text-rose-500">*</span>
                </label>
                <select
                  value={orgSize}
                  onChange={(e) => setOrgSize(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF] focus:ring-1 focus:ring-[#0066FF] bg-white"
                >
                  <option value="1 - 50 employees">1 - 50 employees</option>
                  <option value="51 - 200 employees">51 - 200 employees</option>
                  <option value="201 - 500 employees">201 - 500 employees</option>
                  <option value="500 - 1,000 employees">500 - 1,000 employees</option>
                  <option value="1,000+ employees">1,000+ employees</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF] focus:ring-1 focus:ring-[#0066FF]"
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
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF] focus:ring-1 focus:ring-[#0066FF]"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF] focus:ring-1 focus:ring-[#0066FF]"
                />
              </div>
            </div>
          </div>

          {/* Panel 2: Assessment Details */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100">
              <ClipboardList className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-sm text-slate-900">
                Assessment Details
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
                    Auto Generate
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
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF] bg-white"
                >
                  <option value="Draft">Draft</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Pending Validation">Pending Validation</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Visit Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Visit Date <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF]"
                  />
                </div>
              </div>

              {/* Questionnaire Version */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Questionnaire Version <span className="text-rose-500">*</span>
                </label>
                <select
                  value={questionnaireVersion}
                  onChange={(e) => setQuestionnaireVersion(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF] bg-white"
                >
                  <option value="v1.0 (60 Questions)">v1.0 (60 Questions)</option>
                </select>
              </div>

              {/* Target Report Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Report Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={targetReportDate}
                    onChange={(e) => setTargetReportDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF]"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Assessor */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assessor <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center space-x-2 border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white">
                  <div className="w-6 h-6 rounded-full bg-[#0066FF] text-white flex items-center justify-center text-[10px] font-bold">
                    AS
                  </div>
                  <select
                    value={assessor}
                    onChange={(e) => setAssessor(e.target.value)}
                    className="w-full text-xs bg-transparent focus:outline-none"
                  >
                    <option value={assessor}>{assessor}</option>
                  </select>
                </div>
              </div>

              {/* Co-Assessor */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Co-Assessor (Optional)
                </label>
                <select
                  value={coAssessor}
                  onChange={(e) => setCoAssessor(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF] bg-white text-slate-600"
                >
                  <option value="">Select co-assessor</option>
                  <option value="Rohit Mehta">Rohit Mehta</option>
                  <option value="Priya Nair">Priya Nair</option>
                </select>
              </div>

              {/* Engagement Reference */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Engagement Reference (Optional)
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
                Assessment Scope
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
              className="px-6 py-2.5 text-xs font-semibold text-white bg-[#0066FF] hover:bg-[#0052CC] rounded-lg shadow-sm transition-colors flex items-center space-x-2"
            >
              <span>{isSubmitting ? "Initialising..." : "Next"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Column (4 cols): Scope Guidance, Customer Contacts, Documents */}
        <div className="lg:col-span-4 space-y-6">
          {/* Panel 1: Assessment Scope & Guidance */}
          <div className="bg-[#F0F7FF] rounded-xl border border-blue-200/80 p-5 shadow-xs space-y-3">
            <div className="flex items-center space-x-2 text-blue-900 font-bold text-xs">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span>What happens next?</span>
            </div>

            <ol className="space-y-2 text-xs text-slate-700 list-none pl-0">
              <li className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[11px] flex-shrink-0 mt-0.5">
                  1
                </span>
                <span>Create the assessment record.</span>
              </li>
              <li className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[11px] flex-shrink-0 mt-0.5">
                  2
                </span>
                <span>Proceed to the 60-question questionnaire.</span>
              </li>
              <li className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[11px] flex-shrink-0 mt-0.5">
                  3
                </span>
                <span>Capture responses, evidence and observations.</span>
              </li>
              <li className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[11px] flex-shrink-0 mt-0.5">
                  4
                </span>
                <span>Review and submit for validation.</span>
              </li>
            </ol>
          </div>

          {/* Panel 2: Customer Contacts (Optional) */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="font-bold text-xs text-slate-900">
                Customer Contacts <span className="font-normal text-slate-400">(Optional)</span>
              </h4>
              <button
                type="button"
                className="text-[11px] font-semibold text-[#0066FF] hover:underline flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Contact</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="text-slate-400 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="pb-1.5">Name</th>
                    <th className="pb-1.5">Role</th>
                    <th className="pb-1.5">Email</th>
                    <th className="pb-1.5">Phone</th>
                    <th className="pb-1.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {contacts.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2 font-medium text-slate-800">{c.name}</td>
                      <td className="py-2 text-slate-500">{c.role}</td>
                      <td className="py-2 text-slate-500">{c.email}</td>
                      <td className="py-2 text-slate-500">{c.phone}</td>
                      <td className="py-2 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button type="button" className="p-0.5 text-blue-600 hover:text-blue-800">
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button type="button" className="p-0.5 text-rose-500 hover:text-rose-700">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Panel 3: Documents (Optional) */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="font-bold text-xs text-slate-900">
                Documents <span className="font-normal text-slate-400">(Optional)</span>
              </h4>
              <button
                type="button"
                className="text-[11px] font-semibold text-[#0066FF] hover:underline flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Upload Document</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="text-slate-400 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="pb-1.5">File Name</th>
                    <th className="pb-1.5">Type</th>
                    <th className="pb-1.5">Uploaded On</th>
                    <th className="pb-1.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {documents.map((d) => (
                    <tr key={d.id}>
                      <td className="py-2 font-medium text-slate-800">{d.fileName}</td>
                      <td className="py-2 text-slate-500">{d.type}</td>
                      <td className="py-2 text-slate-500">{d.uploadedOn}</td>
                      <td className="py-2 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button type="button" className="p-0.5 text-blue-600 hover:text-blue-800">
                            <Download className="w-3 h-3" />
                          </button>
                          <button type="button" className="p-0.5 text-rose-500 hover:text-rose-700">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

