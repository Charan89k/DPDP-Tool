import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { isClientRole } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

/** Customer users manage their team on their organisation's page. */
export default async function TeamPage() {
  const sessionUser = await getCurrentSession();
  if (!sessionUser) redirect("/login?redirect=/dashboard/team");
  redirect(isClientRole(sessionUser.role) ? `/dashboard/customers/${sessionUser.tenantId}` : "/dashboard/customers");
}
