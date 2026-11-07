import React from "react";
import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";

type Variant = NonNullable<BadgeProps["variant"]>;

const PAYMENT: Record<string, { label: string; variant: Variant }> = {
  PENDING: { label: "Pending", variant: "amber" },
  PAID: { label: "Paid", variant: "emerald" },
  FAILED: { label: "Failed", variant: "rose" },
  REFUNDED: { label: "Refunded", variant: "slate" },
};

// "Sent" means the mail server accepted the message, not that it reached the inbox.
const DELIVERY: Record<string, { label: string; variant: Variant }> = {
  QUEUED: { label: "Queued", variant: "slate" },
  SENDING: { label: "Sending", variant: "blue" },
  SENT: { label: "Sent", variant: "emerald" },
  FAILED: { label: "Failed", variant: "rose" },
};

export function PaymentStatusBadge({ status }: { status: string }) {
  const s = PAYMENT[status] ?? { label: status, variant: "slate" as Variant };
  return <Badge variant={s.variant} size="sm">{s.label}</Badge>;
}

export function DeliveryStatusBadge({ status, attempts }: { status: string; attempts?: number }) {
  const s = DELIVERY[status] ?? { label: status, variant: "slate" as Variant };
  const retried = attempts !== undefined && attempts > 1;
  return (
    <Badge variant={s.variant} size="sm" title={status === "SENT" ? "Accepted by the mail server" : undefined}>
      {s.label}
      {retried ? ` (attempt ${attempts})` : ""}
    </Badge>
  );
}
