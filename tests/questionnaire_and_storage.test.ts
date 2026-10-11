import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import {
  getCanonicalQuestionnaireSections,
  calculateQuestionnaireProgress,
  CANONICAL_DOMAINS,
  STANDARD_MCQ_OPTIONS,
} from "../lib/questionnaire/data.ts";
import type { QuestionResponse } from "../lib/questionnaire/types.ts";
import {
  FileValidator,
  ValidationError,
} from "../lib/storage/validation.ts";
import {
  LocalStorageAdapter,
} from "../lib/storage/local_adapter.ts";
import {
  EvidenceVaultService,
} from "../lib/storage/service.ts";
import type { SessionUser } from "../lib/auth/types.ts";
import { canUploadEvidence } from "../lib/auth/rbac.ts";

describe("Phase 3D.UI.1: Canonical Questionnaire Structure & Section Constraints", () => {
  it("should verify exactly 8 canonical sections and 60 canonical questions", () => {
    const sections = getCanonicalQuestionnaireSections();
    assert.equal(sections.length, 8, "Must have exactly 8 canonical sections");

    const totalQuestions = sections.reduce((acc, s) => acc + s.questions.length, 0);
    assert.equal(totalQuestions, 60, "Must have exactly 60 canonical questions across all sections");
  });

  it("should verify the canonical 8 sections and expected question counts", () => {
    const sections = getCanonicalQuestionnaireSections();
    const expected = [
      { code: "GOV", count: 8 },
      { code: "DAT", count: 8 },
      { code: "NOT", count: 8 },
      { code: "RGT", count: 7 },
      { code: "SEC", count: 10 },
      { code: "RET", count: 6 },
      { code: "TPR", count: 6 },
      { code: "APP", count: 7 },
    ];

    assert.equal(sections.length, expected.length);
    for (let i = 0; i < expected.length; i++) {
      assert.equal(sections[i].code, expected[i].code);
      assert.equal(sections[i].questions.length, expected[i].count);
    }
  });

  it("should provide exactly 5 canonical response options per question in deterministic order", () => {
    const sections = getCanonicalQuestionnaireSections();
    const expectedOptions = [
      "Implemented",
      "Partially implemented",
      "Not implemented",
      "Unknown / not verified",
      "Not applicable — justification required",
    ];

    for (const section of sections) {
      for (const question of section.questions) {
        assert.equal(question.options.length, 5);
        assert.deepEqual(Array.from(question.options), expectedOptions);
      }
    }
  });

  it("should calculate progress deterministically and enforce mandatory justification for Not applicable", () => {
    const sections = getCanonicalQuestionnaireSections();
    const responses: Record<string, QuestionResponse> = {};

    // Baseline: 0 answered
    let progress = calculateQuestionnaireProgress(sections, responses);
    assert.equal(progress.totalQuestions, 60);
    assert.equal(progress.totalAnswered, 0);
    assert.equal(progress.totalExcluded, 0);
    assert.equal(progress.totalUnanswered, 60);
    assert.equal(progress.completionPercentage, 0);

    // Answer 2 questions in GOV
    responses["GOV-001"] = {
      questionCode: "GOV-001",
      selectedOption: "Implemented",
    };
    responses["GOV-002"] = {
      questionCode: "GOV-002",
      selectedOption: "Partially implemented",
    };

    // Selecting 'Not applicable — justification required' WITHOUT justification should not count as answered
    responses["GOV-003"] = {
      questionCode: "GOV-003",
      selectedOption: "Not applicable — justification required",
      commentsAndJustification: "", // empty
    };

    progress = calculateQuestionnaireProgress(sections, responses);
    assert.equal(progress.totalAnswered, 2);
    assert.equal(progress.totalExcluded, 0);
    assert.equal(progress.totalUnanswered, 58);
    assert.equal(progress.hasErrors, true);

    // Now supply justification
    responses["GOV-003"] = {
      questionCode: "GOV-003",
      selectedOption: "Not applicable — justification required",
      commentsAndJustification: "Exempt under Section 17 statutory limits.",
    };

    progress = calculateQuestionnaireProgress(sections, responses);
    assert.equal(progress.totalAnswered, 2);
    assert.equal(progress.totalExcluded, 1);
    assert.equal(progress.totalUnanswered, 57);
    assert.equal(progress.completionPercentage, 5); // 3/60 = 5%
    assert.equal(progress.hasErrors, false);
  });

  it("should mark section complete only when all questions in that section are answered or justified", () => {
    const sections = getCanonicalQuestionnaireSections();
    const responses: Record<string, QuestionResponse> = {};

    // RET has 6 questions (RET-001 to RET-006)
    const retSection = sections.find((s) => s.code === "RET");
    assert.ok(retSection);
    assert.equal(retSection.questions.length, 6);

    let progress = calculateQuestionnaireProgress(sections, responses);
    let retSummary = progress.sectionSummaries.find((s) => s.sectionCode === "RET");
    assert.equal(retSummary?.isComplete, false);

    // Answer all 6 questions in RET
    for (let i = 1; i <= 6; i++) {
      responses[`RET-00${i}`] = {
        questionCode: `RET-00${i}`,
        selectedOption: "Implemented",
      };
    }

    progress = calculateQuestionnaireProgress(sections, responses);
    retSummary = progress.sectionSummaries.find((s) => s.sectionCode === "RET");
    assert.equal(retSummary?.isComplete, true);
    assert.equal(retSummary?.answeredCount, 6);
    assert.equal(retSummary?.unansweredCount, 0);
  });
});

