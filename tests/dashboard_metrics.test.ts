/**
 * TLI DPDP Compliance Gap Analysis Tool — Dashboard Metrics Test Suite
 *
 * Verifies that dashboard figures are derived deterministically from persisted data:
 * lifecycle bucketing, cancelled exclusion, and canonical questionnaire completion rules.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getCanonicalQuestionnaireSections } from "../lib/questionnaire/data.ts";
import {
  bucketAssessmentStatus,
  countAssessmentsByBucket,
  groupResponsesByAssessment,
  summarizePortfolioProgress,
} from "../lib/dashboard/metrics.ts";

const sections = getCanonicalQuestionnaireSections();
const firstSection = sections[0];
const [q1, q2] = firstSection.questions;

describe("Dashboard metrics", () => {
  it("treats DRAFT as an in-progress assessment, not a report draft", () => {
    assert.equal(bucketAssessmentStatus("DRAFT"), "IN_PROGRESS");
    assert.equal(bucketAssessmentStatus("DRAFT_REPORT_GENERATED"), "REPORT_DRAFT");
    assert.equal(bucketAssessmentStatus("UNDER_REVIEW"), "PENDING_VALIDATION");
  });

  it("excludes cancelled assessments from every count", () => {
    const counts = countAssessmentsByBucket(["DRAFT", "CANCELLED", "FINAL_ISSUED", "UNDER_REVIEW"]);
    assert.deepEqual(counts, {
      total: 3,
      inProgress: 1,
      pendingValidation: 1,
      reportDraft: 0,
      completed: 1,
    });
  });

  it("reports zero completion and all questions outstanding when nothing is answered", () => {
    const progress = summarizePortfolioProgress(sections, ["a1"], new Map());
    assert.equal(progress.completionByAssessment.get("a1"), 0);
    assert.equal(progress.unansweredQuestions, 60);
    assert.ok(progress.sectionCompletion.every((s) => s.completed === 0));
  });

  it("counts not-applicable answers only when a justification is provided", () => {
    const responses = groupResponsesByAssessment([
      { assessment_id: "a1", question_code: q1.code, selected_option: "Implemented", comments_and_justification: null },
      {
        assessment_id: "a1",
        question_code: q2.code,
        selected_option: "Not applicable — justification required",
        comments_and_justification: "   ",
      },
    ]);
    const progress = summarizePortfolioProgress(sections, ["a1"], responses);
    const section = progress.sectionCompletion.find((s) => s.sectionCode === firstSection.code)!;
    assert.equal(section.completed, 1, "Unjustified N/A must not count as complete");
    assert.equal(progress.unansweredQuestions, 59);
  });

  it("aggregates section totals across multiple assessments", () => {
    const responses = groupResponsesByAssessment([
      { assessment_id: "a1", question_code: q1.code, selected_option: "Partially implemented", comments_and_justification: null },
      { assessment_id: "a2", question_code: q1.code, selected_option: "Not implemented", comments_and_justification: null },
    ]);
    const progress = summarizePortfolioProgress(sections, ["a1", "a2"], responses);
    const section = progress.sectionCompletion.find((s) => s.sectionCode === firstSection.code)!;
    assert.equal(section.total, firstSection.questions.length * 2);
    assert.equal(section.completed, 2);
  });
});
