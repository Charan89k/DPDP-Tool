/**
 * Client-side helpers for reading API responses safely.
 */

/**
 * `data` has the endpoint's success shape T; read T's fields only after checking that errorMessage
 * is null (on failure only the optional error fields are present).
 */
export type JsonResult<T> = {
  data: T & { error?: unknown; details?: unknown; code?: unknown };
  errorMessage: string | null;
};

/**
 * Reads a JSON body, tolerating non-JSON error pages (e.g. a proxy's 413 "Request Entity Too
 * Large") and translating common transport failures into user-facing messages. T is the shape the
 * endpoint returns on success; on failure only the error fields can be relied on.
 */
export async function readJsonResponse<T extends object = Record<string, unknown>>(
  res: Response
): Promise<JsonResult<T>> {
  let data: Record<string, unknown> = {};
  try {
    const parsed: unknown = await res.json();
    if (parsed && typeof parsed === "object") data = parsed as Record<string, unknown>;
  } catch {
    data = {};
  }

  if (res.ok) {
    // The endpoint's success contract: this app's own API, so its shape is trusted here.
    return { data: data as JsonResult<T>["data"], errorMessage: null };
  }
  if (res.status === 413) {
    return {
      data: data as JsonResult<T>["data"],
      errorMessage: "This file is larger than the server accepts. Please upload a smaller file.",
    };
  }
  return {
    data: data as JsonResult<T>["data"],
    errorMessage:
      (typeof data.error === "string" && data.error) ||
      `The request failed (HTTP ${res.status}). Please try again.`,
  };
}
