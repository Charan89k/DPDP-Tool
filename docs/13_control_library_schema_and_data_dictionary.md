# 13. Control-Library Data Dictionary and Schema

**Project:** TLI DPDP Compliance Gap Analysis Tool  
**Deliverable Ref:** Phase 2 Control-Library Data Dictionary & Schema Specification  
**Status:** Canonical Standard — Version 1.0.0

---

## 1. Architectural Intent & Design Principles

The Control Library schema is engineered to guarantee:
1. **Source Traceability**: Every control maps to an explicit statutory section and rule without conflating statutory text with TLI advisory methodology.
2. **Immutability & Stability**: `control_id` remains constant across versions (e.g., `TLI-DPDP-NOT-01`), while `control_version` tracks substantive revisions using Semantic Versioning (`MAJOR.MINOR.PATCH`).
3. **Machine Readability**: Strict field types, defined enums, and JSON Schema definitions ensure interoperability between documentation, database seeding scripts, and automated test runners.

---

## 2. Control Entity Data Dictionary

| Field Name | Type | Nullable | Permitted Values / Pattern | Description & Semantic Rules |
|---|---|:---:|---|---|
| `control_id` | String | No | Pattern: `^TLI-DPDP-[A-Z]{3}-\d{2}$`<br>e.g., `TLI-DPDP-NOT-01` | Permanent, immutable unique identifier. Does not change across revisions. |
| `control_version` | String | No | Pattern: `^\d+\.\d+\.\d+$`<br>e.g., `1.0.0` | Semantic version string. Incremented on substantive changes. |
| `title` | String | No | Length: $10 \le \text{len} \le 200$ | Concise human-readable title of the control. |
| `objective` | String | No | Length: $20 \le \text{len} \le 1000$ | High-level regulatory and compliance objective to be achieved. |
| `topic` | Enum | No | `NOTICE_TRANSPARENCY`, `CONSENT_MANAGEMENT`, `LEGITIMATE_USES`, `FIDUCIARY_DUTIES`, `PROCESSOR_OVERSIGHT`, `SECURITY_SAFEGUARDS`, `BREACH_READINESS`, `RETENTION_ERASURE`, `CHILDREN_DISABLED_DATA`, `SDF_GOVERNANCE`, `DATA_PRINCIPAL_RIGHTS`, `CROSS_BORDER_TRANSFERS`, `PENALTY_READINESS` | Primary statutory domain/category. |
| `subcategory` | String | No | Length: $3 \le \text{len} \le 100$ | Granular thematic sub-topic (e.g., "Itemised Notice", "Multilingual Access", "Dark Patterns", "VAPT", "Parental Age Verification"). |
| `source_id` | String | No | Foreign Key $\rightarrow$ `SRC-01` to `SRC-07` | Reference to the authoritative document in the Legal Source Register. |
| `source_provision` | String | No | Length: $3 \le \text{len} \le 150$<br>e.g., `Section 5(1) r/w Rule 3` | Specific statutory section, subsection, and subordinate rule citations. |
| `source_status` | Enum | No | `ENACTED_STATUTE`, `NOTIFIED_RULES`, `OFFICIAL_ORDER`, `OFFICIAL_GUIDANCE`, `DRAFT_CONSULTATION`, `TLI_METHODOLOGY`, `SECTORAL_REGULATION` | Legal standing of the underlying source. |
| `commencement_status`| Enum | No | `IN_FORCE`, `SCHEDULED_COMMENCEMENT_13_NOV_2026`, `SCHEDULED_COMMENCEMENT_13_MAY_2027`, `AWAITING_COMMENCEMENT_NOTIFICATION` | Current commencement status under Section 1(2) and MeitY notifications. |
| `obligation_type` | Enum | No | `MANDATORY_STATUTORY`, `STATUTORY_EXCEPTION_CONDITIONAL`, `SDF_MANDATORY_CONDITIONAL`, `TLI_RECOMMENDED_PRACTICE` | Nature of the compliance mandate. |
| `legal_reference_summary` | String | No | Markdown text | Verbatim statutory summary and legal context. |
| `applicability_conditions` | String | No | Markdown text | Conditions under which this control applies to an organisation. |
| `applicability_rationale` | String | No | Markdown text | Statutory rationale justifying why this control can or cannot be marked Not Applicable. |
| `assessment_question` | String | No | Length: $20 \le \text{len} \le 500$ | The precise question presented to the assessed organisation. |
| `implementation_expectations` | String | No | Markdown text | Concrete operational, procedural, or technical measures expected. |
| `acceptable_evidence` | Array[String]| No | Array of `evidence_type_id`<br>Pattern: `^EVID-[A-Z]{3,4}-\d{2}$` | References to compatible items in the Evidence Catalogue. |
| `evidence_limitations`| String | No | Markdown text | Common weaknesses, invalid forms of proof, and evidentiary boundary limitations. |
| `assessment_guidance` | String | No | Markdown text | Guidance for TLI consultants evaluating responses and evidence. |
| `risk_guidance` | String | No | Markdown text | Statutory exposure, penalty bracket, and business risk if control is absent. |
| `suggested_remediation` | String | No | Markdown text | Corrective and preventive actions (CAPA) recommended for gap closure. |
| `related_control_ids` | Array[String]| Yes | Array of `control_id` | Cross-references to interdependent controls within the library. |
| `legal_review_status`| Enum | No | `LEGAL_VERIFICATION_REQUIRED`, `PROVISIONAL_RESEARCH_COMPLETE`, `PENDING_TLI_LEGAL_COUNSEL_SIGN_OFF`, `APPROVED_BY_TLI_LEGAL` | Status of formal legal counsel review. |
| `methodology_review_status` | Enum | No | `DRAFT`, `METHODOLOGY_REVIEW_PENDING`, `APPROVED_BY_TLI_METHODOLOGY_LEAD` | Status of forensic methodology review by TLI Advisory Lead. |
| `review_notes` | String | Yes | Text | Comments from legal or methodology reviewers. |
| `created_at` | Timestamp | No | ISO 8601 string | Timestamp of initial authoring. |
| `updated_at` | Timestamp | No | ISO 8601 string | Timestamp of latest revision. |

