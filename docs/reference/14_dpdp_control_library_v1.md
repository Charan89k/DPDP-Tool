# 14. Versioned DPDP Control Library (Release v1.0.0)

**Project:** TLI DPDP Compliance Gap Analysis Tool  
**Framework Code:** `DPDPA-2023-V1.0`  
**Release Version:** `1.0.0`  
**Governing Authorities:** Digital Personal Data Protection Act, 2023 & DPDP Rules, 2025  
**Review Status:** Provisional Research Draft — Pending TLI Legal Counsel Formal Sign-Off

---

## Control Catalog Summary

| Control ID | Title | Topic | Statutory Section | Commencement Status | Obligation Type |
|---|---|---|---|---|---|
| `TLI-DPDP-SCO-01` | Applicability, Jurisdiction & Material Perimeter | Scope & Governance | Section 3 | 13 May 2027 | Mandatory Statutory |
| `TLI-DPDP-LGL-01` | Lawful Basis & Ground of Processing | Lawful Basis | Section 4 | 13 May 2027 | Mandatory Statutory |
| `TLI-DPDP-NOT-01` | Itemised & Pre-Consent Notice | Notice & Transparency | Section 5(1) r/w Rule 3 | 13 May 2027 | Mandatory Statutory |
| `TLI-DPDP-NOT-02` | Historical Notice for Pre-Existing Consent | Notice & Transparency | Section 5(2) r/w Rule 3 | 13 May 2027 | Mandatory Statutory |
| `TLI-DPDP-NOT-03` | Multilingual Notice Option Mechanism | Notice & Transparency | Section 5(3) r/w Rule 5 | 13 May 2027 | Mandatory Statutory |
| `TLI-DPDP-CON-01` | Unbundled Affirmative Consent Architecture | Consent Management | Section 6(1)-(3) r/w Rule 6 | 13 May 2027 | Mandatory Statutory |
| `TLI-DPDP-CON-02` | Consent Withdrawal Mechanism & Comparable Ease | Consent Management | Section 6(4)-(6) | 13 May 2027 | Mandatory Statutory |
| `TLI-DPDP-CON-03` | Consent Manager Interoperability | Consent Management | Section 6(7)-(9) r/w Rule 4 | 13 Nov 2026 | Conditional |
| `TLI-DPDP-LEG-01` | Voluntary Provision Legitimate Uses | Legitimate Uses | Section 7(a) | 13 May 2027 | Conditional |
| `TLI-DPDP-LEG-02` | Employment Functions Legitimate Uses | Legitimate Uses | Section 7(g) | 13 May 2027 | Conditional |
| `TLI-DPDP-FID-01` | Accountability & Non-Delegable Responsibility | Fiduciary Duties | Section 8(1) | 13 May 2027 | Mandatory Statutory |
| `TLI-DPDP-PRO-01` | Data Processor Engagement & Contractual Governance | Processor Oversight | Section 8(2) r/w Rule 7 | 13 May 2027 | Mandatory Statutory |
| `TLI-DPDP-FID-02` | Data Quality, Accuracy & Decision Safeguards | Fiduciary Duties | Section 8(3) | 13 May 2027 | Mandatory Statutory |
| `TLI-DPDP-SEC-01` | Technical & Organisational Security Safeguards (TOMs)| Security Safeguards | Section 8(4)-(5) r/w Rule 8 | 13 May 2027 | Mandatory Statutory |
| `TLI-DPDP-SEC-02` | Encryption, Key Governance & Access Controls | Security Safeguards | Section 8(5) r/w Rule 8 | 13 May 2027 | Mandatory Statutory |
| `TLI-DPDP-BRC-01` | Personal Data Breach Incident Response & Triage | Breach Readiness | Section 8(6) r/w Rule 9 | 13 May 2027 | Mandatory Statutory |
| `TLI-DPDP-BRC-02` | Dual Breach Intimation (DPBI & Affected Principals) | Breach Readiness | Section 8(6) r/w Rule 9 | 13 May 2027 | Mandatory Statutory |
| `TLI-DPDP-RET-01` | Purpose Fulfillment & Automated Erasure | Retention & Erasure | Section 8(7) r/w Rule 10 | 13 May 2027 | Mandatory Statutory |
| `TLI-DPDP-RET-02` | Statutory Retention Exceptions Register | Retention & Erasure | Section 8(7)-(8) | 13 May 2027 | Mandatory Statutory |
| `TLI-DPDP-DSR-01` | Data Principal Rights: Access & Information Summary | Data Principal Rights | Section 11 r/w Rule 14 | 13 May 2027 | Mandatory Statutory |
| `TLI-DPDP-DSR-02` | Data Principal Rights: Correction, Update & Erasure | Data Principal Rights | Section 12 r/w Rule 14 | 13 May 2027 | Mandatory Statutory |
| `TLI-DPDP-DSR-03` | Grievance Redressal Mechanism & Officer Publication | Grievance Handling | Section 8(8), 13 r/w Rule 11| 13 May 2027 | Mandatory Statutory |
| `TLI-DPDP-DSR-04` | Data Principal Right to Nominate | Data Principal Rights | Section 14 r/w Rule 15 | 13 May 2027 | Mandatory Statutory |
| `TLI-DPDP-CHD-01` | Verifiable Parental Consent for Children & Disabled | Children's Data | Section 9(1) r/w Rule 12 | 13 May 2027 | Conditional |
| `TLI-DPDP-CHD-02` | Prohibition on Child Tracking, Profiling & Ads | Children's Data | Section 9(2)-(3) | 13 May 2027 | Conditional |
| `TLI-DPDP-SDF-01` | Significant Data Fiduciary Governance (Resident DPO) | SDF Governance | Section 10(1)-(2)(a) | 13 May 2027 | SDF Conditional |
| `TLI-DPDP-SDF-02` | SDF Impact Assessments (DPIA) & Independent Audits | SDF Governance | Section 10(2)(b)-(c) r/w Rule 13| 13 May 2027 | SDF Conditional |
| `TLI-DPDP-XBD-01` | Cross-Border Data Transfers & Negative List | Cross-Border Transfers | Section 16(1) r/w Rule 16 | 13 May 2027 | Conditional |
| `TLI-DPDP-XBD-02` | Sectoral Data Localization Preservation | Cross-Border Transfers | Section 16(2) r/w Sectoral | 13 May 2027 | Conditional |
| `TLI-DPDP-PEN-01` | Statutory Penalty Deficit Exposure & Sanction Audit | Penalty Readiness | Schedule r/w Section 33 | 13 May 2027 | Mandatory Statutory |

---

## Detailed Control Specifications

### 1. `TLI-DPDP-SCO-01`: Applicability, Jurisdiction & Material Perimeter
- **Control Version**: `1.0.0`
- **Topic**: `NOTICE_TRANSPARENCY` | **Subcategory**: `Scope & Perimeter`
- **Source Reference**: `SRC-01` (DPDPA 2023, Section 3)
- **Source Status**: `ENACTED_STATUTE` | **Commencement**: `SCHEDULED_COMMENCEMENT_13_MAY_2027`
- **Obligation Type**: `MANDATORY_STATUTORY`
- **Legal Reference Summary**: The Act applies to processing of digital personal data within India, and outside India if in connection with offering goods or services to Data Principals in India. It excludes personal or domestic processing and data made publicly available by the Data Principal.
- **Applicability Conditions**: Applies universally to any entity processing personal data in digital form.
- **Applicability Rationale**: Core jurisdictional perimeter. Cannot be marked Not Applicable.
- **Assessment Question**: Has the organisation documented its digital personal data inventory, established jurisdictional boundaries, and identified all digital collection touchpoints?
- **Implementation Expectations**: Maintain an exhaustive inventory of digital processing activities (RoPA), categorising personal data collected within India or from Indian Data Principals abroad.
- **Acceptable Evidence**: `EVID-ROPA-01`
- **Evidence Limitations**: Verbal assertions without a documented data inventory are insufficient.
- **Assessment Guidance**: Verify whether offline data digitised subsequently is brought into scope as mandated by Section 3(a)(ii).
- **Risk Guidance**: Operating outside defined compliance scope risks unmonitored regulatory exposure across all processing streams.
- **Suggested Remediation**: Implement an enterprise Data Processing Activities Registry (RoPA) cataloguing data flows, storage locations, and legal entities.
- **Related Controls**: `TLI-DPDP-LGL-01`
- **Review Status**: `PROVISIONAL_RESEARCH_COMPLETE` | `METHODOLOGY_REVIEW_PENDING`

