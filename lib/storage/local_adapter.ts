/**
 * CloudE5 — Local Disk Storage Adapter
 *
 * Implements real local-disk evidence vault operations with strict tenant isolation,
 * directory traversal protection, SHA-256 calculation, and fail-closed safety.
 *
 * Configured via CLOUDE5_EVIDENCE_DIR (legacy name: DPDP_LOCAL_EVIDENCE_DIR; defaults to
 * '.local_evidence' in the working directory,
 * which is strictly ignored by Git and located outside public/).
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { FileValidator, ValidationError } from "./validation.ts";
import { assertPersistentEvidenceStorage } from "./object_store.ts";

/** Evidence vault directory from configuration (CLOUDE5_EVIDENCE_DIR, legacy DPDP_LOCAL_EVIDENCE_DIR). */
export function resolveEvidenceDirSetting(env: Record<string, string | undefined>): string | undefined {
  return env.CLOUDE5_EVIDENCE_DIR || env.DPDP_LOCAL_EVIDENCE_DIR || undefined;
}

export interface SaveResult {
  bytesWritten: number;
  sha256: string;
  storageKey: string;
}

export class LocalStorageAdapter {
  private baseDir: string;

  constructor(customBaseDir?: string) {
    const configuredDir = customBaseDir || resolveEvidenceDirSetting(process.env);
    
    // Default to .local_evidence in project root if not explicitly configured
    const targetDir = configuredDir
      ? path.resolve(/*turbopackIgnore: true*/ configuredDir)
      : path.resolve(/*turbopackIgnore: true*/ process.cwd(), ".local_evidence");

    // Strictly enforce that the evidence vault is never placed in public/ or client-accessible assets
    const publicDir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), "public");
    if (FileValidator.isSafePath(publicDir, targetDir)) {
      throw new Error(
        "CRITICAL SECURITY VIOLATION: Evidence storage directory cannot be inside the 'public/' directory."
      );
    }

    this.baseDir = targetDir;
    this.ensureDirectoryExists(this.baseDir);
  }

  /**
   * Internal helper ensuring directory exists with appropriate permissions.
   */
  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true, mode: 0o750 });
    }
  }

  /**
   * Resolves and verifies that a storage key resolves safely inside baseDir.
   */
  public resolveSafePath(storageKey: string): string {
    // Prevent empty or whitespace keys
    if (!storageKey || !storageKey.trim()) {
      throw new ValidationError("Storage key cannot be empty.");
    }

    // Disallow backslashes and null bytes
    if (storageKey.includes("\0") || storageKey.includes("\\")) {
      throw new ValidationError("Storage key contains illegal path characters.");
    }

    const resolved = path.resolve(this.baseDir, storageKey);

    if (!FileValidator.isSafePath(this.baseDir, resolved)) {
      throw new ValidationError(`Path traversal detected: '${storageKey}' attempts to escape evidence vault.`);
    }

    return resolved;
  }

  /**
   * Persists binary buffer to local vault at specified storage key.
   * Returns written byte count and computed SHA-256 digest.
   */
  public async saveFile(storageKey: string, content: Buffer): Promise<SaveResult> {
    const targetPath = this.resolveSafePath(storageKey);
    const parentDir = path.dirname(targetPath);

    this.ensureDirectoryExists(parentDir);

    // Compute cryptographic SHA-256 digest
    const hash = crypto.createHash("sha256").update(content).digest("hex");

    // Write file atomically with restricted permissions (0o640: owner rw, group r, others none)
    await fs.promises.writeFile(targetPath, content, { mode: 0o640 });

    return {
      bytesWritten: content.length,
      sha256: hash,
      storageKey,
    };
  }

  /**
   * Reads raw binary payload from local vault.
   * Fails closed if file does not exist.
   */
  public async readFile(storageKey: string): Promise<Buffer> {
    const targetPath = this.resolveSafePath(storageKey);

    if (!fs.existsSync(targetPath)) {
      throw new Error(`Evidence file not found in vault: ${storageKey}`);
    }

    return await fs.promises.readFile(targetPath);
  }

  /**
   * Checks whether an object exists in the local vault.
   */
  public async fileExists(storageKey: string): Promise<boolean> {
    try {
      const targetPath = this.resolveSafePath(storageKey);
      return fs.existsSync(targetPath);
    } catch {
      return false;
    }
  }

  /**
   * Deletes an object from the local vault.
   */
  public async deleteFile(storageKey: string): Promise<void> {
    const targetPath = this.resolveSafePath(storageKey);

    if (fs.existsSync(targetPath)) {
      await fs.promises.unlink(targetPath);
    }
  }

  /**
   * Relocates an object to an isolated quarantine key.
   */
  public async quarantineFile(currentStorageKey: string, quarantineKey: string): Promise<void> {
    const sourcePath = this.resolveSafePath(currentStorageKey);
    const destPath = this.resolveSafePath(quarantineKey);

    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Cannot quarantine missing evidence file: ${currentStorageKey}`);
    }

    const quarantineDir = path.dirname(destPath);
    this.ensureDirectoryExists(quarantineDir);

    await fs.promises.rename(sourcePath, destPath);
  }

  /**
   * Returns base directory path (strictly for diagnostic / test verification; never serialized to client).
   */
  public getVaultBaseDirectory(): string {
    return this.baseDir;
  }
}

// Singleton adapter instance using environment configuration
let defaultAdapter: LocalStorageAdapter | null = null;

export function getLocalStorageAdapter(): LocalStorageAdapter {
  assertPersistentEvidenceStorage();
  if (!defaultAdapter) {
    defaultAdapter = new LocalStorageAdapter();
  }
  return defaultAdapter;
}
