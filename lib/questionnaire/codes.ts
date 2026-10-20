/**
 * CloudE5 — Canonical question code checks (server side).
 *
 * Responses and assessor reviews are keyed by question code. Only the 60 canonical codes count
 * towards completeness, so invented codes can neither be stored nor satisfy a lifecycle guard.
 */

import manifestData from "../../data/questionnaire_v1.json" with { type: "json" };
import { normalizeQuestionCode } from "../scoring/engine.ts";

const CANONICAL_CODES: ReadonlySet<string> = new Set(manifestData.questions.map((q) => q.code));

export const CANONICAL_QUESTION_COUNT = CANONICAL_CODES.size;

/** The canonical form of a question code (e.g. "gov-01" -> "GOV-001"), or null if it is not one. */
export function toCanonicalQuestionCode(code: string): string | null {
  const normalized = normalizeQuestionCode(code);
  return CANONICAL_CODES.has(normalized) ? normalized : null;
}

/** Number of distinct canonical questions among the given codes; unknown codes are ignored. */
export function countCanonicalQuestions(codes: Iterable<string>): number {
  const seen = new Set<string>();
  for (const code of codes) {
    const canonical = toCanonicalQuestionCode(code);
    if (canonical) seen.add(canonical);
  }
  return seen.size;
}