---

### 2. `TLI-DPDP-LGL-01`: Lawful Basis & Ground of Processing
- **Control Version**: `1.0.0`
- **Topic**: `LEGITIMATE_USES` | **Subcategory**: `Lawful Grounds`
- **Source Reference**: `SRC-01` (DPDPA 2023, Section 4)
- **Source Status**: `ENACTED_STATUTE` | **Commencement**: `SCHEDULED_COMMENCEMENT_13_MAY_2027`
- **Obligation Type**: `MANDATORY_STATUTORY`
- **Legal Reference Summary**: Personal data may be processed only for a lawful purpose for which the Data Principal has given consent (Section 6), or for certain legitimate uses specified under Section 7.
- **Applicability Conditions**: Applies to all processing activities across all business units.
- **Applicability Rationale**: Foundational rule. No processing can exist without a valid statutory ground.
- **Assessment Question**: Is every personal data processing activity formally mapped to a distinct statutory ground (valid consent under Section 6 or an exhaustive legitimate use under Section 7)?
- **Implementation Expectations**: Document the legal ground for every data processing activity in the RoPA; eliminate processing lacking a valid statutory anchor.
- **Acceptable Evidence**: `EVID-ROPA-01`, `EVID-SEC-01`
- **Evidence Limitations**: High-level privacy policies without activity-level legal mapping do not demonstrate compliance.
- **Assessment Guidance**: Confirm that the organisation does not rely on generic "business interest" claims outside the exhaustive list of Section 7.
- **Risk Guidance**: Processing without a lawful basis constitutes an unlawful act under Section 4, exposing the fiduciary to statutory scrutiny and penalties under the Schedule.
- **Suggested Remediation**: Conduct a legal grounds audit mapping each personal data collection workflow to either Section 6 (Consent) or a Section 7 clause.
- **Related Controls**: `TLI-DPDP-CON-01`, `TLI-DPDP-LEG-01`
- **Review Status**: `PROVISIONAL_RESEARCH_COMPLETE` | `METHODOLOGY_REVIEW_PENDING`

---

### 3. `TLI-DPDP-NOT-01`: Itemised & Pre-Consent Notice
- **Control Version**: `1.0.0`
- **Topic**: `NOTICE_TRANSPARENCY` | **Subcategory**: `Itemised Notice`
- **Source Reference**: `SRC-01` (DPDPA 2023, Section 5(1)) r/w `SRC-03` (DPDPR 2025, Rule 3)
- **Source Status**: `NOTIFIED_RULES` | **Commencement**: `SCHEDULED_COMMENCEMENT_13_MAY_2027`
- **Obligation Type**: `MANDATORY_STATUTORY`
- **Legal Reference Summary**: Notice must be given before or at the time of seeking consent. It must specify the personal data sought, the specific itemised purpose, the manner of exercising Section 11 rights, and the manner of making complaints to the DPBI.
- **Applicability Conditions**: Applies to all activities where personal data is collected on the basis of consent.
- **Applicability Rationale**: Mandatory whenever consent is sought. Can be marked Not Applicable only if processing relies solely on Section 7 legitimate uses.
- **Assessment Question**: Does the organisation provide a clear, standalone, itemised notice before or at the time of requesting consent, detailing data types, purpose, rights, and DPBI complaint procedures?
- **Implementation Expectations**: Deploy discrete pre-consent notices detailing data fields, specific itemised purposes, DSAR instructions, and grievance redressal steps.
- **Acceptable Evidence**: `EVID-NOT-01`, `EVID-NOT-02`
- **Evidence Limitations**: Generic website terms of service or privacy policies bundled with commercial conditions do not satisfy Section 5(1).
- **Assessment Guidance**: Inspect actual collection touchpoints (web forms, mobile app screens, paper forms) to verify notice timing and content.
- **Risk Guidance**: Inadequate or bundled notice invalidates consent under Section 6(1), undermining the legality of processing.
- **Suggested Remediation**: Redesign onboarding UI/UX to display standalone, itemised notices prior to consent checkboxes.
- **Related Controls**: `TLI-DPDP-NOT-03`, `TLI-DPDP-CON-01`
- **Review Status**: `PROVISIONAL_RESEARCH_COMPLETE` | `METHODOLOGY_REVIEW_PENDING`

---

### 4. `TLI-DPDP-NOT-02`: Historical Notice for Pre-Existing Consent
- **Control Version**: `1.0.0`
- **Topic**: `NOTICE_TRANSPARENCY` | **Subcategory**: `Grandfathered Notice`
- **Source Reference**: `SRC-01` (DPDPA 2023, Section 5(2)) r/w `SRC-03` (DPDPR 2025, Rule 3)
- **Source Status**: `NOTIFIED_RULES` | **Commencement**: `SCHEDULED_COMMENCEMENT_13_MAY_2027`
- **Obligation Type**: `MANDATORY_STATUTORY`
- **Legal Reference Summary**: Where consent was collected prior to commencement of the Act, notice informing the Data Principal of the data, purpose, rights, and DPBI grievance route must be dispatched as soon as practicable.
- **Applicability Conditions**: Applies to fiduciaries holding legacy personal data collected prior to 13 May 2027.
- **Applicability Rationale**: Mandatory for entities with legacy customer/user databases.
- **Assessment Question**: Has the organisation planned or dispatched retrospective notices to existing Data Principals whose consent was captured prior to the commencement of the Act?
- **Implementation Expectations**: Implement a communication protocol to send compliant Section 5 notices to existing registered users upon commencement.
- **Acceptable Evidence**: `EVID-NOT-03`, `EVID-SOP-01`
- **Evidence Limitations**: Marketing email campaigns without statutory notice elements do not qualify.
- **Assessment Guidance**: Verify communications schedules, customer notification email/SMS templates, and audit logs.
- **Risk Guidance**: Continuing processing legacy data without issuing statutory notice exposes the fiduciary to non-compliance penalties under the Schedule.
- **Suggested Remediation**: Draft and schedule a grandfathering notice communication plan for all active registered users.
- **Related Controls**: `TLI-DPDP-NOT-01`
- **Review Status**: `PROVISIONAL_RESEARCH_COMPLETE` | `METHODOLOGY_REVIEW_PENDING`

---

### 5. `TLI-DPDP-NOT-03`: Multilingual Notice Option Mechanism
- **Control Version**: `1.0.0`
- **Topic**: `NOTICE_TRANSPARENCY` | **Subcategory**: `Multilingual Access`
- **Source Reference**: `SRC-01` (DPDPA 2023, Section 5(3)) r/w `SRC-03` (DPDPR 2025, Rule 5) & `SRC-05`
- **Source Status**: `NOTIFIED_RULES` | **Commencement**: `SCHEDULED_COMMENCEMENT_13_MAY_2027`
- **Obligation Type**: `MANDATORY_STATUTORY`
- **Legal Reference Summary**: The Data Principal shall be given an option to access the contents of the notice in English or any of the 22 languages specified in the Eighth Schedule to the Constitution.
- **Applicability Conditions**: Applies to all consumer-facing and public-facing Data Fiduciaries seeking consent.
- **Applicability Rationale**: Mandatory statutory provision. Can be scoped out only for purely internal B2B non-individual systems where individual consent is not sought.
- **Assessment Question**: Does the organisation provide an operational mechanism (e.g. language toggle or accessible translated views) allowing Data Principals to view notices in English or any Eighth Schedule language?
- **Implementation Expectations**: Implement UI language selection toggles or certified translated versions of the privacy notice across 22 Eighth Schedule languages.
- **Acceptable Evidence**: `EVID-NOT-02`
- **Evidence Limitations**: Stating that a translation tool can be used by the user in their browser does not satisfy the statutory mandate under Section 5(3).
- **Assessment Guidance**: Verify that certified translations or verified dynamic localization engines are integrated into the customer onboarding path.
- **Risk Guidance**: Failure to provide Eighth Schedule multilingual options constitutes a breach of notice obligations under Section 5.
- **Suggested Remediation**: Commission certified translations of statutory notices and implement an accessible language selector on public portals.
- **Related Controls**: `TLI-DPDP-NOT-01`
- **Review Status**: `PROVISIONAL_RESEARCH_COMPLETE` | `METHODOLOGY_REVIEW_PENDING`

---

