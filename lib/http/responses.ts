/**
 * Client-side helpers for reading API responses safely.
 */

/**
 * Reads a JSON body, tolerating non-JSON error pages (e.g. a proxy's 413 "Request Entity Too
 * Large") and translating common transport failures into user-facing messages.
 */
export async function readJsonResponse(
  res: Response
): Promise<{ data: Record<string, any>; errorMessage: string | null }> {
  let data: Record<string, any> = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (res.ok) {
    return { data, errorMessage: null };
  }
  if (res.status === 413) {
    return {
      data,
      errorMessage: "This file is larger than the server accepts. Please upload a smaller file.",
    };
  }
  return {
    data,
    errorMessage:
      (typeof data.error === "string" && data.error) ||
      `The request failed (HTTP ${res.status}). Please try again.`,
  };
}
