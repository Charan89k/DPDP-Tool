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
import { z } from "zod";
import {
  assertSessionMatchesDatabase,
  DatabaseAuthorizationError,
  executeWithRls,
} from "@/lib/db/rls";
import { canCreateAssessment, isTliRole } from "@/lib/auth/rbac";

const createAssessmentSchema = z.object({
  title: z.string().trim().min(3).max(255).optional(),
  engagementCode: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "Engagement code may only contain letters, numbers, '.', '_' and '-'.")
    .optional(),
  targetCompletionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Target completion date must use YYYY-MM-DD.")
    .nullable()
    .optional(),
  tenantId: z.string().uuid("Customer organization identifier is invalid.").optional(),
  leadConsultantId: z.string().uuid().optional(),
  assignedUserIds: z.array(z.string().uuid()).max(50).optional(),
});

export async function GET(req: NextRequest) {
  const sessionUser = await getCurrentSession(req);

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
  const sessionUser = await getCurrentSession(req);

  if (!sessionUser) {
    return NextResponse.json(
      { error: "Authentication required to create assessment." },
      { status: 401 }
    );
  }

  // RBAC Enforcement: Only TLI Lead Consultant or TLI Super Admin can initiate assessments
  if (!canCreateAssessment(sessionUser.role)) {
    return NextResponse.json(
      { error: "Insufficient permissions. Only TLI Lead Consultants or Super Administrators can initiate assessments." },
      { status: 403 }
    );
  }

  try {
    const parseResult = createAssessmentSchema.safeParse(await req.json());
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const body = parseResult.data;
    const title = body.title || "India DPDP Comprehensive Compliance Gap Evaluation";
    const engagementCode =
      body.engagementCode ||
      `DPDP-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
    const targetDate = body.targetCompletionDate || null;
    const requestedTenantId = body.tenantId;
    if (!requestedTenantId) {
      return NextResponse.json(
        { error: "Select the customer organization this assessment is for." },
        { status: 400 }
      );
    }


    const client = await pool.connect();
    try {
      await client.query("BEGIN;");

      // Re-verify the signed session against live account state before privileged writes
      await assertSessionMatchesDatabase(client, sessionUser);

      // Verify tenant exists and is active
      const tenantCheck = await client.query(
        "SELECT id, name, status FROM tenants WHERE id = $1 AND type = 'CLIENT' LIMIT 1;",
        [requestedTenantId]
      );
      if (tenantCheck.rows.length === 0) {
        await client.query("ROLLBACK;");
        return NextResponse.json(
          { error: "Target customer organization not found." },
          { status: 404 }
        );
      }
      if (tenantCheck.rows[0].status !== "ACTIVE") {
        await client.query("ROLLBACK;");
        return NextResponse.json(
          { error: "Cannot create assessment for an inactive or suspended organization." },
          { status: 400 }
        );
      }

      // 1. Resolve framework version and scoring model
      const fwRes = await client.query("SELECT id FROM framework_versions LIMIT 1;");
      const frameworkId = fwRes.rows[0]?.id;

      const smRes = await client.query("SELECT id FROM scoring_models LIMIT 1;");
      const scoringModelId = smRes.rows[0]?.id;

      if (!frameworkId || !scoringModelId) {
        throw new Error("Active framework version or scoring model not found in database.");
      }

      // 2. Resolve lead consultant
      const leadConsultantId = body.leadConsultantId || sessionUser.userId;
      const consultantRes = await client.query(
        "SELECT id, role FROM users WHERE id = $1 AND is_active = TRUE AND role IN ('TLI_LEAD_CONSULTANT', 'TLI_SUPER_ADMIN') LIMIT 1;",
        [leadConsultantId]
      );
      const resolvedLeadId = consultantRes.rows[0]?.id || sessionUser.userId;

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
        RETURNING id, engagement_code, title, tenant_id, status, created_at;
      `;
      const res = await client.query(insertSql, [
        requestedTenantId,
        frameworkId,
        scoringModelId,
        engagementCode,
        title,
        resolvedLeadId,
        targetDate,
      ]);

      const newAssessment = res.rows[0];

      // 4. Bind consultant in assessment_assignments
      await client.query(
        `INSERT INTO assessment_assignments (assessment_id, user_id, assignment_role)
         VALUES ($1, $2, 'ENGAGEMENT_LEAD')
         ON CONFLICT (assessment_id, user_id) DO NOTHING;`,
        [newAssessment.id, resolvedLeadId]
      );

      // 5. Validate and assign client coordinators if provided
      const assignedUserIds: string[] = Array.from(new Set(body.assignedUserIds ?? []));
      const assignedCount = assignedUserIds.length;

      for (const assignedUserId of assignedUserIds) {
        const userCheck = await client.query(
          "SELECT id, tenant_id, role FROM users WHERE id = $1 AND is_active = TRUE LIMIT 1;",
          [assignedUserId]
        );

        if (userCheck.rows.length === 0) {
          await client.query("ROLLBACK;");
          return NextResponse.json(
            { error: `Assigned user ${assignedUserId} was not found or is inactive.` },
            { status: 400 }
          );
        }

        const targetUser = userCheck.rows[0];

        // CRITICAL CROSS-TENANT DEFENSE: Verify assigned user belongs to the assessment tenant
        if (targetUser.tenant_id !== requestedTenantId) {
          await client.query("ROLLBACK;");
          return NextResponse.json(
            {
              error: `Cross-tenant assignment violation: Assigned user ${assignedUserId} belongs to tenant '${targetUser.tenant_id}', which does not match target tenant '${requestedTenantId}'.`,
            },
            { status: 400 }
          );
        }

        // Insert client assignment
        await client.query(
          `INSERT INTO assessment_assignments (assessment_id, user_id, assignment_role)
           VALUES ($1, $2, 'CLIENT_COORDINATOR')
           ON CONFLICT (assessment_id, user_id) DO NOTHING;`,
          [newAssessment.id, targetUser.id]
        );
      }

      // Audit log entry
      const clientIp = req.headers.get("x-forwarded-for") || "127.0.0.1";
      const userAgent = req.headers.get("user-agent") || "TLI-App";
      await client.query(
        `INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, ip_address, user_agent, new_state)
         VALUES ($1, $2, 'ASSESSMENT_CREATED', 'assessments', $3, $4, $5, $6);`,
        [
          requestedTenantId,
          sessionUser.userId,
          newAssessment.id,
          clientIp,
          userAgent,
          JSON.stringify({
            code: newAssessment.engagement_code,
            title: newAssessment.title,
            assignedUsersCount: assignedCount,
          }),
        ]
      );

      await client.query("COMMIT;");

      return NextResponse.json(
        {
          success: true,
          assessment: newAssessment,
          assignedCoordinatorsCount: assignedCount,
        },
        { status: 201 }
      );
    } catch (dbErr) {
      await client.query("ROLLBACK;");
      throw dbErr;
    } finally {
      client.release();
    }
  } catch (err: unknown) {
    if (err instanceof DatabaseAuthorizationError) {
      return NextResponse.json({ error: "Your session is no longer authorized for this action." }, { status: 403 });
    }
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
    if (typeof err === "object" && err !== null && (err as { code?: string }).code === "23505") {
      return NextResponse.json(
        { error: "An assessment with this engagement code already exists." },
        { status: 409 }
      );
    }
    console.error("Failed to create assessment engagement:", err);
    return NextResponse.json(
      { error: "Failed to create assessment engagement." },
      { status: 500 }
    );
  }
}
