/**
 * CloudE5 — Tenant isolation policy layer for SQLite.
 *
 * SQLite has no row-level security, so CloudE5 enforces the same rules the PostgreSQL
 * deployment enforced (migrations 002–014, final state) through per-connection objects
 * created when the connection opens:
 *
 * - `temp._ctx` holds the request identity (tenant, user, role) and a `bypass` flag.
 *   executeWithRls() sets it after verifying the identity against the database; it is reset
 *   to the privileged system context when the request finishes.
 * - READ isolation: for every tenant-owned table a TEMP VIEW with the same name filters rows by
 *   the policy's USING expression. SQLite resolves unqualified names in the temp schema first,
 *   so every `SELECT ... FROM assessments` in application code is filtered automatically.
 * - WRITE isolation: writes are routed to the base tables (`main.<table>`, see translate.ts)
 *   where TEMP triggers enforce the policies:
 *     INSERT  — WITH CHECK must hold, otherwise the statement aborts.
 *     UPDATE  — rows outside USING are silently skipped (RAISE(IGNORE), as RLS hides them);
 *               a new row violating WITH CHECK aborts.
 *     DELETE  — rows outside USING are silently skipped.
 *     Commands the runtime role was never granted abort with "permission denied".
 *
 * Because the policy objects live on the connection and every query passes through them,
 * individual queries cannot forget tenant scoping. The privileged system context (bypass = 1)
 * corresponds to the PostgreSQL table owner and is used only by authentication, onboarding,
 * migrations and maintenance code paths.
 */

const ROLE = "(SELECT role FROM temp._ctx)";
const TENANT = "(SELECT tenant_id FROM temp._ctx)";
const USER = "(SELECT user_id FROM temp._ctx)";
const BYPASS = "(SELECT bypass FROM temp._ctx)";

const SUPER_ADMIN = `${ROLE} = 'TLI_SUPER_ADMIN'`;
const CONSULTANT = `${ROLE} IN ('TLI_LEAD_CONSULTANT', 'TLI_REVIEWER')`;
const CLIENT_WRITER = `${ROLE} IN ('CLIENT_ADMIN', 'CLIENT_BU_LEAD', 'CLIENT_CONTRIBUTOR')`;
const OPEN_STATUSES = "('DRAFT', 'SCOPING', 'SCOPE_LOCKED', 'DATA_GATHERING')";

/** Equivalent of is_user_assigned_to_assessment(): direct lookup, no policy recursion. */
const assigned = (assessmentExpr: string) =>
  `(${assessmentExpr} IS NOT NULL AND EXISTS (SELECT 1 FROM main.assessment_assignments aa ` +
  `WHERE aa.assessment_id = ${assessmentExpr} AND aa.user_id = ${USER}))`;

/** Equivalent of get_assessment_tenant_id(). */
const assessmentTenant = (assessmentExpr: string) =>
  `(SELECT a.tenant_id FROM main.assessments a WHERE a.id = ${assessmentExpr})`;

const ownTenant = (column: string) => `(${TENANT} IS NOT NULL AND ${column} = ${TENANT})`;

/**
 * `$.` marks a column of the row being checked. It is replaced with an explicit qualifier
 * ('policy_row.' in views, 'NEW.'/'OLD.' in triggers) so that columns inside correlated
 * subqueries can never bind to the subquery's own tables by accident.
 */
type Predicate = string;

interface TablePolicy {
  table: string;
  select: Predicate;
  insert: Predicate | "DENY";
  update: { using: Predicate; check: Predicate } | "DENY";
  delete: Predicate | "DENY";
}

const forAll = (table: string, using: Predicate, check: Predicate = using): TablePolicy => ({
  table,
  select: using,
  insert: check,
  update: { using, check },
  delete: using,
});

const appendOnly = (table: string, select: Predicate, insert: Predicate): TablePolicy => ({
  table,
  select,
  insert,
  update: "DENY",
  delete: "DENY",
});

const tenantScoped = (table: string) => forAll(table, `(${SUPER_ADMIN} OR ${ownTenant("$.tenant_id")})`);

const assessmentScoped: Predicate = `(${SUPER_ADMIN} OR (${CONSULTANT} AND (${assigned("$.id")} OR $.lead_consultant_id = ${USER})) OR ${ownTenant("$.tenant_id")})`;

