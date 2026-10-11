"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  MinusCircle,
  Edit2,
  Eye,
  FileDown,
  ArrowLeft,
  ChevronDown,
  Building,
  Check,
} from "lucide-react";

interface AssessmentSummaryViewProps {
  assessmentId: string;
  tenantName: string;
  assessmentCode?: string;
  visitDate?: string;
  onBackToEvidence?: () => void;
  onSubmitValidation?: () => Promise<void>;
}

export function AssessmentSummaryView({
  assessmentId,
  tenantName = "ABC Private Limited",
  assessmentCode = "DPDP-2024-006",
  visitDate = "20 Aug 2024",
  onSubmitValidation,
}: AssessmentSummaryViewProps) {
  const [assessmentStatus, setAssessmentStatus] = useState("Ready for Validation");
  const [comments, setComments] = useState(
    "Overall, basic governance structure is in place. Data inventory needs improvement and security controls are not fully implemented."
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Questions audit rows matching 05_assessment_summary_review_submit.jpeg
  const summaryQuestions = [
    {
      num: 1,
      code: "GOV-01",
      domain: "Governance & Accountability",
      question: "Has the organisation defined and documented a data protection governance structure with clear roles and accountabilities?",
      response: "Implemented",
      responseClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
      evidenceStatus: "Reviewed",
      evidenceClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
      score: 100,
      notes: "Policy and roles documented. Board approval minutes available.",
    },
    {
      num: 2,
      code: "DAT-01",
      domain: "Data Processing",
      question: "Is a personal data inventory maintained for all processing activities?",
      response: "Partially Implemented",
      responseClass: "bg-amber-50 text-amber-800 border-amber-200",
      evidenceStatus: "Received",
      evidenceClass: "bg-blue-50 text-blue-700 border-blue-200",
      score: 50,
      notes: "Inventory exists for key systems. Needs to be extended to all business units.",
    },
    {
      num: 3,
      code: "SEC-01",
      domain: "Security Safeguards",
      question: "Are appropriate security measures implemented to protect personal data?",
      response: "Implemented",
      responseClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
      evidenceStatus: "Reviewed",
      evidenceClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
      score: 100,
      notes: "Access controls, encryption and monitoring in place.",
    },
  ];

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (onSubmitValidation) {
        await onSubmitValidation();
      }
      setSubmitSuccess(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Top Context Bar & 4-Step Stepper */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <nav className="text-xs text-slate-500 font-medium mb-1">
            <Link href="/dashboard/assessments" className="hover:text-blue-600">
              Assessments
            </Link>{" "}
            &gt; <span className="text-slate-800">{tenantName}</span> &gt;{" "}
            <span className="text-slate-800">Summary & Review</span>
          </nav>
          <p className="text-xs font-semibold text-slate-600">
            {tenantName} | Assessment ID: <span className="font-mono text-slate-900">{assessmentCode}</span> | Visit Date: {visitDate}
          </p>
        </div>

        {/* 4-Step Stepper (matching 05_assessment_summary_review_submit.jpeg) */}
        <div className="flex items-center space-x-3 self-start md:self-auto select-none">
          {/* Step 1: Customer Details */}
          <Link href="/dashboard/assessments/new" className="flex items-center space-x-1.5">
            <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px] font-bold">
              ✓
            </div>
            <span className="text-xs font-medium text-slate-600">
              Customer Details
            </span>
          </Link>

          <div className="w-8 h-0.5 bg-emerald-500" />

          {/* Step 2: Questionnaire */}
          <Link
            href={`/dashboard/assessments/${assessmentId}/questionnaire`}
            className="flex items-center space-x-1.5"
          >
            <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px] font-bold">
              ✓
            </div>
            <span className="text-xs font-medium text-slate-600">
              Questionnaire
            </span>
          </Link>

          <div className="w-8 h-0.5 bg-emerald-500" />

          {/* Step 3: Evidence */}
          <Link
            href={`/dashboard/assessments/${assessmentId}/evidence`}
            className="flex items-center space-x-1.5"
          >
            <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px] font-bold">
              ✓
            </div>
            <span className="text-xs font-medium text-slate-600">
              Evidence
            </span>
          </Link>

          <div className="w-8 h-0.5 bg-blue-500" />

          {/* Step 4: Review & Submit (Active) */}
          <div className="flex items-center space-x-1.5">
            <div className="w-5 h-5 rounded-full bg-[#0066FF] text-white flex items-center justify-center text-[11px] font-bold">
              4
            </div>
            <span className="text-xs font-semibold text-[#0066FF]">
              Review & Submit
            </span>
          </div>

          {/* Action CTAs */}
          <Link
            href={`/dashboard/assessments/${assessmentId}/evidence`}
            className="ml-3 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors"
          >
            &larr; Back to Evidence
          </Link>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || submitSuccess}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-[#0066FF] hover:bg-[#0052CC] disabled:bg-emerald-600 rounded-lg shadow-sm transition-colors flex items-center space-x-1"
          >
            <span>{submitSuccess ? "Submitted ✓" : isSubmitting ? "Submitting..." : "Submit for Validation"}</span>
          </button>
        </div>
      </div>

      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Assessment Summary
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Review responses, evidence and preliminary results before submitting for validation.
        </p>
      </div>

      {/* 2. Top 5 Status KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {/* Total Questions */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center space-x-3 mb-1">
            <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <span className="text-2xl font-bold text-slate-900 block leading-tight">
                3
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Total Questions
              </span>
            </div>
          </div>
          <span className="text-[11px] text-blue-600 font-medium block">
            100% completed
          </span>
        </div>

        {/* Implemented */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center space-x-3 mb-1">
            <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-2xl font-bold text-slate-900 block leading-tight">
                2
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Implemented
              </span>
            </div>
          </div>
          <span className="text-[11px] text-emerald-600 font-medium block">
            67%
          </span>
        </div>

        {/* Partially Implemented */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center space-x-3 mb-1">
            <div className="w-9 h-9 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <span className="text-2xl font-bold text-slate-900 block leading-tight">
                1
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Partially Implemented
              </span>
            </div>
          </div>
          <span className="text-[11px] text-amber-600 font-medium block">
            33%
          </span>
        </div>

        {/* Not Implemented */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center space-x-3 mb-1">
            <div className="w-9 h-9 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
              <XCircle className="w-4 h-4" />
            </div>
            <div>
              <span className="text-2xl font-bold text-slate-900 block leading-tight">
                0
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Not Implemented
              </span>
            </div>
          </div>
          <span className="text-[11px] text-rose-600 font-medium block">
            0%
          </span>
        </div>

        {/* Not Applicable */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center space-x-3 mb-1">
            <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center flex-shrink-0">
              <MinusCircle className="w-4 h-4" />
            </div>
            <div>
              <span className="text-2xl font-bold text-slate-900 block leading-tight">
                0
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Not Applicable
              </span>
            </div>
          </div>
          <span className="text-[11px] text-slate-500 font-medium block">
            0%
          </span>
        </div>
      </div>

      {/* 3. Middle Section: Domain Results, Readiness Gauge, Status, & Right Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Area (8 cols): 3 cards in row */}
        <div className="lg:col-span-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Domain-wise Results */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
              <h4 className="font-bold text-xs text-slate-900">
                Domain-wise Results
              </h4>
              <div className="space-y-3">
                {/* Governance */}
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <div className="flex items-center space-x-1.5">
                      <span className="w-7 h-5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold font-mono flex items-center justify-center">
                        GOV
                      </span>
                      <span className="font-medium text-slate-700">Governance & Accountability</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: "100%" }} />
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">1/1 100%</span>
                  </div>
                </div>

                {/* Data Processing */}
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <div className="flex items-center space-x-1.5">
                      <span className="w-7 h-5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold font-mono flex items-center justify-center">
                        DAT
                      </span>
                      <span className="font-medium text-slate-700">Data Processing</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: "50%" }} />
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">1/1 100%</span>
                  </div>
                </div>

                {/* Security */}
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <div className="flex items-center space-x-1.5">
                      <span className="w-7 h-5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold font-mono flex items-center justify-center">
                        SEC
                      </span>
                      <span className="font-medium text-slate-700">Security Safeguards</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: "100%" }} />
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">1/1 100%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Preliminary Readiness Score */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
              <h4 className="font-bold text-xs text-slate-900">
                Preliminary Readiness Score
              </h4>

              <div className="flex flex-col items-center justify-center py-1">
                <div className="relative w-28 h-28 flex items-center justify-center">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="14" fill="transparent" stroke="#F1F5F9" strokeWidth="4.5" />
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      fill="transparent"
                      stroke="#10B981"
                      strokeWidth="4.5"
                      strokeDasharray="58.9 29.1"
                      strokeDashoffset="0"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      fill="transparent"
                      stroke="#F59E0B"
                      strokeWidth="4.5"
                      strokeDasharray="29.1 58.9"
                      strokeDashoffset="-58.9"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-xl font-bold text-slate-900 leading-none">67%</span>
                    <span className="text-[9px] text-slate-500 font-medium mt-0.5">Preliminary Score</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] mt-2 w-full">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-slate-600">Implemented</span>
                    <span className="font-bold ml-auto">2</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-slate-600">Partially</span>
                    <span className="font-bold ml-auto">1</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span className="text-slate-600">Not Impl.</span>
                    <span className="font-bold ml-auto">0</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-300" />
                    <span className="text-slate-600">Not Appl.</span>
                    <span className="font-bold ml-auto">0</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Assessment Status */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
              <h4 className="font-bold text-xs text-slate-900">
                Assessment Status
              </h4>

              <div className="space-y-2.5 text-xs">
                <div>
                  <span className="block text-[11px] text-slate-500 font-medium mb-1">
                    Status
                  </span>
                  <select
                    value={assessmentStatus}
                    onChange={(e) => setAssessmentStatus(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200 rounded-lg focus:outline-none"
                  >
                    <option value="Ready for Validation">Ready for Validation</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Completed / Approved">Completed / Approved</option>
                  </select>
                </div>

                <div>
                  <span className="block text-[11px] text-slate-500 font-medium mb-0.5">
                    Completed On
                  </span>
                  <span className="font-medium text-slate-800 font-mono text-[11px]">
                    20 Aug 2024 04:30 PM
                  </span>
                </div>

                <div>
                  <span className="block text-[11px] text-slate-500 font-medium mb-1">
                    Assessor
                  </span>
                  <div className="flex items-center space-x-2">
                    <div className="w-5 h-5 rounded-full bg-[#0066FF] text-white flex items-center justify-center text-[10px] font-bold">
                      AS
                    </div>
                    <span className="font-semibold text-slate-800 text-xs">
                      Anita Sharma
                    </span>
                  </div>
                </div>

                <div>
                  <span className="block text-[11px] text-slate-500 font-medium mb-1">
                    Co-Assessor (Optional)
                  </span>
                  <select className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white text-slate-600">
                    <option value="">Select co-assessor</option>
                    <option value="Rohit Mehta">Rohit Mehta</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Question-wise Summary Table */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  Question-wise Summary
                </h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Question Code</th>
                    <th className="py-2.5 px-3">Domain</th>
                    <th className="py-2.5 px-3">Question</th>
                    <th className="py-2.5 px-3">Response</th>
                    <th className="py-2.5 px-3">Evidence Status</th>
                    <th className="py-2.5 px-3">Score</th>
                    <th className="py-2.5 px-3">Assessor Notes</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summaryQuestions.map((q) => (
                    <tr key={q.code} className="hover:bg-slate-50/70">
                      <td className="py-3 px-3 text-slate-500 font-mono">{q.num}</td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">
                        {q.code}
                      </td>
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                        {q.domain}
                      </td>
                      <td className="py-3 px-3 text-slate-700 min-w-[200px]">
                        {q.question}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border ${q.responseClass}`}
                        >
                          {q.response}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border ${q.evidenceClass}`}
                        >
                          {q.evidenceStatus}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-800">
                        {q.score}
                      </td>
                      <td className="py-3 px-3 text-slate-600 min-w-[180px]">
                        {q.notes}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button type="button" className="p-1 text-slate-400 hover:text-blue-600">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" className="p-1 text-slate-400 hover:text-blue-600">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Comments & Report Generation Card Row */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-stretch">
            {/* Comments (Optional) (7 cols) */}
            <div className="sm:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-900">
                  Comments (Optional)
                </label>
                <span className="text-[10px] text-slate-400 font-mono">
                  {comments.length} / 1000
                </span>
              </div>
              <textarea
                rows={3}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF]"
              />
            </div>

            {/* Report Generation (5 cols) */}
            <div className="sm:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center space-x-2 text-slate-900 font-bold text-xs mb-1">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Report Generation</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Generate a draft report for internal review. You can edit the report before final submission.
                </p>
              </div>

              <Link
                href={`/dashboard/reports/${assessmentId}`}
                className="w-full inline-flex items-center justify-center space-x-2 px-3 py-2 border border-blue-600 text-blue-600 hover:bg-blue-50 text-xs font-semibold rounded-lg transition-colors shadow-2xs"
              >
                <span className="w-4 h-4 rounded bg-blue-600 text-white flex items-center justify-center font-bold text-[9px]">
                  W
                </span>
                <span>Generate Draft Report (Word)</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Customer Details, Key Observations, Next Steps */}
        <div className="lg:col-span-4 space-y-5">
          {/* Customer & Assessment Metadata Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="font-bold text-xs text-slate-900">
                Customer & Assessment
              </h4>
              <Link
                href="/dashboard/assessments/new"
                className="text-[11px] font-semibold text-[#0066FF] hover:underline flex items-center space-x-1"
              >
                <Edit2 className="w-3 h-3" />
                <span>Edit</span>
              </Link>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Customer Name</span>
                <span className="font-semibold text-slate-900">{tenantName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Assessment ID</span>
                <span className="font-mono font-medium text-slate-800">{assessmentCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Visit Date</span>
                <span className="font-medium text-slate-800">{visitDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Questionnaire Version</span>
                <span className="font-medium text-slate-800">v1.0 (60 Questions)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Industry</span>
                <span className="font-medium text-slate-800">IT / ITES</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Assessment Scope</span>
                <span className="font-medium text-slate-800">India operations</span>
              </div>
            </div>
          </div>

          {/* Key Observations Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="font-bold text-xs text-slate-900">
                Key Observations
              </h4>
              <button
                type="button"
                className="text-[11px] font-semibold text-[#0066FF] hover:underline flex items-center space-x-1"
              >
                <Edit2 className="w-3 h-3" />
                <span>Edit</span>
              </button>
            </div>

            <ul className="list-disc pl-4 space-y-1.5 text-xs text-slate-600 leading-normal">
              <li>Organisation has a documented data protection governance structure.</li>
              <li>Personal data inventory is partially maintained.</li>
              <li>Security controls for personal data are in place.</li>
            </ul>
          </div>

          {/* Next Steps Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h4 className="font-bold text-xs text-slate-900 pb-2 border-b border-slate-100">
              Next Steps
            </h4>

            <ol className="space-y-2.5 text-xs text-slate-700 list-none pl-0">
              <li className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[11px] flex-shrink-0 mt-0.5">
                  1
                </span>
                <span>Submit for assessor validation.</span>
              </li>
              <li className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[11px] flex-shrink-0 mt-0.5">
                  2
                </span>
                <span>Generate draft report (Word).</span>
              </li>
              <li className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[11px] flex-shrink-0 mt-0.5">
                  3
                </span>
                <span>Review and finalise findings.</span>
              </li>
              <li className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[11px] flex-shrink-0 mt-0.5">
                  4
                </span>
                <span>Deliver final report to customer.</span>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