### 6. `TLI-DPDP-CON-01`: Unbundled Affirmative Consent Architecture
- **Control Version**: `1.0.0`
- **Topic**: `CONSENT_MANAGEMENT` | **Subcategory**: `Affirmative Choice`
- **Source Reference**: `SRC-01` (DPDPA 2023, Section 6(1)-(3)) r/w `SRC-03` (DPDPR 2025, Rule 6)
- **Source Status**: `NOTIFIED_RULES` | **Commencement**: `SCHEDULED_COMMENCEMENT_13_MAY_2027`
- **Obligation Type**: `MANDATORY_STATUTORY`
- **Legal Reference Summary**: Consent must be free, specific, informed, unconditional, unambiguous, and signified by clear affirmative action. Any part of consent infringing the Act is invalid. Pre-ticked boxes, bundled terms, or forced consent for non-essential purposes are prohibited.
- **Applicability Conditions**: Applies to all processing activities relying on consent.
- **Applicability Rationale**: Mandatory statutory provision for consent-based processing.
- **Assessment Question**: Are consent mechanisms unbundled, free from dark patterns and pre-ticked checkboxes, and captured through clear affirmative action with cryptographic timestamps?
- **Implementation Expectations**: Configure consent collection with unchecked boxes, separate consent toggles for distinct purposes, and an immutable consent logging system.
- **Acceptable Evidence**: `EVID-CON-01`
- **Evidence Limitations**: Merely showing a "By clicking Submit you agree to our Terms" button fails the unconditional and affirmative action test.
- **Assessment Guidance**: Inspect live registration flows across web, mobile, and offline channels.
- **Risk Guidance**: Invalid or bundled consent nullifies the legal basis of processing under Section 6, triggering liability under Section 4 and Schedule penalties.
- **Suggested Remediation**: Remove pre-ticked checkboxes and decouple service delivery from optional data collection (e.g. marketing profiling).
- **Related Controls**: `TLI-DPDP-CON-02`, `TLI-DPDP-NOT-01`
- **Review Status**: `PROVISIONAL_RESEARCH_COMPLETE` | `METHODOLOGY_REVIEW_PENDING`

---

### 7. `TLI-DPDP-CON-02`: Consent Withdrawal Mechanism & Comparable Ease
- **Control Version**: `1.0.0`
- **Topic**: `CONSENT_MANAGEMENT` | **Subcategory**: `Withdrawal Mechanism`
- **Source Reference**: `SRC-01` (DPDPA 2023, Section 6(4)-(6))
- **Source Status**: `ENACTED_STATUTE` | **Commencement**: `SCHEDULED_COMMENCEMENT_13_MAY_2027`
- **Obligation Type**: `MANDATORY_STATUTORY`
- **Legal Reference Summary**: Data Principals have the right to withdraw consent at any time. The ease of withdrawal must be comparable to the ease with which consent was given. Upon withdrawal, the fiduciary must cease processing within a reasonable time.
- **Applicability Conditions**: Applies to all consent-based processing systems.
- **Applicability Rationale**: Mandatory statutory duty.
- **Assessment Question**: Does the organisation provide an accessible, frictionless mechanism allowing Data Principals to withdraw consent with ease comparable to granting it, triggering automated cessation of processing?
- **Implementation Expectations**: Deploy self-service consent management preference centers (e.g. 1-click unsubscribe/opt-out) integrated with backend data pipelines.
- **Acceptable Evidence**: `EVID-CON-02`
- **Evidence Limitations**: Requiring physical letters or complex manual customer service calls to withdraw digitally given consent violates the "comparable ease" test.
- **Assessment Guidance**: Compare the steps required to give consent vs the steps required to withdraw.
- **Risk Guidance**: Obstructing consent withdrawal violates Section 6(4) and triggers mandatory erasure requirements under Section 8(7).
- **Suggested Remediation**: Build a self-service privacy preference center in mobile apps and web account settings.
- **Related Controls**: `TLI-DPDP-CON-01`, `TLI-DPDP-RET-01`
- **Review Status**: `PROVISIONAL_RESEARCH_COMPLETE` | `METHODOLOGY_REVIEW_PENDING`

---

### 8. `TLI-DPDP-CON-03`: Consent Manager Interoperability
- **Control Version**: `1.0.0`
- **Topic**: `CONSENT_MANAGEMENT` | **Subcategory**: `Consent Managers`
- **Source Reference**: `SRC-01` (DPDPA 2023, Section 6(7)-(9)) r/w `SRC-03` (DPDPR 2025, Rule 4)
- **Source Status**: `NOTIFIED_RULES` | **Commencement**: `SCHEDULED_COMMENCEMENT_13_NOV_2026`
- **Obligation Type**: `STATUTORY_EXCEPTION_CONDITIONAL`
- **Legal Reference Summary**: A Data Principal may give, manage, review, or withdraw consent through a registered Consent Manager. Consent Managers must be registered with the DPBI and satisfy technical and operational standards under Rule 4.
- **Applicability Conditions**: Applies to organisations integrating with or acting as registered Consent Managers.
- **Applicability Rationale**: Interoperability requirement commencing 13 November 2026.
- **Assessment Question**: Is the organisation equipped with technical APIs and interoperability workflows to receive, verify, and execute consent instructions from registered Consent Managers?
- **Implementation Expectations**: Integrate standard API endpoints to ingest and validate consent artifacts dispatched by registered Consent Managers.
- **Acceptable Evidence**: `EVID-CON-01`
- **Evidence Limitations**: Architecture drafts without implemented API specifications are insufficient.
- **Assessment Guidance**: Verify whether system architecture accommodates external consent lifecycle webhooks.
- **Risk Guidance**: Inability to honor Consent Manager requests once operational creates regulatory non-compliance under Section 6(9).
- **Suggested Remediation**: Design an inbound Consent Artifact ingestion gateway supporting MeitY/DPBI electronic data interchange standards.
- **Related Controls**: `TLI-DPDP-CON-01`, `TLI-DPDP-CON-02`
- **Review Status**: `PROVISIONAL_RESEARCH_COMPLETE` | `METHODOLOGY_REVIEW_PENDING`

---

### 9. `TLI-DPDP-LEG-01`: Voluntary Provision Legitimate Uses
- **Control Version**: `1.0.0`
- **Topic**: `LEGITIMATE_USES` | **Subcategory**: `Voluntary Provision`
- **Source Reference**: `SRC-01` (DPDPA 2023, Section 7(a))
- **Source Status**: `ENACTED_STATUTE` | **Commencement**: `SCHEDULED_COMMENCEMENT_13_MAY_2027`
- **Obligation Type**: `STATUTORY_EXCEPTION_CONDITIONAL`
- **Legal Reference Summary**: Processing personal data without explicit consent is lawful where the Data Principal voluntarily provides their data to the Data Fiduciary for a specified purpose and has not indicated withholding of consent.
- **Applicability Conditions**: Applies to workflows relying on voluntary provision (e.g. inbound customer queries, visitor logs).
- **Applicability Rationale**: Legitimate use exception. Must be justified where applied.
- **Assessment Question**: Where processing relies on voluntary provision under Section 7(a), is processing strictly confined to the specific purpose for which the data was provided?
- **Implementation Expectations**: Document controls ensuring data voluntarily furnished for one purpose (e.g., reception sign-in, support ticket) is not repurposed for marketing or profiling.
- **Acceptable Evidence**: `EVID-ROPA-01`, `EVID-SOP-01`
- **Evidence Limitations**: Repurposing voluntary support data for unsolicited sales outreach is prohibited.
- **Assessment Guidance**: Verify whether data boundaries and access restrictions prevent secondary processing.
- **Risk Guidance**: Exceeding the scope of voluntary provision constitutes unlawful processing under Section 4.
- **Suggested Remediation**: Establish technical partition tags preventing voluntary customer enquiry data from synchronizing to marketing databases.
- **Related Controls**: `TLI-DPDP-LGL-01`
- **Review Status**: `PROVISIONAL_RESEARCH_COMPLETE` | `METHODOLOGY_REVIEW_PENDING`

---

