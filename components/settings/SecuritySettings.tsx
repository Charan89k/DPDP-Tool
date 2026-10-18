"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { readJsonResponse } from "@/lib/http/responses";

const inputClass =
  "w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent";
const primaryButton =
  "px-4 py-2 text-sm font-semibold text-white bg-[#0066FF] hover:bg-[#0052CC] disabled:opacity-60 rounded-lg";
const secondaryButton =
  "px-4 py-2 text-sm font-semibold text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:opacity-60 rounded-lg";

interface Props {
  mfaEnabled: boolean;
  recoveryCodesRemaining: number;
}

type Setup = { qrCodeDataUrl: string; manualEntryKey: string };

export function SecuritySettings({ mfaEnabled: initialEnabled, recoveryCodesRemaining }: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const call = async (url: string, body?: unknown) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = await readJsonResponse(res);
      if (result.errorMessage) setMessage({ tone: "error", text: result.errorMessage });
      return result;
    } catch {
      setMessage({ tone: "error", text: "Unable to reach CloudE5. Please try again." });
      return { data: {}, errorMessage: "network" };
    } finally {
      setBusy(false);
    }
  };

  const startSetup = async () => {
    const { data, errorMessage } = await call("/api/auth/mfa/setup");
    if (!errorMessage) setSetup({ qrCodeDataUrl: data.qrCodeDataUrl, manualEntryKey: data.manualEntryKey });
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, errorMessage } = await call("/api/auth/mfa/enable", { code });
    if (!errorMessage) {
      setRecoveryCodes(data.recoveryCodes);
      setEnabled(true);
      setSetup(null);
      setCode("");
    }
  };

  const disable = async (e: React.FormEvent) => {
    e.preventDefault();
    const { errorMessage } = await call("/api/auth/mfa/disable", { password, code });
    if (!errorMessage) {
      setEnabled(false);
      setPassword("");
      setCode("");
      setMessage({ tone: "success", text: "Two-factor authentication is turned off." });
    }
  };

  const signOutEverywhere = async () => {
    const { errorMessage } = await call("/api/auth/logout-all");
    if (!errorMessage) router.push("/login?notice=signed-out");
  };

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5" aria-labelledby="security-heading">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-[#0066FF]" aria-hidden="true" />
        <h2 id="security-heading" className="text-base font-bold text-slate-900">Sign-in security</h2>
      </div>

      {message && (
        <div
          role={message.tone === "error" ? "alert" : "status"}
          className={`p-3 rounded-lg border text-sm ${
            message.tone === "error" ? "bg-rose-50 border-rose-200 text-rose-800" : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-slate-500" aria-hidden="true" />
              Two-factor authentication
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              {enabled
                ? `On. Sign-in requires a code from your authenticator app. ${recoveryCodes ? "" : `${recoveryCodesRemaining} recovery codes remaining.`}`
                : "Off. Add a code from an authenticator app (such as Google Authenticator, Microsoft Authenticator or 1Password) to every sign-in."}
            </p>
          </div>
          {!enabled && !setup && (
            <button type="button" onClick={startSetup} disabled={busy} className={primaryButton}>
              Set up two-factor
            </button>
          )}
        </div>

        {setup && (
          <form onSubmit={confirm} className="grid sm:grid-cols-[auto,1fr] gap-5 items-start p-4 rounded-lg border border-slate-200 bg-slate-50">
            {/* eslint-disable-next-line @next/next/no-img-element -- server-generated data URL */}
            <img src={setup.qrCodeDataUrl} alt="QR code to add CloudE5 to your authenticator app" width={180} height={180} className="rounded bg-white p-2 border border-slate-200" />
            <div className="space-y-3">
              <p className="text-sm text-slate-700">
                1. Scan the QR code with your authenticator app, or enter this key manually:
              </p>
              <code className="block text-sm font-mono bg-white border border-slate-200 rounded px-3 py-2 break-all select-all">
                {setup.manualEntryKey}
              </code>
              <label htmlFor="mfa-code" className="block text-sm text-slate-700">
                2. Enter the 6-digit code it shows:
              </label>
              <input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className={`${inputClass} max-w-[10rem] font-mono tracking-widest`} />
              <div className="flex gap-2">
                <button type="submit" disabled={busy || code.length !== 6} className={primaryButton}>
                  Turn on
                </button>
                <button type="button" onClick={() => setSetup(null)} className={secondaryButton}>
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}

        {recoveryCodes && (
          <div className="p-4 rounded-lg border border-amber-300 bg-amber-50 space-y-2" role="status">
            <p className="text-sm font-semibold text-amber-900">Save your recovery codes now</p>
            <p className="text-sm text-amber-900">
              Each code works once if you lose your authenticator. They will not be shown again.
            </p>
            <ul className="grid grid-cols-2 gap-1 font-mono text-sm text-slate-900 select-all">
              {recoveryCodes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        {enabled && !recoveryCodes && (
          <form onSubmit={disable} className="grid sm:grid-cols-3 gap-3 items-end p-4 rounded-lg border border-slate-200">
            <div>
              <label htmlFor="disable-password" className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <input id="disable-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="disable-code" className="block text-xs font-semibold text-slate-700 mb-1">Code or recovery code</label>
              <input id="disable-code" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} className={inputClass} />
            </div>
            <button type="submit" disabled={busy} className={secondaryButton}>
              Turn off two-factor
            </button>
          </form>
        )}
      </div>

      <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Sign out everywhere</h3>
          <p className="text-sm text-slate-600 mt-1">Ends your sessions on every device, including this one.</p>
        </div>
        <button type="button" onClick={signOutEverywhere} disabled={busy} className={`${secondaryButton} inline-flex items-center gap-2`}>
          <LogOut className="w-4 h-4" aria-hidden="true" /> Sign out everywhere
        </button>
      </div>
    </section>
  );
}
