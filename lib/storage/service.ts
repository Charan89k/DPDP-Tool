/**
 * CloudE5 — Evidence Vault Service
 *
 * Coordinates file validation, local disk vault persistence, database metadata
 * registration under PostgreSQL Row-Level Security, and fail-closed download gating.
 * There is no in-memory fallback: if metadata cannot be authorized and persisted, the
 * operation fails and no orphaned payload is left in the vault.
 */

import crypto from "node:crypto";
import { FileValidator, ValidationError } from "./validation.ts";
import { getConfiguredScanner, MalwareDetectedError, type MalwareScanner } from "./malware_scanner.ts";
import { getLocalStorageAdapter, LocalStorageAdapter } from "./local_adapter.ts";
import type { SaveResult } from "./local_adapter.ts";
import { executeWithRls } from "../db/rls.ts";
import type { SessionUser } from "../auth/types.ts";
import { canAccessAllTenants, isTliRole, canReviewAssessment } from "../auth/rbac.ts";

export interface EvidenceRecord {
  id: string;
  tenantId: string;
  assessmentId: string;
  controlCode: string;
  questionCode?: string | null;
  evidenceCategory?: string | null;
  description?: string | null;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  storageKey: string;
  sha256: string;
  status: "PENDING_UPLOAD" | "PENDING_SCAN" | "ACTIVE" | "VERIFIED" | "REJECTED" | "QUARANTINED" | "SUPERSEDED" | "DELETED";
  quarantineReason?: string | null;
  /** Who checked the payload before storage: CLAMAV when a virus scanner ran, else LOCAL_VALIDATOR. */
  scanProvider?: string;
  uploadedByUserId: string;
  verifiedByReviewerId?: string | null;
  verificationNotes?: string | null;
  verifiedAt?: string | null;
  createdAt: string;
}

/**
 * Persists and retrieves evidence metadata. Production uses PostgreSQL under RLS; there is no
 * silent fallback, so database or authorization failures always fail the operation (fail closed).
 */
