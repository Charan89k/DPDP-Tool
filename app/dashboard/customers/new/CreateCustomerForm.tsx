"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Users,
  ArrowRight,
  AlertCircle,
  User,
} from "lucide-react";
import type { SessionUser } from "@/lib/auth/types";
import type { CreateCustomerInput } from "@/lib/onboarding/types";

interface CreateCustomerFormProps {
  sessionUser: SessionUser;
}

export function CreateCustomerForm(_props: CreateCustomerFormProps) {
  const router = useRouter();

  // Organization fields
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("Healthcare");
  const [isSdf, setIsSdf] = useState(false);
  const [dpoName, setDpoName] = useState("");
  const [dpoEmail, setDpoEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  // Initial user provisioning
  const [provisionUser, setProvisionUser] = useState(true);
  const [userFullName, setUserFullName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync DPO fields to Initial User if checked
  const handleDpoEmailChange = (val: string) => {
    setDpoEmail(val);
    if (provisionUser && !userEmail) {
      setUserEmail(val);
    }
  };

  const handleDpoNameChange = (val: string) => {
    setDpoName(val);
    if (provisionUser && !userFullName) {
      setUserFullName(val);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage("Organisation name is required.");
      return;
    }

    if (provisionUser && (!userFullName.trim() || !userEmail.trim())) {
      setErrorMessage("Please complete the required initial client user details.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: CreateCustomerInput = {
        name: name.trim(),
        industry,
        isSdf,
        dpoName: dpoName.trim() || null,
        dpoEmail: dpoEmail.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
      };

      if (provisionUser) {
        payload.initialUser = {
          fullName: userFullName.trim(),
          email: userEmail.trim(),
          role: "CLIENT_ADMIN",
          password: userPassword || undefined,
        };
      }

      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Failed to create customer organization.");
        setIsSubmitting(false);
        return;
      }

      if (data.customer?.id) {
        router.push(`/dashboard/customers/${data.customer.id}`);
      } else {
        router.push("/dashboard/customers");
      }
    } catch (err) {
      console.error("Failed to onboard customer:", err);
      setErrorMessage("Network error connecting to customer provisioning service.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header & Breadcrumb */}
      <div>
        <nav className="text-xs text-slate-500 font-medium mb-1">
          <Link href="/dashboard/customers" className="hover:text-blue-600">
            Customers
          </Link>{" "}
          &gt; <span className="text-slate-800">New Customer Organization</span>
        </nav>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Onboard Customer Organisation
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Establish tenant boundaries, statutory DPO details, and client administrator credentials.
        </p>
      </div>

      {errorMessage && (
        <div
          className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5"
          role="alert"
        >
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <span className="leading-relaxed font-medium">{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Panel 1: Organisation Details */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100">
            <Building2 className="w-4 h-4 text-[#0066FF]" />
            <h3 className="font-bold text-sm text-slate-900">
              Organisation Profile & Industry Scope
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Organisation / Company Legal Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Apex Health Systems Ltd"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF] focus:ring-1 focus:ring-[#0066FF]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Sector / Industry Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF] bg-white text-slate-800"
              >
                <option value="Healthcare">Healthcare & Pharmaceuticals</option>
                <option value="BFSI">Banking & Financial Services (BFSI)</option>
                <option value="IT / ITES">IT / ITES & Software Platforms</option>
                <option value="Retail">E-Commerce & Consumer Retail</option>
                <option value="Manufacturing">Manufacturing & Supply Chain</option>
                <option value="Telecommunications">Telecommunications & ISP</option>
                <option value="Government">Government & Public Utilities</option>
                <option value="Other">Other Enterprise</option>
              </select>
            </div>
          </div>

          {/* SDF Checkbox */}
          <div className="pt-2">
            <label className="flex items-start space-x-3 p-3 bg-amber-50/60 border border-amber-200/80 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={isSdf}
                onChange={(e) => setIsSdf(e.target.checked)}
                className="mt-0.5 rounded text-[#0066FF] focus:ring-[#0066FF] h-4 w-4"
              />
              <div className="text-xs">
                <span className="font-semibold text-amber-950 block">
                  Designated Significant Data Fiduciary (SDF) under DPDP Act Section 10
                </span>
                <span className="text-[11px] text-amber-800 mt-0.5 block leading-relaxed">
                  Requires appointment of an India-resident DPO, mandatory independent data audits, and Data Protection Impact Assessments (DPIA).
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Panel 2: Statutory DPO & Contact Information */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100">
            <Users className="w-4 h-4 text-[#0066FF]" />
            <h3 className="font-bold text-sm text-slate-900">
              Statutory Contact & DPO Details
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Data Protection Officer (DPO) / Primary Lead Name
              </label>
              <input
                type="text"
                value={dpoName}
                onChange={(e) => handleDpoNameChange(e.target.value)}
                placeholder="e.g. Dr. Ramesh Varma"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                DPO / Statutory Corporate Email
              </label>
              <input
                type="email"
                value={dpoEmail}
                onChange={(e) => handleDpoEmailChange(e.target.value)}
                placeholder="dpo@apexhealth.example.com"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Contact Phone
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Corporate Headquarters / Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Bengaluru, Karnataka, India"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF]"
              />
            </div>
          </div>
        </div>

        {/* Panel 3: Client Administrator Account Provisioning */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2.5">
              <User className="w-4 h-4 text-[#0066FF]" />
              <h3 className="font-bold text-sm text-slate-900">
                Initial Client Administrator Provisioning
              </h3>
            </div>
            <label className="flex items-center space-x-2 text-xs text-slate-600 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={provisionUser}
                onChange={(e) => setProvisionUser(e.target.checked)}
                className="rounded text-[#0066FF] focus:ring-[#0066FF] h-3.5 w-3.5"
              />
              <span>Provision User Account Immediately</span>
            </label>
          </div>

          {provisionUser ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Client Admin Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required={provisionUser}
                    value={userFullName}
                    onChange={(e) => setUserFullName(e.target.value)}
                    placeholder="e.g. Dr. Ramesh Varma"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Client Admin Corporate Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required={provisionUser}
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    placeholder="admin@apexhealth.example.com"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Initial Account Password (optional)
                </label>
                <div className="relative">
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    className="w-full px-3 py-2 font-mono text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF] bg-slate-50/50"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Leave blank (recommended): the user receives a verification email and chooses their own password with &quot;Forgot password&quot;. If you set one, share it securely.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-500">
              Client users can be invited later via single-use invitation tokens from the customer management workspace.
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2">
          <Link
            href="/dashboard/customers"
            className="px-5 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 text-xs font-semibold text-white bg-[#0066FF] hover:bg-[#0052CC] active:bg-[#0047B3] disabled:opacity-60 rounded-lg shadow-sm transition-colors flex items-center space-x-2"
          >
            <span>{isSubmitting ? "Onboarding..." : "Complete Customer Onboarding"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}