### 10. `TLI-DPDP-LEG-02`: Employment Functions Legitimate Uses
- **Control Version**: `1.0.0`
- **Topic**: `LEGITIMATE_USES` | **Subcategory**: `Employment Data`
- **Source Reference**: `SRC-01` (DPDPA 2023, Section 7(g))
- **Source Status**: `ENACTED_STATUTE` | **Commencement**: `SCHEDULED_COMMENCEMENT_13_MAY_2027`
- **Obligation Type**: `STATUTORY_EXCEPTION_CONDITIONAL`
- **Legal Reference Summary**: Personal data may be processed without consent for the purposes of employment or for safeguarding the employer from loss or liability, such as prevention of corporate theft, trade secret protection, or provision of services/benefits.
- **Applicability Conditions**: Applies to all employers processing employee data.
- **Applicability Rationale**: Legitimate use exception for HR/workplace data.
- **Assessment Question**: Does the organisation process employee personal data strictly within the boundaries of employment functions, benefits administration, and asset protection without excessive or disproportionate surveillance?
- **Implementation Expectations**: Maintain an Employee Privacy Notice and HR Processing Policy defining permissible monitoring and data handling boundaries.
- **Acceptable Evidence**: `EVID-ROPA-01`, `EVID-SEC-01`
- **Evidence Limitations**: Invasive personal device monitoring without employment nexus cannot be justified under Section 7(g).
- **Assessment Guidance**: Inspect employee handbooks, monitoring disclosures, and BYOD policies.
- **Risk Guidance**: Unjustified surveillance beyond Section 7(g) boundaries violates statutory grounds, exposing the employer to employee grievances and DPBI scrutiny.
- **Suggested Remediation**: Formalise an Employee Data Protection SOP clarifying legitimate employment use cases and data retention limits.
- **Related Controls**: `TLI-DPDP-LGL-01`, `TLI-DPDP-RET-01`
- **Review Status**: `PROVISIONAL_RESEARCH_COMPLETE` | `METHODOLOGY_REVIEW_PENDING`

---

### 11. `TLI-DPDP-FID-01`: Accountability & Non-Delegable Responsibility
- **Control Version**: `1.0.0`
- **Topic**: `FIDUCIARY_DUTIES` | **Subcategory**: `Fiduciary Accountability`
- **Source Reference**: `SRC-01` (DPDPA 2023, Section 8(1))
- **Source Status**: `ENACTED_STATUTE` | **Commencement**: `SCHEDULED_COMMENCEMENT_13_MAY_2027`
- **Obligation Type**: `MANDATORY_STATUTORY`
- **Legal Reference Summary**: A Data Fiduciary shall be responsible for complying with the provisions of this Act in respect of any processing undertaken by it or on its behalf by a Data Processor.
- **Applicability Conditions**: Applies to all Data Fiduciaries.
- **Applicability Rationale**: Non-negotiable statutory duty.
- **Assessment Question**: Does the organisation maintain enterprise-wide governance, policies, and audit mechanisms ensuring accountability for all processing conducted internally and through external vendors?
- **Implementation Expectations**: Formulate board-approved data protection governance charters, appoint privacy leads, and conduct regular internal compliance reviews.
- **Acceptable Evidence**: `EVID-SEC-01`, `EVID-DPA-01`
- **Evidence Limitations**: Shifting full compliance responsibility onto cloud providers or IT vendors is legally void under Section 8(1).
- **Assessment Guidance**: Review executive accountability reporting, compliance charters, and vendor oversight mechanisms.
- **Risk Guidance**: Fiduciary remains solely liable before the DPBI for statutory violations committed by downstream processors.
- **Suggested Remediation**: Establish a Data Protection Committee and implement formal third-party risk governance.
- **Related Controls**: `TLI-DPDP-PRO-01`, `TLI-DPDP-SEC-01`
- **Review Status**: `PROVISIONAL_RESEARCH_COMPLETE` | `METHODOLOGY_REVIEW_PENDING`

---

### 12. `TLI-DPDP-PRO-01`: Data Processor Engagement & Contractual Governance
- **Control Version**: `1.0.0`
- **Topic**: `PROCESSOR_OVERSIGHT` | **Subcategory**: `Processor Contracts (DPA)`
- **Source Reference**: `SRC-01` (DPDPA 2023, Section 8(2)) r/w `SRC-03` (DPDPR 2025, Rule 7)
- **Source Status**: `NOTIFIED_RULES` | **Commencement**: `SCHEDULED_COMMENCEMENT_13_MAY_2027`
- **Obligation Type**: `MANDATORY_STATUTORY`
- **Legal Reference Summary**: A Data Fiduciary may engage, appoint, use or otherwise involve a Data Processor only under a valid contract. Rule 7 specifies mandatory clauses: processing scope, confidentiality, technical security, breach reporting, sub-processor restrictions, and audit rights.
- **Applicability Conditions**: Applies to all fiduciaries engaging third-party software, cloud hosts, outsourcing agencies, or payroll processors.
- **Applicability Rationale**: Mandatory statutory duty.
- **Assessment Question**: Are all third-party Data Processors bound by legally executed Data Processing Agreements (DPAs) incorporating mandatory Rule 7 clauses?
- **Implementation Expectations**: Execute standardized DPAs with all cloud hosts, SaaS providers, and service vendors processing personal data.
- **Acceptable Evidence**: `EVID-DPA-01`
- **Evidence Limitations**: Standard commercial purchase orders without privacy and security schedules fail Section 8(2).
- **Assessment Guidance**: Review a sample of executed vendor contracts across cloud infrastructure, HR SaaS, and customer support vendors.
- **Risk Guidance**: Engaging an uncontracted processor violates Section 8(2) and exposes the fiduciary to direct liability for vendor breaches.
- **Suggested Remediation**: Establish an enterprise DPA remediation workflow to execute supplemental data protection terms with all active vendors.
- **Related Controls**: `TLI-DPDP-FID-01`, `TLI-DPDP-SEC-01`
- **Review Status**: `PROVISIONAL_RESEARCH_COMPLETE` | `METHODOLOGY_REVIEW_PENDING`

---

### 13. `TLI-DPDP-FID-02`: Data Quality, Accuracy & Decision Safeguards
- **Control Version**: `1.0.0`
- **Topic**: `FIDUCIARY_DUTIES` | **Subcategory**: `Data Accuracy`
- **Source Reference**: `SRC-01` (DPDPA 2023, Section 8(3))
- **Source Status**: `ENACTED_STATUTE` | **Commencement**: `SCHEDULED_COMMENCEMENT_13_MAY_2027`
- **Obligation Type**: `MANDATORY_STATUTORY`
- **Legal Reference Summary**: A Data Fiduciary shall ensure data completeness, accuracy, and consistency if the personal data is used to make a decision that affects the Data Principal, or is disclosed to another Data Fiduciary.
- **Applicability Conditions**: Applies to fiduciaries using personal data for automated scoring, credit underwriting, employment reviews, or external sharing.
- **Applicability Rationale**: Mandatory statutory obligation.
- **Assessment Question**: Does the organisation maintain data validation, deduplication, and quality controls to guarantee accuracy when personal data affects Data Principals or is disclosed to third parties?
- **Implementation Expectations**: Implement database input validation routines, deduplication engines, and self-service correction mechanisms.
- **Acceptable Evidence**: `EVID-SOP-02`
- **Evidence Limitations**: Manual ad-hoc corrections without documented quality validation protocols do not satisfy Section 8(3).
- **Assessment Guidance**: Test data validation rules on onboarding inputs and data exchange interfaces.
- **Risk Guidance**: Incorrect decisions resulting from inaccurate data breach Section 8(3) and provoke Data Principal claims under Section 12.
- **Suggested Remediation**: Implement automated data hygiene and verification pipelines at points of collection and transformation.
- **Related Controls**: `TLI-DPDP-DSR-02`
- **Review Status**: `PROVISIONAL_RESEARCH_COMPLETE` | `METHODOLOGY_REVIEW_PENDING`

---

