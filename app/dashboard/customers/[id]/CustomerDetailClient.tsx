"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Users,
  ShieldCheck,
  Plus,
  Mail,
  User,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  ArrowRight,
  FileCheck2,
  Calendar,
  Lock,
  Clock,
  ShieldAlert,
} from "lucide-react";
import type { SessionUser } from "@/lib/auth/types";
import { getRoleBadgeLabel, canManageTenantUsers } from "@/lib/auth/rbac";

interface CustomerRecord {
  id: string;
  name: string;
  slug: string;
  industry: string;
  is_sdf: boolean;
  dpo_name?: string | null;
  dpo_email?: string | null;
  status: string;
  created_at: string;
}

interface UserRecord {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  last_login_at?: string | null;
  created_at: string;
}

interface InvitationRecord {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  expires_at: string;
  accepted_at?: string | null;
  created_at: string;
}

interface AssessmentRecord {
  id: string;
  engagement_code: string;
  title: string;
  status: string;
  target_completion_date?: string | null;
  created_at: string;
  lead_consultant_name?: string | null;
}

interface CustomerDetailClientProps {
  sessionUser: SessionUser;
  customer: CustomerRecord;
  users: UserRecord[];
  invitations: InvitationRecord[];
  assessments: AssessmentRecord[];
}

