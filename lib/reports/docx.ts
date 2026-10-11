/**
 * TLI DPDP Compliance Gap Analysis Tool — Professional Word (.docx) Exporter
 *
 * Implements authoritative report generation preserving Truth Labs International
 * brand typography, tables, headers, footers, pagination, draft watermarks,
 * and complete 60-question audit provenance.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  HeadingLevel,
  Header,
  Footer,
  PageNumber,
  ShadingType,
} from "docx";
import type { ReportDocumentData } from "./types.ts";

const BRAND_NAVY = "16191F";
const BRAND_STONE_DARK = "292524";
const BRAND_STONE_MUTED = "78716C";
const BRAND_AMBER_BG = "FEF3C7";
const BRAND_AMBER_BORDER = "F59E0B";
const BRAND_ROSE_BG = "FFE4E6";
const BRAND_ROSE_BORDER = "E11D48";
const BG_HEADER_GRAY = "F5F5F4";
const BORDER_LIGHT_GRAY = "E7E5E4";

type AlignmentValue = (typeof AlignmentType)[keyof typeof AlignmentType];

function createTableCell(
  text: string,
  options?: {
    isHeader?: boolean;
    bold?: boolean;
    widthPct?: number;
    bgColor?: string;
    align?: AlignmentValue;
  }
): TableCell {
  return new TableCell({
    width: options?.widthPct ? { size: options.widthPct, type: WidthType.PERCENTAGE } : undefined,
    shading: options?.bgColor
      ? { fill: options.bgColor, type: ShadingType.CLEAR }
      : options?.isHeader
      ? { fill: BG_HEADER_GRAY, type: ShadingType.CLEAR }
      : undefined,
    margins: { top: 120, bottom: 120, left: 140, right: 140 },
    children: [
      new Paragraph({
        alignment: options?.align || AlignmentType.LEFT,
        children: [
          new TextRun({
            text: text || "—",
            bold: options?.bold || options?.isHeader || false,
            size: options?.isHeader ? 18 : 17, // 9pt / 8.5pt
            font: "Arial",
            color: options?.isHeader ? BRAND_NAVY : BRAND_STONE_DARK,
          }),
        ],
      }),
    ],
  });
}

export async function generateWordReport(data: ReportDocumentData): Promise<Buffer> {
  const isDraft = data.auditTrail.isDraft;

  // Header & Footer
  const docHeader = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({
            text: "Truth Labs International — DPDP Compliance Advisory | ",
            size: 16,
            font: "Arial",
            color: BRAND_STONE_MUTED,
          }),
          new TextRun({
            text: isDraft ? "[DRAFT COPY]" : "OFFICIAL REPORT",
            size: 16,
            bold: true,
            font: "Arial",
            color: isDraft ? BRAND_AMBER_BORDER : BRAND_NAVY,
          }),
        ],
      }),
    ],
  });

  const docFooter = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        children: [
          new TextRun({
            text: `REF: TLI-DPDP-REP-${data.assessment.id.slice(0, 8).toUpperCase()} | CONFIDENTIAL & PROPRIETARY | Page `,
            size: 16,
            font: "Arial",
            color: BRAND_STONE_MUTED,
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            size: 16,
            font: "Arial",
            color: BRAND_STONE_MUTED,
          }),
          new TextRun({
            text: " of ",
            size: 16,
            font: "Arial",
            color: BRAND_STONE_MUTED,
          }),
          new TextRun({
            children: [PageNumber.TOTAL_PAGES],
            size: 16,
            font: "Arial",
            color: BRAND_STONE_MUTED,
          }),
        ],
      }),
    ],
  });

  const children: (Paragraph | Table)[] = [];

  // ==========================================
  // 1. DRAFT BANNER (If draft)
  // ==========================================
  if (isDraft) {
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                shading: { fill: BRAND_AMBER_BG, type: ShadingType.CLEAR },
                margins: { top: 160, bottom: 160, left: 200, right: 200 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: "⚠ DRAFT ASSESSMENT REPORT — FOR CONSULTING REVIEW ONLY",
                        bold: true,
                        size: 22,
                        font: "Arial",
                        color: "92400E",
                      }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: "This document is a draft evaluation compiled prior to formal Lead Consultant issuance. In accordance with TLI governance decisions DEC-01 and DEC-08, numeric scores are advisory pending final methodology ratification.",
                        size: 16,
                        font: "Arial",
                        color: "78350F",
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );
    children.push(new Paragraph({ spacing: { after: 200 } }));
  }

  // ==========================================
  // 2. DOCUMENT TITLE & PERIMETER BLOCK
  // ==========================================
  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      spacing: { before: 200, after: 100 },
      children: [
        new TextRun({
          text: "Truth Labs International",
          bold: true,
          size: 36,
          font: "Georgia",
          color: BRAND_NAVY,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: "FORENSIC PRIVACY & STATUTORY DPDP COMPLIANCE ADVISORY REPORT",
          bold: true,
          size: 20,
          font: "Arial",
          color: BRAND_STONE_MUTED,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `Engagement: ${data.assessment.title}`,
          bold: true,
          size: 26,
          font: "Georgia",
          color: BRAND_STONE_DARK,
        }),
      ],
    })
  );

  // Engagement Details Table
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            createTableCell("Data Fiduciary Entity", { isHeader: true, widthPct: 25 }),
            createTableCell(data.assessment.tenantName, { widthPct: 25, bold: true }),
            createTableCell("Classification", { isHeader: true, widthPct: 25 }),
            createTableCell(
              data.assessment.isSdf
                ? "Significant Data Fiduciary (SDF)"
                : "Standard Data Fiduciary",
              { widthPct: 25 }
            ),
          ],
        }),
        new TableRow({
          children: [
            createTableCell("Target Framework", { isHeader: true, widthPct: 25 }),
            createTableCell(data.assessment.targetFramework, { widthPct: 25 }),
            createTableCell("Status", { isHeader: true, widthPct: 25 }),
            createTableCell(data.assessment.status, { widthPct: 25, bold: true }),
          ],
        }),
        new TableRow({
          children: [
            createTableCell("Lead Consultant", { isHeader: true, widthPct: 25 }),
            createTableCell(data.assessment.leadConsultantName || "Assigned by TLI", { widthPct: 25 }),
            createTableCell("Evaluation Date", { isHeader: true, widthPct: 25 }),
            createTableCell(new Date(data.auditTrail.generatedAt).toLocaleDateString("en-IN"), {
              widthPct: 25,
            }),
          ],
        }),
      ],
    }),
    new Paragraph({ spacing: { after: 280 } })
  );

  // ==========================================
  // 3. EXECUTIVE SUMMARY & FOUR INDEPENDENT METRICS
  // ==========================================
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 120 },
      children: [
        new TextRun({
          text: "1. Executive Summary & Core Metrics Ledger",
          bold: true,
          size: 24,
          font: "Georgia",
          color: BRAND_NAVY,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 160 },
      children: [
        new TextRun({
          text: "The Digital Personal Data Protection Act, 2023 establishes mandatory, non-negotiable statutory safeguards. In alignment with TLI forensic methodology, statutory compliance is evaluated on a strict non-compensatory standard: mathematical averages in procedural areas do not cure or offset material deficits in core statutory obligations.",
          size: 18,
          font: "Arial",
          color: BRAND_STONE_DARK,
        }),
      ],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            createTableCell("Assessment Completeness", { isHeader: true, widthPct: 25 }),
            createTableCell("Evidence Coverage Ratio", { isHeader: true, widthPct: 25 }),
            createTableCell("Indicative Readiness %", { isHeader: true, widthPct: 25 }),
            createTableCell("Critical Statutory Deficits", { isHeader: true, widthPct: 25 }),
          ],
        }),
        new TableRow({
          children: [
            createTableCell(`${data.executiveSummary.completenessPct}% (60 Questions)`, {
              widthPct: 25,
              bold: true,
            }),
            createTableCell(`${data.executiveSummary.evidenceCoveragePct}% (Verified Artefacts)`, {
              widthPct: 25,
              bold: true,
            }),
            createTableCell(
              `${data.executiveSummary.provisionalReadinessPct}% (${data.executiveSummary.provisionalMaturityScore.toFixed(2)} / 5.00)`,
              { widthPct: 25, bold: true }
            ),
            createTableCell(`${data.executiveSummary.criticalGapsCount} Deficits (Tiers 1-2)`, {
              widthPct: 25,
              bold: true,
              bgColor: data.executiveSummary.criticalGapsCount > 0 ? BRAND_ROSE_BG : undefined,
            }),
          ],
        }),
      ],
    }),
    new Paragraph({ spacing: { after: 280 } })
  );

  // ==========================================
  // 4. STATUTORY PENALTY EXPOSURE CEILINGS (Section 33(1))
  // ==========================================
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 120 },
      children: [
        new TextRun({
          text: "2. Statutory Penalty Ceilings Matrix (Section 33(1))",
          bold: true,
          size: 24,
          font: "Georgia",
          color: BRAND_NAVY,
        }),
      ],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            createTableCell("Schedule Penalty Tier", { isHeader: true, widthPct: 35 }),
            createTableCell("Statutory Ceiling Amount", { isHeader: true, widthPct: 35 }),
            createTableCell("Identified Gaps Count", { isHeader: true, widthPct: 30 }),
          ],
        }),
        new TableRow({
          children: [
            createTableCell("Tier 1: Security Safeguards Failure (Section 8(4))", { widthPct: 35 }),
            createTableCell("Up to ₹250 Crores", { widthPct: 35, bold: true }),
            createTableCell(`${data.statutoryPenaltyExposure.tier1Count} Gaps`, { widthPct: 30 }),
          ],
        }),
        new TableRow({
          children: [
            createTableCell("Tier 2: Breach Notification Failure (Section 8(6))", { widthPct: 35 }),
            createTableCell("Up to ₹200 Crores", { widthPct: 35, bold: true }),
            createTableCell(`${data.statutoryPenaltyExposure.tier2Count} Gaps`, { widthPct: 30 }),
          ],
        }),
        new TableRow({
          children: [
            createTableCell("Tier 3: Children's Data & SDF Duties (Sec 9, 10)", { widthPct: 35 }),
            createTableCell("Up to ₹150 Crores", { widthPct: 35, bold: true }),
            createTableCell(`${data.statutoryPenaltyExposure.tier3Count} Gaps`, { widthPct: 30 }),
          ],
        }),
        new TableRow({
          children: [
            createTableCell("Tier 4: General Statutory Default (Schedule Item 4)", { widthPct: 35 }),
            createTableCell("Up to ₹50 Crores", { widthPct: 35, bold: true }),
            createTableCell(`${data.statutoryPenaltyExposure.tier4Count} Gaps`, { widthPct: 30 }),
          ],
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 100, after: 280 },
      children: [
        new TextRun({
          text: `Statutory Disclaimer: ${data.statutoryPenaltyExposure.disclaimer}`,
          size: 16,
          font: "Arial",
          color: BRAND_STONE_MUTED,
          italics: true,
        }),
      ],
    })
  );

  // ==========================================
  // 5. 13 STATUTORY DOMAINS BREAKDOWN
  // ==========================================
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 120 },
      children: [
        new TextRun({
          text: "3. Statutory Domain Findings Breakdown",
          bold: true,
          size: 24,
          font: "Georgia",
          color: BRAND_NAVY,
        }),
      ],
    })
  );

  const domainRows: TableRow[] = [
    new TableRow({
      children: [
        createTableCell("Domain", { isHeader: true, widthPct: 30 }),
        createTableCell("Statutory Provision", { isHeader: true, widthPct: 25 }),
        createTableCell("Weight", { isHeader: true, widthPct: 15 }),
        createTableCell("Questions Answered", { isHeader: true, widthPct: 15 }),
        createTableCell("Readiness", { isHeader: true, widthPct: 15 }),
      ],
    }),
  ];

  for (const d of data.domainFindings) {
    domainRows.push(
      new TableRow({
        children: [
          createTableCell(d.domainTitle, { widthPct: 30, bold: true }),
          createTableCell(d.statutoryProvision, { widthPct: 25 }),
          createTableCell(`${d.domainWeight.toFixed(2)}x`, { widthPct: 15 }),
          createTableCell(`${d.answeredCount} / ${d.mappedQuestionsCount}`, { widthPct: 15 }),
          createTableCell(`${d.readinessPct}%`, { widthPct: 15, bold: true }),
        ],
      })
    );
  }

  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: domainRows }));
  children.push(new Paragraph({ spacing: { after: 280 } }));

  // ==========================================
  // 6. QUESTION-BY-QUESTION FINDING LEDGER (60 Questions)
  // ==========================================
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 120 },
      children: [
        new TextRun({
          text: "4. Comprehensive 60-Question Audit Ledger",
          bold: true,
          size: 24,
          font: "Georgia",
          color: BRAND_NAVY,
        }),
      ],
    })
  );

  const questionRows: TableRow[] = [
    new TableRow({
      children: [
        createTableCell("Code", { isHeader: true, widthPct: 10 }),
        createTableCell("Question Text & Section", { isHeader: true, widthPct: 35 }),
        createTableCell("Respondent Choice", { isHeader: true, widthPct: 20 }),
        createTableCell("Provision & Control", { isHeader: true, widthPct: 15 }),
        createTableCell("Severity & Remediation", { isHeader: true, widthPct: 20 }),
      ],
    }),
  ];

  for (const q of data.questionFindings) {
    const isCritical = q.gapSeverity === "CRITICAL_GAP";
    questionRows.push(
      new TableRow({
        children: [
          createTableCell(q.questionCode, { widthPct: 10, bold: true }),
          createTableCell(`${q.questionText}\n[Section: ${q.sectionTitle}]`, { widthPct: 35 }),
          createTableCell(q.selectedOption || "Unanswered", {
            widthPct: 20,
            bgColor: isCritical ? BRAND_ROSE_BG : undefined,
            bold: isCritical,
          }),
          createTableCell(
            q.isUnresolvedMapping
              ? "Pending Mapping (DEC-08)"
              : `${q.sourceProvision}\n(${q.mappedControlId || "—"})`,
            { widthPct: 15 }
          ),
          createTableCell(
            `Severity: ${q.gapSeverity}\nRemediation: ${q.recommendedRemediation}`,
            { widthPct: 20 }
          ),
        ],
      })
    );
  }

  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: questionRows }));
  children.push(new Paragraph({ spacing: { after: 280 } }));

  // ==========================================
  // 7. UNRESOLVED QUESTION MAPPINGS (4 Questions)
  // ==========================================
  if (data.unresolvedQuestions.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 120 },
        children: [
          new TextRun({
            text: "5. Unresolved Governance Items (DEC-08 Register)",
            bold: true,
            size: 24,
            font: "Georgia",
            color: BRAND_NAVY,
          }),
        ],
      }),
      new Paragraph({
        spacing: { after: 140 },
        children: [
          new TextRun({
            text: "The following 4 questionnaire items are pending receipt of the canonical Excel cross-reference sheet. In strict adherence to governance decision DEC-08, they are isolated from statutory control scoring and penalty math:",
            size: 18,
            font: "Arial",
            color: BRAND_STONE_DARK,
          }),
        ],
      })
    );

    const unresRows: TableRow[] = [
      new TableRow({
        children: [
          createTableCell("Code", { isHeader: true, widthPct: 15 }),
          createTableCell("Question Text", { isHeader: true, widthPct: 45 }),
          createTableCell("Respondent Choice", { isHeader: true, widthPct: 20 }),
          createTableCell("Governance Disposition", { isHeader: true, widthPct: 20 }),
        ],
      }),
    ];

    for (const u of data.unresolvedQuestions) {
      unresRows.push(
        new TableRow({
          children: [
            createTableCell(u.questionCode, { widthPct: 15, bold: true }),
            createTableCell(u.questionText, { widthPct: 45 }),
            createTableCell(u.selectedOption || "Unanswered", { widthPct: 20 }),
            createTableCell("Isolated pending Excel sheet", { widthPct: 20 }),
          ],
        })
      );
    }

    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: unresRows }));
    children.push(new Paragraph({ spacing: { after: 280 } }));
  }

  // ==========================================
  // 8. REMEDIATION ACTION PLAN (CAPA)
  // ==========================================
  if (data.remediationTasks.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 120 },
        children: [
          new TextRun({
            text: "6. Corrective Action Plan (CAPA) & Remediation Ledger",
            bold: true,
            size: 24,
            font: "Georgia",
            color: BRAND_NAVY,
          }),
        ],
      })
    );

    const remRows: TableRow[] = [
      new TableRow({
        children: [
          createTableCell("Action Item", { isHeader: true, widthPct: 35 }),
          createTableCell("Priority", { isHeader: true, widthPct: 15 }),
          createTableCell("Responsible Owner", { isHeader: true, widthPct: 20 }),
          createTableCell("Target Date", { isHeader: true, widthPct: 15 }),
          createTableCell("Status", { isHeader: true, widthPct: 15 }),
        ],
      }),
    ];

    for (const r of data.remediationTasks) {
      remRows.push(
        new TableRow({
          children: [
            createTableCell(`${r.title}\n${r.description}`, { widthPct: 35 }),
            createTableCell(r.priority, { widthPct: 15, bold: true }),
            createTableCell(r.ownerName || "Unassigned", { widthPct: 20 }),
            createTableCell(r.targetDate, { widthPct: 15 }),
            createTableCell(r.status, { widthPct: 15, bold: true }),
          ],
        })
      );
    }

    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: remRows }));
    children.push(new Paragraph({ spacing: { after: 280 } }));
  }

  // ==========================================
  // 9. METHODOLOGY DISCLOSURES & AUDIT SEAL
  // ==========================================
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 120 },
      children: [
        new TextRun({
          text: "7. Methodology Disclosures & Attestation Seal",
          bold: true,
          size: 24,
          font: "Georgia",
          color: BRAND_NAVY,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: `Methodology Model: ${data.methodologyDisclosures.provisionalModel} (${data.methodologyDisclosures.scoringStatus})\nGovernance Reference: ${data.methodologyDisclosures.governanceReference}\nTemplate Version: ${data.auditTrail.reportTemplateVersion}\nDataset SHA-256 Hash: ${data.auditTrail.datasetSha256}`,
          size: 16,
          font: "Arial",
          color: BRAND_STONE_DARK,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: data.methodologyDisclosures.nonCompensatoryDisclaimer,
          size: 16,
          font: "Arial",
          color: BRAND_STONE_MUTED,
          italics: true,
        }),
      ],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            createTableCell("Lead Consultant Approver", { isHeader: true, widthPct: 50 }),
            createTableCell("Issuing Authority Seal", { isHeader: true, widthPct: 50 }),
          ],
        }),
        new TableRow({
          children: [
            createTableCell(
              `${data.auditTrail.approvedByUserName || data.assessment.leadConsultantName || "TLI Advisory Lead"}\nApproved Date: ${
                data.auditTrail.approvedAt
                  ? new Date(data.auditTrail.approvedAt).toLocaleDateString("en-IN")
                  : "Pending Formal Issuance"
              }`,
              { widthPct: 50 }
            ),
            createTableCell(
              "Truth Labs International\nDigital Personal Data Protection Practice\nForensic Privacy & Advisory Division",
              { widthPct: 50, bold: true }
            ),
          ],
        }),
      ],
    })
  );

  const doc = new Document({
    sections: [
      {
        headers: { default: docHeader },
        footers: { default: docFooter },
        children,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
