"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AuthShell, Field, FormAlert, authButtonClass, authInputClass } from "@/components/auth/AuthShell";
import { readJsonResponse } from "@/lib/http/responses";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const { data, errorMessage } = await readJsonResponse(res);
      setResult(errorMessage ? { tone: "error", message: errorMessage } : { tone: "success", message: data.message });
    } catch {
      setResult({ tone: "error", message: "Unable to reach CloudE5. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your account email and we'll send you a reset link."
      footer={
        <Link href="/login" className="font-semibold text-[#0066FF] hover:underline">
          Back to sign in
        </Link>
      }
    >
      {result && <FormAlert tone={result.tone}>{result.message}</FormAlert>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field id="email" label="Work email">
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={authInputClass} />
        </Field>
        <button type="submit" disabled={isSubmitting} aria-busy={isSubmitting} className={authButtonClass}>
          {isSubmitting ? "Sending..." : "Send reset link"}
        </button>
      </form>
    </AuthShell>
  );
}