### 14. `TLI-DPDP-SEC-01`: Technical & Organisational Security Safeguards (TOMs)
- **Control Version**: `1.0.0`
- **Topic**: `SECURITY_SAFEGUARDS` | **Subcategory**: `TOMs & Information Security`
- **Source Reference**: `SRC-01` (DPDPA 2023, Section 8(4)-(5)) r/w `SRC-03` (DPDPR 2025, Rule 8)
- **Source Status**: `NOTIFIED_RULES` | **Commencement**: `SCHEDULED_COMMENCEMENT_13_MAY_2027`
- **Obligation Type**: `MANDATORY_STATUTORY`
- **Legal Reference Summary**: A Data Fiduciary shall implement appropriate technical and organisational measures to ensure compliance, and protect personal data by taking reasonable security safeguards to prevent personal data breach. Maximum penalty: ₹250 Crores.
- **Applicability Conditions**: Applies universally across all systems holding digital personal data.
- **Applicability Rationale**: Top-tier statutory mandate carrying maximum penal exposure.
- **Assessment Question**: Has the organisation implemented verified technical and organisational security measures (access controls, vulnerability assessments, network segmentation, multi-factor authentication) to prevent data breaches?
- **Implementation Expectations**: Deploy ISO 27001 / SOC 2 aligned security baselines: annual VAPT, strict MFA on employee portals, role-based database access, and patch management.
- **Acceptable Evidence**: `EVID-SEC-01`, `EVID-VAPT-01`
- **Evidence Limitations**: Stale VAPT reports older than 12 months or unresolved critical vulnerabilities invalidate claims of reasonable safeguards.
- **Assessment Guidance**: Inspect recent penetration test executive summaries and remediation verification letters.
- **Risk Guidance**: Absence of reasonable safeguards exposes the organisation to the maximum statutory penalty under Schedule Tier 1 (up to ₹250 Crores).
- **Suggested Remediation**: Commission an immediate external VAPT audit and remediate all high/critical vulnerabilities on personal data repositories.
- **Related Controls**: `TLI-DPDP-SEC-02`, `TLI-DPDP-BRC-01`
- **Review Status**: `PROVISIONAL_RESEARCH_COMPLETE` | `METHODOLOGY_REVIEW_PENDING`

---

### 15. `TLI-DPDP-SEC-02`: Encryption, Key Governance & Access Controls
- **Control Version**: `1.0.0`
- **Topic**: `SECURITY_SAFEGUARDS` | **Subcategory**: `Encryption & Cryptography`
- **Source Reference**: `SRC-01` (DPDPA 2023, Section 8(5)) r/w `SRC-03` (DPDPR 2025, Rule 8)
- **Source Status**: `NOTIFIED_RULES` | **Commencement**: `SCHEDULED_COMMENCEMENT_13_MAY_2027`
- **Obligation Type**: `MANDATORY_STATUTORY`
- **Legal Reference Summary**: Reasonable safeguards require protecting data in transit and at rest using standard cryptographic mechanisms, key isolation, and least-privilege identity access management.
- **Applicability Conditions**: Applies to all databases, object stores, and transmission channels carrying personal data.
- **Applicability Rationale**: Core baseline safeguard.
- **Assessment Question**: Is all digital personal data encrypted at rest (e.g. AES-256) and in transit (TLS 1.2+ / 1.3), supported by secure KMS key rotation and least-privilege access?
- **Implementation Expectations**: Enforce TLS 1.3 in transit, AES-256 at rest, automated annual key rotation via KMS/HSM, and zero plaintext personal data storage.
- **Acceptable Evidence**: `EVID-SEC-02`
- **Evidence Limitations**: Hardcoded encryption keys in source repositories or plaintext database backups fail Section 8(5).
- **Assessment Guidance**: Inspect database configuration snapshots and TLS ciphersuite audit reports.
- **Risk Guidance**: Plaintext data exfiltration turns an intrusion into a catastrophic data breach with maximum liability.
- **Suggested Remediation**: Enable automated KMS encryption at rest across all cloud storage buckets and relational database volumes.
- **Related Controls**: `TLI-DPDP-SEC-01`
- **Review Status**: `PROVISIONAL_RESEARCH_COMPLETE` | `METHODOLOGY_REVIEW_PENDING`

---

### 16. `TLI-DPDP-BRC-01`: Personal Data Breach Incident Response & Triage
- **Control Version**: `1.0.0`
- **Topic**: `BREACH_READINESS` | **Subcategory**: `Incident Management SOP`
- **Source Reference**: `SRC-01` (DPDPA 2023, Section 8(6)) r/w `SRC-03` (DPDPR 2025, Rule 9) & `SRC-07`
- **Source Status**: `NOTIFIED_RULES` | **Commencement**: `SCHEDULED_COMMENCEMENT_13_MAY_2027`
- **Obligation Type**: `MANDATORY_STATUTORY`
- **Legal Reference Summary**: In the event of a personal data breach, the Data Fiduciary shall intimate the Board and each affected Data Principal. Requires documented incident management and triage SOPs. Maximum penalty: ₹200 Crores.
- **Applicability Conditions**: Applies to all Data Fiduciaries.
- **Applicability Rationale**: Mandatory statutory duty carrying Tier 2 penalty exposure.
- **Assessment Question**: Does the organisation maintain an operational Personal Data Breach Incident Response Plan detailing detection, escalation, containment, and root-cause analysis?
- **Implementation Expectations**: Establish a 24/7 Computer Security Incident Response Team (CSIRT), breach triage matrix, and documented escalation protocols.
- **Acceptable Evidence**: `EVID-BRC-01`
- **Evidence Limitations**: Generic IT disaster recovery plans that omit personal data compromise and privacy impacts are insufficient.
- **Assessment Guidance**: Review table-top drill records and incident response playbooks.
- **Risk Guidance**: Failure to promptly detect and triage a breach leads to statutory reporting failure under Section 8(6).
- **Suggested Remediation**: Author and execute a dedicated Data Breach Incident Response Plan with annual tabletop simulation drills.
- **Related Controls**: `TLI-DPDP-BRC-02`, `TLI-DPDP-SEC-01`
- **Review Status**: `PROVISIONAL_RESEARCH_COMPLETE` | `METHODOLOGY_REVIEW_PENDING`

---

### 17. `TLI-DPDP-BRC-02`: Dual Breach Intimation (DPBI & Affected Principals)
- **Control Version**: `1.0.0`
- **Topic**: `BREACH_READINESS` | **Subcategory**: `Dual Breach Notification`
- **Source Reference**: `SRC-01` (DPDPA 2023, Section 8(6)) r/w `SRC-03` (DPDPR 2025, Rule 9)
- **Source Status**: `NOTIFIED_RULES` | **Commencement**: `SCHEDULED_COMMENCEMENT_13_MAY_2027`
- **Obligation Type**: `MANDATORY_STATUTORY`
- **Legal Reference Summary**: Mandatory intimation of personal data breach to the Data Protection Board of India and to each affected Data Principal in the form, manner, and timelines prescribed under Rule 9. Maximum penalty: ₹200 Crores.
- **Applicability Conditions**: Applies to all Data Fiduciaries.
- **Applicability Rationale**: Non-negotiable statutory mandate.
- **Assessment Question**: Are communication templates, secure channels, and procedural workflows established to execute mandatory breach intimations to both the DPBI and affected Data Principals?
- **Implementation Expectations**: Pre-draft bilingual breach notification templates and maintain technical bulk notification channels to alert affected Data Principals without delay.
- **Acceptable Evidence**: `EVID-BRC-02`, `EVID-SOP-03`
- **Evidence Limitations**: Notifying only the Board while concealing the incident from affected Data Principals violates Section 8(6).
- **Assessment Guidance**: Inspect pre-drafted communication templates for required statutory fields (nature of breach, data categories, mitigation advice).
- **Risk Guidance**: Failure to intimate breach to the Board or Data Principals triggers statutory penalties up to ₹200 Crores (Schedule Tier 2).
- **Suggested Remediation**: Configure automated communication playbooks ready to dispatch breach notices to DPBI digital portal and Data Principals.
- **Related Controls**: `TLI-DPDP-BRC-01`
- **Review Status**: `PROVISIONAL_RESEARCH_COMPLETE` | `METHODOLOGY_REVIEW_PENDING`

---

### 18. `TLI-DPDP-RET-01`: Purpose Fulfillment & Automated Erasure
- **Control Version**: `1.0.0`
- **Topic**: `RETENTION_ERASURE` | **Subcategory**: `Data Retention & Purging`
- **Source Reference**: `SRC-01` (DPDPA 2023, Section 8(7)) r/w `SRC-03` (DPDPR 2025, Rule 10)
- **Source Status**: `NOTIFIED_RULES` | **Commencement**: `SCHEDULED_COMMENCEMENT_13_MAY_2027`
- **Obligation Type**: `MANDATORY_STATUTORY`
- **Legal Reference Summary**: A Data Fiduciary must erase personal data upon the Data Principal withdrawing consent or as soon as it is reasonable to assume that the specified purpose is no longer being served, unless retention is required by law.
- **Applicability Conditions**: Applies to all systems holding digital personal data.
- **Applicability Rationale**: Mandatory statutory duty enforcing storage limitation.
- **Assessment Question**: Does the organisation maintain defined retention schedules with automated or verified data purging when the specified purpose expires or consent is withdrawn?
- **Implementation Expectations**: Maintain a Data Retention Schedule and execute automated cron jobs / database TTL policies to purge expired personal data.
- **Acceptable Evidence**: `EVID-RET-01`
- **Evidence Limitations**: Indefinite data retention policies or failure to purge test/staging databases violate Section 8(7).
- **Assessment Guidance**: Verify database archival routines and data destruction certificates.
- **Risk Guidance**: Retaining data beyond purpose fulfillment breaches Section 8(7) and amplifies breach impact surface.
- **Suggested Remediation**: Deploy automated data lifecycle management (DLM) policies across databases and object storage.
- **Related Controls**: `TLI-DPDP-CON-02`, `TLI-DPDP-RET-02`
- **Review Status**: `PROVISIONAL_RESEARCH_COMPLETE` | `METHODOLOGY_REVIEW_PENDING`

