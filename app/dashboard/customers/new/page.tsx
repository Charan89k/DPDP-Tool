import React from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { canCreateCustomer } from "@/lib/auth/rbac";
import { CreateCustomerForm } from "./CreateCustomerForm";

export const dynamic = "force-dynamic";

export default async function NewCustomerPage() {
  const sessionUser = await getCurrentSession();
  if (!sessionUser) {
    redirect("/login?redirect=/dashboard/customers/new");
  }

  // RBAC: Only authorized TLI roles (TLI Super Admin) can onboard new customer organizations
  if (!canCreateCustomer(sessionUser.role)) {
    redirect("/dashboard/customers");
  }

  return (
    <div className="space-y-6">
      <CreateCustomerForm sessionUser={sessionUser} />
    </div>
  );
}

