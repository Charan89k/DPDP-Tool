import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { executeWithRls } from "@/lib/db/rls";
import { canCreateCustomer } from "@/lib/auth/rbac";
import {
  Users,
  Building2,
  Plus,
  Search,
  Mail,
  ArrowRight,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const sessionUser = await getCurrentSession();
  if (!sessionUser) {
    redirect("/login?redirect=/dashboard/customers");
  }

  // Fetch tenants under RLS
  const tenants = await executeWithRls(sessionUser, async (client) => {
    const res = await client.query(`
      SELECT 
        t.id, 
        t.name, 
        t.slug, 
        t.industry, 
        t.is_sdf, 
        t.dpo_name, 
        t.dpo_email, 
        t.created_at,
        (SELECT COUNT(*) FROM assessments a WHERE a.tenant_id = t.id)::int AS assessment_count,
        (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id)::int AS user_count
      FROM tenants t
      WHERE t.type = 'CLIENT'
      ORDER BY t.name ASC;
    `);
    return res.rows;
  });

  const canAddCustomer = canCreateCustomer(sessionUser.role);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Customers
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage data fiduciary client accounts, provision team users, and configure DPDP assessments.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {canAddCustomer && (
            <Link
              href="/dashboard/customers/new"
              className="inline-flex items-center px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors"
            >
              <Plus className="w-4 h-4 mr-1.5 text-slate-500" />
              <span>New Customer</span>
            </Link>
          )}

          <Link
            href="/dashboard/assessments/new"
            className="inline-flex items-center px-4 py-2 bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            <span>New Assessment</span>
          </Link>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search customers by name, industry, or contact..."
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0066FF]"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing <span className="font-semibold text-slate-800">{tenants.length}</span> Data Fiduciaries
        </div>
      </div>

      {/* Customer Grid */}
      {tenants.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-xs text-slate-500 shadow-xs">
          <p>No customer records accessible under current scope.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {tenants.map((tenant) => (
          <div
            key={tenant.id}
            className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <Link
                      href={`/dashboard/customers/${tenant.id}`}
                      className="font-bold text-sm text-slate-900 hover:text-[#0066FF] leading-tight transition-colors block"
                    >
                      {tenant.name}
                    </Link>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {tenant.industry || "Enterprise"}
                    </p>
                  </div>
                </div>

                {tenant.is_sdf && (
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex-shrink-0">
                    SDF
                  </span>
                )}
              </div>

              {/* DPO & Contact details */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs text-slate-600">
                <div className="flex items-center space-x-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate">{tenant.dpo_email || "compliance@client.com"}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate">
                    {tenant.user_count || 0} User{(tenant.user_count === 1) ? "" : "s"} • DPO: {tenant.dpo_name || "Designated Lead"}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
              <Link
                href={`/dashboard/customers/${tenant.id}`}
                className="text-[11px] font-medium text-slate-600 hover:text-[#0066FF] transition-colors"
              >
                {tenant.assessment_count} Assessment{tenant.assessment_count === 1 ? "" : "s"} &bull; Manage
              </Link>

              <Link
                href={`/dashboard/assessments/new?tenantId=${tenant.id}`}
                className="inline-flex items-center space-x-1 text-xs font-semibold text-[#0066FF] hover:underline"
              >
                <span>Start Assessment</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        ))}
        </div>
      )}
    </div>
  );
}

