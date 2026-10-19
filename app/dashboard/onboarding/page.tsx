import React from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { getOrganizationProfile } from "@/lib/organization/profile";
import { OnboardingClient } from "./OnboardingClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set up your workspace" };

export default async function OnboardingPage() {
  const sessionUser = await getCurrentSession();
  if (!sessionUser) redirect("/login?redirect=/dashboard/onboarding");
  if (sessionUser.role !== "CLIENT_ADMIN") redirect("/dashboard");

  const organization = await getOrganizationProfile(sessionUser);
  return <OnboardingClient organization={organization} adminName={sessionUser.fullName} />;
}