export interface EvidenceMetadataStore {
  /**
   * Authorizes the upload against the target assessment, persists the payload via `persistPayload`
   * and records metadata atomically. Returns the owning tenant of the assessment.
   */
  recordUpload(
    sessionUser: SessionUser,
    record: EvidenceRecord,
    persistPayload: () => Promise<SaveResult>
  ): Promise<{ tenantId: string; save: SaveResult }>;
  findForDownload(sessionUser: SessionUser, evidenceId: string): Promise<EvidenceRecord | null>;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class PostgresEvidenceMetadataStore implements EvidenceMetadataStore {
  public async recordUpload(
    sessionUser: SessionUser,
    record: EvidenceRecord,
    persistPayload: () => Promise<SaveResult>
  ): Promise<{ tenantId: string; save: SaveResult }> {
    if (!UUID_PATTERN.test(record.assessmentId)) {
      throw new ValidationError("A valid assessment identifier is required for evidence upload.");
    }

    return executeWithRls(sessionUser, async (client) => {
      // Authorize before any bytes are written: the assessment must be visible under RLS.
      const assessRes = await client.query(
        "SELECT id, tenant_id FROM assessments WHERE id = $1 LIMIT 1;",
        [record.assessmentId]
      );
      if (assessRes.rowCount === 0) {
        throw new ValidationError(
          "Access denied: Target assessment not found or not accessible under your security profile."
        );
      }
      const assessment = assessRes.rows[0];

      const ctrlRes = await client.query(
        `SELECT ac.id
         FROM assessment_controls ac
         JOIN controls c ON c.id = ac.control_id
         WHERE ac.assessment_id = $1 AND c.code = $2
         LIMIT 1`,
        [record.assessmentId, record.controlCode]
      );
      const assessmentControlId = ctrlRes.rows[0]?.id || null;

      const save = await persistPayload();

      await client.query(
        `INSERT INTO evidence_items (
          id, tenant_id, assessment_id, assessment_control_id, question_code,
          evidence_category, description, uploaded_by_user_id,
          file_name, file_size_bytes, mime_type, s3_key, s3_bucket,
          sha256_hash, status, scan_provider, scan_result, scanned_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8,
          $9, $10, $11, $12, 'local-vault',
          $13, 'ACTIVE', $14, 'CLEAN', CURRENT_TIMESTAMP
        )`,
        [
          record.id,
          assessment.tenant_id,
          record.assessmentId,
          assessmentControlId,
          record.questionCode || record.controlCode,
          record.evidenceCategory || null,
          record.description || null,
          sessionUser.userId,
          record.fileName,
          save.bytesWritten,
          record.mimeType,
          record.storageKey,
          save.sha256,
          record.scanProvider || "LOCAL_VALIDATOR",
        ]
      );

      return { tenantId: assessment.tenant_id as string, save };
    });
  }

  public async findForDownload(
    sessionUser: SessionUser,
    evidenceId: string
  ): Promise<EvidenceRecord | null> {
    if (!UUID_PATTERN.test(evidenceId)) {
      return null;
    }
    return executeWithRls(sessionUser, async (client) => {
      const res = await client.query(
        `SELECT
          ei.id, ei.tenant_id, ei.file_name, ei.file_size_bytes, ei.mime_type,
          ei.s3_key, ei.sha256_hash, ei.status, ei.quarantine_reason,
          ei.uploaded_by_user_id, ei.created_at,
          ei.question_code, ei.evidence_category, ei.description,
          ei.verified_by_reviewer_id, ei.verification_notes, ei.verified_at,
          c.code AS control_code,
          COALESCE(ei.assessment_id, ac.assessment_id) AS assessment_id
         FROM evidence_items ei
         LEFT JOIN assessment_controls ac ON ac.id = ei.assessment_control_id
         LEFT JOIN controls c ON c.id = ac.control_id
         WHERE ei.id = $1`,
        [evidenceId]
      );

      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      return {
        id: row.id,
        tenantId: row.tenant_id,
        assessmentId: row.assessment_id || "default",
        controlCode: row.control_code || row.question_code || "GENERIC",
        questionCode: row.question_code || null,
        evidenceCategory: row.evidence_category || null,
        description: row.description || null,
        fileName: row.file_name,
        fileSizeBytes: Number(row.file_size_bytes),
        mimeType: row.mime_type,
        storageKey: row.s3_key,
        sha256: row.sha256_hash,
        status: row.status,
        quarantineReason: row.quarantine_reason,
        uploadedByUserId: row.uploaded_by_user_id,
        verifiedByReviewerId: row.verified_by_reviewer_id,
        verificationNotes: row.verification_notes,
        verifiedAt: row.verified_at ? row.verified_at.toISOString() : null,
        createdAt: row.created_at.toISOString(),
      } as EvidenceRecord;
    });
  }
}

/**
 * Explicit in-memory metadata store for isolated unit tests of validation, storage, tenant
 * checks and download gating. It performs no assessment authorization and must never be used
 * by application code.
 */
export class InMemoryEvidenceMetadataStore implements EvidenceMetadataStore {
  private records = new Map<string, EvidenceRecord>();

  public async recordUpload(
    _sessionUser: SessionUser,
    record: EvidenceRecord,
    persistPayload: () => Promise<SaveResult>
  ): Promise<{ tenantId: string; save: SaveResult }> {
    const save = await persistPayload();
    this.records.set(record.id, { ...record });
    return { tenantId: record.tenantId, save };
  }

  public async findForDownload(_sessionUser: SessionUser, evidenceId: string) {
    const record = this.records.get(evidenceId);
    return record ? { ...record } : null;
  }

  public setStatus(evidenceId: string, status: EvidenceRecord["status"]): void {
    const record = this.records.get(evidenceId);
    if (record) {
      this.records.set(evidenceId, { ...record, status });
    }
  }
}

const DOWNLOAD_BLOCKED_STATUSES: ReadonlyArray<EvidenceRecord["status"]> = [
  "QUARANTINED",
  "PENDING_SCAN",
  "PENDING_UPLOAD",
  "DELETED",
];

export class EvidenceVaultService {
  private validator: FileValidator;
  private adapter: LocalStorageAdapter;
  private metadataStore: EvidenceMetadataStore;
  private scanner: MalwareScanner | null;

  constructor(
    adapter?: LocalStorageAdapter,
    validator?: FileValidator,
    metadataStore?: EvidenceMetadataStore,
    scanner?: MalwareScanner | null
  ) {
    this.adapter = adapter || getLocalStorageAdapter();
    this.validator = validator || new FileValidator();
    this.metadataStore = metadataStore || new PostgresEvidenceMetadataStore();
    this.scanner = scanner === undefined ? getConfiguredScanner() : scanner;
  }