describe("Phase 3D.UI.1: File Validation Engine & Defense-in-Depth", () => {
  const validator = new FileValidator();

  it("should validate and sanitize filenames stripping path traversal and dangerous characters", () => {
    const safe1 = validator.sanitizeFilename("../../etc/passwd.pdf");
    assert.equal(safe1, "passwd.pdf", "Should strip relative path traversal");

    const safe2 = validator.sanitizeFilename("..\\..\\Windows\\System32\\cmd.exe.docx");
    assert.equal(safe2, "cmd_exe.docx", "Should strip Windows backslash traversal and sanitize double extension");

    const safe3 = validator.sanitizeFilename("Evidence\0NullByte:<>|;*&.pdf");
    assert.equal(safe3, "Evidence_NullByte.pdf", "Should strip null bytes and shell characters");

    // Very long name should be truncated
    const longName = "A".repeat(120) + ".pdf";
    const safeLong = validator.sanitizeFilename(longName);
    assert.ok(safeLong.length <= 85);
    assert.ok(safeLong.endsWith(".pdf"));
  });

  it("should reject files violating size boundaries (< 100 bytes or > 50 MB)", () => {
    // Under 100 bytes
    assert.throws(
      () => validator.validateMetadata("doc.pdf", "application/pdf", 50),
      /below minimum allowed/
    );

    // Over 50 MB (52,428,801 bytes)
    assert.throws(
      () => validator.validateMetadata("doc.pdf", "application/pdf", 52_428_801),
      /exceeds maximum allowed/
    );

    // Valid size (10 KB)
    const valid = validator.validateMetadata("doc.pdf", "application/pdf", 10_240);
    assert.equal(valid.sanitizedFilename, "doc.pdf");
    assert.equal(valid.normalizedMime, "application/pdf");
  });

  it("should reject unauthorized MIME types and extension mismatches", () => {
    // Unauthorized MIME
    assert.throws(
      () => validator.validateMetadata("app.exe", "application/x-msdownload", 5000),
      /MIME type 'application\/x-msdownload' is not authorized/
    );

    // Extension mismatch (PDF file declared as PNG)
    assert.throws(
      () => validator.validateMetadata("doc.pdf", "image/png", 5000),
      /does not match declared MIME type/
    );
  });

  it("should verify valid binary magic bytes for PDF, PNG, JPEG, and OOXML", () => {
    // PDF magic bytes (%PDF-)
    const pdfHeader = Buffer.from("%PDF-1.7 header contents for test", "utf-8");
    assert.doesNotThrow(() => validator.verifyMagicBytes(pdfHeader, "application/pdf"));

    // PNG magic bytes
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    assert.doesNotThrow(() => validator.verifyMagicBytes(pngHeader, "image/png"));

    // JPEG magic bytes
    const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    assert.doesNotThrow(() => validator.verifyMagicBytes(jpegHeader, "image/jpeg"));

    // DOCX/XLSX magic bytes (PK\x03\x04)
    const zipHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
    assert.doesNotThrow(() =>
      validator.verifyMagicBytes(
        zipHeader,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
    );
  });

  it("should reject binary signature mismatches and forbidden dangerous signatures", () => {
    // Text file pretending to be PDF
    const fakePdf = Buffer.from("Plain text content that is not a real PDF file", "utf-8");
    assert.throws(
      () => validator.verifyMagicBytes(fakePdf, "application/pdf"),
      /Binary signature mismatch/
    );

    // Windows PE executable masquerading as PDF
    const exePayload = Buffer.from("MZ\x90\x00\x03\x00\x00\x00", "binary");
    assert.throws(
      () => validator.verifyMagicBytes(exePayload, "application/pdf"),
      /Detected forbidden content signature \(Windows PE executable \/ DLL\)/
    );

    // Linux ELF executable
    const elfPayload = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);
    assert.throws(
      () => validator.verifyMagicBytes(elfPayload, "image/png"),
      /Detected forbidden content signature \(Linux ELF executable\)/
    );

    // Stored XSS HTML vector
    const htmlPayload = Buffer.from("<!DOCTYPE html><html><script>alert(1)</script></html>", "utf-8");
    assert.throws(
      () => validator.verifyMagicBytes(htmlPayload, "application/pdf"),
      /Detected forbidden content signature \(HTML content/
    );
  });

  it("should generate strictly opaque, server-controlled storage keys", () => {
    const key = FileValidator.generateStorageKey(
      "tenant-alpha-123",
      "assessment-456",
      "TLI-DPDP-SCO-01",
      "evidence-789"
    );

    assert.equal(
      key,
      "tenants/tenant-alpha-123/assessments/assessment-456/controls/TLI-DPDP-SCO-01/evidence-789.bin"
    );

    // Must never contain client filename
    assert.ok(!key.includes(".pdf"));
    assert.ok(!key.includes("secret_report"));
  });
});

describe("Phase 3D.UI.1: Local Storage Adapter & Filesystem Vault", () => {
  const testVaultDir = path.resolve(process.cwd(), ".local_evidence_test_" + Date.now());
  let adapter: LocalStorageAdapter;

  before(() => {
    adapter = new LocalStorageAdapter(testVaultDir);
  });

  after(async () => {
    // Cleanup temporary test vault directory
    if (fs.existsSync(testVaultDir)) {
      await fs.promises.rm(testVaultDir, { recursive: true, force: true });
    }
  });

  it("should refuse initialization if configured inside public/ directory", () => {
    const badPath = path.resolve(process.cwd(), "public", "evidence_vault");
    assert.throws(
      () => new LocalStorageAdapter(badPath),
      /Evidence storage directory cannot be inside the 'public\/' directory/
    );
  });

  it("should persist binary payload, verify SHA-256 digest, and retrieve exact content", async () => {
    const key = "tenants/t1/assessments/a1/controls/TLI-DPDP-SCO-01/e1.bin";
    const payload = Buffer.from("%PDF-1.7\nSample DPDP RoPA Evidence Content\n%%EOF", "utf-8");

    const expectedSha256 = crypto.createHash("sha256").update(payload).digest("hex");

    const saveRes = await adapter.saveFile(key, payload);
    assert.equal(saveRes.bytesWritten, payload.length);
    assert.equal(saveRes.sha256, expectedSha256);

    const exists = await adapter.fileExists(key);
    assert.equal(exists, true);

    const retrieved = await adapter.readFile(key);
    assert.deepEqual(retrieved, payload);
  });

  it("should block path traversal attempts escaping the storage vault", async () => {
    const traversalKeys = [
      "../../etc/passwd",
      "../test.bin",
      "tenants/t1/../../../secret.txt",
      "tenants/t1/assessments/..\\..\\loot.bin",
    ];

    for (const badKey of traversalKeys) {
      await assert.rejects(
        async () => adapter.saveFile(badKey, Buffer.from("test")),
        /Path traversal detected|illegal path characters/
      );

      await assert.rejects(
        async () => adapter.readFile(badKey),
        /Path traversal detected|illegal path characters/
      );
    }
  });

  it("should support quarantine file relocation and deletion", async () => {
    const originalKey = "tenants/t1/assessments/a1/controls/TLI-DPDP-SEC-01/malware.bin";
    const quarantineKey = FileValidator.generateQuarantineKey("t1", "malware");
    const payload = Buffer.from("%PDF-1.7\nSuspicious File", "utf-8");

    await adapter.saveFile(originalKey, payload);
    assert.equal(await adapter.fileExists(originalKey), true);

    await adapter.quarantineFile(originalKey, quarantineKey);

    assert.equal(await adapter.fileExists(originalKey), false, "Original key should no longer exist");
    assert.equal(await adapter.fileExists(quarantineKey), true, "Quarantine key should exist");

    await adapter.deleteFile(quarantineKey);
    assert.equal(await adapter.fileExists(quarantineKey), false, "Quarantine file should be deleted");
  });
});

describe("Phase 3D.UI.1: Multi-Tenant Access & Quarantine Download Gate", () => {
  const testVaultDir = path.resolve(process.cwd(), ".local_evidence_sec_" + Date.now());
  let adapter: LocalStorageAdapter;
  let service: EvidenceVaultService;

  const tenantAlphaUser: SessionUser = {
    userId: "usr-alpha-contributor",
    tenantId: "tenant-alpha-uuid",
    tenantName: "Alpha Health",
    tenantSlug: "alpha-health",
    tenantType: "CLIENT",
    isSdf: true,
    email: "contributor@alpha.example.com",
    fullName: "Alpha Contributor",
    role: "CLIENT_CONTRIBUTOR",
  };

  const tenantAlphaViewer: SessionUser = {
    userId: "usr-alpha-viewer",
    tenantId: "tenant-alpha-uuid",
    tenantName: "Alpha Health",
    tenantSlug: "alpha-health",
    tenantType: "CLIENT",
    isSdf: true,
    email: "viewer@alpha.example.com",
    fullName: "Alpha Viewer",
    role: "CLIENT_VIEWER",
  };

  const tenantBetaUser: SessionUser = {
    userId: "usr-beta-contributor",
    tenantId: "tenant-beta-uuid",
    tenantName: "Beta Logistics",
    tenantSlug: "beta-logistics",
    tenantType: "CLIENT",
    isSdf: false,
    email: "contributor@beta.example.com",
    fullName: "Beta Contributor",
    role: "CLIENT_CONTRIBUTOR",
  };

  const tliSuperAdmin: SessionUser = {
    userId: "usr-tli-admin",
    tenantId: "tenant-tli-uuid",
    tenantName: "Truth Labs International",
    tenantSlug: "truth-labs",
    tenantType: "TLI",
    isSdf: false,
    email: "admin@truthlabs.in",
    fullName: "TLI Super Admin",
    role: "TLI_SUPER_ADMIN",
  };

  before(() => {
    adapter = new LocalStorageAdapter(testVaultDir);
    service = new EvidenceVaultService(adapter);
    EvidenceVaultService.clearMockRegistry();
  });

  after(async () => {
    EvidenceVaultService.clearMockRegistry();
    if (fs.existsSync(testVaultDir)) {
      await fs.promises.rm(testVaultDir, { recursive: true, force: true });
    }
  });

  it("should enforce RBAC rule blocking CLIENT_VIEWER from uploading evidence", () => {
    assert.equal(
      canUploadEvidence(tenantAlphaViewer.role),
      false,
      "CLIENT_VIEWER must not have upload permissions"
    );
    assert.equal(
      canUploadEvidence(tenantAlphaUser.role),
      true,
      "CLIENT_CONTRIBUTOR must have upload permissions"
    );
  });

  it("should upload evidence, record metadata, and allow authorized tenant download", async () => {
    const validPdfPayload = Buffer.from(
      "%PDF-1.7\n%Valid DPDP Compliance Policy Document\n" + "A".repeat(150) + "\n%%EOF",
      "utf-8"
    );

    const record = await service.uploadEvidence({
      sessionUser: tenantAlphaUser,
      assessmentId: "assessment-alpha-001",
      controlCode: "TLI-DPDP-SCO-01",
      filename: "Data_Inventory_RoPA.pdf",
      mimeType: "application/pdf",
      content: validPdfPayload,
    });

    assert.equal(record.fileName, "Data_Inventory_RoPA.pdf");
    assert.equal(record.tenantId, tenantAlphaUser.tenantId);
    assert.equal(record.status, "ACTIVE");

    // Download by tenant alpha user should succeed
    const download = await service.getEvidenceForDownload(tenantAlphaUser, record.id);
    assert.equal(download.record.id, record.id);
    assert.deepEqual(download.content, validPdfPayload);
  });

  it("should block cross-tenant download attempts (Tenant Beta cannot download Tenant Alpha file)", async () => {
    const validPdf = Buffer.from("%PDF-1.7\nAlpha Confidential Data\n%%EOF" + "B".repeat(100), "utf-8");

    const record = await service.uploadEvidence({
      sessionUser: tenantAlphaUser,
      assessmentId: "assessment-alpha-001",
      controlCode: "TLI-DPDP-LGL-01",
      filename: "Confidential_Alpha.pdf",
      mimeType: "application/pdf",
      content: validPdf,
    });

    // Beta tenant attempts to download Alpha's evidence
    await assert.rejects(
      async () => service.getEvidenceForDownload(tenantBetaUser, record.id),
      /Tenant isolation policy prohibits cross-tenant evidence download/
    );

    // TLI Super Admin CAN download for global forensic review
    const adminDownload = await service.getEvidenceForDownload(tliSuperAdmin, record.id);
    assert.equal(adminDownload.record.id, record.id);
  });

  it("should fail closed and block downloads for QUARANTINED, PENDING_SCAN, and PENDING_UPLOAD files", async () => {
    const validPdf = Buffer.from("%PDF-1.7\nQuarantined Payload\n%%EOF" + "C".repeat(100), "utf-8");

    const record = await service.uploadEvidence({
      sessionUser: tenantAlphaUser,
      assessmentId: "assessment-alpha-001",
      controlCode: "TLI-DPDP-SEC-01",
      filename: "Quarantine_Test.pdf",
      mimeType: "application/pdf",
      content: validPdf,
    });

    // Manually transition to QUARANTINED
    EvidenceVaultService.setMockRecordStatus(record.id, "QUARANTINED");

    await assert.rejects(
      async () => service.getEvidenceForDownload(tenantAlphaUser, record.id),
      /File cannot be downloaded while in status 'QUARANTINED'/
    );

    // Manually transition to PENDING_SCAN
    EvidenceVaultService.setMockRecordStatus(record.id, "PENDING_SCAN");

    await assert.rejects(
      async () => service.getEvidenceForDownload(tenantAlphaUser, record.id),
      /File cannot be downloaded while in status 'PENDING_SCAN'/
    );

    // Revert back to ACTIVE -> download succeeds
    EvidenceVaultService.setMockRecordStatus(record.id, "ACTIVE");
    const cleanDownload = await service.getEvidenceForDownload(tenantAlphaUser, record.id);
    assert.equal(cleanDownload.record.id, record.id);
  });
});