export function CustomerDetailClient({
  sessionUser,
  customer,
  users: initialUsers,
  invitations: initialInvitations,
  assessments,
}: CustomerDetailClientProps) {
  const router = useRouter();
  const [users, setUsers] = useState<UserRecord[]>(initialUsers);
  const [invitations, setInvitations] = useState<InvitationRecord[]>(initialInvitations);
  const [activeTab, setActiveTab] = useState<"users" | "invitations" | "assessments">("users");

  // Modal / Form state
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [provisionMode, setProvisionMode] = useState<"direct" | "invite">("direct");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("CLIENT_ADMIN");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [generatedActivationUrl, setGeneratedActivationUrl] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const canManage = canManageTenantUsers(sessionUser.role);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setGeneratedActivationUrl(null);

    if (!fullName.trim() || !email.trim()) {
      setFormError("Full name and corporate email are required.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (provisionMode === "direct") {
        // Direct provisioning
        const res = await fetch(`/api/customers/${customer.id}/users`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: fullName.trim(),
            email: email.trim(),
            role,
            password: password || undefined,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setFormError(data.error || "Failed to provision user.");
          setIsSubmitting(false);
          return;
        }

        setUsers([...users, data.user]);
        setShowAddUserModal(false);
        resetForm();
      } else {
        // Invitation flow
        const res = await fetch(`/api/customers/${customer.id}/invitations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: fullName.trim(),
            email: email.trim(),
            role,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setFormError(data.error || "Failed to generate invitation.");
          setIsSubmitting(false);
          return;
        }

        setInvitations([data.invitation, ...invitations]);
        setGeneratedActivationUrl(data.activationUrl);
        setActiveTab("invitations");
      }
    } catch (err: any) {
      console.error("User management error:", err);
      setFormError("Network error contacting server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFullName("");
    setEmail("");
    setRole("CLIENT_ADMIN");
    setPassword("");
    setFormError(null);
    setGeneratedActivationUrl(null);
  };

  const copyToClipboard = (text: string) => {
    const fullUrl = `${window.location.origin}${text}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <nav className="text-xs text-slate-500 font-medium mb-1">
            <Link href="/dashboard/customers" className="hover:text-blue-600">
              Customers
            </Link>{" "}
            &gt; <span className="text-slate-800">{customer.name}</span>
          </nav>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {customer.name}
            </h1>
            {customer.is_sdf && (
              <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded border border-amber-200">
                Significant Data Fiduciary
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Industry: <strong className="text-slate-700">{customer.industry}</strong> • Created:{" "}
            <span className="text-slate-700">
              {new Date(customer.created_at).toLocaleDateString()}
            </span>
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {canManage && (
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowAddUserModal(true);
              }}
              className="inline-flex items-center px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors"
            >
              <Plus className="w-4 h-4 mr-1.5 text-slate-500" />
              <span>Add / Invite User</span>
            </button>
          )}

          <Link
            href={`/dashboard/assessments/new?tenantId=${customer.id}`}
            className="inline-flex items-center px-4 py-2 bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            <span>New Assessment</span>
          </Link>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="text-slate-400 text-[11px] uppercase font-bold tracking-wider mb-1">
            Data Protection Officer
          </div>
          <div className="font-semibold text-sm text-slate-900">
            {customer.dpo_name || "Designated Lead"}
          </div>
          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 truncate">
            <Mail className="w-3.5 h-3.5 text-slate-400" />
            <span>{customer.dpo_email || "Not specified"}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="text-slate-400 text-[11px] uppercase font-bold tracking-wider mb-1">
            Team & Membership
          </div>
          <div className="font-semibold text-sm text-slate-900">
            {users.length} Provisioned User{users.length === 1 ? "" : "s"}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {invitations.filter((i) => i.status === "PENDING").length} Pending Invitation(s)
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="text-slate-400 text-[11px] uppercase font-bold tracking-wider mb-1">
            Compliance Engagements
          </div>
          <div className="font-semibold text-sm text-slate-900">
            {assessments.length} Assessment{assessments.length === 1 ? "" : "s"}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            India DPDP Act, 2023 60-Question Framework
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200">
        <div className="flex space-x-6">
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`pb-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === "users"
                ? "border-[#0066FF] text-[#0066FF]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Provisioned Users ({users.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("invitations")}
            className={`pb-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === "invitations"
                ? "border-[#0066FF] text-[#0066FF]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Invitations & Activation ({invitations.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("assessments")}
            className={`pb-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === "assessments"
                ? "border-[#0066FF] text-[#0066FF]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Assessments ({assessments.length})
          </button>
        </div>
      </div>

      {/* TAB 1: Provisioned Users */}
      {activeTab === "users" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          {users.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No users provisioned for this customer yet. Use "Add / Invite User" to add team members.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Last Login</th>
                    <th className="py-3 px-4">Member Since</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => {
                    const badge = getRoleBadgeLabel(u.role as any);
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{u.full_name}</div>
                          <div className="text-[11px] text-slate-500">{u.email}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Active
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {u.last_login_at
                            ? new Date(u.last_login_at).toLocaleString()
                            : "Never logged in"}
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Invitations & Activation */}
      {activeTab === "invitations" && (
        <div className="space-y-4">
          <div className="p-4 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-start gap-3">
            <Clock className="w-5 h-5 text-[#0066FF] flex-shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-semibold text-blue-950 block">
                Single-Use Invitation Token Lifecycle
              </span>
              <span className="text-[11px] text-blue-800 mt-0.5 block leading-relaxed">
                Tokens are single-use, 7-day expiring, and stored as SHA-256 hashes. Because external SMTP delivery is not configured in this environment, copy the activation links directly to simulate recipient account onboarding.
              </span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            {invitations.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No active invitations. Use "Add / Invite User" to issue a new single-use activation invitation.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Invited Recipient</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Expires</th>
                      <th className="py-3 px-4">Issued On</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invitations.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{inv.full_name}</div>
                          <div className="text-[11px] text-slate-500">{inv.email}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {inv.role}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {inv.status === "PENDING" && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              Pending Activation
                            </span>
                          )}
                          {inv.status === "ACCEPTED" && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              Accepted & Active
                            </span>
                          )}
                          {inv.status === "EXPIRED" && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                              Expired
                            </span>
                          )}
                          {inv.status === "REVOKED" && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              Revoked
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {new Date(inv.expires_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {new Date(inv.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Assessments */}
      {activeTab === "assessments" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          {assessments.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 space-y-3">
              <p>No assessments configured for this customer yet.</p>
              <Link
                href={`/dashboard/assessments/new?tenantId=${customer.id}`}
                className="inline-flex items-center px-4 py-2 bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-semibold rounded-lg"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                <span>Create Assessment for {customer.name}</span>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Engagement Code</th>
                    <th className="py-3 px-4">Title</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Lead Consultant</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assessments.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                        {a.engagement_code}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">{a.title}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          {a.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{a.lead_consultant_name || "Assigned Lead"}</td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/dashboard/assessments/${a.id}/questionnaire`}
                          className="inline-flex items-center space-x-1 text-xs font-semibold text-[#0066FF] hover:underline"
                        >
                          <span>Open Assessment</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: Add / Invite User */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-base text-slate-900">
                Add Team Member — {customer.name}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddUserModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                &times;
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {generatedActivationUrl ? (
              <div className="space-y-4">
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Invitation Token Generated Successfully</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-emerald-700">
                    Email delivery is unconfigured in this environment. Copy the link below to evaluate the activation flow:
                  </p>
                  <div className="p-2 bg-white rounded border border-emerald-300 font-mono text-[11px] text-slate-800 break-all select-all">
                    {typeof window !== "undefined" ? window.location.origin : ""}{generatedActivationUrl}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(generatedActivationUrl)}
                    className="px-4 py-2 bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedLink ? "Copied!" : "Copy Activation Link"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddUserModal(false);
                      resetForm();
                    }}
                    className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAddUser} className="space-y-4">
                {/* Mode Selector */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg text-xs font-medium text-slate-600">
                  <button
                    type="button"
                    onClick={() => setProvisionMode("direct")}
                    className={`py-1.5 rounded-md text-center transition-all ${
                      provisionMode === "direct"
                        ? "bg-white text-slate-900 shadow-xs font-semibold"
                        : "hover:text-slate-900"
                    }`}
                  >
                    Direct Provisioning (Credentials)
                  </button>
                  <button
                    type="button"
                    onClick={() => setProvisionMode("invite")}
                    className={`py-1.5 rounded-md text-center transition-all ${
                      provisionMode === "invite"
                        ? "bg-white text-slate-900 shadow-xs font-semibold"
                        : "hover:text-slate-900"
                    }`}
                  >
                    Invitation Token (Activation)
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Priya Nair"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Corporate Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@customer.com"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Client Role <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF] bg-white"
                  >
                    <option value="CLIENT_ADMIN">Client Admin (DPO / Governance Lead)</option>
                    <option value="CLIENT_BU_LEAD">Client BU Lead (Department Head)</option>
                    <option value="CLIENT_CONTRIBUTOR">Client Contributor (Response Owner)</option>
                    <option value="CLIENT_VIEWER">Client Viewer (Read-Only Executive)</option>
                  </select>
                </div>

                {provisionMode === "direct" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Initial Password
                    </label>
                    <input
                      type="text"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 font-mono text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF] bg-slate-50/50"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Pre-filled with test credential for local demonstration.
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddUserModal(false)}
                    className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
                  >
                    <span>
                      {isSubmitting
                        ? "Processing..."
                        : provisionMode === "direct"
                        ? "Provision User"
                        : "Generate Invitation"}
                    </span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

