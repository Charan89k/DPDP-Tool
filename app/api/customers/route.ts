/**
 * CloudE5 — Customer Organization API
 *
 * GET  /api/customers - List customer organizations accessible to authenticated user
 * POST /api/customers - Create a new customer organization (Platform Administrator only)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { executeWithRls } from "@/lib/db/rls";
import { pool } from "@/lib/db/pool";
import { canCreateCustomer, isTliRole, CLIENT_ROLES } from "@/lib/auth/rbac";
import { hashPassword } from "@/lib/auth/passwords";
import { resolveClientIp } from "@/lib/auth/rate_limit";

const createCustomerSchema = z.object({
  name: z.string().min(2, "Organisation name must be at least 2 characters.").max(255),
  slug: z.string().min(2).max(100).optional(),
  industry: z.string().min(2).max(100).default("Enterprise"),
  isSdf: z.boolean().default(false),
  dpoName: z.string().max(255).optional().nullable(),
  dpoEmail: z.string().email("Valid DPO email address is required.").optional().nullable().or(z.literal("")),
  phone: z.string().max(50).optional().nullable(),
  address: z.string().max(255).optional().nullable(),
  initialUser: z
    .object({
      fullName: z.string().min(2, "User name must be at least 2 characters."),
      email: z.string().email("Valid corporate email address is required."),
      role: z.enum(["CLIENT_ADMIN", "CLIENT_BU_LEAD", "CLIENT_CONTRIBUTOR", "CLIENT_VIEWER"]).default("CLIENT_ADMIN"),
      password: z.string().max(200).optional().or(z.literal("").transform(() => undefined)),
    })
    .optional(),
});

export async function GET(req: NextRequest) {
  const sessionUser = await getCurrentSession(req);
  if (!sessionUser) {
    return NextResponse.json(
      { error: "Authentication required to access customer directory." },
      { status: 401 }
    );
  }

  try {
    const customers = await executeWithRls(sessionUser, async (client) => {
      const sql = `
        SELECT 
          t.id, 
          t.name, 
          t.slug, 
          t.industry, 
          t.is_sdf, 
          t.dpo_name, 
          t.dpo_email, 
          t.status,
          t.created_at,
          COUNT(DISTINCT a.id)::int AS assessment_count,
          COUNT(DISTINCT u.id)::int AS user_count
        FROM tenants t
        LEFT JOIN assessments a ON a.tenant_id = t.id
        LEFT JOIN users u ON u.tenant_id = t.id
        WHERE t.type = 'CLIENT'
        GROUP BY t.id, t.name, t.slug, t.industry, t.is_sdf, t.dpo_name, t.dpo_email, t.status, t.created_at
        ORDER BY t.name ASC;
      `;
      const res = await client.query(sql);
      return res.rows;
    });

    return NextResponse.json({
      success: true,
      count: customers.length,
      customers,
    });
  } catch (err: any) {
    console.error("Failed to query customers:", err);
    return NextResponse.json(
      { error: "Unable to retrieve customers. Please verify your permissions." },
      { status: 500 }
    );
  }
}

import { createCustomerOrganization, OnboardingError } from "@/lib/onboarding/service";

export async function POST(req: NextRequest) {
  const sessionUser = await getCurrentSession(req);
  if (!sessionUser) {
    return NextResponse.json(
      { error: "Authentication required to create customer organization." },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const parseResult = createCustomerSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const clientIp = resolveClientIp(req);
    const userAgent = req.headers.get("user-agent") || "CloudE5-App";

    const { customer, initialUser } = await createCustomerOrganization(
      sessionUser,
      parseResult.data as any,
      clientIp,
      userAgent
    );

    return NextResponse.json(
      {
        success: true,
        customer,
        initialUser,
      },
      { status: 201 }
    );
  } catch (err: any) {
    if (err instanceof OnboardingError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.statusCode }
      );
    }
    console.error("Failed to onboard customer organisation:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create customer organisation." },
      { status: 500 }
    );
  }
}
