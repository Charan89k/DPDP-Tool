/**
 * CloudE5 — Report Data Compiler
 *
 * Compiles exhaustive, auditable report data across all 60 questions,
 * 13 statutory domains, evidence items, assessor reviews, and remediations.
 * Enforces role boundaries: internal assessor findings are redacted for clients.
 */

import { createHash } from "node:crypto";
import { executeWithRls } from "../db/rls.ts";
import type { SessionUser } from "../auth/types.ts";
import { isTliRole } from "../auth/rbac.ts";
import { getAssessmentGapAnalysis } from "../gaps/index.ts";
import questionnaireData from "../../data/questionnaire_v1.json" with { type: "json" };
import controlsData from "../../data/dpdp_controls.json" with { type: "json" };
import type {
  ReportDocumentData,
  DomainFindingReportItem,
  QuestionFindingReportItem,
  UnresolvedQuestionReportItem,
  RemediationReportItem,
} from "./types.ts";

export async function compileReportDocumentData(
  sessionUser: SessionUser,
  assessmentId: string,
  isDraft: boolean = true
): Promise<ReportDocumentData> {
  const isConsultant = isTliRole(sessionUser.role);

  // 1. Fetch Assessment & Metadata under RLS
  const dbData = await executeWithRls(sessionUser, async (client) => {
    const assessSql = `
      SELECT 
        a.id,
        a.engagement_code,
        a.title,
        a.status,
        fv.name AS target_framework,
        a.created_at AS start_date,
        a.target_completion_date,
        a.tenant_id,
        t.name AS tenant_name,
        t.slug AS tenant_slug,
        t.industry,
        t.is_sdf,
        t.dpo_name AS dpo_contact_name,
        u.full_name AS lead_consultant_name,
        a.lead_consultant_id,
        a.submitted_at,
        a.reviewed_at,
        a.approved_at,
        a.issued_at
      FROM assessments a
      JOIN framework_versions fv ON fv.id = a.framework_version_id
      LEFT JOIN users u ON u.id = a.lead_consultant_id
      LEFT JOIN tenants t ON t.id = a.tenant_id
      WHERE a.id = $1
      LIMIT 1;
    `;
    const assessRes = await client.query(assessSql, [assessmentId]);
    if (assessRes.rowCount === 0) {
      throw new Error(`Assessment ${assessmentId} not found or access denied under RLS policy.`);
    }

    const assessment = assessRes.rows[0];

    // Fetch remediation tasks
    const remSql = `
      SELECT 
        rt.id,
        rt.question_code,
        rt.title,
        rt.description,
        rt.priority,
        rt.target_date,
        rt.status,
        u.full_name AS owner_name
      FROM remediation_tasks rt
      LEFT JOIN users u ON u.id = rt.owner_user_id
      WHERE (rt.assessment_id = $1 OR rt.tenant_id = $2)
      ORDER BY rt.created_at ASC;
    `;
    const remRes = await client.query(remSql, [assessmentId, assessment.tenant_id]);

    // Fetch lead approver name if approved
    let approverName: string | null = null;
    if (assessment.lead_consultant_id) {
      const apprRes = await client.query(`SELECT full_name FROM users WHERE id = $1;`, [
        assessment.lead_consultant_id,
      ]);
      approverName = apprRes.rows[0]?.full_name || null;
    }

    return {
      assessment,
      remediations: remRes.rows,
      approverName,
    };
  });

  // 2. Fetch Deterministic Gap Analysis under RLS
  const gapAnalysis = await getAssessmentGapAnalysis(sessionUser, assessmentId);

  // Map controls for quick lookup
  const controlMap = new Map<string, any>();
  for (const c of controlsData) {
    controlMap.set(c.control_id, c);
  }

  // 3. Compile Question Findings (all 60 questions)
  const questionFindings: QuestionFindingReportItem[] = [];
  const unresolvedQuestions: UnresolvedQuestionReportItem[] = [];

  for (const q of questionnaireData.questions) {
    const matchingGap = gapAnalysis.gaps.find((g) => g.questionCode === q.code);
    const isUnresolved = q.mapping_status === "UNRESOLVED_PENDING_EXCEL_SHEET";

    if (isUnresolved) {
      unresolvedQuestions.push({
        questionCode: q.code,
        sectionTitle: q.section_title,
        questionText: q.text,
        selectedOption: matchingGap ? matchingGap.selectedOption : null,
        unresolvedReason:
          "Awaiting canonical Excel cross-reference build sheet. Strictly isolated from statutory domain scores and penalties (DEC-08).",
      });
    }

    const mappedCtrl = q.canonical_control_id ? controlMap.get(q.canonical_control_id) : null;

    questionFindings.push({
      questionCode: q.code,
      sectionTitle: q.section_title,
      questionText: q.text,
      selectedOption: matchingGap ? matchingGap.selectedOption : null,
      commentsAndJustification: matchingGap?.factualObservation || null,
      mappedControlId: q.canonical_control_id || null,
      controlTitle: mappedCtrl?.title,
      sourceProvision: matchingGap?.sourceProvision || mappedCtrl?.source_provision || "Pending Mapping",
      statutoryDomain: matchingGap?.statutoryDomain || mappedCtrl?.topic || "UNRESOLVED_PENDING_MAPPING",
      gapType: matchingGap ? matchingGap.gapType : "COMPLIANT_NO_GAP",
      gapSeverity: matchingGap ? matchingGap.gapSeverity : "NONE",
      potentialPenaltyTier: matchingGap?.potentialPenaltyCeiling?.tier || null,
      potentialPenaltyCrores: matchingGap?.potentialPenaltyCeiling?.ceilingCrores || null,
      evidenceReferences: matchingGap?.evidenceItems ? matchingGap.evidenceItems.map((e) => e.fileName) : [],
      // Role Boundary: Censor internal assessor notes for client roles
      assessorFindings: isConsultant ? matchingGap?.assessorReview?.reviewFindings || null : null,
      recommendedRemediation:
        matchingGap?.remediationGuidance ||
        mappedCtrl?.suggested_remediation ||
        "Maintain verified compliance controls and documentation.",
      isUnresolvedMapping: isUnresolved,
    });
  }

  // 4. Compile Domain Summaries
  const domainFindings: DomainFindingReportItem[] = gapAnalysis.domainSummaries.map((d) => ({
    domainCode: d.domainCode,
    domainTitle: d.domainTitle,
    statutoryProvision: d.statutoryProvision,
    domainWeight: d.domainWeight,
    mappedQuestionsCount: d.totalQuestions,
    answeredCount: d.totalQuestions - d.unansweredCount,
    criticalGapsCount: d.criticalGapsCount,
    highGapsCount: d.totalGapsCount - d.criticalGapsCount,
    readinessPct: d.readinessPct,
  }));

  // 5. Compile Remediation Tasks
  const remediationTasks: RemediationReportItem[] = dbData.remediations.map((r: any) => ({
    id: r.id,
    questionCode: r.question_code || null,
    title: r.title,
    description: r.description,
    priority: r.priority,
    targetDate: r.target_date ? new Date(r.target_date).toISOString().split("T")[0] : "Not set",
    status: r.status,
    ownerName: r.owner_name || null,
  }));

  // 6. Dataset SHA-256 Fingerprint
  const datasetDigestPayload = JSON.stringify({
    assessmentId,
    status: dbData.assessment.status,
    scoresHash: gapAnalysis.summary.calculationHash,
    questions: questionFindings.map((q) => ({
      code: q.questionCode,
      opt: q.selectedOption,
      gap: q.gapType,
      sev: q.gapSeverity,
    })),
  });
  const datasetSha256 = createHash("sha256").update(datasetDigestPayload).digest("hex");

  // If assessment is formally issued, isDraft is strictly false
  const effectiveIsDraft = dbData.assessment.status === "FINAL_ISSUED" ? false : isDraft;

  return {
    assessment: {
      id: dbData.assessment.id,
      engagementCode: dbData.assessment.engagement_code,
      title: dbData.assessment.title,
      status: dbData.assessment.status,
      targetFramework: dbData.assessment.target_framework,
      startDate: new Date(dbData.assessment.start_date).toISOString(),
      targetCompletionDate: dbData.assessment.target_completion_date
        ? new Date(dbData.assessment.target_completion_date).toISOString()
        : null,
      tenantId: dbData.assessment.tenant_id,
      tenantName: dbData.assessment.tenant_name,
      tenantSlug: dbData.assessment.tenant_slug,
      industry: dbData.assessment.industry,
      isSdf: Boolean(dbData.assessment.is_sdf),
      dpoContactName: dbData.assessment.dpo_contact_name,
      leadConsultantName: dbData.assessment.lead_consultant_name,
      leadConsultantId: dbData.assessment.lead_consultant_id,
      submittedAt: dbData.assessment.submitted_at,
      reviewedAt: dbData.assessment.reviewed_at,
      approvedAt: dbData.assessment.approved_at,
      issuedAt: dbData.assessment.issued_at,
    },
    executiveSummary: {
      completenessPct: gapAnalysis.summary.completenessPct,
      evidenceCoveragePct: gapAnalysis.summary.evidenceCoveragePct,
      provisionalReadinessPct: gapAnalysis.summary.provisionalReadinessPct,
      provisionalMaturityScore: gapAnalysis.summary.provisionalMaturityScore,
      criticalGapsCount: gapAnalysis.summary.criticalGapsCount,
      highGapsCount: gapAnalysis.summary.highDeficitsCount,
      mediumGapsCount: gapAnalysis.summary.mediumDeficitsCount,
      lowGapsCount: gapAnalysis.summary.lowDeficitsCount,
      unresolvedGapsCount: gapAnalysis.summary.unresolvedMappingsCount,
      totalGapsCount: gapAnalysis.summary.totalGapsCount,
    },
    statutoryPenaltyExposure: (() => {
      let tier1Count = 0;
      let tier2Count = 0;
      let tier3Count = 0;
      let tier4Count = 0;
      let maxExposureCrores = 0;

      for (const gap of gapAnalysis.gaps) {
        if (gap.potentialPenaltyCeiling) {
          const tier = gap.potentialPenaltyCeiling.tier;
          if (tier === "TIER_1") tier1Count++;
          else if (tier === "TIER_2") tier2Count++;
          else if (tier === "TIER_3") tier3Count++;
          else if (tier === "TIER_4") tier4Count++;

          if (gap.potentialPenaltyCeiling.ceilingCrores > maxExposureCrores) {
            maxExposureCrores = gap.potentialPenaltyCeiling.ceilingCrores;
          }
        }
      }

      return {
        tier1Count,
        tier2Count,
        tier3Count,
        tier4Count,
        maxExposureCrores,
        disclaimer:
          "Statutory penalty figures represent maximum legislative ceilings prescribed under Section 33(1) of the Digital Personal Data Protection Act, 2023. These amounts do not constitute assessed fines, legal orders, or predictions of Data Protection Board of India (DPBI) adjudications under Section 33(2).",
      };
    })(),
    domainFindings,
    questionFindings,
    unresolvedQuestions,
    remediationTasks,
    methodologyDisclosures: {
      scoringStatus: "PROVISIONAL_PENDING_APPROVAL",
      provisionalModel: "SCORING-V1-PROVISIONAL",
      governanceReference: "CloudE5 Governance Register (DEC-01 through DEC-10)",
      nonCompensatoryDisclaimer:
        "Non-Compensatory Evaluation Principle: Overall readiness scores and mathematical averages do not mitigate or cure material deficiencies in mandatory statutory safeguards (such as Section 8(4) security controls or Section 8(6) breach notification requirements).",
      statutoryCeilingDisclaimer:
        "Regulatory Exposure Disclosure: Statutory penalties are adjudicated exclusively by the Data Protection Board of India upon complaint, inquiry, or statutory audit pursuant to Section 33(2) guiding factors.",
    },
    auditTrail: {
      reportTemplateVersion: "CE5-REP-V1.0",
      isDraft: effectiveIsDraft,
      draftWatermarkNotice: effectiveIsDraft
        ? "DRAFT AUDIT REPORT — FOR INTERNAL CONSULTING REVIEW ONLY — NOT AN OFFICIAL ADVISORY OPINION"
        : "OFFICIALLY ISSUED REGULATORY COMPLIANCE EVALUATION REPORT",
      generatedAt: new Date().toISOString(),
      generatedByUserId: sessionUser.userId,
      generatedByUserName: sessionUser.fullName,
      approvedByUserId: dbData.assessment.lead_consultant_id,
      approvedByUserName: dbData.approverName,
      approvedAt: dbData.assessment.approved_at,
      datasetSha256,
    },
  };
}