const responseSelect: Predicate = `(${SUPER_ADMIN} OR ${ownTenant("$.tenant_id")} OR (${CONSULTANT} AND ${assigned("$.assessment_id")}))`;
const responseWrite: Predicate =
  `(${SUPER_ADMIN} OR (${ownTenant("$.tenant_id")} AND ${CLIENT_WRITER} AND $.assessment_id IN ` +
  `(SELECT a.id FROM temp.assessments a WHERE a.tenant_id = ${TENANT} AND a.status IN ${OPEN_STATUSES})))`;

const reviewSelect: Predicate = `(${SUPER_ADMIN} OR (${CONSULTANT} AND ${assigned("$.assessment_id")}) OR (${TENANT} IS NOT NULL AND ${assessmentTenant("$.assessment_id")} = ${TENANT}))`;
const reviewWrite: Predicate = `(${SUPER_ADMIN} OR (${CONSULTANT} AND ${assigned("$.assessment_id")}))`;

const inScopedControls = (column: string) => `${column} IN (SELECT ac.id FROM temp.assessment_controls ac)`;

const evidencePolicy: Predicate =
  `(${SUPER_ADMIN} OR (${CONSULTANT} AND (($.assessment_control_id IS NOT NULL AND ${inScopedControls("$.assessment_control_id")}) ` +
  `OR ($.assessment_id IS NOT NULL AND ${assigned("$.assessment_id")}))) OR ${ownTenant("$.tenant_id")})`;

const clarificationPolicy: Predicate =
  `(${SUPER_ADMIN} OR ($.assessment_control_id IS NOT NULL AND ${inScopedControls("$.assessment_control_id")}) ` +
  `OR ($.assessment_id IS NOT NULL AND ((${TENANT} IS NOT NULL AND ${assessmentTenant("$.assessment_id")} = ${TENANT}) ` +
  `OR (${CONSULTANT} AND ${assigned("$.assessment_id")}))))`;

const remediationPolicy: Predicate =
  `(${SUPER_ADMIN} OR (${CONSULTANT} AND (($.assessment_id IS NOT NULL AND ${assigned("$.assessment_id")}) ` +
  `OR ${inScopedControls("$.assessment_control_id")})) OR ${ownTenant("$.tenant_id")})`;

const consultantAssignedTenant = (column: string) =>
  `(${CONSULTANT} AND ${column} IN (SELECT a.tenant_id FROM main.assessments a WHERE ${assigned("a.id")}))`;

const tenantsAdmin: Predicate = `(${SUPER_ADMIN} OR ${ownTenant("$.id")})`;
const usersAdmin: Predicate = `(${SUPER_ADMIN} OR ${ownTenant("$.tenant_id")})`;
const invitationsAdmin: Predicate = `(${SUPER_ADMIN} OR (${ownTenant("$.tenant_id")} AND ${ROLE} = 'CLIENT_ADMIN'))`;

