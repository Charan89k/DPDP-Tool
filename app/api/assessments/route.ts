/**
 * TLI DPDP Compliance Gap Analysis Tool — RLS-Scoped Assessments Endpoint
 *
 * GET /api/assessments
 * Fetches assessment records accessible to the authenticated user.
 *
 * POST /api/assessments
 * Creates a new assessment record under PostgreSQL Row-Level Security.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { executeWithRls } from "@/lib/db/rls";
import { isTliRole } from "@/lib/auth/rbac";

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
          a.engagement_code,
          'ENTERPRISE_GAP_ASSESSMENT' AS assessment_type,
          a.status,
          fv.name AS target_framework,
          a.created_at AS start_date,
          a.target_completion_date,
          u.full_name AS lead_consultant_name,
          t.dpo_name AS dpo_contact_name,
          a.created_at,
          t.name AS tenant_name,
          t.slug AS tenant_slug,
          t.is_sdf
        FROM assessments a
        JOIN framework_versions fv ON fv.id = a.framework_version_id
        LEFT JOIN users u ON u.id = a.lead_consultant_id
        LEFT JOIN tenants t ON t.id = a.tenant_id
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

import { pool } from "@/lib/db/pool";

export async function POST(req: NextRequest) {
  const sessionUser = await getCurrentSession();

  if (!sessionUser) {
    return NextResponse.json(
      { error: "Authentication required to create assessment." },
      { status: 401 }
    );
  }

  // RBAC Enforcement: Only TLI Lead Consultant or TLI Super Admin can initiate assessments
  const canCreate =
    sessionUser.role === "TLI_SUPER_ADMIN" ||
    sessionUser.role === "TLI_LEAD_CONSULTANT";

  if (!canCreate) {
    return NextResponse.json(
      { error: "Insufficient permissions. Only TLI Lead Consultants or Super Administrators can initiate assessments." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const title = (body.title || "India DPDP Comprehensive Compliance Gap Evaluation").trim();
    const engagementCode = (
      body.engagementCode ||
      `DPDP-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`
    ).trim();
    const targetDate = body.targetCompletionDate || null;
    const requestedTenantId = body.tenantId || sessionUser.tenantId;

    // Cross-tenant boundary check: Client admin can only create for their own tenant
    if (sessionUser.role === "CLIENT_ADMIN" && requestedTenantId !== sessionUser.tenantId) {
      return NextResponse.json(
        { error: "Client administrators can only create assessments for their own organization." },
        { status: 403 }
      );
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN;");

      // 1. Resolve framework version and scoring model
      const fwRes = await client.query("SELECT id FROM framework_versions LIMIT 1;");
      const frameworkId = fwRes.rows[0]?.id;

      const smRes = await client.query("SELECT id FROM scoring_models LIMIT 1;");
      const scoringModelId = smRes.rows[0]?.id;

      if (!frameworkId || !scoringModelId) {
        throw new Error("Active framework version or scoring model not found in database.");
      }

      // 2. Resolve lead consultant
      const consultantRes = await client.query(
        "SELECT id FROM users WHERE role IN ('TLI_LEAD_CONSULTANT', 'TLI_SUPER_ADMIN') LIMIT 1;"
      );
      const leadConsultantId = consultantRes.rows[0]?.id || sessionUser.userId;

      // 3. Insert assessment
      const insertSql = `
        INSERT INTO assessments (
          tenant_id,
          framework_version_id,
          scoring_model_id,
          engagement_code,
          title,
          status,
          lead_consultant_id,
          target_completion_date
        ) VALUES ($1, $2, $3, $4, $5, 'DRAFT', $6, $7)
        RETURNING id, engagement_code, title;
      `;
      const res = await client.query(insertSql, [
        requestedTenantId,
        frameworkId,
        scoringModelId,
        engagementCode,
        title,
        leadConsultantId,
        targetDate,
      ]);

      const newAssessment = res.rows[0];

      // 4. Bind consultant in assessment_assignments
      await client.query(
        `INSERT INTO assessment_assignments (assessment_id, user_id, assignment_role)
         VALUES ($1, $2, 'ENGAGEMENT_LEAD')
         ON CONFLICT (assessment_id, user_id) DO NOTHING;`,
        [newAssessment.id, leadConsultantId]
      );

      await client.query("COMMIT;");

      return NextResponse.json(
        {
          success: true,
          assessment: newAssessment,
        },
        { status: 201 }
      );
    } catch (dbErr) {
      await client.query("ROLLBACK;");
      throw dbErr;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("Failed to create assessment engagement:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create assessment engagement." },
      { status: 500 }
    );
  }
}
