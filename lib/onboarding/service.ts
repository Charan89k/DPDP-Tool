/**
 * CloudE5 — Customer Onboarding Domain Service
 *
 * Implements server-side customer organization onboarding, user provisioning,
 * cryptographic token invitations, and assessment assignment workflows
 * with strict role authorization, tenant boundary enforcement, and immutable audit logs.
 */

import crypto from "node:crypto";
import type { PoolClient } from "../db/pool.ts";
import { pool } from "../db/pool.ts";
import { assertSessionMatchesDatabase, DatabaseAuthorizationError, executeWithRls } from "../db/rls.ts";
import type { SessionUser, UserRole } from "../auth/types.ts";
import { canCreateCustomer, canManageTenantUsers, isTliRole, CLIENT_ROLES } from "../auth/rbac.ts";
import { describePasswordProblem, hashPassword } from "../auth/passwords.ts";
import { issueToken } from "../auth/account.ts";
import { publicBaseUrl, sendEmail } from "../email/mailer.ts";
import { verificationEmail } from "../email/templates.ts";
import type {
  CreateCustomerInput,
  ProvisionUserInput,
  CreateInvitationInput,
  AcceptInvitationInput,
  CreateAssessmentWithAssignmentInput,
  CustomerDetails,
  InvitationResult,
} from "./types.ts";

export class OnboardingError extends Error {
  code: string;
  statusCode: number;

