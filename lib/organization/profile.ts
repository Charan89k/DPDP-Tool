/**
 * CloudE5 — Organisation profile and onboarding.
 *
 * Customer administrators maintain their organisation's profile (industry, Significant Data
 * Fiduciary status as notified by the Central Government, DPO / grievance contact) and complete
 * onboarding. All access runs through executeWithRls, so a user can only ever read or change
 * their own organisation; only CLIENT_ADMIN (or a platform administrator) may change it.
 */

import { z } from "zod";
import { executeWithRls } from "../db/rls.ts";
import type { SessionUser } from "../auth/types.ts";
import { workEmailSchema } from "../auth/work_email.ts";

import { TEAM_SIZES } from "./options.ts";


// An empty field means "not given": stored as null.
const optionalText = (max: number) =>
  z.literal("").transform(() => null).or(z.string().trim().max(max).nullable().optional());

export const organizationProfileSchema = z.object({
  name: z.string().trim().min(2, "Enter your organisation's name.").max(160),
  industry: z.string().trim().max(120).nullable().optional(),
  isSdf: z.boolean(),
  dpoName: z.string().trim().max(120).nullable().optional(),
  dpoEmail: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .max(254)
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  teamSize: z.enum(TEAM_SIZES).nullable().optional(),
  contactPhone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number.")
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  contactEmail: workEmailSchema.nullable().optional().or(z.literal("").transform(() => null)),
  website: optionalText(200),
  address: optionalText(300),
  completeOnboarding: z.boolean().optional(),
});

export type OrganizationProfileInput = z.infer<typeof organizationProfileSchema>;

export interface OrganizationProfile {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  isSdf: boolean;
  dpoName: string | null;
  dpoEmail: string | null;
  teamSize: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  website: string | null;
  address: string | null;
  onboardingCompletedAt: string | null;
}

export class OrganizationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "OrganizationError";
    this.statusCode = statusCode;
  }
}

/** tenants row with PROFILE_COLUMNS selected. */
interface TenantProfileRow {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  is_sdf: boolean;
  dpo_name: string | null;
  dpo_email: string | null;
  team_size: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  website: string | null;
  address: string | null;
  onboarding_completed_at: Date | string | null;
}

function toProfile(row: TenantProfileRow): OrganizationProfile {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    industry: row.industry ?? null,
    isSdf: Boolean(row.is_sdf),
    dpoName: row.dpo_name ?? null,
    dpoEmail: row.dpo_email ?? null,
    teamSize: row.team_size ?? null,
    contactPhone: row.contact_phone ?? null,
    contactEmail: row.contact_email ?? null,
    website: row.website ?? null,
    address: row.address ?? null,
    onboardingCompletedAt: row.onboarding_completed_at ? new Date(row.onboarding_completed_at).toISOString() : null,
  };
}

const PROFILE_COLUMNS =
  "id, name, slug, industry, is_sdf, dpo_name, dpo_email, team_size, contact_phone, contact_email, website, address, onboarding_completed_at";

export async function getOrganizationProfile(sessionUser: SessionUser): Promise<OrganizationProfile> {
  return executeWithRls(sessionUser, async (client) => {
    const res = await client.query(`SELECT ${PROFILE_COLUMNS} FROM tenants WHERE id = $1;`, [sessionUser.tenantId]);
    if (res.rows.length === 0) throw new OrganizationError("Organisation not found.", 404);
    return toProfile(res.rows[0]);
  });
}

export async function updateOrganizationProfile(
  sessionUser: SessionUser,
  input: OrganizationProfileInput
): Promise<OrganizationProfile> {
  if (sessionUser.role !== "CLIENT_ADMIN" && sessionUser.role !== "TLI_SUPER_ADMIN") {
    throw new OrganizationError("Only organisation administrators can change the organisation profile.", 403);
  }
  return executeWithRls(sessionUser, async (client) => {
    const res = await client.query(
      `UPDATE tenants
       SET name = $1, industry = $2, is_sdf = $3, dpo_name = $4, dpo_email = $5,
           team_size = $8, contact_phone = $9, contact_email = $10, website = $11, address = $12,
           onboarding_completed_at = CASE WHEN $6 THEN COALESCE(onboarding_completed_at, CURRENT_TIMESTAMP)
                                          ELSE onboarding_completed_at END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING ${PROFILE_COLUMNS};`,
      [
        input.name,
        input.industry || null,
        input.isSdf,
        input.dpoName || null,
        input.dpoEmail || null,
        input.completeOnboarding === true,
        sessionUser.tenantId,
        input.teamSize || null,
        input.contactPhone || null,
        input.contactEmail || null,
        input.website || null,
        input.address || null,
      ]
    );
    if (res.rows.length === 0) throw new OrganizationError("Organisation not found.", 404);
    await client.query(
      `INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, new_state)
       VALUES ($1, $2, 'ORGANIZATION_PROFILE_UPDATED', 'tenants', $1, $3);`,
      [
        sessionUser.tenantId,
        sessionUser.userId,
        JSON.stringify({ industry: input.industry || null, isSdf: input.isSdf, onboardingCompleted: input.completeOnboarding === true }),
      ]
    );
    return toProfile(res.rows[0]);
  });
}
