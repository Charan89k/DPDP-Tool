"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell, Field, FormAlert, authButtonClass, authInputClass } from "@/components/auth/AuthShell";
import { readJsonResponse } from "@/lib/http/responses";

function ResetPassword() {
  const router = useRouter();
  const token = useSearchParams().get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : "This reset link is incomplete. Request a new one.");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const { errorMessage } = await readJsonResponse(res);
      if (errorMessage) {
        setError(errorMessage);
        setIsSubmitting(false);
        return;
      }
      router.push("/login?notice=password-reset");
    } catch {
      setError("Unable to reach CloudE5. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Signing in again will be required on every device."
      footer={
        <Link href="/forgot-password" className="font-semibold text-[#0066FF] hover:underline">
          Request a new reset link
        </Link>
      }
    >
      {error && <FormAlert tone="error">{error}</FormAlert>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field id="password" label="New password" hint="At least 12 characters, including a letter and a number.">
          <input id="password" type="password" autoComplete="new-password" required minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby="password-hint" className={authInputClass} />
        </Field>
        <Field id="confirm" label="Confirm new password">
          <input id="confirm" type="password" autoComplete="new-password" required minLength={12} value={confirm} onChange={(e) => setConfirm(e.target.value)} className={authInputClass} />
        </Field>
        <button type="submit" disabled={isSubmitting || !token} aria-busy={isSubmitting} className={authButtonClass}>
          {isSubmitting ? "Saving..." : "Save new password"}
        </button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F4F7FB]" />}>
      <ResetPassword />
    </Suspense>
  );
}