  /**
   * Validates an evidence file, authorizes the target assessment, persists the payload to the
   * vault and registers metadata. If metadata registration fails the stored payload is removed,
   * so storage and database never diverge.
   */
  public async uploadEvidence(params: {
    sessionUser: SessionUser;
    assessmentId: string;
    controlCode?: string;
    questionCode?: string;
    evidenceCategory?: string;
    description?: string;
    filename: string;
    mimeType: string;
    content: Buffer;
  }): Promise<EvidenceRecord> {
    const {
      sessionUser,
      assessmentId,
      controlCode = "GENERIC",
      questionCode,
      evidenceCategory,
      description,
      filename,
      mimeType,
      content,
    } = params;

    // 1. Validate file metadata (size, MIME type allowlist, extension matching, filename sanitization)
    const { sanitizedFilename, normalizedMime } = this.validator.validateMetadata(
      filename,
      mimeType,
      content.length
    );

    // 2. Validate binary magic bytes against declared MIME type and blocked signatures
    this.validator.verifyMagicBytes(content, normalizedMime);

    // 2b. Virus scan when a scanner is configured; failures reject the upload (fail closed)
    if (this.scanner) {
      const result = await this.scanner.scan(content);
      if (!result.clean) {
        console.warn(
          `Evidence upload rejected by ${this.scanner.provider}: ${result.signature} (tenant ${sessionUser.tenantId}, user ${sessionUser.userId})`
        );
        throw new MalwareDetectedError();
      }
    }

    // 3. Generate opaque evidence ID and storage key
    const evidenceId = crypto.randomUUID();
    const storageKey = FileValidator.generateStorageKey(
      sessionUser.tenantId,
      assessmentId,
      questionCode || controlCode || "GENERIC",
      evidenceId
    );

    const draft: EvidenceRecord = {
      id: evidenceId,
      tenantId: sessionUser.tenantId,
      assessmentId,
      controlCode: controlCode || questionCode || "GENERIC",
      questionCode: questionCode || null,
      evidenceCategory: evidenceCategory || null,
      description: description || null,
      fileName: sanitizedFilename,
      fileSizeBytes: content.length,
      mimeType: normalizedMime,
      storageKey,
      sha256: "",
      scanProvider: this.scanner?.provider || "LOCAL_VALIDATOR",
      status: "ACTIVE", // Verified and clean through pre-storage inspection
      uploadedByUserId: sessionUser.userId,
      createdAt: new Date().toISOString(),
    };

    // 4. Authorize, persist payload and register metadata as one unit
    let payloadWritten = false;
    try {
      const { tenantId, save } = await this.metadataStore.recordUpload(sessionUser, draft, async () => {
        const result = await this.adapter.saveFile(storageKey, content);
        payloadWritten = true;
        return result;
      });
      return {
        ...draft,
        tenantId,
        fileSizeBytes: save.bytesWritten,
        sha256: save.sha256,
      };
    } catch (err) {
      if (payloadWritten) {
        await this.adapter.deleteFile(storageKey).catch((cleanupErr) => {
          console.error("Failed to remove orphaned evidence payload after metadata failure:", cleanupErr);
        });
      }
      throw err;
    }
  }

  /**
   * Retrieves an evidence record, enforcing multi-tenant isolation and fail-closed scan gates.
   */
  public async getEvidenceForDownload(
    sessionUser: SessionUser,
    evidenceId: string
  ): Promise<{ record: EvidenceRecord; content: Buffer }> {
    const record = await this.metadataStore.findForDownload(sessionUser, evidenceId);

    if (!record) {
      throw new ValidationError("Evidence record not found.");
    }

    // Defense in depth on top of RLS: client users may only download their own tenant's evidence
    if (
      record.tenantId !== sessionUser.tenantId &&
      !canAccessAllTenants(sessionUser.role) &&
      !isTliRole(sessionUser.role)
    ) {
      throw new ValidationError("Access denied: Tenant isolation policy prohibits cross-tenant evidence download.");
    }

    // Fail-closed scan status check: quarantined, deleted, or unscanned payloads are never served
    if (DOWNLOAD_BLOCKED_STATUSES.includes(record.status)) {
      throw new ValidationError(
        `Access denied: File cannot be downloaded while in status '${record.status}'. Quarantined, deleted, or unverified payloads are blocked for security.`
      );
    }

    const content = await this.adapter.readFile(record.storageKey);

    return { record, content };
  }