---

## 3. Enumerated Values & Permitted States

### 3.1 `source_status`
- `ENACTED_STATUTE`: Primary legislation enacted by Parliament (DPDPA 2023).
- `NOTIFIED_RULES`: Subordinate rules gazetted by MeitY (DPDP Rules 2025).
- `OFFICIAL_ORDER`: Official executive order (e.g., Removal of Difficulties Order 2026).
- `OFFICIAL_GUIDANCE`: Official circular, advisory, or FAQ issued by MeitY or DPBI.
- `DRAFT_CONSULTATION`: Unnotified draft proposals or public consultation papers.
- `TLI_METHODOLOGY`: Advisory best practices originated by Truth Labs International.
- `SECTORAL_REGULATION`: Binding sectoral directives preserved under Section 16(2) or Section 38(2) of DPDPA 2023 (e.g., RBI payment system data directive, CERT-In cybersecurity directions).

### 3.2 `commencement_status`
- `IN_FORCE`: Currently active and enforceable in law (e.g., Sections 18–26 DPBI provisions).
- `SCHEDULED_COMMENCEMENT_13_NOV_2026`: Enacted/notified; commences 13 November 2026 (Rule 4 Consent Managers).
- `SCHEDULED_COMMENCEMENT_13_MAY_2027`: Enacted/notified; commences 13 May 2027 (Core Fiduciary duties).
- `AWAITING_COMMENCEMENT_NOTIFICATION`: Unnotified or awaiting specific gazette notification.

### 3.3 `obligation_type`
- `MANDATORY_STATUTORY`: Non-negotiable statutory duty applying to all standard Data Fiduciaries.
- `STATUTORY_EXCEPTION_CONDITIONAL`: Applicable only when specific processing contexts or statutory grounds exist (e.g., Section 7 legitimate uses).
- `SDF_MANDATORY_CONDITIONAL`: Mandatory only for designated Significant Data Fiduciaries.
- `TLI_RECOMMENDED_PRACTICE`: High-assurance forensic recommendation not explicitly commanded by statute.

### 3.4 `legal_review_status`
- `LEGAL_VERIFICATION_REQUIRED`: Initial research flag indicating legal ambiguity requiring counsel check.
- `PROVISIONAL_RESEARCH_COMPLETE`: Engineering and privacy research complete; awaiting formal counsel review.
- `PENDING_TLI_LEGAL_COUNSEL_SIGN_OFF`: Submitted to TLI legal reviewer queue.
- `APPROVED_BY_TLI_LEGAL`: Formally approved and signed off by authorized TLI Legal Counsel.

---

