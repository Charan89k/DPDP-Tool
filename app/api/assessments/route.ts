/**
 * TLI DPDP Compliance Gap Analysis Tool — RLS-Scoped Assessments Endpoint
 *
 * GET /api/assessments
 * Fetches assessment records accessible to the authenticated user.
 * Multi-tenant isolation is enforced at the PostgreSQL database kernel via Row-Level Security.
 */

import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { executeWithRls } from "@/lib/db/rls";

export async function GET() {
  const sessionUser = await getCurrentSession();

  if (!sessionUser) {
    return NextResponse.json(
      { error: "Authentication required to access assessment workspace." },
      { status: 401 }
    );
  }

  try {
    const assessments = await executeWithRls(sessionUser, async (client) => {
      const sql = `
        SELECT 
          a.id,
          a.tenant_id,
          a.title,
          a.assessment_type,
          a.status,
          a.target_framework,
          a.start_date,
          a.target_completion_date,
          a.lead_consultant_name,
          a.dpo_contact_name,
          a.created_at,
          t.name AS tenant_name,
          t.slug AS tenant_slug,
          t.is_sdf
        FROM assessments a
        JOIN tenants t ON t.id = a.tenant_id
        ORDER BY a.created_at DESC;
      `;
      const result = await client.query(sql);
      return result.rows;
    });

    return NextResponse.json(
      {
        success: true,
        count: assessments.length,
        assessments,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Failed to query assessments under RLS context:", err);
    return NextResponse.json(
      { error: "Unable to retrieve assessments. Please verify your access permissions." },
      { status: 500 }
    );
  }
}

