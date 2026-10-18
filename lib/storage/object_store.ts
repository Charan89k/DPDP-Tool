/**
 * TLI DPDP Compliance Gap Analysis Tool — Evidence Storage Environment Guard
 *
 * Evidence payloads are written to a persistent local vault (LocalStorageAdapter).
 * Serverless hosts such as Vercel have a read-only, ephemeral filesystem: writing evidence
 * there either fails or silently loses files between invocations. The vault therefore refuses
 * to operate on Vercel instead of accepting uploads it cannot keep.
 */

export class StorageConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageConfigurationError";
  }
}

export const STORAGE_NOT_CONFIGURED_MESSAGE =
  "Evidence storage is not available on this server. Please contact your administrator.";

export function assertPersistentEvidenceStorage(
  env: Record<string, string | undefined> = process.env
): void {
  if (env.VERCEL === "1") {
    throw new StorageConfigurationError(
      "Evidence storage requires a persistent filesystem. Vercel's filesystem is ephemeral, so " +
        "evidence uploads are disabled on this deployment."
    );
  }
}
