/**
 * CloudE5 — Customer Organization API
 *
 * GET  /api/customers - List customer organizations accessible to authenticated user
 * POST /api/customers - Create a new customer organization (Platform Administrator only)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { workEmailSchema } from "@/lib/auth/work_email";
import { getCurrentSession } from "@/lib/auth/session";
import { executeWithRls } from "@/lib/db/rls";
import { resolveClientIp } from "@/lib/auth/rate_limit";
import { sessionErrorResponse } from "@/lib/http/session_errors";

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
      email: workEmailSchema,
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
          (SELECT COUNT(*) FROM assessments a WHERE a.tenant_id = t.id)::int AS assessment_count,
          (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id)::int AS user_count
        FROM tenants t
        WHERE t.type = 'CLIENT'
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
  } catch (err) {
    const sessionError = sessionErrorResponse(err);
    if (sessionError) return sessionError;
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
      parseResult.data,
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
  } catch (err) {
    const sessionError = sessionErrorResponse(err);
    if (sessionError) return sessionError;
    if (err instanceof OnboardingError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.statusCode }
      );
    }
    console.error("Failed to onboard customer organisation:", err);
    return NextResponse.json(
      { error: "Failed to create customer organisation." },
      { status: 500 }
    );
  }
}