---

### 19. `TLI-DPDP-RET-02`: Statutory Retention Exceptions Register
- **Control Version**: `1.0.0`
- **Topic**: `RETENTION_ERASURE` | **Subcategory**: `Legal Retention Register`
- **Source Reference**: `SRC-01` (DPDPA 2023, Section 8(7)-(8))
- **Source Status**: `ENACTED_STATUTE` | **Commencement**: `SCHEDULED_COMMENCEMENT_13_MAY_2027`
- **Obligation Type**: `MANDATORY_STATUTORY`
- **Legal Reference Summary**: Retention beyond purpose fulfillment is lawful only where explicitly required under applicable laws (e.g. Income Tax Act, Prevention of Money Laundering Act, Companies Act).
- **Applicability Conditions**: Applies to all fiduciaries retaining personal data under statutory mandates.
- **Applicability Rationale**: Justification requirement for retained records.
- **Assessment Question**: Has the organisation compiled a Legal Retention Register documenting the specific statutory provisions requiring extended retention of records?
- **Implementation Expectations**: Maintain a legal citation register linking personal data categories (e.g. invoices, payroll, KYC) to specific Indian statutory retention mandates.
- **Acceptable Evidence**: `EVID-RET-02`
- **Evidence Limitations**: Vague assertions of "regulatory compliance" without citing the applicable Indian Act and section fail this control.
- **Assessment Guidance**: Review legal citations against tax, banking, corporate, and labor legislation.
- **Risk Guidance**: Unsubstantiated retention masquerading as legal obligation violates Section 8(7).
- **Suggested Remediation**: Partner with legal counsel to formulate a comprehensive statutory retention schedule mapping data types to specific enactments.
- **Related Controls**: `TLI-DPDP-RET-01`
- **Review Status**: `PROVISIONAL_RESEARCH_COMPLETE` | `METHODOLOGY_REVIEW_PENDING`

---

### 20. `TLI-DPDP-DSR-01`: Data Principal Rights: Access & Information Summary
- **Control Version**: `1.0.0`
- **Topic**: `DATA_PRINCIPAL_RIGHTS` | **Subcategory**: `Right to Access`
- **Source Reference**: `SRC-01` (DPDPA 2023, Section 11) r/w `SRC-03` (DPDPR 2025, Rule 14)
- **Source Status**: `NOTIFIED_RULES` | **Commencement**: `SCHEDULED_COMMENCEMENT_13_MAY_2027`
- **Obligation Type**: `MANDATORY_STATUTORY`
- **Legal Reference Summary**: The Data Principal has the right to obtain from the fiduciary: (a) a summary of personal data being processed and processing activities, (b) the identities of all other Data Fiduciaries and Processors with whom shared, and (c) other prescribed information.
- **Applicability Conditions**: Applies to all Data Fiduciaries processing personal data with consent or under Section 7(a).
- **Applicability Rationale**: Mandatory statutory right under Section 11.
- **Assessment Question**: Does the organisation maintain a secure portal and workflow to provide Data Principals with a comprehensive summary of their processed personal data and a list of sharing partners?
- **Implementation Expectations**: Deploy a self-service DSAR access portal or request intake workflow capable of compiling personal data summaries within statutory timelines.
- **Acceptable Evidence**: `EVID-DSR-01`, `EVID-SOP-04`
- **Evidence Limitations**: Requiring Data Principals to visit physical offices or pay excessive fees violates Section 11 and Rule 14.
- **Assessment Guidance**: Test the DSAR intake form and inspect sample response summaries.
- **Risk Guidance**: Denying or ignoring valid access requests triggers Data Principal complaints to the DPBI under Section 13.
- **Suggested Remediation**: Implement an automated DSAR orchestration tool linked to backend user databases.
- **Related Controls**: `TLI-DPDP-DSR-02`, `TLI-DPDP-DSR-03`
- **Review Status**: `PROVISIONAL_RESEARCH_COMPLETE` | `METHODOLOGY_REVIEW_PENDING`

---

### 21. `TLI-DPDP-DSR-02`: Data Principal Rights: Correction, Update & Erasure
- **Control Version**: `1.0.0`
- **Topic**: `DATA_PRINCIPAL_RIGHTS` | **Subcategory**: `Right to Correction & Erasure`
- **Source Reference**: `SRC-01` (DPDPA 2023, Section 12) r/w `SRC-03` (DPDPR 2025, Rule 14)
- **Source Status**: `NOTIFIED_RULES` | **Commencement**: `SCHEDULED_COMMENCEMENT_13_MAY_2027`
- **Obligation Type**: `MANDATORY_STATUTORY`
- **Legal Reference Summary**: A Data Principal has the right to correction of inaccurate personal data, completion of incomplete data, updating, and erasure of personal data that is no longer necessary for the specified purpose or where consent has been withdrawn.
- **Applicability Conditions**: Applies to all Data Fiduciaries.
- **Applicability Rationale**: Mandatory statutory right.
- **Assessment Question**: Are procedures and self-service features in place allowing Data Principals to correct, update, complete, or request erasure of their personal data?
- **Implementation Expectations**: Provide profile editing features and a verified DSAR workflow to execute corrections and erasures across primary and replica databases.
- **Acceptable Evidence**: `EVID-DSR-01`
- **Evidence Limitations**: Refusing erasure requests without citing a valid statutory retention exception violates Section 12(3).
- **Assessment Guidance**: Audit the end-to-end workflow from customer request to downstream database modification.
- **Risk Guidance**: Failure to process correction or erasure requests exposes the fiduciary to regulatory orders and penalties.
- **Suggested Remediation**: Build profile self-service editing workflows and establish technical propagation of erasures to Data Processors.
- **Related Controls**: `TLI-DPDP-FID-02`, `TLI-DPDP-RET-01`
- **Review Status**: `PROVISIONAL_RESEARCH_COMPLETE` | `METHODOLOGY_REVIEW_PENDING`

---

### 22. `TLI-DPDP-DSR-03`: Grievance Redressal Mechanism & Officer Publication
- **Control Version**: `1.0.0`
- **Topic**: `DATA_PRINCIPAL_RIGHTS` | **Subcategory**: `Grievance Redressal`
- **Source Reference**: `SRC-01` (DPDPA 2023, Section 8(8), Section 13) r/w `SRC-03` (DPDPR 2025, Rule 11)
- **Source Status**: `NOTIFIED_RULES` | **Commencement**: `SCHEDULED_COMMENCEMENT_13_MAY_2027`
- **Obligation Type**: `MANDATORY_STATUTORY`
- **Legal Reference Summary**: A Data Fiduciary must establish an effective grievance redressal mechanism and publish the contact details of the Data Protection Officer or authorised Grievance Officer. Fiduciaries must resolve complaints within statutory timelines (e.g. 30 days) before a principal approaches the Board.
- **Applicability Conditions**: Applies universally to all Data Fiduciaries.
- **Applicability Rationale**: Mandatory statutory duty.
- **Assessment Question**: Has the organisation published the contact details of an authorized Grievance Officer and established an SLA-tracked grievance redressal ticketing system?
- **Implementation Expectations**: Publish the Grievance Officer's name, email, and physical address prominently on websites/apps; maintain a ticketing SLA enforcing resolution within statutory limits.
- **Acceptable Evidence**: `EVID-NOT-01`, `EVID-SOP-05`
- **Evidence Limitations**: Generic "support@company.com" addresses without a designated human officer violate Section 8(8).
- **Assessment Guidance**: Check public privacy notice footer and test grievance ticket routing.
- **Risk Guidance**: Failure to provide grievance redressal allows Data Principals to escalate directly to the DPBI, triggering board inquiries.
- **Suggested Remediation**: Formally designate an India-based Grievance Officer and configure a privacy grievance queue in the ticketing system.
- **Related Controls**: `TLI-DPDP-NOT-01`, `TLI-DPDP-SDF-01`
- **Review Status**: `PROVISIONAL_RESEARCH_COMPLETE` | `METHODOLOGY_REVIEW_PENDING`