  constructor(message: string, code: string = "ONBOARDING_ERROR", statusCode: number = 400) {
    super(message);
    this.name = "OnboardingError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

interface PendingVerification {
  email: string;
  fullName: string;
  token: string;
}

/** Sends the email verification link for an administrator-created account (after commit). */
async function sendVerificationEmail(pending: PendingVerification | null): Promise<void> {
  if (!pending) return;
  await sendEmail(
    verificationEmail(
      pending.email,
      pending.fullName,
      `${publicBaseUrl()}/verify-email?token=${encodeURIComponent(pending.token)}`
    )
  );
}

/**
 * Re-verifies the signed session against live account state on a privileged client.
 * Privileged onboarding operations run outside RLS, so they must not trust token claims alone.
 */
async function verifyPrivilegedSession(
  client: Pick<PoolClient, "query">,
  sessionUser: SessionUser
): Promise<void> {
  try {
    await assertSessionMatchesDatabase(client, sessionUser);
  } catch (err) {
    if (err instanceof DatabaseAuthorizationError) {
      throw new OnboardingError(
        "Your session is no longer authorized for this action. Please sign in again.",
        "SESSION_NOT_AUTHORIZED",
        403
      );
    }
    throw err;
  }
}

/**
 * Onboards a new customer organization (Platform Administrator only).
 */
export async function createCustomerOrganization(
  sessionUser: SessionUser,
  input: CreateCustomerInput,
  clientIp: string = "127.0.0.1",
  userAgent: string = "CloudE5-App"
): Promise<{ customer: any; initialUser?: any }> {
  if (!canCreateCustomer(sessionUser.role)) {
    throw new OnboardingError(
      "Unauthorized: Only Platform Administrators are permitted to onboard customer organizations.",
      "FORBIDDEN",
      403
    );
  }

  const name = input.name?.trim();
  if (!name || name.length < 2) {
    throw new OnboardingError("Organisation name must be at least 2 characters.", "INVALID_INPUT", 400);
  }

  const slug = (
    input.slug ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  ).slice(0, 100);

  let result: any;
  let pendingVerification: PendingVerification | null = null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN;");
    await verifyPrivilegedSession(client, sessionUser);

    // 1. Check for duplicate slug or name
    const dupCheck = await client.query(
      "SELECT id, slug, name FROM tenants WHERE slug = $1 OR name = $2 LIMIT 1;",
      [slug, name]
    );

    if (dupCheck.rows.length > 0) {
      await client.query("ROLLBACK;");
      const matched = dupCheck.rows[0];
      const conflictField = matched.slug === slug ? "slug" : "name";
      throw new OnboardingError(
        `A customer organisation with this ${conflictField} already exists (${matched[conflictField]}).`,
        "CONFLICT",
        409
      );
    }

    // 2. Insert new tenant
    const insertRes = await client.query(
      `INSERT INTO tenants (
        type, name, slug, industry, is_sdf, dpo_name, dpo_email, status
      ) VALUES (
        'CLIENT', $1, $2, $3, $4, $5, $6, 'ACTIVE'
      ) RETURNING id, type, name, slug, industry, is_sdf, dpo_name, dpo_email, status, created_at;`,
      [
        name,
        slug,
        input.industry || "Enterprise",
        Boolean(input.isSdf),
        input.dpoName || null,
        input.dpoEmail || null,
      ]
    );

    const newCustomer = insertRes.rows[0];

    // 3. Record audit log
    await client.query(
      `INSERT INTO audit_logs (
        tenant_id, user_id, action, entity_type, entity_id, ip_address, user_agent, new_state
      ) VALUES ($1, $2, 'TENANT_CREATED', 'tenants', $3, $4, $5, $6);`,
      [
        newCustomer.id,
        sessionUser.userId,
        newCustomer.id,
        clientIp,
        userAgent,
        JSON.stringify({
          name: newCustomer.name,
          slug: newCustomer.slug,
          industry: newCustomer.industry,
          isSdf: newCustomer.is_sdf,
        }),
      ]
    );

    // 4. Optionally provision initial user
    let createdUser: any = undefined;
    if (input.initialUser) {
      const { fullName, email, role = "CLIENT_ADMIN", password } = input.initialUser;

      if (!CLIENT_ROLES.includes(role as UserRole)) {
        await client.query("ROLLBACK;");
        throw new OnboardingError(
          `Initial user role must be a client role. Received: ${role}`,
          "INVALID_ROLE",
          400
        );
      }

      // Check email uniqueness
      const emailCheck = await client.query(
        "SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1;",
        [email]
      );
      if (emailCheck.rows.length > 0) {
        await client.query("ROLLBACK;");
        throw new OnboardingError(
          `A user with email '${email}' already exists.`,
          "USER_CONFLICT",
          409
        );
      }

      if (password) {
        const passwordProblem = describePasswordProblem(password, { email });
        if (passwordProblem) {
          throw new OnboardingError(`Password does not meet requirements: ${passwordProblem}`, "WEAK_PASSWORD", 400);
        }
      }
      // Without an administrator-chosen password the account gets an unusable random one; the
      // user verifies their email and sets their own password via "Forgot password".
      const passwordHash = await hashPassword(password || crypto.randomBytes(32).toString("base64url"));

      const userRes = await client.query(
        `INSERT INTO users (
          tenant_id, email, password_hash, full_name, role, is_active
        ) VALUES ($1, $2, $3, $4, $5, TRUE)
        RETURNING id, tenant_id, email, full_name, role, is_active, created_at;`,
        [newCustomer.id, email.toLowerCase().trim(), passwordHash, fullName.trim(), role]
      );

      createdUser = userRes.rows[0];
      pendingVerification = {
        email: createdUser.email,
        fullName: createdUser.full_name,
        token: await issueToken(client, createdUser.id, "EMAIL_VERIFICATION"),
      };

      await client.query(
        `INSERT INTO audit_logs (
          tenant_id, user_id, action, entity_type, entity_id, ip_address, user_agent, new_state
        ) VALUES ($1, $2, 'USER_PROVISIONED', 'users', $3, $4, $5, $6);`,
        [
          newCustomer.id,
          sessionUser.userId,
          createdUser.id,
          clientIp,
          userAgent,
          JSON.stringify({
            email: createdUser.email,
            role: createdUser.role,
            isInitialUser: true,
          }),
        ]
      );
    }

    await client.query("COMMIT;");
    result = { customer: newCustomer, initialUser: createdUser };
  } catch (err) {
    await client.query("ROLLBACK;");
    throw err;
  } finally {
    client.release();
  }
  await sendVerificationEmail(pendingVerification);
  return result;
}

/**
 * Retrieves customer organization details, provisioned users, invitations, and assessments.
 */
export async function getCustomerDetails(
  sessionUser: SessionUser,
  customerId: string
): Promise<CustomerDetails> {
  // Cross-tenant boundary check
  if (!isTliRole(sessionUser.role) && sessionUser.tenantId !== customerId) {
    throw new OnboardingError(
      "Access denied: You cannot view records belonging to another organization.",
      "FORBIDDEN",
      403
    );
  }

  // Runs under the tenant policy layer: platform staff see only organisations they may access.
  return executeWithRls(sessionUser, async (client) => {
    const tenantRes = await client.query(
      `SELECT id, name, slug, industry, is_sdf, dpo_name, dpo_email, status, created_at
       FROM tenants
       WHERE id = $1 AND type = 'CLIENT';`,
      [customerId]
    );

    if (tenantRes.rows.length === 0) {
      throw new OnboardingError("Customer organisation not found.", "NOT_FOUND", 404);
    }

    const tenant = tenantRes.rows[0];

    const usersRes = await client.query(
      `SELECT id, full_name, email, role, is_active, phone, created_at
       FROM users
       WHERE tenant_id = $1
       ORDER BY created_at ASC;`,
      [customerId]
    );

    const invRes = await client.query(
      `SELECT id, email, role, status, expires_at, created_at, accepted_at
       FROM user_invitations
       WHERE tenant_id = $1
       ORDER BY created_at DESC;`,
      [customerId]
    );

    const assessRes = await client.query(
      `SELECT id, title, engagement_code, status, created_at, target_completion_date
       FROM assessments
       WHERE tenant_id = $1
       ORDER BY created_at DESC;`,
      [customerId]
    );

    return {
      tenant,
      users: usersRes.rows,
      invitations: invRes.rows,
      assessments: assessRes.rows,
    };
  });
}

/**
 * Directly provisions a customer user.
 */
export async function provisionCustomerUser(
  sessionUser: SessionUser,
  customerId: string,
  input: ProvisionUserInput,
  clientIp: string = "127.0.0.1",
  userAgent: string = "CloudE5-App"
): Promise<any> {
  // Permissions check
  if (!canManageTenantUsers(sessionUser.role)) {
    throw new OnboardingError("Unauthorized to manage users.", "FORBIDDEN", 403);
  }

  // Cross-tenant boundary check: Client admin can only provision within own tenant
  if (!isTliRole(sessionUser.role) && sessionUser.tenantId !== customerId) {
    throw new OnboardingError("Cannot provision users for another organisation.", "FORBIDDEN", 403);
  }

  // Role validation: Customer users can ONLY have client roles
  if (!CLIENT_ROLES.includes(input.role)) {
    throw new OnboardingError(
      `Invalid customer role '${input.role}'. Allowed roles: ${CLIENT_ROLES.join(", ")}`,
      "INVALID_ROLE",
      400
    );
  }

  const email = input.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new OnboardingError("A valid email address is required.", "INVALID_INPUT", 400);
  }

