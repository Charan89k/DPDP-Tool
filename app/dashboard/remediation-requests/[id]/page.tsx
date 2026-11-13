import React from "react";
import { notFound, redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { getRemediationRequest, RemediationRequestError } from "@/lib/remediation-requests/service";
import { RequestDetailClient } from "@/components/remediation-requests/RequestDetailClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Remediation request" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RemediationRequestPage({ params }: Props) {
  const session = await getCurrentSession();
  const { id } = await params;
  if (!session) redirect(`/login?redirect=/dashboard/remediation-requests/${id}`);
  let detail;
  try {
    detail = await getRemediationRequest(session, id);
  } catch (err) {
    if (err instanceof RemediationRequestError && err.status === 404) notFound();
    throw err;
  }
  return (
    <RequestDetailClient
      detail={detail}
      canWrite={["CLIENT_ADMIN", "CLIENT_BU_LEAD", "CLIENT_CONTRIBUTOR"].includes(session.role)}
      isClientAdmin={session.role === "CLIENT_ADMIN"}
      isAuthor={session.role === "TLI_SUPER_ADMIN" || session.role === "TLI_LEAD_CONSULTANT"}
    />
  );
}