---

### 23. `TLI-DPDP-DSR-04`: Data Principal Right to Nominate
- **Control Version**: `1.0.0`
- **Topic**: `DATA_PRINCIPAL_RIGHTS` | **Subcategory**: `Right to Nominate`
- **Source Reference**: `SRC-01` (DPDPA 2023, Section 14) r/w `SRC-03` (DPDPR 2025, Rule 15)
- **Source Status**: `NOTIFIED_RULES` | **Commencement**: `SCHEDULED_COMMENCEMENT_13_MAY_2027`
- **Obligation Type**: `MANDATORY_STATUTORY`
- **Legal Reference Summary**: A Data Principal shall have the right to nominate any other individual, who shall, in the event of death or incapacity of the Data Principal, exercise the rights of the Data Principal in accordance with prescribed rules.
- **Applicability Conditions**: Applies to user-account and consumer-facing platforms.
- **Applicability Rationale**: Mandatory statutory right under Section 14.
- **Assessment Question**: Does the organisation provide an account feature or mechanism allowing Data Principals to nominate an individual to manage their personal data in the event of death or incapacity?
- **Implementation Expectations**: Introduce a digital nomination feature within account settings allowing users to designate a nominee with contact details.
- **Acceptable Evidence**: `EVID-DSR-01`, `EVID-SOP-04`
- **Evidence Limitations**: Lacking a nomination mechanism in consumer user accounts breaches Section 14.
- **Assessment Guidance**: Verify account management screens and deceased account policy documentation.
- **Risk Guidance**: Inability to honor lawful nominee claims violates Section 14.
- **Suggested Remediation**: Add a "Digital Nominee Designation" section to user account profile settings.
- **Related Controls**: `TLI-DPDP-DSR-01`
- **Review Status**: `PROVISIONAL_RESEARCH_COMPLETE` | `METHODOLOGY_REVIEW_PENDING`

---

### 24. `TLI-DPDP-CHD-01`: Verifiable Parental Consent for Children & Disabled
- **Control Version**: `1.0.0`
- **Topic**: `CHILDREN_DISABLED_DATA` | **Subcategory**: `Parental Consent`
- **Source Reference**: `SRC-01` (DPDPA 2023, Section 9(1)) r/w `SRC-03` (DPDPR 2025, Rule 12) & `SRC-04`
- **Source Status**: `NOTIFIED_RULES` | **Commencement**: `SCHEDULED_COMMENCEMENT_13_MAY_2027`
- **Obligation Type**: `STATUTORY_EXCEPTION_CONDITIONAL`
- **Legal Reference Summary**: A Data Fiduciary shall, before processing any personal data of a child (< 18 years) or a person with a disability who has a lawful guardian, obtain verifiable consent of the parent or lawful guardian in prescribed form. Maximum penalty: ₹200 Crores.
- **Applicability Conditions**: Applies to any organisation processing personal data of individuals under 18 years of age or persons with disabilities.
- **Applicability Rationale**: Conditional requirement. Can be marked Not Applicable only if the organisation strictly verifies that it does not process minor data.
- **Assessment Question**: Does the organisation maintain an operational age-gating mechanism and a verifiable parental/guardian consent verification process before processing children's personal data?
- **Implementation Expectations**: Deploy neutral age-screens and integrate government-approved parental verification mechanisms (e.g., DigiLocker tokenization, parental OTP verification).
- **Acceptable Evidence**: `EVID-CHD-01`
- **Evidence Limitations**: Self-declaration checkboxes ("I am 18 or older") without verification are insufficient for platforms likely to be accessed by minors.
- **Assessment Guidance**: Review user onboarding flow and parental consent verification logs.
- **Risk Guidance**: Processing child data without verifiable parental consent carries statutory penalties up to ₹200 Crores (Schedule Tier 2).
- **Suggested Remediation**: Implement a robust age-assurance mechanism and establish a multi-step parental verification workflow.
- **Related Controls**: `TLI-DPDP-CHD-02`, `TLI-DPDP-CON-01`
- **Review Status**: `PROVISIONAL_RESEARCH_COMPLETE` | `METHODOLOGY_REVIEW_PENDING`

---

### 25. `TLI-DPDP-CHD-02`: Prohibition on Child Tracking, Profiling & Ads
- **Control Version**: `1.0.0`
- **Topic**: `CHILDREN_DISABLED_DATA` | **Subcategory**: `Child Safety Safeguards`
- **Source Reference**: `SRC-01` (DPDPA 2023, Section 9(2)-(3))
- **Source Status**: `ENACTED_STATUTE` | **Commencement**: `SCHEDULED_COMMENCEMENT_13_MAY_2027`
- **Obligation Type**: `STATUTORY_EXCEPTION_CONDITIONAL`
- **Legal Reference Summary**: A Data Fiduciary shall not undertake tracking or behavioural monitoring of children or targeted advertising directed at children, nor undertake processing likely to cause detrimental effect on child well-being. Maximum penalty: ₹200 Crores.
- **Applicability Conditions**: Applies to entities whose digital platforms or apps are accessed by minors.
- **Applicability Rationale**: Mandatory conditional restriction.
- **Assessment Question**: Are technical controls enforced to completely disable tracking scripts, behavioural analytics, user profiling, and targeted advertising whenever an account belongs to a minor?
- **Implementation Expectations**: Configure advertising SDKs and analytics pipelines to suppress tracking cookies, user profiling, and targeted ad servers for registered minors.
- **Acceptable Evidence**: `EVID-CHD-02`
- **Evidence Limitations**: Serving targeted ads to accounts flagged as minors constitutes an immediate violation of Section 9(3).
- **Assessment Guidance**: Audit network traffic and tracking SDK initialisation code for minor user profiles.
- **Risk Guidance**: Direct violation of Section 9(3) subject to Tier 2 statutory penalty (up to ₹200 Crores).
- **Suggested Remediation**: Hardcode a platform-wide privacy switch that disables all advertising identifiers and behavioral pixels for minor user IDs.
- **Related Controls**: `TLI-DPDP-CHD-01`
- **Review Status**: `PROVISIONAL_RESEARCH_COMPLETE` | `METHODOLOGY_REVIEW_PENDING`

---

### 26. `TLI-DPDP-SDF-01`: Significant Data Fiduciary Governance (Resident DPO)
- **Control Version**: `1.0.0`
- **Topic**: `SDF_GOVERNANCE` | **Subcategory**: `DPO Appointment`
- **Source Reference**: `SRC-01` (DPDPA 2023, Section 10(1)-(2)(a)) & `SRC-04`
- **Source Status**: `ENACTED_STATUTE` | **Commencement**: `SCHEDULED_COMMENCEMENT_13_MAY_2027`
- **Obligation Type**: `SDF_MANDATORY_CONDITIONAL`
- **Legal Reference Summary**: Significant Data Fiduciaries (notified under Section 10) must appoint an India-based Data Protection Officer (DPO) who represents the fiduciary and reports directly to the Board of Directors or governing body.
- **Applicability Conditions**: Mandatory for notified Significant Data Fiduciaries; advisory best practice for high-volume fiduciaries.
- **Applicability Rationale**: Conditional on SDF designation or prospective candidacy.
- **Assessment Question**: Has the organisation formally appointed an India-resident Data Protection Officer with independent reporting lines directly to the Board of Directors?
- **Implementation Expectations**: Issue formal board resolution appointing an India-resident DPO with direct reporting to the Board, adequate resources, and independence.
- **Acceptable Evidence**: `EVID-SDF-01`
- **Evidence Limitations**: Designating a non-resident executive or subordinating the DPO to IT/marketing departments violates Section 10(2)(a).
- **Assessment Guidance**: Inspect board minutes, employment contract, and organizational reporting hierarchy.
- **Risk Guidance**: Operating as an SDF without a resident DPO breaches Section 10 obligations and invites severe regulatory penalties.
- **Suggested Remediation**: Formalise the DPO role charter and ensure the designated individual is resident in India and reports to executive governance.
- **Related Controls**: `TLI-DPDP-SDF-02`, `TLI-DPDP-DSR-03`
- **Review Status**: `PROVISIONAL_RESEARCH_COMPLETE` | `METHODOLOGY_REVIEW_PENDING`

