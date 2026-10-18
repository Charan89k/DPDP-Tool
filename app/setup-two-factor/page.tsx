import React from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { getMfaStatus, isMfaSetupRequired } from "@/lib/auth/mfa";
import { SecuritySettings } from "@/components/settings/SecuritySettings";

export const dynamic = "force-dynamic";

/** Where members land when their organisation requires two-factor and they have not enrolled. */
export default async function SetupTwoFactorPage() {
  const sessionUser = await getCurrentSession();
  if (!sessionUser) {
    redirect("/login?redirect=/dashboard");
  }
  if (!(await isMfaSetupRequired(sessionUser))) {
    redirect("/dashboard");
  }
  const mfa = await getMfaStatus(sessionUser);

  return (
    <main className="min-h-screen bg-[#F4F7FB] px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Set up two-factor authentication</h1>
          <p className="text-sm text-slate-600 mt-1">
            Your organisation requires a code from an authenticator app at every sign-in. Set it up to continue.
          </p>
        </div>
        <SecuritySettings
          mfaEnabled={mfa.enabled}
          recoveryCodesRemaining={mfa.recoveryCodesRemaining}
          organizationRequiresMfa
          continueHref="/dashboard"
        />
      </div>
    </main>
  );
}
