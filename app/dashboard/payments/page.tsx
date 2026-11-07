import React from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { isTliRole } from "@/lib/auth/rbac";
import { executeWithRls } from "@/lib/db/rls";
import { listPaymentsForStaff, PAYMENT_STATUS_FILTERS } from "@/lib/payments/queries";
import type { PaymentStatusFilter } from "@/lib/payments/queries";
import { getReportPricePaise } from "@/lib/payments/settings";
import { getRazorpayConfig } from "@/lib/payments/razorpay";
import { assessorEmailAddress } from "@/lib/payments/delivery";
import { ISSUED_STATUSES } from "@/lib/payments/service";
import { PaymentsDashboardClient } from "@/components/payments/PaymentsDashboardClient";
import type { AwaitingPaymentRow } from "@/components/payments/PaymentsDashboardClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Report payments" };

interface PaymentsPageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/login?redirect=/dashboard/payments");
  if (!isTliRole(session.role)) redirect("/dashboard");

  const requested = (await searchParams).status?.toUpperCase();
  const filter: PaymentStatusFilter = PAYMENT_STATUS_FILTERS.includes(requested as PaymentStatusFilter)
    ? (requested as PaymentStatusFilter)
    : "ALL";

  const [payments, pricePaise, awaiting] = await Promise.all([
    listPaymentsForStaff(session, filter),
    getReportPricePaise(),
    executeWithRls(session, async (client) => {
      const res = await client.query<{ id: string; engagement_code: string; title: string; status: string; tenant_name: string; issued_at: string | null }>(
        `SELECT a.id, a.engagement_code, a.title, a.status, t.name AS tenant_name, a.issued_at
         FROM assessments a LEFT JOIN tenants t ON t.id = a.tenant_id
         WHERE a.status IN (${ISSUED_STATUSES.map((_, i) => `$${i + 1}`).join(", ")}) AND a.issued_at IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM report_payments p WHERE p.assessment_id = a.id AND p.status = 'PAID')
         ORDER BY a.issued_at DESC LIMIT 200;`,
        ISSUED_STATUSES
      );
      return res.rows;
    }),
  ]);

  let mode: string | null = null;
  try {
    mode = getRazorpayConfig()?.mode ?? null;
  } catch {
    mode = "misconfigured";
  }

  const awaitingRows: AwaitingPaymentRow[] = awaiting.map((a) => ({
    assessmentId: a.id,
    engagementCode: a.engagement_code,
    title: a.title,
    status: a.status,
    tenantName: a.tenant_name,
    issuedAt: a.issued_at ? new Date(a.issued_at).toISOString() : null,
  }));

  return (
    <PaymentsDashboardClient
      payments={payments}
      awaiting={awaitingRows}
      filter={filter}
      pricePaise={pricePaise}
      mode={mode}
      assessorEmailConfigured={Boolean(assessorEmailAddress())}
      canEditPrice={session.role === "TLI_SUPER_ADMIN"}
      canResend={session.role === "TLI_SUPER_ADMIN" || session.role === "TLI_LEAD_CONSULTANT"}
    />
  );
}
