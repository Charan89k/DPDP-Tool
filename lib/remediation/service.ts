/**
 * TLI DPDP Compliance Gap Analysis Tool — Remediation Workflow Service
 *
 * Implements Corrective and Preventive Action (CAPA) tracking, assignment,
 * closure submissions by clients, and independent assessor validation under RLS.
 *
 * Core Governance Guarantee:
 * Completing a remediation task does NOT alter the original questionnaire responses
 * or mutate issued immutable report snapshots.
 */

import { executeWithRls } from "../db/rls.ts";
import type { SessionUser } from "../auth/types.ts";
import { isTliRole } from "../auth/rbac.ts";
import type {
  RemediationTask,
  CreateRemediationInput,
  UpdateRemediationInput,
  ValidateRemediationInput,
} from "./types.ts";

/**
 * Fetches all remediation tasks for an assessment under PostgreSQL RLS.
 */
export async function getAssessmentRemediations(
  sessionUser: SessionUser,
  assessmentId: string
): Promise<RemediationTask[]> {
  return await executeWithRls(sessionUser, async (client) => {
    const sql = `
      SELECT 
        rt.id,
        rt.tenant_id,
        rt.assessment_id,
        rt.question_code,
        rt.assessment_control_id,
        rt.title,
        rt.description,
        rt.priority,
        rt.target_date,
        rt.owner_user_id,
        u_owner.full_name AS owner_name,
        rt.status,
        rt.closure_submission_notes,
        rt.closure_submitted_at,
        rt.closure_validated_by_id,
        u_val.full_name AS closure_validated_by_name,
        rt.closure_validation_notes,
        rt.validated_at,
        rt.created_at,
        rt.updated_at
      FROM remediation_tasks rt
      LEFT JOIN users u_owner ON u_owner.id = rt.owner_user_id
      LEFT JOIN users u_val ON u_val.id = rt.closure_validated_by_id
      WHERE rt.assessment_id = $1
      ORDER BY 
        CASE rt.priority
          WHEN 'CRITICAL' THEN 1
          WHEN 'HIGH' THEN 2
          WHEN 'MEDIUM' THEN 3
          WHEN 'LOW' THEN 4
          ELSE 5
        END ASC,
        rt.created_at ASC;
    `;
    const res = await client.query(sql, [assessmentId]);

    return res.rows.map((r) => ({
      id: r.id,
      tenantId: r.tenant_id,
      assessmentId: r.assessment_id,
      questionCode: r.question_code,
      assessmentControlId: r.assessment_control_id,
      title: r.title,
      description: r.description,
      priority: r.priority,
      targetDate: r.target_date ? new Date(r.target_date).toISOString().split("T")[0] : "",
      ownerUserId: r.owner_user_id,
      ownerName: r.owner_name,
      status: r.status,
      closureSubmissionNotes: r.closure_submission_notes,
      closureSubmittedAt: r.closure_submitted_at ? new Date(r.closure_submitted_at).toISOString() : null,
      closureValidatedById: r.closure_validated_by_id,
      closureValidatedByName: r.closure_validated_by_name,
      closureValidationNotes: r.closure_validation_notes,
      validatedAt: r.validated_at ? new Date(r.validated_at).toISOString() : null,
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
    }));
  });
}

/**
 * Creates a remediation task linked to an assessment finding.
 */