export const TABLE_POLICIES: TablePolicy[] = [
  {
    table: "tenants",
    select: `(${tenantsAdmin} OR ${consultantAssignedTenant("$.id")})`,
    insert: tenantsAdmin,
    update: { using: tenantsAdmin, check: tenantsAdmin },
    delete: tenantsAdmin,
  },
  tenantScoped("business_units"),
  {
    table: "users",
    select:
      `(${usersAdmin} OR $.id IN (SELECT lead_consultant_id FROM temp.assessments WHERE tenant_id = ${TENANT}) ` +
      `OR ${consultantAssignedTenant("$.tenant_id")})`,
    insert: usersAdmin,
    update: { using: usersAdmin, check: usersAdmin },
    delete: usersAdmin,
  },
  tenantScoped("processing_activities"),
  forAll("assessments", assessmentScoped),
  forAll(
    "assessment_assignments",
    `(${SUPER_ADMIN} OR $.user_id = ${USER} OR (${TENANT} IS NOT NULL AND ${assessmentTenant("$.assessment_id")} = ${TENANT}))`,
    `(${ROLE} IN ('TLI_SUPER_ADMIN', 'TLI_LEAD_CONSULTANT') OR (${TENANT} IS NOT NULL AND ${assessmentTenant("$.assessment_id")} = ${TENANT}))`
  ),
  forAll("assessment_controls", `$.assessment_id IN (SELECT a.id FROM temp.assessments a)`),
  forAll("assessment_control_activities", inScopedControls("$.assessment_control_id")),
  appendOnly("control_response_history", inScopedControls("$.assessment_control_id"), inScopedControls("$.assessment_control_id")),
  forAll("evidence_items", evidencePolicy),
  forAll("clarification_threads", clarificationPolicy),
  forAll("clarification_messages", `$.thread_id IN (SELECT ct.id FROM temp.clarification_threads ct)`),
  forAll("assessment_scores", `$.assessment_id IN (SELECT a.id FROM temp.assessments a)`),
  appendOnly(
    "report_snapshots",
    `(${SUPER_ADMIN} OR (${CONSULTANT} AND (${assigned("$.assessment_id")} OR $.lead_approver_id = ${USER} OR $.generated_by_user_id = ${USER})) OR ${ownTenant("$.tenant_id")})`,
    `(${SUPER_ADMIN} OR (${CONSULTANT} AND (${assigned("$.assessment_id")} OR $.lead_approver_id = ${USER} OR $.generated_by_user_id = ${USER})) OR ${ownTenant("$.tenant_id")})`
  ),
  forAll("remediation_tasks", remediationPolicy),
  forAll("remediation_evidence_items", `$.remediation_task_id IN (SELECT rt.id FROM temp.remediation_tasks rt)`),
  appendOnly(
    "audit_logs",
    `(${SUPER_ADMIN} OR ${ownTenant("$.tenant_id")} OR ($.entity_type = 'assessments' AND ((${CONSULTANT} AND ${assigned("$.entity_id")}) ` +
      `OR (${TENANT} IS NOT NULL AND ${assessmentTenant("$.entity_id")} = ${TENANT}))))`,
    `(${SUPER_ADMIN} OR ${ownTenant("$.tenant_id")} OR ($.entity_type = 'assessments' AND ${CONSULTANT} AND ${assigned("$.entity_id")} ` +
      `AND ($.tenant_id = ${TENANT} OR $.tenant_id = ${assessmentTenant("$.entity_id")})))`
  ),
  {
    table: "assessment_questionnaire_responses",
    select: responseSelect,
    insert: responseWrite,
    update: { using: responseWrite, check: responseWrite },
    delete: "DENY",
  },
  appendOnly(
    "questionnaire_response_history",
    responseSelect,
    `(${SUPER_ADMIN} OR (${ownTenant("$.tenant_id")} AND ${CLIENT_WRITER} AND $.submitted_by_id = ${USER} AND $.assessment_id IN ` +
      `(SELECT a.id FROM temp.assessments a WHERE a.tenant_id = ${TENANT} AND a.status IN ${OPEN_STATUSES})))`
  ),
  {
    table: "questionnaire_assessor_reviews",
    select: reviewSelect,
    insert: reviewWrite,
    update: { using: reviewWrite, check: reviewWrite },
    delete: "DENY",
  },
  appendOnly(
    "questionnaire_assessor_review_history",
    reviewSelect,
    `(${SUPER_ADMIN} OR (${CONSULTANT} AND ${assigned("$.assessment_id")} AND $.reviewed_by_user_id = ${USER}))`
  ),
  appendOnly(
    "evidence_review_history",
    `(${SUPER_ADMIN} OR (${CONSULTANT} AND $.evidence_item_id IN (SELECT ei.id FROM temp.evidence_items ei)) ` +
      `OR (${TENANT} IS NOT NULL AND $.evidence_item_id IN (SELECT ei.id FROM temp.evidence_items ei WHERE ei.tenant_id = ${TENANT})))`,
    `(${SUPER_ADMIN} OR (${CONSULTANT} AND $.evidence_item_id IN (SELECT ei.id FROM temp.evidence_items ei) AND $.reviewed_by_user_id = ${USER}))`
  ),
  {
    table: "user_invitations",
    select: `(${invitationsAdmin} OR (${CONSULTANT} AND $.tenant_id IN (SELECT a.tenant_id FROM temp.assessments a WHERE ${assigned("a.id")})))`,
    insert: invitationsAdmin,
    update: { using: invitationsAdmin, check: invitationsAdmin },
    delete: invitationsAdmin,
  },
  // Authentication tokens are only ever handled by privileged authentication code paths.
  { table: "auth_tokens", select: "0", insert: "DENY", update: "DENY", delete: "DENY" },
];