  /**
   * Records an assessor review decision on an evidence item with audit tracking.
   */
  public async reviewEvidence(params: {
    sessionUser: SessionUser;
    evidenceId: string;
    status: "VERIFIED" | "REJECTED" | "ACTIVE" | "SUPERSEDED" | "QUARANTINED";
    verificationNotes?: string;
  }): Promise<EvidenceRecord> {
    const { sessionUser, evidenceId, status, verificationNotes } = params;

    if (!canReviewAssessment(sessionUser.role)) {
      throw new ValidationError("Access denied: Only authorized CloudE5 assessors can record evidence review decisions.");
    }

    return await executeWithRls(sessionUser, async (client) => {
      const prevRes = await client.query(
        "SELECT id, status, tenant_id, assessment_id, question_code, file_name, file_size_bytes, mime_type, s3_key, sha256_hash, uploaded_by_user_id, created_at FROM evidence_items WHERE id = $1 LIMIT 1;",
        [evidenceId]
      );
      if (prevRes.rowCount === 0) {
        throw new ValidationError("Evidence record not found or access denied under RLS.");
      }
      const prev = prevRes.rows[0];

      await client.query(
        `UPDATE evidence_items
         SET status = $1,
             verification_notes = $2,
             verified_by_reviewer_id = $3,
             verified_at = CURRENT_TIMESTAMP
         WHERE id = $4;`,
        [status, verificationNotes || null, sessionUser.userId, evidenceId]
      );

      // Record immutable audit history
      await client.query(
        `INSERT INTO evidence_review_history (
          evidence_item_id,
          previous_status,
          new_status,
          verification_notes,
          reviewed_by_user_id
        ) VALUES ($1, $2, $3, $4, $5);`,
        [evidenceId, prev.status, status, verificationNotes || null, sessionUser.userId]
      );

      const updatedRecord: EvidenceRecord = {
        id: prev.id,
        tenantId: prev.tenant_id,
        assessmentId: prev.assessment_id || "default",
        controlCode: prev.question_code || "GENERIC",
        questionCode: prev.question_code,
        fileName: prev.file_name,
        fileSizeBytes: Number(prev.file_size_bytes),
        mimeType: prev.mime_type,
        storageKey: prev.s3_key,
        sha256: prev.sha256_hash,
        status,
        verificationNotes: verificationNotes || null,
        verifiedByReviewerId: sessionUser.userId,
        verifiedAt: new Date().toISOString(),
        uploadedByUserId: prev.uploaded_by_user_id,
        createdAt: prev.created_at.toISOString(),
      };

      return updatedRecord;
    });
  }

  /**
   * Soft-deletes an evidence item following retention rules and recording audit info.
   */
  public async deleteEvidence(params: {
    sessionUser: SessionUser;
    evidenceId: string;
  }): Promise<{ deleted: boolean }> {
    const { sessionUser, evidenceId } = params;

    return await executeWithRls(sessionUser, async (client) => {
      const res = await client.query(
        "SELECT id, tenant_id, uploaded_by_user_id, status FROM evidence_items WHERE id = $1 LIMIT 1;",
        [evidenceId]
      );
      if (res.rowCount === 0) {
        throw new ValidationError("Evidence record not found or access denied.");
      }
      const item = res.rows[0];

      const isOwner = item.uploaded_by_user_id === sessionUser.userId;
      const isAdminOfTenant = sessionUser.role === "CLIENT_ADMIN" && item.tenant_id === sessionUser.tenantId;
      const isSuperAdmin = sessionUser.role === "TLI_SUPER_ADMIN";

      if (!isOwner && !isAdminOfTenant && !isSuperAdmin) {
        throw new ValidationError("Access denied: You do not have permission to delete this evidence item.");
      }

      await client.query(
        `UPDATE evidence_items
         SET status = 'DELETED',
             deleted_at = CURRENT_TIMESTAMP,
             deleted_by_user_id = $1
         WHERE id = $2;`,
        [sessionUser.userId, evidenceId]
      );

      return { deleted: true };
    });
  }
}