---

### 27. `TLI-DPDP-SDF-02`: SDF Impact Assessments (DPIA) & Independent Audits
- **Control Version**: `1.0.0`
- **Topic**: `SDF_GOVERNANCE` | **Subcategory**: `DPIA & Independent Audit`
- **Source Reference**: `SRC-01` (DPDPA 2023, Section 10(2)(b)-(c)) r/w `SRC-03` (DPDPR 2025, Rule 13)
- **Source Status**: `NOTIFIED_RULES` | **Commencement**: `SCHEDULED_COMMENCEMENT_13_MAY_2027`
- **Obligation Type**: `SDF_MANDATORY_CONDITIONAL`
- **Legal Reference Summary**: An SDF must appoint an independent Data Auditor to carry out data audits, and undertake periodic Data Protection Impact Assessments (DPIA) assessing privacy risks and mitigation measures.
- **Applicability Conditions**: Mandatory for notified Significant Data Fiduciaries.
- **Applicability Rationale**: Conditional on SDF designation.
- **Assessment Question**: Does the organisation conduct periodic Data Protection Impact Assessments (DPIAs) for high-risk processing activities and engage an independent Data Auditor for annual compliance audits?
- **Implementation Expectations**: Formulate an enterprise DPIA framework and execute formal engagement contracts with external independent privacy auditors.
- **Acceptable Evidence**: `EVID-SDF-02`
- **Evidence Limitations**: Internal self-assessments cannot substitute for an independent data audit under Section 10(2)(b).
- **Assessment Guidance**: Review DPIA documentation for high-risk deployments (e.g. AI systems, biometric processing) and external auditor findings.
- **Risk Guidance**: Failure to conduct DPIAs or independent audits constitutes a material SDF violation under Section 10.
- **Suggested Remediation**: Adopt an institutional DPIA methodology and establish a procurement schedule for independent annual data audits.
- **Related Controls**: `TLI-DPDP-SDF-01`
- **Review Status**: `PROVISIONAL_RESEARCH_COMPLETE` | `METHODOLOGY_REVIEW_PENDING`

---

### 28. `TLI-DPDP-XBD-01`: Cross-Border Data Transfers & Negative List
- **Control Version**: `1.0.0`
- **Topic**: `CROSS_BORDER_TRANSFERS` | **Subcategory**: `Cross-Border Transfers`
- **Source Reference**: `SRC-01` (DPDPA 2023, Section 16(1)) r/w `SRC-03` (DPDPR 2025, Rule 16)
- **Source Status**: `NOTIFIED_RULES` | **Commencement**: `SCHEDULED_COMMENCEMENT_13_MAY_2027`
- **Obligation Type**: `STATUTORY_EXCEPTION_CONDITIONAL`
- **Legal Reference Summary**: The Central Government may restrict transfer of personal data outside India to notified countries/territories (negative list). Fiduciaries must not transfer personal data to blacklisted destinations.
- **Applicability Conditions**: Applies to all organisations transferring digital personal data outside India.
- **Applicability Rationale**: Mandatory conditional restriction.
- **Assessment Question**: Does the organisation maintain an inventory of all cross-border data flows and enforce controls ensuring personal data is not transferred to blacklisted countries?
- **Implementation Expectations**: Maintain a Cross-Border Data Transfer Register documenting destination countries, recipient entities, and technical safeguard mechanisms.
- **Acceptable Evidence**: `EVID-XBD-01`, `EVID-ROPA-01`
- **Evidence Limitations**: Unmonitored overseas SaaS usage (shadow IT) where data destination is unknown violates Section 16.
- **Assessment Guidance**: Audit network gateways, cloud region configurations, and offshore vendor contracts.
- **Risk Guidance**: Unauthorised cross-border transfers to restricted jurisdictions breach Section 16 and trigger immediate statutory sanctions.
- **Suggested Remediation**: Implement technical cloud policies restricting data center provisioning to approved jurisdictions and document all outbound data flows.
- **Related Controls**: `TLI-DPDP-XBD-02`, `TLI-DPDP-PRO-01`
- **Review Status**: `PROVISIONAL_RESEARCH_COMPLETE` | `METHODOLOGY_REVIEW_PENDING`

---

### 29. `TLI-DPDP-XBD-02`: Sectoral Data Localization Preservation
- **Control Version**: `1.0.0`
- **Topic**: `CROSS_BORDER_TRANSFERS` | **Subcategory**: `Sectoral Localization`
- **Source Reference**: `SRC-01` (DPDPA 2023, Section 16(2)) r/w `SRC-06` (RBI Directive 2018)
- **Source Status**: `SECTORAL_REGULATION` | **Commencement**: `IN_FORCE`
- **Obligation Type**: `STATUTORY_EXCEPTION_CONDITIONAL`
- **Legal Reference Summary**: Nothing contained in Section 16(1) shall restrict the applicability of any law for the time being in force that provides for a higher degree of protection or restriction on transfer of personal data (e.g. RBI payment data localization).
- **Applicability Conditions**: Applies to regulated entities (banks, NBFCs, payment aggregators, insurance providers).
- **Applicability Rationale**: Sector-specific statutory preservation clause.
- **Assessment Question**: Does the organisation comply with higher sectoral data localization mandates (such as RBI directives requiring payment data to be stored exclusively in India)?
- **Implementation Expectations**: Configure financial database clusters and primary transaction processing exclusively within sovereign Indian data centers.
- **Acceptable Evidence**: `EVID-XBD-02`
- **Evidence Limitations**: Storing payment system logs exclusively in overseas cloud regions violates RBI directives preserved under Section 16(2).
- **Assessment Guidance**: Review System Audit Reports (SAR) submitted to sectoral regulators (RBI, IRDAI, SEBI).
- **Risk Guidance**: Sectoral localization violations trigger regulatory license suspension alongside DPDPA exposure.
- **Suggested Remediation**: Ensure all payment transaction data and related audit trails reside strictly on domestic Indian servers.
- **Related Controls**: `TLI-DPDP-XBD-01`
- **Review Status**: `PROVISIONAL_RESEARCH_COMPLETE` | `METHODOLOGY_REVIEW_PENDING`

---

### 30. `TLI-DPDP-PEN-01`: Statutory Penalty Deficit Exposure & Sanction Audit
- **Control Version**: `1.0.0`
- **Topic**: `PENALTY_READINESS` | **Subcategory**: `Penalty Exposure`
- **Source Reference**: `SRC-01` (DPDPA 2023, Schedule r/w Section 33)
- **Source Status**: `ENACTED_STATUTE` | **Commencement**: `SCHEDULED_COMMENCEMENT_13_MAY_2027`
- **Obligation Type**: `MANDATORY_STATUTORY`
- **Legal Reference Summary**: The Schedule establishes five statutory financial penalty tiers up to ₹250 Crores based on breach nature, gravity, duration, repetitive nature, and mitigating measures taken by the fiduciary.
- **Applicability Conditions**: Applies universally to all Data Fiduciaries and Processors.
- **Applicability Rationale**: Risk quantification and mitigation readiness.
- **Assessment Question**: Has the organisation assessed its potential statutory penalty exposure across the five statutory tiers and established mitigating measures recognized under Section 28(2)?
- **Implementation Expectations**: Conduct periodic statutory risk modeling quantifying potential penalty liabilities and documenting proactive mitigating measures.
- **Acceptable Evidence**: `EVID-RSK-01`, `EVID-SEC-01`
- **Evidence Limitations**: Relying solely on cyber insurance without implementing technical mitigations does not satisfy DPBI mitigation criteria.
- **Assessment Guidance**: Check whether compliance deficits in Sections 8(5), 8(6), and 9 are tracked as enterprise board-level risks.
- **Risk Guidance**: Failure to remediate known statutory deficits constitutes a repetitive/aggravated factor under Section 28(2), driving penalties toward statutory maximums.
- **Suggested Remediation**: Present quarterly DPDP statutory deficit registers to executive leadership and prioritize funding for high-penalty risk gaps.
- **Related Controls**: `TLI-DPDP-SEC-01`, `TLI-DPDP-BRC-02`, `TLI-DPDP-CHD-01`
- **Review Status**: `PROVISIONAL_RESEARCH_COMPLETE` | `METHODOLOGY_REVIEW_PENDING`

