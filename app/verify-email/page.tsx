"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthShell, FormAlert } from "@/components/auth/AuthShell";
import { readJsonResponse } from "@/lib/http/responses";

function VerifyEmail() {
  const token = useSearchParams().get("token") || "";
  const [state, setState] = useState<{ status: "working" | "done" | "failed"; message: string }>({
    status: "working",
    message: "Verifying your email address...",
  });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!token) {
      setState({ status: "failed", message: "This verification link is incomplete. Open the link from your email again." });
      return;
    }
    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(readJsonResponse)
      .then(({ data, errorMessage }) =>
        setState(errorMessage ? { status: "failed", message: errorMessage } : { status: "done", message: data.message })
      )
      .catch(() => setState({ status: "failed", message: "Unable to reach CloudE5. Please try again." }));
  }, [token]);

  return (
    <AuthShell title="Email verification">
      <FormAlert tone={state.status === "failed" ? "error" : state.status === "done" ? "success" : "info"}>
        {state.message}
      </FormAlert>
      {state.status !== "working" && (
        <Link href={state.status === "done" ? "/login?notice=verified" : "/login"} className="font-semibold text-sm text-[#0066FF] hover:underline">
          Continue to sign in
        </Link>
      )}
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F4F7FB]" />}>
      <VerifyEmail />
    </Suspense>
  );
}
