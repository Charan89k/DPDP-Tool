/**
 * CloudE5 — Invitation Acceptance & Account Activation API
 *
 * POST /api/auth/invitations/accept
 * Verifies the single-use token, validates expiration, creates the user account,
 * and marks the invitation as accepted transactionally.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { pool } from "@/lib/db/pool";
import { describePasswordProblem, hashPassword } from "@/lib/auth/passwords";
import { resolveClientIp } from "@/lib/auth/rate_limit";

const acceptInvitationSchema = z.object({
  token: z.string().min(16, "Invalid token format."),
  password: z.string().min(1, "Choose a password.").max(200),
  fullName: z.string().min(2).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = acceptInvitationSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { token, password, fullName: nameOverride } = parseResult.data;
    const passwordProblem = describePasswordProblem(password);
    if (passwordProblem) {
      return NextResponse.json(
        { error: `Password does not meet requirements: ${passwordProblem}`, details: { password: [passwordProblem] } },
        { status: 400 }
      );
    }
    const clientIp = resolveClientIp(req);
    const userAgent = req.headers.get("user-agent") || "CloudE5-App";

    // Compute SHA-256 hash of the provided raw token
    const tokenHash = crypto.createHash("sha256").update(token.trim()).digest("hex");

    const client = await pool.connect();
    try {
      await client.query("BEGIN;");

      // Query invitation by token hash
      const inviteRes = await client.query(
        `SELECT id, tenant_id, email, full_name, role, expires_at, status
         FROM user_invitations
         WHERE token_hash = $1
         FOR UPDATE;`,
        [tokenHash]
      );

      if (inviteRes.rows.length === 0) {
        await client.query("ROLLBACK;");
        return NextResponse.json(
          { error: "Invalid or unrecognized invitation token." },
          { status: 404 }
        );
      }

      const invite = inviteRes.rows[0];

      // Validate single-use status
      if (invite.status !== "PENDING") {
        await client.query("ROLLBACK;");
        return NextResponse.json(
          { error: `This invitation is no longer active (status: ${invite.status}).` },
          { status: 400 }
        );
      }

      // Validate expiration
      if (new Date(invite.expires_at).getTime() < Date.now()) {
        await client.query(
          "UPDATE user_invitations SET status = 'EXPIRED' WHERE id = $1;",
          [invite.id]
        );
        await client.query("COMMIT;");
        return NextResponse.json(
          { error: "This invitation has expired. Please contact your administrator." },
          { status: 400 }
        );
      }

      // Check if user already exists
      const userCheck = await client.query(
        "SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1;",
        [invite.email]
      );
      if (userCheck.rows.length > 0) {
        await client.query(
          "UPDATE user_invitations SET status = 'REVOKED' WHERE id = $1;",
          [invite.id]
        );
        await client.query("COMMIT;");
        return NextResponse.json(
          { error: "An account with this email address already exists." },
          { status: 409 }
        );
      }

      // Hash password
      const passwordHash = await hashPassword(password);
      const finalName = (nameOverride || invite.full_name).trim();

      // Insert new user
      const insertUserSql = `
        INSERT INTO users (
          tenant_id, email, password_hash, full_name, role, is_active, email_verified_at
        ) VALUES (
          $1, $2, $3, $4, $5, TRUE, CURRENT_TIMESTAMP
        )
        RETURNING id, email, full_name, role, tenant_id;
      `;
      const userRes = await client.query(insertUserSql, [
        invite.tenant_id,
        invite.email.toLowerCase(),
        passwordHash,
        finalName,
        invite.role,
      ]);
      const createdUser = userRes.rows[0];

      // Mark invitation as accepted
      await client.query(
        `UPDATE user_invitations 
         SET status = 'ACCEPTED', accepted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1;`,
        [invite.id]
      );

      // Audit invitation acceptance
      await client.query(
        `INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, ip_address, user_agent, new_state)
         VALUES ($1, $2, 'INVITATION_ACCEPTED', 'users', $2, $3, $4, $5);`,
        [
          invite.tenant_id,
          createdUser.id,
          clientIp,
          userAgent,
          JSON.stringify({
            invitationId: invite.id,
            email: createdUser.email,
            role: createdUser.role,
          }),
        ]
      );

      await client.query("COMMIT;");

      return NextResponse.json(
        {
          success: true,
          message: "Account successfully activated. You may now sign in with your corporate credentials.",
          user: {
            id: createdUser.id,
            email: createdUser.email,
            fullName: createdUser.full_name,
            role: createdUser.role,
          },
        },
        { status: 200 }
      );
    } catch (dbErr) {
      await client.query("ROLLBACK;");
      throw dbErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Failed to accept invitation:", err);
    return NextResponse.json(
      { error: "Failed to process invitation acceptance." },
      { status: 500 }
    );
  }
}