export async function createRemediationTask(
  sessionUser: SessionUser,
  input: CreateRemediationInput
): Promise<RemediationTask> {
  const { assessmentId, questionCode, title, description, priority, targetDate, ownerUserId } = input;

  return await executeWithRls(sessionUser, async (client) => {
    // 1. Resolve tenant_id from assessment
    const assessRes = await client.query(
      `SELECT id, tenant_id FROM assessments WHERE id = $1;`,
      [assessmentId]
    );
    if (assessRes.rowCount === 0) {
      throw new Error(`Assessment ${assessmentId} not found or access denied.`);
    }
    const tenantId = assessRes.rows[0].tenant_id;

    // 2. Insert into remediation_tasks
    const insertSql = `
      INSERT INTO remediation_tasks (
        tenant_id,
        assessment_id,
        question_code,
        title,
        description,
        priority,
        target_date,
        owner_user_id,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'OPEN')
      RETURNING *;
    `;
    const res = await client.query(insertSql, [
      tenantId,
      assessmentId,
      questionCode || null,
      title,
      description,
      priority,
      targetDate,
      ownerUserId || null,
    ]);

    const row = res.rows[0];

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, new_state)
       VALUES ($1, $2, 'CREATE_REMEDIATION_TASK', 'remediation_tasks', $3, $4);`,
      [
        tenantId,
        sessionUser.userId,
        row.id,
        JSON.stringify({ title, priority, questionCode }),
      ]
    );

    return {
      id: row.id,
      tenantId: row.tenant_id,
      assessmentId: row.assessment_id,
      questionCode: row.question_code,
      assessmentControlId: row.assessment_control_id,
      title: row.title,
      description: row.description,
      priority: row.priority,
      targetDate: row.target_date ? new Date(row.target_date).toISOString().split("T")[0] : "",
      ownerUserId: row.owner_user_id,
      ownerName: null,
      status: row.status,
      closureSubmissionNotes: row.closure_submission_notes,
      closureSubmittedAt: null,
      closureValidatedById: null,
      closureValidatedByName: null,
      closureValidationNotes: null,
      validatedAt: null,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  });
}

/**
 * Updates remediation task progress or submits closure evidence/notes.
 * Clients cannot mark as VALIDATED_CLOSED; they must submit for closure.
 */
export async function updateRemediationProgress(
  sessionUser: SessionUser,
  taskId: string,
  input: UpdateRemediationInput
): Promise<RemediationTask> {
  const isConsultant = isTliRole(sessionUser.role);

  // Client cannot directly validate and close without assessor validation
  if (!isConsultant && input.status === "VALIDATED_CLOSED") {
    throw new Error(
      "Authority violation: Clients cannot mark remediation tasks as VALIDATED_CLOSED. Submission for closure requires independent TLI assessor validation."
    );
  }

  return await executeWithRls(sessionUser, async (client) => {
    const existingRes = await client.query(
      `SELECT * FROM remediation_tasks WHERE id = $1 FOR UPDATE;`,
      [taskId]
    );
    if (existingRes.rowCount === 0) {
      throw new Error(`Remediation task ${taskId} not found or access denied.`);
    }

    const current = existingRes.rows[0];
    const newStatus = input.status || current.status;
    let submittedAt = current.closure_submitted_at;

    if (newStatus === "SUBMITTED_FOR_CLOSURE" && !submittedAt) {
      submittedAt = new Date().toISOString();
    }

    const updateSql = `
      UPDATE remediation_tasks
      SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        target_date = COALESCE($3, target_date),
        owner_user_id = COALESCE($4, owner_user_id),
        status = $5,
        closure_submission_notes = COALESCE($6, closure_submission_notes),
        closure_submitted_at = $7,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *;
    `;

    const res = await client.query(updateSql, [
      input.title || null,
      input.description || null,
      input.targetDate || null,
      input.ownerUserId || null,
      newStatus,
      input.closureSubmissionNotes || null,
      submittedAt,
      taskId,
    ]);

    const row = res.rows[0];
    return {
      id: row.id,
      tenantId: row.tenant_id,
      assessmentId: row.assessment_id,
      questionCode: row.question_code,
      assessmentControlId: row.assessment_control_id,
      title: row.title,
      description: row.description,
      priority: row.priority,
      targetDate: row.target_date ? new Date(row.target_date).toISOString().split("T")[0] : "",
      ownerUserId: row.owner_user_id,
      ownerName: null,
      status: row.status,
      closureSubmissionNotes: row.closure_submission_notes,
      closureSubmittedAt: row.closure_submitted_at ? new Date(row.closure_submitted_at).toISOString() : null,
      closureValidatedById: row.closure_validated_by_id,
      closureValidatedByName: null,
      closureValidationNotes: row.closure_validation_notes,
      validatedAt: row.validated_at ? new Date(row.validated_at).toISOString() : null,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  });
}

/**
 * Validates a remediation task closure (TLI Assessors & Lead Consultants only).
 * Sets status to VALIDATED_CLOSED or REJECTED_REOPENED.
 */
export async function validateRemediationClosure(
  sessionUser: SessionUser,
  taskId: string,
  input: ValidateRemediationInput
): Promise<RemediationTask> {
  if (!isTliRole(sessionUser.role)) {
    throw new Error(
      `Authority violation: Role ${sessionUser.role} is not authorized to validate remediation closures. Independent TLI assessor review required.`
    );
  }

  const { action, validationNotes } = input;
  const targetStatus = action === "VALIDATE_CLOSE" ? "VALIDATED_CLOSED" : "REJECTED_REOPENED";

  return await executeWithRls(sessionUser, async (client) => {
    const existingRes = await client.query(
      `SELECT * FROM remediation_tasks WHERE id = $1 FOR UPDATE;`,
      [taskId]
    );
    if (existingRes.rowCount === 0) {
      throw new Error(`Remediation task ${taskId} not found or access denied.`);
    }

    const current = existingRes.rows[0];

    const updateSql = `
      UPDATE remediation_tasks
      SET
        status = $1,
        closure_validated_by_id = $2,
        closure_validation_notes = $3,
        validated_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *;
    `;

    const res = await client.query(updateSql, [
      targetStatus,
      sessionUser.userId,
      validationNotes,
      taskId,
    ]);

    const row = res.rows[0];

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, previous_state, new_state)
       VALUES ($1, $2, 'VALIDATE_REMEDIATION_TASK', 'remediation_tasks', $3, $4, $5);`,
      [
        sessionUser.tenantId,
        sessionUser.userId,
        taskId,
        JSON.stringify({ status: current.status }),
        JSON.stringify({ status: targetStatus, notes: validationNotes }),
      ]
    );

    return {
      id: row.id,
      tenantId: row.tenant_id,
      assessmentId: row.assessment_id,
      questionCode: row.question_code,
      assessmentControlId: row.assessment_control_id,
      title: row.title,
      description: row.description,
      priority: row.priority,
      targetDate: row.target_date ? new Date(row.target_date).toISOString().split("T")[0] : "",
      ownerUserId: row.owner_user_id,
      ownerName: null,
      status: row.status,
      closureSubmissionNotes: row.closure_submission_notes,
      closureSubmittedAt: row.closure_submitted_at ? new Date(row.closure_submitted_at).toISOString() : null,
      closureValidatedById: row.closure_validated_by_id,
      closureValidatedByName: sessionUser.fullName,
      closureValidationNotes: row.closure_validation_notes,
      validatedAt: row.validated_at ? new Date(row.validated_at).toISOString() : null,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  });
}