/** Reference data readable by every authenticated user but never writable at runtime. */
export const READ_ONLY_TABLES = [
  "control_domains",
  "controls",
  "evidence_types",
  "framework_versions",
  "legal_sources",
  "scoring_models",
  "schema_migrations",
];

const qualify = (predicate: Predicate, prefix: string) => predicate.replace(/\$\./g, prefix);

const permissionDenied = (table: string) =>
  `SELECT RAISE(ABORT, 'permission denied for table ${table}');`;
const checkViolation = (table: string) =>
  `SELECT RAISE(ABORT, 'new row violates row-level security policy for table "${table}"');`;

/** Builds the per-connection policy objects (temp views and triggers). */
export function buildPolicySql(): string {
  const statements: string[] = [
    `CREATE TEMP TABLE IF NOT EXISTS _ctx (
       tenant_id TEXT, user_id TEXT, role TEXT, bypass INTEGER NOT NULL
     );`,
    `DELETE FROM temp._ctx;`,
    `INSERT INTO temp._ctx (tenant_id, user_id, role, bypass) VALUES (NULL, NULL, '', 1);`,
  ];
  const guard = (condition: string) => `WHEN ${BYPASS} = 0 AND ${condition}`;
  const notTrue = (predicate: string) => `NOT coalesce((${predicate}), 0)`;

  for (const policy of TABLE_POLICIES) {
    const t = policy.table;
    statements.push(
      `CREATE TEMP VIEW ${t} AS SELECT * FROM main.${t} AS policy_row WHERE ${BYPASS} = 1 OR coalesce((${qualify(policy.select, "policy_row.")}), 0);`
    );

    statements.push(
      policy.insert === "DENY"
        ? `CREATE TEMP TRIGGER ${t}__policy_insert BEFORE INSERT ON main.${t} ${guard("1")} BEGIN ${permissionDenied(t)} END;`
        : `CREATE TEMP TRIGGER ${t}__policy_insert BEFORE INSERT ON main.${t} ${guard(notTrue(qualify(policy.insert, "NEW.")))} BEGIN ${checkViolation(t)} END;`
    );

    if (policy.update === "DENY") {
      statements.push(
        `CREATE TEMP TRIGGER ${t}__policy_update BEFORE UPDATE ON main.${t} ${guard("1")} BEGIN ${permissionDenied(t)} END;`
      );
    } else {
      statements.push(
        `CREATE TEMP TRIGGER ${t}__policy_update_using BEFORE UPDATE ON main.${t} ${guard(notTrue(qualify(policy.update.using, "OLD.")))} BEGIN SELECT RAISE(IGNORE); END;`,
        `CREATE TEMP TRIGGER ${t}__policy_update_check BEFORE UPDATE ON main.${t} ${guard(`coalesce((${qualify(policy.update.using, "OLD.")}), 0) AND ${notTrue(qualify(policy.update.check, "NEW."))}`)} BEGIN ${checkViolation(t)} END;`
      );
    }

    statements.push(
      policy.delete === "DENY"
        ? `CREATE TEMP TRIGGER ${t}__policy_delete BEFORE DELETE ON main.${t} ${guard("1")} BEGIN ${permissionDenied(t)} END;`
        : `CREATE TEMP TRIGGER ${t}__policy_delete BEFORE DELETE ON main.${t} ${guard(notTrue(qualify(policy.delete, "OLD.")))} BEGIN SELECT RAISE(IGNORE); END;`
    );
  }

  for (const t of READ_ONLY_TABLES) {
    for (const op of ["INSERT", "UPDATE", "DELETE"]) {
      statements.push(
        `CREATE TEMP TRIGGER ${t}__policy_${op.toLowerCase()} BEFORE ${op} ON main.${t} ${guard("1")} BEGIN ${permissionDenied(t)} END;`
      );
    }
  }

  return statements.join("\n");
}

export interface PolicyContext {
  tenantId: string | null;
  userId: string | null;
  role: string;
}

export const SET_CONTEXT_SQL = "UPDATE temp._ctx SET tenant_id = ?, user_id = ?, role = ?, bypass = 0";
export const SET_SYSTEM_CONTEXT_SQL = "UPDATE temp._ctx SET tenant_id = NULL, user_id = NULL, role = '', bypass = 1";
export const GET_CONTEXT_SQL = "SELECT tenant_id, user_id, role, bypass FROM temp._ctx";