## 4. Formal JSON Schema Specification

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://truthlabs.org/schemas/tli-dpdp-control-v1.json",
  "title": "TLIDPDPControlDefinition",
  "type": "object",
  "required": [
    "control_id",
    "control_version",
    "title",
    "objective",
    "topic",
    "subcategory",
    "source_id",
    "source_provision",
    "source_status",
    "commencement_status",
    "obligation_type",
    "legal_reference_summary",
    "applicability_conditions",
    "applicability_rationale",
    "assessment_question",
    "implementation_expectations",
    "acceptable_evidence",
    "evidence_limitations",
    "assessment_guidance",
    "risk_guidance",
    "suggested_remediation",
    "legal_review_status",
    "methodology_review_status"
  ],
  "properties": {
    "control_id": { "type": "string", "pattern": "^TLI-DPDP-[A-Z]{3}-\\d{2}$" },
    "control_version": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" },
    "title": { "type": "string", "minLength": 10, "maxLength": 200 },
    "objective": { "type": "string", "minLength": 20, "maxLength": 1000 },
    "topic": {
      "type": "string",
      "enum": [
        "NOTICE_TRANSPARENCY", "CONSENT_MANAGEMENT", "LEGITIMATE_USES",
        "FIDUCIARY_DUTIES", "PROCESSOR_OVERSIGHT", "SECURITY_SAFEGUARDS",
        "BREACH_READINESS", "RETENTION_ERASURE", "CHILDREN_DISABLED_DATA",
        "SDF_GOVERNANCE", "DATA_PRINCIPAL_RIGHTS", "CROSS_BORDER_TRANSFERS",
        "PENALTY_READINESS"
      ]
    },
    "subcategory": { "type": "string", "minLength": 3, "maxLength": 100 },
    "source_id": { "type": "string", "pattern": "^SRC-\\d{2}$" },
    "source_provision": { "type": "string", "minLength": 3, "maxLength": 150 },
    "source_status": {
      "type": "string",
      "enum": ["ENACTED_STATUTE", "NOTIFIED_RULES", "OFFICIAL_ORDER", "OFFICIAL_GUIDANCE", "DRAFT_CONSULTATION", "TLI_METHODOLOGY", "SECTORAL_REGULATION"]
    },
    "commencement_status": {
      "type": "string",
      "enum": ["IN_FORCE", "SCHEDULED_COMMENCEMENT_13_NOV_2026", "SCHEDULED_COMMENCEMENT_13_MAY_2027", "AWAITING_COMMENCEMENT_NOTIFICATION"]
    },
    "obligation_type": {
      "type": "string",
      "enum": ["MANDATORY_STATUTORY", "STATUTORY_EXCEPTION_CONDITIONAL", "SDF_MANDATORY_CONDITIONAL", "TLI_RECOMMENDED_PRACTICE"]
    },
    "legal_reference_summary": { "type": "string" },
    "applicability_conditions": { "type": "string" },
    "applicability_rationale": { "type": "string" },
    "assessment_question": { "type": "string", "minLength": 20, "maxLength": 500 },
    "implementation_expectations": { "type": "string" },
    "acceptable_evidence": { "type": "array", "items": { "type": "string", "pattern": "^EVID-[A-Z]{3,4}-\\d{2}$" } },
    "evidence_limitations": { "type": "string" },
    "assessment_guidance": { "type": "string" },
    "risk_guidance": { "type": "string" },
    "suggested_remediation": { "type": "string" },
    "related_control_ids": { "type": "array", "items": { "type": "string", "pattern": "^TLI-DPDP-[A-Z]{3}-\\d{2}$" } },
    "legal_review_status": {
      "type": "string",
      "enum": ["LEGAL_VERIFICATION_REQUIRED", "PROVISIONAL_RESEARCH_COMPLETE", "PENDING_TLI_LEGAL_COUNSEL_SIGN_OFF", "APPROVED_BY_TLI_LEGAL"]
    },
    "methodology_review_status": {
      "type": "string",
      "enum": ["DRAFT", "METHODOLOGY_REVIEW_PENDING", "APPROVED_BY_TLI_METHODOLOGY_LEAD"]
    },
    "review_notes": { "type": "string" },
    "created_at": { "type": "string", "format": "date-time" },
    "updated_at": { "type": "string", "format": "date-time" }
  }
}
```

---

## 5. Architectural Decision: Framework-Level Response Options

### 5.1 Evaluation & Design Alternatives
In designing the evaluation response model for the TLI tool, two architectural patterns were evaluated:
1. **Alternative A (Embedded Per-Control Options)**: Duplicating a `response_options` array within each of the 30 individual control records in `data/dpdp_controls.json`.
2. **Alternative B (Global Framework-Level Definition — ADOPTED)**: Defining standard response states globally at the framework level (`DPDPA-2023-V1.0`), documented in `docs/16_assessment_and_review_guidance.md` Section 2 and enforced via database enum `assessment_response_state`.

### 5.2 Rationale for Framework-Level Standardization
1. **Mathematical & Semantic Consistency**: Every control in the DPDPA framework evaluates against the identical five states (`IMPLEMENTED`, `PARTIALLY_IMPLEMENTED`, `NOT_IMPLEMENTED`, `NOT_APPLICABLE`, `UNABLE_TO_DETERMINE`). Embedding this list 30 times introduces redundant maintenance overhead without operational benefit.
2. **Payload & Storage Optimization**: Eliminates 30 redundant copies of the response array from API responses, database tables, and JSON schema definitions.
3. **Immutable Historical Reproducibility**: Assessment response states are bound to the immutable framework release (`framework_versions.version_id`). If future legal frameworks introduce additional response classifications (e.g. `COMPENSATING_CONTROL_ACCEPTED`), the framework version tracks this change cleanly without mutating historical assessment records.

