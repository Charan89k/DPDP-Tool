/**
 * CloudE5 — Customer User Provisioning API
 *
 * POST /api/customers/[id]/users
 * Provisions a client user for the specified customer organization.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { CLIENT_ROLES } from "@/lib/auth/rbac";
import crypto from "node:crypto";
import { describePasswordProblem, hashPassword } from "@/lib/auth/passwords";
import { issueToken } from "@/lib/auth/account";
import { publicBaseUrl, sendEmail } from "@/lib/email/mailer";
import { verificationEmail } from "@/lib/email/templates";
import { pool } from "@/lib/db/pool";
import { assertSessionMatchesDatabase, DatabaseAuthorizationError } from "@/lib/db/rls";
import { resolveClientIp } from "@/lib/auth/rate_limit";

const provisionUserSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters.").max(255),
  email: z.string().email("Valid corporate email address is required."),
  role: z.enum(["CLIENT_ADMIN", "CLIENT_BU_LEAD", "CLIENT_CONTRIBUTOR", "CLIENT_VIEWER"]),
  password: z.string().max(200).optional().or(z.literal("").transform(() => undefined)),
  phone: z.string().max(50).optional().nullable(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const sessionUser = await getCurrentSession(req);
  if (!sessionUser) {
    return NextResponse.json(
      { error: "Authentication required to provision users." },
      { status: 401 }
    );
  }

  const { id: customerId } = await context.params;

  // Authorization check: Only Platform Administrator or Client Admin of this tenant
  const isAuthorized =
    sessionUser.role === "TLI_SUPER_ADMIN" ||
    (sessionUser.role === "CLIENT_ADMIN" && sessionUser.tenantId === customerId);

  if (!isAuthorized) {
    return NextResponse.json(
      { error: "Insufficient permissions to provision users for this organization." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parseResult = provisionUserSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { fullName, email, role, password, phone } = parseResult.data;
    const normalizedEmail = email.trim().toLowerCase();

    // Security Gate: Ensure role is strictly a client-facing role
    if (!CLIENT_ROLES.includes(role)) {
      return NextResponse.json(
        { error: "Security violation: Cannot provision user with administrative or platform role." },
        { status: 400 }
      );
    }

    const clientIp = resolveClientIp(req);
    const userAgent = req.headers.get("user-agent") || "CloudE5-App";

    const client = await pool.connect();
    try {
      await client.query("BEGIN;");

      // Re-verify the signed session against live account state before privileged writes
      await assertSessionMatchesDatabase(client, sessionUser);

      // Verify tenant exists and is active
      const tenantCheck = await client.query(
        "SELECT id, name, status FROM tenants WHERE id = $1 LIMIT 1;",
        [customerId]
      );
      if (tenantCheck.rows.length === 0) {
        await client.query("ROLLBACK;");
        return NextResponse.json(
          { error: "Customer organization not found." },
          { status: 404 }
        );
      }

      if (tenantCheck.rows[0].status !== "ACTIVE") {
        await client.query("ROLLBACK;");
        return NextResponse.json(
          { error: "Cannot provision users for an inactive or suspended organization." },
          { status: 400 }
        );
      }

      // Check email uniqueness across the system
      const emailCheck = await client.query(
        "SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1;",
        [normalizedEmail]
      );
      if (emailCheck.rows.length > 0) {
        await client.query("ROLLBACK;");
        return NextResponse.json(
          { error: `An account with email '${normalizedEmail}' already exists in the system.` },
          { status: 409 }
        );
      }

      if (password) {
        const problem = describePasswordProblem(password, { email: normalizedEmail });
        if (problem) {
          await client.query("ROLLBACK;");
          return NextResponse.json(
            { error: `Password does not meet requirements: ${problem}`, details: { password: [problem] } },
            { status: 400 }
          );
        }
      }
      // Without an administrator-chosen password the account gets an unusable random one; the user
      // sets their own through the emailed verification + password reset flow.
      const passwordHash = await hashPassword(password || crypto.randomBytes(32).toString("base64url"));

      const insertSql = `
        INSERT INTO users (
          tenant_id, email, password_hash, full_name, phone, role, is_active
        ) VALUES (
          $1, $2, $3, $4, $5, $6, TRUE
        )
        RETURNING id, email, full_name, role, is_active, created_at;
      `;
      const res = await client.query(insertSql, [
        customerId,
        normalizedEmail,
        passwordHash,
        fullName.trim(),
        phone ? phone.trim() : null,
        role,
      ]);

      const newUser = res.rows[0];

      // Audit user provisioning
      await client.query(
        `INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, ip_address, user_agent, new_state)
         VALUES ($1, $2, 'USER_PROVISIONED', 'users', $3, $4, $5, $6);`,
        [
          customerId,
          sessionUser.userId,
          newUser.id,
          clientIp,
          userAgent,
          JSON.stringify({ email: newUser.email, role: newUser.role, fullName: newUser.full_name }),
        ]
      );

      const verificationToken = await issueToken(client, newUser.id, "EMAIL_VERIFICATION");
      await client.query("COMMIT;");

      // The new user proves control of their email before first sign-in. Without an admin-chosen
      // password they then use "Forgot password" to set one.
      const emailDelivery = await sendEmail(
        verificationEmail(
          newUser.email,
          newUser.full_name,
          `${publicBaseUrl()}/verify-email?token=${encodeURIComponent(verificationToken)}`
        )
      );

      return NextResponse.json(
        {
          success: true,
          user: newUser,
          emailDelivery: emailDelivery.sent
            ? { sent: true, message: `A verification email was sent to ${newUser.email}.` }
            : { sent: false, reason: emailDelivery.reason, message: "The user was created but the verification email could not be sent." },
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
      return NextResponse.json(
        { error: "Your session is no longer authorized for this action. Please sign in again." },
        { status: 403 }
      );
    }
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
    console.error("Failed to provision user:", err);
    return NextResponse.json({ error: "Failed to provision user." }, { status: 500 });
  }
}
