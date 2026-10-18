"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { AuthShell, Field, FormAlert, authButtonClass, authInputClass } from "@/components/auth/AuthShell";
import { readJsonResponse } from "@/lib/http/responses";

type FieldErrors = Record<string, string[] | undefined>;

export default function RegisterPage() {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    organizationName: "",
    industry: "",
    password: "",
    acceptTerms: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [completedMessage, setCompletedMessage] = useState<string | null>(null);

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: key === "acceptTerms" ? e.target.checked : e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, industry: form.industry || null }),
      });
      const { data, errorMessage } = await readJsonResponse(res);
      if (errorMessage) {
        setError(errorMessage);
        setFieldErrors((data.details as FieldErrors) || {});
      } else {
        setCompletedMessage(
          data.emailDelivered
            ? data.message
            : "Your account was created, but this server could not send the verification email. Please contact the CloudE5 administrator of this installation."
        );
      }
    } catch {
      setError("Unable to reach CloudE5. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const err = (key: string) => fieldErrors[key]?.[0];

  if (completedMessage) {
    return (
      <AuthShell title="Check your email" subtitle={`We sent a verification link to ${form.email}.`}>
        <FormAlert tone="success">{completedMessage}</FormAlert>
        <p className="text-sm text-slate-600">
          The link expires in 24 hours. Didn&apos;t get it? Check your spam folder, or request a new link from the{" "}
          <Link href="/login" className="font-semibold text-[#0066FF] hover:underline">
            sign-in page
          </Link>
          .
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your organisation account"
      subtitle="You'll become the first administrator of your organisation's workspace."
      footer={
        <p>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-[#0066FF] hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      {error && <FormAlert tone="error">{error}</FormAlert>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field id="fullName" label="Your full name" error={err("fullName")}>
          <input id="fullName" autoComplete="name" required minLength={2} value={form.fullName} onChange={update("fullName")} className={authInputClass} />
        </Field>
        <Field id="email" label="Work email" error={err("email")}>
          <input id="email" type="email" autoComplete="email" required value={form.email} onChange={update("email")} className={authInputClass} />
        </Field>
        <Field id="organizationName" label="Organisation name" error={err("organizationName")}>
          <div className="relative">
            <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" aria-hidden="true" />
            <input id="organizationName" autoComplete="organization" required minLength={2} value={form.organizationName} onChange={update("organizationName")} className={`${authInputClass} pl-9`} />
          </div>
        </Field>
        <Field id="industry" label="Industry (optional)" error={err("industry")}>
          <input id="industry" value={form.industry} onChange={update("industry")} placeholder="e.g. Healthcare, Fintech, Retail" className={authInputClass} />
        </Field>
        <Field
          id="password"
          label="Password"
          error={err("password")}
          hint="At least 12 characters, including a letter and a number."
        >
          <input id="password" type="password" autoComplete="new-password" required minLength={12} value={form.password} onChange={update("password")} aria-describedby="password-hint" className={authInputClass} />
        </Field>
        <div>
          <label className="flex items-start gap-2.5 text-xs text-slate-600 leading-relaxed">
            <input type="checkbox" checked={form.acceptTerms} onChange={update("acceptTerms")} required className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0066FF] focus:ring-[#0066FF]" />
            <span>
              I understand that CloudE5 provides self-assessment tooling, that its results are not legal advice, and that my
              organisation is responsible for the information it enters.
            </span>
          </label>
          {err("acceptTerms") && <p className="mt-1 text-xs text-rose-600">{err("acceptTerms")}</p>}
        </div>
        <button type="submit" disabled={isSubmitting} aria-busy={isSubmitting} className={authButtonClass}>
          {isSubmitting ? "Creating account..." : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
