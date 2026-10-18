"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { AuthShell, Field, FormAlert, authButtonClass, authInputClass } from "@/components/auth/AuthShell";
import { getSafeRedirectUrl } from "@/lib/auth/redirects";
import { readJsonResponse } from "@/lib/http/responses";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get("redirect") || "/dashboard";
  const notice = searchParams.get("notice");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaCode, setMfaCode] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setNeedsVerification(false);
    setResendMessage(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const { data, errorMessage: error } = await readJsonResponse(res);
      if (error) {
        setErrorMessage(error);
        setNeedsVerification(data.code === "EMAIL_NOT_VERIFIED");
        setIsLoading(false);
        return;
      }
      if (data.mfaRequired) {
        setMfaStep(true);
        setIsLoading(false);
        return;
      }
      router.push(getSafeRedirectUrl(redirectTarget));
      router.refresh();
    } catch {
      setErrorMessage("Unable to reach CloudE5. Check your connection and try again.");
      setIsLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: mfaCode.trim() }),
      });
      const { data, errorMessage: error } = await readJsonResponse(res);
      if (error) {
        setErrorMessage(error);
        if (data.code === "CHALLENGE_EXPIRED") {
          setMfaStep(false);
          setPassword("");
        }
        setIsLoading(false);
        return;
      }
      router.push(getSafeRedirectUrl(redirectTarget));
      router.refresh();
    } catch {
      setErrorMessage("Unable to reach CloudE5. Check your connection and try again.");
      setIsLoading(false);
    }
  };

  if (mfaStep) {
    return (
      <AuthShell title="Two-factor verification" subtitle="Enter the 6-digit code from your authenticator app.">
        {errorMessage && <FormAlert tone="error">{errorMessage}</FormAlert>}
        <form onSubmit={handleMfaSubmit} className="space-y-4">
          <Field id="mfa-code" label="Authentication code" hint="Lost your device? Enter one of your recovery codes instead.">
            <input
              id="mfa-code"
              autoComplete="one-time-code"
              autoFocus
              required
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              aria-describedby="mfa-code-hint"
              className={`${authInputClass} font-mono tracking-widest`}
            />
          </Field>
          <button type="submit" disabled={isLoading} aria-busy={isLoading} className={authButtonClass}>
            {isLoading ? "Verifying..." : "Verify and sign in"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMfaStep(false);
              setMfaCode("");
              setPassword("");
            }}
            className="w-full text-sm font-semibold text-slate-600 hover:underline"
          >
            Use a different account
          </button>
        </form>
      </AuthShell>
    );
  }

  const resendVerification = async () => {
    setResendMessage(null);
    const res = await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    const { data, errorMessage: error } = await readJsonResponse<{ message: string }>(res);
    setResendMessage(error || data.message || null);
  };

  return (
    <AuthShell
      title="Sign in"
      subtitle="Access your organisation's CloudE5 workspace."
      footer={
        <p>
          New to CloudE5?{" "}
          <Link href="/register" className="font-semibold text-[#0066FF] hover:underline">
            Create an organisation account
          </Link>
        </p>
      }
    >
      {notice === "verified" && <FormAlert tone="success">Your email is verified. Sign in to continue.</FormAlert>}
      {notice === "password-reset" && <FormAlert tone="success">Your password was changed. Sign in with your new password.</FormAlert>}
      {notice === "signed-out" && <FormAlert tone="info">You have been signed out.</FormAlert>}
      {errorMessage && (
        <FormAlert tone="error">
          {errorMessage}
          {needsVerification && (
            <button
              type="button"
              onClick={resendVerification}
              className="block mt-2 font-semibold underline underline-offset-2"
            >
              Resend verification email
            </button>
          )}
        </FormAlert>
      )}
      {resendMessage && <FormAlert tone="info">{resendMessage}</FormAlert>}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
        <Field id="email" label="Work email">
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            className={authInputClass}
          />
        </Field>
        <Field id="password" label="Password">
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className={`${authInputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2.5 top-2 p-1 rounded text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF]"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </Field>
        <div className="flex justify-end -mt-1">
          <Link href="/forgot-password" className="text-xs font-semibold text-[#0066FF] hover:underline">
            Forgot password?
          </Link>
        </div>
        <button type="submit" disabled={isLoading} aria-busy={isLoading} className={authButtonClass}>
          <LogIn className="w-4 h-4" aria-hidden="true" />
          {isLoading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F4F7FB]" />}>
      <LoginForm />
    </Suspense>
  );
}