  let newUser: any;
  let pendingVerification: PendingVerification | null = null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN;");
    await verifyPrivilegedSession(client, sessionUser);

    // Verify tenant exists
    const tCheck = await client.query("SELECT id, name FROM tenants WHERE id = $1 AND type = 'CLIENT';", [
      customerId,
    ]);
    if (tCheck.rows.length === 0) {
      await client.query("ROLLBACK;");
      throw new OnboardingError("Customer organisation not found.", "NOT_FOUND", 404);
    }

    // Check email uniqueness
    const emailCheck = await client.query(
      "SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1;",
      [email]
    );
    if (emailCheck.rows.length > 0) {
      await client.query("ROLLBACK;");
      throw new OnboardingError(
        `A user with email '${email}' already exists in the system.`,
        "CONFLICT",
        409
      );
    }

    if (input.password) {
      const passwordProblem = describePasswordProblem(input.password, { email });
      if (passwordProblem) {
        throw new OnboardingError(`Password does not meet requirements: ${passwordProblem}`, "WEAK_PASSWORD", 400);
      }
    }
    const passwordHash = await hashPassword(input.password || crypto.randomBytes(32).toString("base64url"));

    const userRes = await client.query(
      `INSERT INTO users (
        tenant_id, email, password_hash, full_name, role, phone, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, TRUE)
      RETURNING id, tenant_id, email, full_name, role, phone, is_active, created_at;`,
      [customerId, email, passwordHash, input.fullName.trim(), input.role, input.phone || null]
    );

