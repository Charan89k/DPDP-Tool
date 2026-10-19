/**
 * CloudE5 — Evidence upload response contract, shared by POST /api/evidence/upload and the
 * browser components that upload evidence. Type-only: safe to import from client code.
 */

import type { EvidenceRecord } from "./service.ts";

export interface UploadedEvidence {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  sha256: string;
  status: EvidenceRecord["status"];
  uploadedAt: string;
  questionCode: string | null;
  evidenceCategory: string | null;
  description: string | null;
}
