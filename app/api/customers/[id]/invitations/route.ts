/**
 * CloudE5 — User Invitations API
 *
 * POST /api/customers/[id]/invitations
 * Generates a cryptographically secure, single-use, time-limited invitation token.
 * Stores strictly the SHA-256 hash of the token in database records.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { getCurrentSession } from "@/lib/auth/session";
import { CLIENT_ROLES } from "@/lib/auth/rbac";
import { pool } from "@/lib/db/pool";
import { assertSessionMatchesDatabase, DatabaseAuthorizationError } from "@/lib/db/rls";
import { resolveClientIp } from "@/lib/auth/rate_limit";
import { publicBaseUrl, sendEmail } from "@/lib/email/mailer";
import { invitationEmail } from "@/lib/email/templates";

const inviteUserSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters.").max(255),
  email: z.string().email("Valid corporate email address is required."),
  role: z.enum(["CLIENT_ADMIN", "CLIENT_BU_LEAD", "CLIENT_CONTRIBUTOR", "CLIENT_VIEWER"]),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const sessionUser = await getCurrentSession(req);
  if (!sessionUser) {
    return NextResponse.json(
      { error: "Authentication required to issue invitations." },
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
      { error: "Insufficient permissions to invite users for this organization." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parseResult = inviteUserSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { fullName, email, role } = parseResult.data;
    const normalizedEmail = email.trim().toLowerCase();

    // Enforce role boundary
    if (!CLIENT_ROLES.includes(role)) {
      return NextResponse.json(
        { error: "Invalid role: Only client-facing roles can be invited." },
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

      // Verify tenant
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
          { error: "Cannot invite users to an inactive organization." },
          { status: 400 }
        );
      }

      // Check if user already exists
      const userCheck = await client.query(
        "SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1;",
        [normalizedEmail]
      );
      if (userCheck.rows.length > 0) {
        await client.query("ROLLBACK;");
        return NextResponse.json(
          { error: `A user account with email '${normalizedEmail}' is already registered.` },
          { status: 409 }
        );
      }

      // Invalidate existing pending invitations for this email in this tenant
      await client.query(
        `UPDATE user_invitations 
         SET status = 'REVOKED', updated_at = CURRENT_TIMESTAMP
         WHERE tenant_id = $1 AND LOWER(email) = $2 AND status = 'PENDING';`,
        [customerId, normalizedEmail]
      );

      // Generate cryptographically secure 32-byte token
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days expiry

      // Insert invitation record (storing strictly token_hash)
      const insertSql = `
        INSERT INTO user_invitations (
          tenant_id, email, full_name, role, invited_by_id, token_hash, expires_at, status
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, 'PENDING'
        )
        RETURNING id, tenant_id, email, full_name, role, expires_at, status, created_at;
      `;
      const res = await client.query(insertSql, [
        customerId,
        normalizedEmail,
        fullName.trim(),
        role,
        sessionUser.userId,
        tokenHash,
        expiresAt,
      ]);

      const newInvitation = res.rows[0];

      // Audit log entry
      await client.query(
        `INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, ip_address, user_agent, new_state)
         VALUES ($1, $2, 'USER_INVITED', 'user_invitations', $3, $4, $5, $6);`,
        [
          customerId,
          sessionUser.userId,
          newInvitation.id,
          clientIp,
          userAgent,
          JSON.stringify({
            email: newInvitation.email,
            role: newInvitation.role,
            expiresAt: newInvitation.expires_at,
          }),
        ]
      );

      await client.query("COMMIT;");

      const activationPath = `/activate?token=${rawToken}`;
      const emailDelivery = await sendEmail(
        invitationEmail(
          normalizedEmail,
          tenantCheck.rows[0].name,
          sessionUser.fullName,
          `${publicBaseUrl()}${activationPath}`
        )
      );
      const isProduction = process.env.NODE_ENV === "production";

      return NextResponse.json(
        {
          success: true,
          invitation: newInvitation,
          emailDelivery: emailDelivery.sent
            ? { sent: true, message: `An invitation email was sent to ${normalizedEmail}.` }
            : {
                sent: false,
                reason: emailDelivery.reason,
                message:
                  "The invitation was created but the email could not be sent. Configure SMTP for this installation, then re-send the invitation.",
              },
          // Activation links are never returned by production servers; they travel only by email.
          ...(isProduction ? {} : { activationUrl: activationPath }),
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
    console.error("Failed to generate invitation:", err);
    return NextResponse.json({ error: "Failed to generate invitation." }, { status: 500 });
  }
}