    newUser = userRes.rows[0];
    pendingVerification = {
      email: newUser.email,
      fullName: newUser.full_name,
      token: await issueToken(client, newUser.id, "EMAIL_VERIFICATION"),
    };

    await client.query(
      `INSERT INTO audit_logs (
        tenant_id, user_id, action, entity_type, entity_id, ip_address, user_agent, new_state
      ) VALUES ($1, $2, 'USER_PROVISIONED', 'users', $3, $4, $5, $6);`,
      [
        customerId,
        sessionUser.userId,
        newUser.id,
        clientIp,
        userAgent,
        JSON.stringify({
          email: newUser.email,
          role: newUser.role,
          provisionedBy: sessionUser.email,
        }),
      ]
    );

    await client.query("COMMIT;");
  } catch (err) {
    await client.query("ROLLBACK;");
    throw err;
  } finally {
    client.release();
  }
  await sendVerificationEmail(pendingVerification);
  return newUser;
}

/**
 * Creates a single-use cryptographic invitation for a customer user.
 */
export async function createCustomerInvitation(
  sessionUser: SessionUser,
  customerId: string,
  input: CreateInvitationInput,
  baseUrl: string = "http://localhost:3000",
  clientIp: string = "127.0.0.1",
  userAgent: string = "CloudE5-App"
): Promise<InvitationResult> {
  if (!canManageTenantUsers(sessionUser.role)) {
    throw new OnboardingError("Unauthorized to issue invitations.", "FORBIDDEN", 403);
  }

  if (!isTliRole(sessionUser.role) && sessionUser.tenantId !== customerId) {
    throw new OnboardingError("Cannot issue invitations for another organisation.", "FORBIDDEN", 403);
  }

  if (!CLIENT_ROLES.includes(input.role)) {
    throw new OnboardingError(
      `Invalid customer role '${input.role}'. Allowed roles: ${CLIENT_ROLES.join(", ")}`,
      "INVALID_ROLE",
      400
    );
  }

  const email = input.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new OnboardingError("Valid corporate email address is required.", "INVALID_INPUT", 400);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN;");
    await verifyPrivilegedSession(client, sessionUser);

    // 1. Verify tenant exists
    const tCheck = await client.query("SELECT id FROM tenants WHERE id = $1 AND type = 'CLIENT';", [
      customerId,
    ]);
    if (tCheck.rows.length === 0) {
      await client.query("ROLLBACK;");
      throw new OnboardingError("Customer organisation not found.", "NOT_FOUND", 404);
    }

    // 2. Check if user already exists
    const existingUser = await client.query(
      "SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1;",
      [email]
    );
    if (existingUser.rows.length > 0) {
      await client.query("ROLLBACK;");
      throw new OnboardingError(
        `User with email '${email}' is already provisioned on the platform.`,
        "CONFLICT",
        409
      );
    }

    // 3. Invalidate any existing pending invitations for this email in this tenant
    await client.query(
      `UPDATE user_invitations 
       SET status = 'REVOKED'
       WHERE tenant_id = $1 AND LOWER(email) = $2 AND status = 'PENDING';`,
      [customerId, email]
    );

    // 4. Generate 32-byte cryptographic random token (64 hex characters)
    const rawToken = crypto.randomBytes(32).toString("hex");
    // Token is stored strictly as SHA-256 hash
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const fullName = (input.fullName || email.split("@")[0]).trim();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days expiry

    const invRes = await client.query(
      `INSERT INTO user_invitations (
        tenant_id, email, full_name, role, invited_by_id, token_hash, expires_at, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')
      RETURNING id, tenant_id, email, full_name, role, status, expires_at, created_at;`,
      [customerId, email, fullName, input.role, sessionUser.userId, tokenHash, expiresAt]
    );

    const invitation = invRes.rows[0];

    // 5. Record audit log
    await client.query(
      `INSERT INTO audit_logs (
        tenant_id, user_id, action, entity_type, entity_id, ip_address, user_agent, new_state
      ) VALUES ($1, $2, 'USER_INVITED', 'user_invitations', $3, $4, $5, $6);`,
      [
        customerId,
        sessionUser.userId,
        invitation.id,
        clientIp,
        userAgent,
        JSON.stringify({
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expires_at,
          invitedBy: sessionUser.email,
        }),
      ]
    );

    await client.query("COMMIT;");

    const activationUrl = `${baseUrl.replace(/\/$/, "")}/activate?token=${rawToken}`;

    return {
      id: invitation.id,
      tenantId: invitation.tenant_id,
      email: invitation.email,
      role: invitation.role,
      token: rawToken,
      activationUrl,
      expiresAt: invitation.expires_at.toISOString ? invitation.expires_at.toISOString() : invitation.expires_at,
      emailDelivery: {
        sent: false,
        reason: "SMTP_NOT_CONFIGURED",
      },
    };
  } catch (err) {
    await client.query("ROLLBACK;");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Accepts a cryptographic invitation token, sets user password, and activates account.
 */
export async function acceptCustomerInvitation(
  input: AcceptInvitationInput,
  clientIp: string = "127.0.0.1",
  userAgent: string = "CloudE5-App"
): Promise<any> {
  const token = input.token?.trim();
  if (!token || token.length < 32) {
    throw new OnboardingError("Invalid or missing activation token.", "INVALID_TOKEN", 400);
  }

  const password = input.password;
  const passwordProblem = describePasswordProblem(password ?? "");
  if (passwordProblem) {
    throw new OnboardingError(`Password does not meet requirements: ${passwordProblem}`, "WEAK_PASSWORD", 400);
  }

  const fullName = input.fullName?.trim();
  if (!fullName || fullName.length < 2) {
    throw new OnboardingError("Full name must be at least 2 characters.", "INVALID_INPUT", 400);
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const client = await pool.connect();
  try {
    await client.query("BEGIN;");

    // 1. Locate invitation by token hash FOR UPDATE
    const invRes = await client.query(
      `SELECT id, tenant_id, email, role, status, expires_at
       FROM user_invitations
       WHERE token_hash = $1
       FOR UPDATE;`,
      [tokenHash]
    );

    if (invRes.rows.length === 0) {
      await client.query("ROLLBACK;");
      throw new OnboardingError("Invalid or expired invitation token.", "TOKEN_NOT_FOUND", 400);
    }

    const invitation = invRes.rows[0];

    // 2. Validate status and expiration
    if (invitation.status === "ACCEPTED") {
      await client.query("ROLLBACK;");
      throw new OnboardingError(
        "This invitation has already been used. Please log in directly.",
        "TOKEN_ALREADY_USED",
        400
      );
    }

    if (invitation.status !== "PENDING") {
      await client.query("ROLLBACK;");
      throw new OnboardingError(
        `This invitation is no longer active (status: ${invitation.status}).`,
        "TOKEN_INVALID",
        400
      );
    }

    const now = new Date();
    const expiry = new Date(invitation.expires_at);
    if (expiry <= now) {
      await client.query(
        "UPDATE user_invitations SET status = 'EXPIRED' WHERE id = $1;",
        [invitation.id]
      );
      await client.query("COMMIT;");
      throw new OnboardingError(
        "This invitation link has expired. Please contact your administrator.",
        "TOKEN_EXPIRED",
        400
      );
    }

    // 3. Hash password and create active user
    const passwordHash = await hashPassword(password);

    // Check if user already exists
    const userCheck = await client.query(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1;",
      [invitation.email]
    );

    let createdUser: any;
    if (userCheck.rows.length > 0) {
      // Never take over an existing account through an invitation (matches the accept route).
      await client.query("UPDATE user_invitations SET status = 'REVOKED' WHERE id = $1;", [invitation.id]);
      await client.query("COMMIT;");
      throw new OnboardingError("An account with this email address already exists.", "ACCOUNT_EXISTS", 409);
    } else {
      const insertRes = await client.query(
        `INSERT INTO users (
          tenant_id, email, password_hash, full_name, role, is_active, email_verified_at
        ) VALUES ($1, $2, $3, $4, $5, TRUE, CURRENT_TIMESTAMP)
        RETURNING id, tenant_id, email, full_name, role, is_active, created_at;`,
        [invitation.tenant_id, invitation.email.toLowerCase(), passwordHash, fullName, invitation.role]
      );
      createdUser = insertRes.rows[0];
    }

    // 4. Mark invitation as ACCEPTED (single-use enforcement)
    await client.query(
      `UPDATE user_invitations
       SET status = 'ACCEPTED', accepted_at = CURRENT_TIMESTAMP
       WHERE id = $1;`,
      [invitation.id]
    );

    // 5. Record audit log
    await client.query(
      `INSERT INTO audit_logs (
        tenant_id, user_id, action, entity_type, entity_id, ip_address, user_agent, new_state
      ) VALUES ($1, $2, 'INVITATION_ACCEPTED', 'user_invitations', $3, $4, $5, $6);`,
      [
        invitation.tenant_id,
        createdUser.id,
        invitation.id,
        clientIp,
        userAgent,
        JSON.stringify({
          email: createdUser.email,
          role: createdUser.role,
          invitationId: invitation.id,
        }),
      ]
    );

    await client.query("COMMIT;");
    return createdUser;
  } catch (err) {
    await client.query("ROLLBACK;");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Creates an assessment and assigns customer coordinators with cross-tenant boundary validation.
 */
export async function createCustomerAssessment(
  sessionUser: SessionUser,
  input: CreateAssessmentWithAssignmentInput,
  clientIp: string = "127.0.0.1",
  userAgent: string = "CloudE5-App"
): Promise<any> {
  if (!isTliRole(sessionUser.role)) {
    throw new OnboardingError(
      "Only authorized CloudE5 consultants can initialize DPDP compliance assessments.",
      "FORBIDDEN",
      403
    );
  }

  const { tenantId, title, engagementCode, leadConsultantId, targetCompletionDate, assignedUserIds = [] } =
    input;

  if (!tenantId || !title || !engagementCode || !leadConsultantId) {
    throw new OnboardingError("Missing required assessment parameters.", "INVALID_INPUT", 400);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN;");
    await verifyPrivilegedSession(client, sessionUser);

    // 1. Resolve framework version & scoring model
    const fwRes = await client.query("SELECT id FROM framework_versions LIMIT 1;");
    const smRes = await client.query("SELECT id FROM scoring_models LIMIT 1;");
    if (fwRes.rows.length === 0 || smRes.rows.length === 0) {
      await client.query("ROLLBACK;");
      throw new OnboardingError("Baseline framework version or scoring model not configured.", "CONFIG_ERROR", 500);
    }
    const frameworkVersionId = fwRes.rows[0].id;
    const scoringModelId = smRes.rows[0].id;

    // 2. Validate the customer organisation and the engagement lead
    const tRes = await client.query(
      "SELECT id, name FROM tenants WHERE id = $1 AND type = 'CLIENT' AND status = 'ACTIVE';",
      [tenantId]
    );
    if (tRes.rows.length === 0) {
      await client.query("ROLLBACK;");
      throw new OnboardingError("Customer organisation not found.", "NOT_FOUND", 404);
    }
    if (sessionUser.role !== "TLI_SUPER_ADMIN" && leadConsultantId !== sessionUser.userId) {
      await client.query("ROLLBACK;");
      throw new OnboardingError("Only a platform administrator can assign another engagement lead.", "FORBIDDEN", 403);
    }
    const leadRes = await client.query(
      "SELECT id FROM users WHERE id = $1 AND is_active = TRUE AND role IN ('TLI_LEAD_CONSULTANT', 'TLI_SUPER_ADMIN');",
      [leadConsultantId]
    );
    if (leadRes.rows.length === 0) {
      await client.query("ROLLBACK;");
      throw new OnboardingError("The engagement lead must be an active lead consultant.", "INVALID_INPUT", 400);
    }

    // 3. Create assessment
    const assessRes = await client.query(
      `INSERT INTO assessments (
        tenant_id, framework_version_id, scoring_model_id, lead_consultant_id,
        title, engagement_code, status, target_completion_date
      ) VALUES ($1, $2, $3, $4, $5, $6, 'DRAFT', $7)
      RETURNING id, tenant_id, title, engagement_code, status, target_completion_date, created_at;`,
      [
        tenantId,
        frameworkVersionId,
        scoringModelId,
        leadConsultantId,
        title,
        engagementCode,
        targetCompletionDate || null,
      ]
    );

    const newAssessment = assessRes.rows[0];

    // 4. Validate and assign users (with strict cross-tenant protection)
    for (const userId of assignedUserIds) {
      const userCheck = await client.query("SELECT id, tenant_id, full_name, role FROM users WHERE id = $1;", [
        userId,
      ]);
      if (userCheck.rows.length === 0) {
        await client.query("ROLLBACK;");
        throw new OnboardingError(`Assigned user ${userId} not found in database.`, "USER_NOT_FOUND", 400);
      }

      const targetUser = userCheck.rows[0];
      if (targetUser.tenant_id !== tenantId) {
        await client.query("ROLLBACK;");
        throw new OnboardingError(
          `Cross-tenant assignment violation: Assigned user '${targetUser.full_name}' (${userId}) does not belong to the customer organization '${tenantId}'.`,
          "CROSS_TENANT_VIOLATION",
          400
        );
      }

      await client.query(
        `INSERT INTO assessment_assignments (assessment_id, user_id, assignment_role)
         VALUES ($1, $2, 'CLIENT_COORDINATOR')
         ON CONFLICT (assessment_id, user_id) DO NOTHING;`,
        [newAssessment.id, targetUser.id]
      );
    }

    // 5. Audit log
    await client.query(
      `INSERT INTO audit_logs (
        tenant_id, user_id, action, entity_type, entity_id, ip_address, user_agent, new_state
      ) VALUES ($1, $2, 'ASSESSMENT_CREATED', 'assessments', $3, $4, $5, $6);`,
      [
        tenantId,
        sessionUser.userId,
        newAssessment.id,
        clientIp,
        userAgent,
        JSON.stringify({
          code: newAssessment.engagement_code,
          title: newAssessment.title,
          assignedUsersCount: assignedUserIds.length,
        }),
      ]
    );

    await client.query("COMMIT;");
    return newAssessment;
  } catch (err) {
    await client.query("ROLLBACK;");
    throw err;
  } finally {
    client.release();
  }
}
