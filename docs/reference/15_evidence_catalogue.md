# 15. Evidence Catalogue and Verification Standards

**Project:** TLI DPDP Compliance Gap Analysis Tool  
**Framework Version:** `DPDPA-2023-V1.0`  
**Deliverable Ref:** Phase 2 Evidence Catalogue & Verification Standards  
**Status:** Canonical Standard — Version 1.0.0

---

## 1. Evidence Verification Philosophy & Standards

To ensure forensic defensibility, the platform enforces strict evidentiary principles:
1. **Document Upload $\ne$ Implementation**: The mere presence of an uploaded policy or diagram does not establish that a control is operational or effective. Reviewers must examine procedural enforcement, configuration proof, and operational records.
2. **Proportionate & Safe Evidence**: Reviewers must never request unmasked customer databases, live biometric records, or production credentials. Evidence must be synthetic, blank template, or masked operational samples (`XXXX-XXXX-1234`).
3. **Multi-Factor Substantiation**: High-assurance controls (such as reasonable safeguards, breach readiness, or consent withdrawal) require a combination of policy documents, technical architecture screenshots, and operational audit records.

---

## 2. Evidence Catalogue Master Table

| Evidence Type ID | Evidence Title | Primary Linked Controls | Mandatory / Conditional | Confidentiality Tier | Recommended Freshness |
|---|---|---|---|---|---|
| `EVID-ROPA-01` | Data Processing Activities Inventory (RoPA) | `TLI-DPDP-SCO-01`, `LGL-01`, `LEG-01` | Mandatory | TIER-2 (Internal Confidential) | Annual / Major Architecture Change |
| `EVID-NOT-01` | Pre-Consent Itemised Notice Artifacts | `TLI-DPDP-NOT-01`, `DSR-03` | Mandatory | TIER-1 (Public Governance) | Current Live Production |
| `EVID-NOT-02` | Multilingual Notice Mechanism Proof | `TLI-DPDP-NOT-03` | Mandatory | TIER-1 (Public Governance) | Current Live Production |
| `EVID-NOT-03` | Legacy User Grandfathering Notice Plan | `TLI-DPDP-NOT-02` | Conditional | TIER-2 (Internal Confidential) | One-time Campaign Record |
| `EVID-CON-01` | Affirmative Consent Capture UI Flow & Logs | `TLI-DPDP-CON-01` | Mandatory | TIER-2 (Internal Confidential) | Current Live Production |
| `EVID-CON-02` | Consent Withdrawal Interface & Workflow | `TLI-DPDP-CON-02` | Mandatory | TIER-2 (Internal Confidential) | Current Live Production |
| `EVID-DPA-01` | Executed Data Processing Agreements (DPA) | `TLI-DPDP-PRO-01` | Mandatory | TIER-2 (Commercial Confidential) | Valid Active Contract Term |
| `EVID-SEC-01` | Information Security Policy & TOMs Architecture| `TLI-DPDP-SEC-01`, `FID-01` | Mandatory | TIER-2 (Internal Confidential) | Annual Review |
| `EVID-SEC-02` | Cryptographic Architecture & Key Governance | `TLI-DPDP-SEC-02` | Mandatory | TIER-2 (Restricted Security) | Annual Review |
| `EVID-VAPT-01` | Independent VAPT Audit Executive Summary | `TLI-DPDP-SEC-01` | Mandatory | TIER-2 (Restricted Security) | Within Last 12 Months |
| `EVID-BRC-01` | Personal Data Breach Incident Response Plan | `TLI-DPDP-BRC-01` | Mandatory | TIER-2 (Internal Confidential) | Annual Review |
| `EVID-BRC-02` | Dual Breach Notification Playbook & Templates | `TLI-DPDP-BRC-02` | Mandatory | TIER-2 (Internal Confidential) | Current Ready State |
| `EVID-RET-01` | Data Retention Schedule & Automated Purging Proof| `TLI-DPDP-RET-01` | Mandatory | TIER-2 (Internal Confidential) | Annual Review |
| `EVID-RET-02` | Statutory Retention Exceptions Register | `TLI-DPDP-RET-02` | Mandatory | TIER-2 (Internal Confidential) | Annual Review |
| `EVID-DSR-01` | Data Principal Rights (DSAR) Portal & Logs | `TLI-DPDP-DSR-01`, `DSR-02` | Mandatory | TIER-2 (Internal Confidential) | Current Live Production |
| `EVID-SOP-01` | Standard Operating Procedure (SOP) Collection | `TLI-DPDP-LEG-01`, `NOT-02` | Conditional | TIER-2 (Internal Confidential) | Within Last 24 Months |
| `EVID-SOP-02` | Data Quality & Deduplication SOP | `TLI-DPDP-FID-02` | Mandatory | TIER-2 (Internal Confidential) | Within Last 24 Months |
| `EVID-SOP-03` | Breach Escalation & Triage Protocol | `TLI-DPDP-BRC-02` | Mandatory | TIER-2 (Internal Confidential) | Annual Review |
| `EVID-SOP-04` | DSAR Fulfillment & Identity Verification SOP | `TLI-DPDP-DSR-01`, `DSR-04` | Mandatory | TIER-2 (Internal Confidential) | Annual Review |
| `EVID-SOP-05` | Grievance Redressal Ticketing SLA & Escalation | `TLI-DPDP-DSR-03` | Mandatory | TIER-2 (Internal Confidential) | Annual Review |
| `EVID-CHD-01` | Verifiable Parental Consent Architecture Flow | `TLI-DPDP-CHD-01` | Conditional | TIER-2 (Internal Confidential) | Current Live Production |
| `EVID-CHD-02` | Child Tracking Suppression Technical Proof | `TLI-DPDP-CHD-02` | Conditional | TIER-2 (Restricted Security) | Current Live Production |
| `EVID-SDF-01` | DPO Appointment Resolution & Reporting Charter| `TLI-DPDP-SDF-01` | Conditional | TIER-2 (Corporate Governance) | Valid Active Appointment |
| `EVID-SDF-02` | DPIA Methodology & Completed Assessments | `TLI-DPDP-SDF-02` | Conditional | TIER-2 (Internal Confidential) | Within Last 12 Months |
| `EVID-XBD-01` | Cross-Border Data Transfer Inventory | `TLI-DPDP-XBD-01` | Conditional | TIER-2 (Internal Confidential) | Annual Review |
| `EVID-XBD-02` | Sectoral Data Localization System Audit Report | `TLI-DPDP-XBD-02` | Conditional | TIER-2 (Regulatory Audit) | Annual Regulatory Filing |
| `EVID-RSK-01` | Enterprise Statutory Penalty Deficit Exposure Risk| `TLI-DPDP-PEN-01` | Mandatory | TIER-2 (Corporate Risk) | Bi-annual Executive Review |

---

## 3. Detailed Evidence Specifications

### 1. `EVID-ROPA-01`: Data Processing Activities Inventory (RoPA)
- **Title**: Record of Data Processing Activities (RoPA) Inventory
- **Description**: Comprehensive structured inventory mapping personal data flows, processing purposes, legal grounds, storage repositories, processors, and retention periods.
- **Linked Controls**: `TLI-DPDP-SCO-01`, `TLI-DPDP-LGL-01`, `TLI-DPDP-LEG-01`, `TLI-DPDP-XBD-01`
- **Purpose**: Establishes material scope, jurisdictional nexus, and lawful processing grounds for all enterprise data flows.
- **Acceptable Evidence Examples**: Enterprise data inventory spreadsheet, privacy management software export (e.g. OneTrust, TrustArc), or internal RoPA database report.
- **Status**: Mandatory for all organisations.
- **Acceptable Alternative Evidence**: Enterprise Data Flow Diagrams (DFDs) paired with systems integration matrices.
- **Freshness Guidance**: Updated within the last 12 months or following major IT architecture modifications.
- **Verification Procedure**:
  1. Inspect whether each business unit (HR, IT, Marketing, FinTech) has contributed data flows.
  2. Verify that each activity lists a specific statutory ground (Section 6 Consent or Section 7 clause).
  3. Confirm that personal data categories (Identity, Financial, Device) are itemised.
- **Limitations & Common Weaknesses**: High-level network topology diagrams that do not identify personal data elements or processing purposes fail this requirement.
- **Confidentiality Classification**: TIER-2 (Internal Confidential).
- **Masking & Redaction Requirements**: Sanitize internal database IP addresses and credentials; ensure no live employee or customer records are present.
- **Retention Considerations**: Retain with assessment working papers for statutory audit lifecycle.
- **Reviewer Guidance**: Cross-check RoPA entries against the controls evaluated in the assessment to ensure scope completeness.

---

### 2. `EVID-NOT-01`: Pre-Consent Itemised Notice Artifacts
- **Title**: Pre-Consent Itemised Notice Screenshots & Content Copies
- **Description**: Verifiable copies and UI screenshots of standalone pre-consent privacy notices presented to Data Principals at collection touchpoints.
- **Linked Controls**: `TLI-DPDP-NOT-01`, `TLI-DPDP-DSR-03`
- **Purpose**: Proves that notice complies with Section 5(1) itemisation mandates prior to consent capture.
- **Acceptable Evidence Examples**: High-resolution screenshots of live mobile app registration screens, web signup forms, or scanned paper onboarding consent sheets.
- **Status**: Mandatory for all consent-based processing.
- **Acceptable Alternative Evidence**: Staging/UAT environment walk-through video recordings with code commit hash tags.
- **Freshness Guidance**: Must reflect the current live production user experience.
- **Verification Procedure**:
  1. Check that notice is presented *before* or *at the time of* consent capture.
  2. Verify presence of: (a) itemised personal data list, (b) specified purpose, (c) Section 11 rights description, (d) DPBI complaint procedure, (e) Grievance Officer details.
- **Limitations & Common Weaknesses**: Submitting a general website footer link to a 20-page legal policy does not satisfy pre-consent notice requirements.
- **Confidentiality Classification**: TIER-1 (Public Governance).
- **Masking & Redaction Requirements**: Ensure sample screenshots use dummy/synthetic user inputs (e.g., `testuser@example.com`).
- **Retention Considerations**: Historical screenshots must be version-linked to the corresponding notice revision.
- **Reviewer Guidance**: Scrutinize the notice for bundled marketing consent or coercive language.

---

### 3. `EVID-NOT-02`: Multilingual Notice Mechanism Proof
- **Title**: Multilingual Notice Option Interface Proof
- **Description**: Proof of technical capability allowing Data Principals to access notice contents in English or any of the 22 Eighth Schedule languages.
- **Linked Controls**: `TLI-DPDP-NOT-03`
- **Purpose**: Demonstrates compliance with Section 5(3) multilingual option mandate.
- **Acceptable Evidence Examples**: Screenshots of the live language selector toggle showing regional languages (e.g. Hindi, Tamil, Telugu, Bengali), or certified translation files integrated into CMS.
- **Status**: Mandatory for public and consumer-facing fiduciaries.
- **Acceptable Alternative Evidence**: API documentation and UI walkthrough of localized CMS delivering regional language content based on browser preference.
- **Freshness Guidance**: Current live production deployment.
- **Verification Procedure**:
  1. Verify the language toggle provides accessibility across Eighth Schedule languages.
  2. Review sample regional translations to confirm they convey statutory notices accurately.
- **Limitations & Common Weaknesses**: Relying on unconfigured generic third-party browser translation plugins without native platform support fails Section 5(3).
- **Confidentiality Classification**: TIER-1 (Public Governance).
- **Masking & Redaction Requirements**: None (public UI artifacts).
- **Retention Considerations**: Maintain records of certified translations alongside release version numbers.
- **Reviewer Guidance**: Test the toggle mechanism in consumer workflows.

---

### 4. `EVID-CON-01`: Affirmative Consent Capture UI Flow & Logs
- **Title**: Affirmative Consent Capture UI Flow & Consent Receipt Log Architecture
- **Description**: Visual proof of unbundled, unticked consent UI and technical schema of immutable consent log receipts.
- **Linked Controls**: `TLI-DPDP-CON-01`
- **Purpose**: Demonstrates that consent is free, specific, informed, unconditional, and captured via clear affirmative action.
- **Acceptable Evidence Examples**: UI screenshots showing unticked checkboxes alongside granular purpose toggles; database schema and sample JSON payload of a consent audit record (with timestamp, notice version, user ID, IP address).
- **Status**: Mandatory for consent-based processing.
- **Acceptable Alternative Evidence**: Automated Playwright/Cypress end-to-end consent test execution logs.
- **Freshness Guidance**: Current live production architecture.
- **Verification Procedure**:
  1. Verify that checkboxes are unchecked by default (zero dark patterns).
  2. Confirm that service provision is not conditioned upon consent for optional secondary purposes.
  3. Inspect consent log schema for timestamp, notice version ID, and affirmative action indicator.
- **Limitations & Common Weaknesses**: Pre-ticked boxes or bundled "I agree to all" single checkboxes fail Section 6(1).
- **Confidentiality Classification**: TIER-2 (Internal Confidential).
- **Masking & Redaction Requirements**: Sample database records must use synthetic user IDs (`user_synthetic_001`) and masked IP addresses (`192.0.2.1`).
- **Retention Considerations**: Consent records must be retained for the life of the processing activity plus statutory limitation periods.
- **Reviewer Guidance**: Check whether consent can be proven in an adversarial DPBI dispute.

---

### 5. `EVID-CON-02`: Consent Withdrawal Interface & Workflow
- **Title**: Consent Withdrawal Interface Proof & System Deprovisioning SOP
- **Description**: Evidence of self-service consent revocation interfaces and backend workflows halting data processing upon withdrawal.
- **Linked Controls**: `TLI-DPDP-CON-02`
- **Purpose**: Proves compliance with Section 6(4) comparable ease of withdrawal requirement.
- **Acceptable Evidence Examples**: Screenshots of user account privacy settings showing 1-click consent toggle off; backend webhook documentation triggering data de-indexing.
- **Status**: Mandatory for consent-based processing.
- **Acceptable Alternative Evidence**: Video recording of a test user revoking consent in a mobile application with immediate notification receipt.
- **Freshness Guidance**: Current live production deployment.
- **Verification Procedure**:
  1. Count clicks/actions required to grant consent vs clicks/actions required to revoke.
  2. Verify that withdrawal triggers automated message to downstream processors.
- **Limitations & Common Weaknesses**: Forcing users to email support or call a contact center to withdraw consent given digitally violates the "comparable ease" test.
- **Confidentiality Classification**: TIER-2 (Internal Confidential).
- **Masking & Redaction Requirements**: Use test accounts with synthetic profile data.
- **Retention Considerations**: Retain withdrawal audit logs for statutory compliance verification.
- **Reviewer Guidance**: Test the withdrawal path in standard consumer accounts.

---

### 6. `EVID-DPA-01`: Executed Data Processing Agreements (DPA)
- **Title**: Executed Data Processing Agreement (DPA) Sample Pack
- **Description**: Redacted copies of legally executed data processing contracts with key IT vendors, cloud hosts, and sub-processors.
- **Linked Controls**: `TLI-DPDP-PRO-01`, `TLI-DPDP-FID-01`
- **Purpose**: Proves compliance with Section 8(2) and Rule 7 mandatory contractual safeguards.
- **Acceptable Evidence Examples**: Fully executed DPA addenda with cloud infrastructure providers (AWS, Azure, GCP), SaaS vendors (Salesforce, Workday), and outsourcing partners.
- **Status**: Mandatory for all organisations engaging external processors.
- **Acceptable Alternative Evidence**: Standard Enterprise Service Agreements containing incorporated data protection schedules.
- **Freshness Guidance**: Active, unexpired contracts.
- **Verification Procedure**:
  1. Inspect signature blocks for authorized client and vendor execution.
  2. Verify mandatory Rule 7 clauses: processing scope, confidentiality, technical security, breach notice SLA, audit rights, and sub-processor authorization.
- **Limitations & Common Weaknesses**: Unsigned draft templates or standard clickwrap terms that lack breach notification commitments fail Section 8(2).
- **Confidentiality Classification**: TIER-2 (Commercial Confidential).
- **Masking & Redaction Requirements**: Redact commercial fee schedules and pricing terms. Maintain legal entity names and data protection clauses unredacted.
- **Retention Considerations**: Retain for the contract duration plus 3 years.
- **Reviewer Guidance**: Ensure all processors identified in RoPA are covered by executed DPAs.

---

### 7. `EVID-SEC-01`: Information Security Policy & TOMs Architecture
- **Title**: Enterprise Information Security Policy & Technical Measures Baseline
- **Description**: Formal board-approved information security policies detailing Technical and Organisational Measures (TOMs) deployed across enterprise assets.
- **Linked Controls**: `TLI-DPDP-SEC-01`, `TLI-DPDP-FID-01`
- **Purpose**: Substantiates reasonable security safeguards under Section 8(5) and Rule 8.
- **Acceptable Evidence Examples**: Approved Information Security Management System (ISMS) policy document, access control policy, network architecture diagrams, and patch management SOPs.
- **Status**: Mandatory for all organisations.
- **Acceptable Alternative Evidence**: ISO/IEC 27001:2022 Statement of Applicability (SoA) and audit reports.
- **Freshness Guidance**: Reviewed and approved within the past 12 months.
- **Verification Procedure**:
  1. Verify executive sign-off and approval date.
  2. Review coverage of access control, vulnerability management, employee offboarding, and physical security.
- **Limitations & Common Weaknesses**: Unapproved draft policy documents or policies that exist only on paper without technical enforcement fail this control.
- **Confidentiality Classification**: TIER-2 (Internal Confidential).
- **Masking & Redaction Requirements**: Sanitize internal IP schemes, server hostnames, and specific perimeter firewall configurations.
- **Retention Considerations**: Maintain current version plus immediate preceding baseline.
- **Reviewer Guidance**: Evaluate whether policies specifically address protection of personal data repositories.

---

### 8. `EVID-VAPT-01`: Independent VAPT Audit Executive Summary
- **Title**: Vulnerability Assessment and Penetration Testing (VAPT) Audit Report
- **Description**: Executive summary and attestation letter from an independent cybersecurity auditing firm detailing annual VAPT results and vulnerability remediation status.
- **Linked Controls**: `TLI-DPDP-SEC-01`
- **Purpose**: Independent objective verification of reasonable security safeguards to prevent personal data breaches under Section 8(5).
- **Acceptable Evidence Examples**: Executive summary of external network and web application penetration test conducted by a CERT-In empaneled or CREST accredited auditor.
- **Status**: Mandatory for all digital fiduciaries.
- **Acceptable Alternative Evidence**: Comprehensive automated Dynamic Application Security Testing (DAST) and infrastructure vulnerability scanning summaries paired with internal security review.
- **Freshness Guidance**: Within the past 12 months.
- **Verification Procedure**:
  1. Check testing scope to ensure personal data applications and databases are covered.
  2. Verify that all critical and high-severity vulnerabilities have been remediated or have documented mitigations.
- **Limitations & Common Weaknesses**: Self-run automated vulnerability scans with unresolved critical CVEs do not satisfy independent verification.
- **Confidentiality Classification**: TIER-2 (Restricted Security).
- **Masking & Redaction Requirements**: Redact exploitable proof-of-concept payload strings and sensitive server credentials. Retain vulnerability counts, severity ratings, and auditor sign-off.
- **Retention Considerations**: Retain for 3 years to demonstrate continuous security governance.
- **Reviewer Guidance**: Check specifically whether database exfiltration and unauthorized API access vulnerabilities were tested.

---

### 9. `EVID-BRC-01`: Personal Data Breach Incident Response Plan
- **Title**: Personal Data Breach Incident Response Plan & Playbook
- **Description**: Formal incident response plan establishing 24/7 detection, escalation, containment, and root-cause analysis for personal data security incidents.
- **Linked Controls**: `TLI-DPDP-BRC-01`
- **Purpose**: Demonstrates operational readiness to prevent and mitigate personal data breaches under Section 8(5) and 8(6).
- **Acceptable Evidence Examples**: CSIRT charter, incident classification matrix, step-by-step containment playbooks, and breach escalation contact trees.
- **Status**: Mandatory for all organisations.
- **Acceptable Alternative Evidence**: Enterprise Cyber Incident Response Plan containing a discrete Personal Data Breach Annex.
- **Freshness Guidance**: Reviewed within the past 12 months.
- **Verification Procedure**:
  1. Verify inclusion of specific criteria defining a "personal data breach" under DPDPA Section 2(u).
  2. Check escalation path to legal, executive management, and DPO.
- **Limitations & Common Weaknesses**: Generic IT disaster recovery plans that focus solely on system uptime without privacy triage fail this control.
- **Confidentiality Classification**: TIER-2 (Internal Confidential).
- **Masking & Redaction Requirements**: Sanitize personal mobile numbers of crisis team members (retain titles and role designations).
- **Retention Considerations**: Maintain active version.
- **Reviewer Guidance**: Verify whether the plan distinguishes between standard operational glitches and personal data breaches.

---

### 10. `EVID-BRC-02`: Dual Breach Notification Playbook & Templates
- **Title**: DPBI & Data Principal Dual Breach Notification Templates
- **Description**: Pre-drafted statutory breach notification templates and transmission protocols for intimating the Data Protection Board of India and affected Data Principals.
- **Linked Controls**: `TLI-DPDP-BRC-02`
- **Purpose**: Proves operational capability to execute mandatory dual breach intimations under Section 8(6) and Rule 9.
- **Acceptable Evidence Examples**: Bilingual notification templates (English + Hindi), bulk notification pipeline architectural specs, and DPBI digital portal dispatch SOP.
- **Status**: Mandatory for all Data Fiduciaries.
- **Acceptable Alternative Evidence**: Incident ticketing system workflow configured with pre-populated regulatory notification forms.
- **Freshness Guidance**: Current operational readiness.
- **Verification Procedure**:
  1. Confirm templates contain mandatory statutory details: nature of breach, data categories compromised, potential consequences, mitigation steps, and DPO contact.
  2. Confirm existence of communication channels (bulk email, SMS, postal, portal banner) to reach Data Principals.
- **Limitations & Common Weaknesses**: Planning to notify only the regulator while having no mechanism to notify individual Data Principals fails Section 8(6).
- **Confidentiality Classification**: TIER-2 (Internal Confidential).
- **Masking & Redaction Requirements**: Fictional/template placeholder text only.
- **Retention Considerations**: Active document.
- **Reviewer Guidance**: Check that the notification language is clear, non-technical, and provides actionable mitigation advice to Data Principals.

---

### 11. `EVID-RET-01`: Data Retention Schedule & Automated Purging Proof
- **Title**: Data Retention Schedule & Automated Deletion Configuration
- **Description**: Enterprise retention schedule defining maximum storage duration per personal data category, supported by automated technical purging configurations.
- **Linked Controls**: `TLI-DPDP-RET-01`
- **Purpose**: Demonstrates adherence to purpose fulfillment and storage limitation principles under Section 8(7) and Rule 10.
- **Acceptable Evidence Examples**: Data Retention Policy matrix; database TTL (Time-To-Live) scripts; cloud lifecycle rule configuration screenshots (e.g. S3 expiration policies); automated purging execution logs.
- **Status**: Mandatory for all organisations.
- **Acceptable Alternative Evidence**: Third-party certified data destruction certificates paired with quarterly purge review logs.
- **Freshness Guidance**: Annual policy review; purging logs within last 3 months.
- **Verification Procedure**:
  1. Match retention periods against purposes declared in pre-consent notices.
  2. Inspect technical configuration (database triggers, cron jobs) proving automated erasure occurs.
- **Limitations & Common Weaknesses**: Having a written policy that says "data will be kept for 3 years" while database records from 8 years ago remain active and unpurged fails Section 8(7).
- **Confidentiality Classification**: TIER-2 (Internal Confidential).
- **Masking & Redaction Requirements**: Sanitize internal database connection strings.
- **Retention Considerations**: Maintain audit records of purged record counts.
- **Reviewer Guidance**: Test whether data deletion applies to backups, read-replicas, and development environments.

---

### 12. `EVID-DSR-01`: Data Principal Rights (DSAR) Portal & Logs
- **Title**: Data Subject Access Request (DSAR) Portal & Workflow System
- **Description**: Operational intake portal, identity verification protocol, and request fulfillment tracking system for processing Data Principal rights.
- **Linked Controls**: `TLI-DPDP-DSR-01`, `TLI-DPDP-DSR-02`, `TLI-DPDP-DSR-04`
- **Purpose**: Demonstrates implementation of Data Principal rights under Sections 11, 12, and 14.
- **Acceptable Evidence Examples**: Public web intake form screenshots, privacy ticketing portal (e.g. Jira Service Management, Zendesk) configured with DSAR categories, and anonymized completed request tickets.
- **Status**: Mandatory for all consumer-facing fiduciaries.
- **Acceptable Alternative Evidence**: Dedicated monitored email intake SOP paired with SLA tracking spreadsheet.
- **Freshness Guidance**: Current live operational system.
- **Verification Procedure**:
  1. Test request intake channels across access, correction, erasure, and nomination.
  2. Confirm identity verification procedures do not demand excessive additional personal data.
  3. Verify statutory SLA tracking (resolution within statutory window).
- **Limitations & Common Weaknesses**: Having an email address listed in a privacy policy without any internal ticketing queue or backend fulfillment mechanism fails Section 11.
- **Confidentiality Classification**: TIER-2 (Internal Confidential).
- **Masking & Redaction Requirements**: Anonymize all applicant names, emails, and ticket details in submitted operational samples.
- **Retention Considerations**: Retain DSAR audit records for 3 years to defend against DPBI complaint proceedings.
- **Reviewer Guidance**: Verify that erasures approved through DSARs propagate downstream to Data Processors.

---

### 13. `EVID-CHD-01`: Verifiable Parental Consent Architecture Flow
- **Title**: Verifiable Parental Consent Mechanism Architecture & User Flow
- **Description**: Architectural documentation, flowcharts, and live screenshots demonstrating verified parental or guardian consent before processing children's data.
- **Linked Controls**: `TLI-DPDP-CHD-01`
- **Purpose**: Substantiates compliance with Section 9(1) verifiable parental consent requirements.
- **Acceptable Evidence Examples**: UI flowchart showing neutral age-screen; integration documentation with approved parental verification methods (e.g. DigiLocker parental relationship tokenization, dual-factor parent OTP); sample synthetic verification records.
- **Status**: Conditional (Mandatory if platform processes personal data of individuals < 18 years).
- **Acceptable Alternative Evidence**: Third-party age assurance provider certification (e.g., Yoti, Veratad) integrated into onboarding.
- **Freshness Guidance**: Current live production deployment.
- **Verification Procedure**:
  1. Inspect the age-gating mechanism to confirm it cannot be bypassed by merely refreshing the page.
  2. Verify that consent request is routed to a verifiable parent/guardian before child account activation.
- **Limitations & Common Weaknesses**: Relying on an unverified self-declaration checkbox ("I am 18 or older" or "My parents have approved this") without technical verification fails Section 9(1).
- **Confidentiality Classification**: TIER-2 (Internal Confidential).
- **Masking & Redaction Requirements**: Use synthetic minor and parent test accounts exclusively. Zero real children's data.
- **Retention Considerations**: Retain parental verification tokens for the life of the child account.
- **Reviewer Guidance**: Scrutinize the age-gating logic for vulnerabilities and dark patterns.

---

### 14. `EVID-SDF-01`: DPO Appointment Resolution & Reporting Charter
- **Title**: Resident DPO Board Appointment Resolution & Governance Charter
- **Description**: Certified copy of the Board of Directors resolution formally appointing an India-resident Data Protection Officer, accompanied by the DPO Governance Charter.
- **Linked Controls**: `TLI-DPDP-SDF-01`, `TLI-DPDP-DSR-03`
- **Purpose**: Proves statutory governance and direct board reporting required for Significant Data Fiduciaries under Section 10(2)(a).
- **Acceptable Evidence Examples**: Extract of Board Meeting Minutes signed by Company Secretary; DPO Job Charter establishing independent reporting to the Board; proof of India residency (e.g. resident employment contract extract).
- **Status**: Conditional (Mandatory for designated SDFs; recommended practice for prospective candidates).
- **Acceptable Alternative Evidence**: Executive appointment letter signed by CEO and Board Chairman.
- **Freshness Guidance**: Active current appointment.
- **Verification Procedure**:
  1. Verify that the appointed DPO is resident in India.
  2. Confirm reporting hierarchy connects directly to the Board or governing body, not mid-level IT management.
  3. Verify that the DPO is empowered with independent authority and access to all processing streams.
- **Limitations & Common Weaknesses**: Naming an overseas executive or assigning DPO duties to a marketing lead with conflicting business targets violates Section 10(2)(a).
- **Confidentiality Classification**: TIER-2 (Corporate Governance).
- **Masking & Redaction Requirements**: Redact remuneration and personal compensation terms.
- **Retention Considerations**: Retain for the duration of the appointment plus 5 years.
- **Reviewer Guidance**: Verify that contact details of the DPO match those published in the public privacy notice under Section 8(8).

---

### 15. `EVID-NOT-03`: Legacy User Grandfathering Notice Plan
- **Title**: Legacy User Grandfathering Notice Plan & Communication Artifacts
- **Description**: Documented implementation plan and communication artifacts demonstrating delivery of post-enactment notices to data principals whose consent was acquired prior to commencement.
- **Linked Controls**: `TLI-DPDP-NOT-02`
- **Purpose**: Proves compliance with Section 5(2) and Rule 3(3) retrospective notice delivery mandate.
- **Acceptable Evidence Examples**: Campaign plan, draft email/SMS notification copy, email service provider delivery logs (aggregated count, delivery rates), customer portal push notification banners.
- **Status**: Conditional (Mandatory where processing relies on pre-commencement consent).
- **Acceptable Alternative Evidence**: Staged communication rollout schedule approved by legal with pilot cohort delivery proof.
- **Freshness Guidance**: One-time statutory migration campaign record; maintained throughout transition.
- **Verification Procedure**:
  1. Inspect notice content for itemised categories, specified purposes, rights, and grievance contact.
  2. Confirm that delivery does not alter underlying service access pending principal review.
  3. Verify delivery tracking telemetry (aggregated counts, delivery success rates).
- **Limitations & Common Weaknesses**: Merely publishing a notice on a static website without dispatching notice directly to legacy users fails Section 5(2).
- **Confidentiality Classification**: TIER-2 (Internal Confidential).
- **Masking & Redaction Requirements**: Mask individual recipient email addresses and telephone numbers; use synthetic dispatch samples.
- **Retention Considerations**: Retain campaign records for statutory audit and enforcement defense lifecycle.
- **Reviewer Guidance**: Verify whether inactive or dormant user accounts are covered by the grandfathering notice campaign or targeted for erasure.

---

### 16. `EVID-SEC-02`: Cryptographic Architecture & Key Governance
- **Title**: Cryptographic Architecture Specification & Key Management Lifecycle
- **Description**: Technical architectural specifications documenting encryption at rest, encryption in transit, key lifecycle management (generation, rotation, destruction), and hardware security module (HSM) / KMS configurations.
- **Linked Controls**: `TLI-DPDP-SEC-02`
- **Purpose**: Verifies technical enforcement of data confidentiality and integrity safeguards under Section 8(5).
- **Acceptable Evidence Examples**: Cloud KMS / HSM key rotation configuration screenshots, TLS 1.3 enforcement policies, database column-level encryption configurations, cipher suite hardening baselines.
- **Status**: Mandatory for all organisations processing personal data.
- **Acceptable Alternative Evidence**: SOC 2 Type II report detailing Trust Services Criteria CC6.1, CC6.6, and CC6.7 controls.
- **Freshness Guidance**: Annual review or upon major cryptographic infrastructure change.
- **Verification Procedure**:
  1. Verify algorithm strength (e.g., AES-256 for rest, TLS 1.2/1.3 with PFS for transit).
  2. Inspect automated key rotation schedules (annual or bi-annual).
  3. Confirm segregation of duties between cryptographic key custodians and database administrators.
- **Limitations & Common Weaknesses**: Hardcoded keys in source code repositories or unrotated static master keys invalidate cryptographic assurance.
- **Confidentiality Classification**: TIER-2 (Restricted Security).
- **Masking & Redaction Requirements**: Redact master key IDs, secret material, and cloud account credentials. Retain configuration parameters and cipher names.
- **Retention Considerations**: Maintain architecture specs for current and immediately preceding baseline.
- **Reviewer Guidance**: Verify whether cryptographic protections extend to off-site backups, snapshots, and disaster recovery replication targets.

---

### 17. `EVID-RET-02`: Statutory Retention Exceptions Register
- **Title**: Statutory Retention Exceptions Register & Legal Hold Policy
- **Description**: Documented register identifying specific statutory enactments requiring retention beyond operational purpose fulfillment, alongside formal legal hold procedures.
- **Linked Controls**: `TLI-DPDP-RET-02`
- **Purpose**: Legally justifies retention under Section 8(7) proviso and Section 17 exemptions against DPBI erasure orders.
- **Acceptable Evidence Examples**: Legal hold policy, cross-statutory retention schedule citing specific Indian enactments (e.g., Companies Act 2013 Sec 128, Income-tax Act 1961 Sec 44AA, PMLA 2002 Sec 12), and active legal hold case registers.
- **Status**: Mandatory for all organisations retaining data past purpose completion.
- **Acceptable Alternative Evidence**: General counsel legal opinion memorandum detailing sector-specific mandatory record retention statutes.
- **Freshness Guidance**: Annual legal review.
- **Verification Procedure**:
  1. Verify each listed retention period cites an explicit primary statutory section, not generic "business need".
  2. Confirm segregation and restricted access controls for data placed under legal hold.
  3. Verify release workflows triggering immediate erasure once statutory retention expires.
- **Limitations & Common Weaknesses**: Citing vague "operational convenience" or undefined "tax audit possibility" without specific statutory citations fails Section 8(7).
- **Confidentiality Classification**: TIER-2 (Internal Confidential).
- **Masking & Redaction Requirements**: Redact sensitive litigation matter names or privileged dispute details. Retain statutory citations and category mappings.
- **Retention Considerations**: Retain with legal department records.
- **Reviewer Guidance**: Cross-check exception register against actual database records flagged for preservation.

---

### 18. `EVID-SOP-01`: Standard Operating Procedure (SOP) Collection
- **Title**: Master Privacy Operating Procedures (SOP) Collection
- **Description**: Suite of approved departmental standard operating procedures governing day-to-day personal data handling across business units.
- **Linked Controls**: `TLI-DPDP-LEG-01`, `TLI-DPDP-NOT-02`
- **Purpose**: Demonstrates operationalization of compliance policies across business lines and employee workflows.
- **Acceptable Evidence Examples**: Approved SOPs for HR data intake, marketing lead acquisition, customer support data access, and vendor data sharing.
- **Status**: Conditional (Mandatory where decentralized processing occurs across departments).
- **Acceptable Alternative Evidence**: Centralized corporate policy portal with mandatory employee acknowledgment and reading completion tracking.
- **Freshness Guidance**: Within last 24 months.
- **Verification Procedure**:
  1. Confirm documented workflow steps, responsible roles, and escalation thresholds.
  2. Verify evidence of operational distribution and employee access.
- **Limitations & Common Weaknesses**: High-level abstract policies without step-by-step operational workflows do not qualify as SOPs.
- **Confidentiality Classification**: TIER-2 (Internal Confidential).
- **Masking & Redaction Requirements**: None beyond internal department codes if proprietary.
- **Retention Considerations**: Maintain current active revisions.
- **Reviewer Guidance**: Sample check employee adherence through interviews or audit records during on-site reviews.

---

### 19. `EVID-SOP-02`: Data Quality & Deduplication SOP
- **Title**: Personal Data Quality, Completeness & Deduplication SOP
- **Description**: Documented standard operating procedures and data validation rules ensuring personal data processed is accurate, complete, and consistent.
- **Linked Controls**: `TLI-DPDP-FID-02`
- **Purpose**: Proves compliance with Section 8(3) data quality mandate where data is used for decisions affecting Data Principals.
- **Acceptable Evidence Examples**: ETL data cleansing pipelines, master data management (MDM) deduplication rules, schema field validation scripts, and data correction workflows.
- **Status**: Mandatory for Data Fiduciaries making decisions or disclosures based on personal data.
- **Acceptable Alternative Evidence**: Data governance quality dashboard reports displaying automated data integrity metrics.
- **Freshness Guidance**: Within last 24 months.
- **Verification Procedure**:
  1. Inspect data entry validation rules (e.g., regex checks, checksum validation).
  2. Verify automated deduplication routines across disparate database repositories.
  3. Confirm that data corrections submitted by Data Principals synchronize across all operational stores.
- **Limitations & Common Weaknesses**: Absence of schema validation leading to truncated or corrupted customer profiles violates Section 8(3).
- **Confidentiality Classification**: TIER-2 (Internal Confidential).
- **Masking & Redaction Requirements**: Sanitize database field names containing internal secrets; use synthetic record samples.
- **Retention Considerations**: Active document.
- **Reviewer Guidance**: Check whether data shared with third-party processors is updated upon principal correction.

---

### 20. `EVID-SOP-03`: Breach Escalation & Triage Protocol
- **Title**: Cybersecurity Incident Breach Escalation & Triage Protocol
- **Description**: Operational SOP defining specific technical criteria, severity matrices, and rapid escalation protocols for potential personal data breaches.
- **Linked Controls**: `TLI-DPDP-BRC-02`
- **Purpose**: Ensures rapid identification and statutory escalation within tight reporting windows under Section 8(6) and Rule 9.
- **Acceptable Evidence Examples**: SOC (Security Operations Center) tier-1 to tier-3 escalation playbooks, severity classification matrix (P1–P4), and 24/7 on-call rotation schedules.
- **Status**: Mandatory for all organisations.
- **Acceptable Alternative Evidence**: PagerDuty/Opsgenie incident escalation policies configured for data privacy security triggers.
- **Freshness Guidance**: Annual review.
- **Verification Procedure**:
  1. Verify criteria distinguishing privacy incidents from routine infrastructure alerts.
  2. Check automated alerting mechanisms to the Data Protection Officer and Legal Counsel.
  3. Confirm timeline milestones designed to achieve regulatory intimations without undue delay.
- **Limitations & Common Weaknesses**: Escalation paths requiring multi-layer bureaucratic approvals before security notification commences violate statutory urgency.
- **Confidentiality Classification**: TIER-2 (Internal Confidential).
- **Masking & Redaction Requirements**: Mask personal contact numbers; retain operational role titles.
- **Retention Considerations**: Active operational procedure.
- **Reviewer Guidance**: Review tabletop exercise records to verify protocol execution fidelity.

---

### 21. `EVID-SOP-04`: DSAR Fulfillment & Identity Verification SOP
- **Title**: Data Principal Rights Verification & Fulfillment SOP
- **Description**: Step-by-step operating procedure for intake, identity verification, scope determination, data retrieval, redaction, and transmission of Data Principal rights responses.
- **Linked Controls**: `TLI-DPDP-DSR-01`, `TLI-DPDP-DSR-04`
- **Purpose**: Operationalizes rights fulfillment under Sections 11, 12, and 14 while preventing fraudulent disclosure to unauthorized parties.
- **Acceptable Evidence Examples**: Detailed DSAR handling manual, identity verification decision matrix (knowledge-based, OTP, existing session), response letter templates, and refusal justification procedures.
- **Status**: Mandatory for all Data Fiduciaries.
- **Acceptable Alternative Evidence**: Privacy management platform workflow diagram and configuration manual.
- **Freshness Guidance**: Annual review.
- **Verification Procedure**:
  1. Confirm that identity verification requires only proportionate information necessary to authenticate the applicant.
  2. Verify third-party redaction steps ensuring one applicant does not receive another person's personal data.
  3. Confirm documentation of grounds and communication workflows when a request is refused.
- **Limitations & Common Weaknesses**: Demanding notarized affidavits or physical document submission for online digital users creates an impermissible barrier.
- **Confidentiality Classification**: TIER-2 (Internal Confidential).
- **Masking & Redaction Requirements**: Blank templates and sanitized process flows only.
- **Retention Considerations**: Active operational procedure.
- **Reviewer Guidance**: Test whether the procedure addresses requests submitted on behalf of deceased or incapacitated principals by lawful nominees under Section 14.

---

### 22. `EVID-SOP-05`: Grievance Redressal Ticketing SLA & Escalation
- **Title**: Grievance Redressal Ticketing SLA, Protocol & Escalation Standard
- **Description**: Standard operating procedure governing receipt, investigation, resolution, and escalation of complaints submitted under Section 13.
- **Linked Controls**: `TLI-DPDP-DSR-03`
- **Purpose**: Proves operational compliance with Section 8(8) and Section 13 grievance redressal mandates within prescribed timelines.
- **Acceptable Evidence Examples**: Customer grievance handling policy, ticketing workflow with automated SLA timers, grievance escalation hierarchy, and DPBI referral advisory templates.
- **Status**: Mandatory for all Data Fiduciaries.
- **Acceptable Alternative Evidence**: CRM customer support ticketing system SLA configuration and reporting metrics.
- **Freshness Guidance**: Annual review.
- **Verification Procedure**:
  1. Verify maximum turnaround time aligns with statutory requirements (prescribed period under Rule 14).
  2. Confirm inclusion of mandatory statutory advisory informing complainant of their right to escalate unresolved grievances to the DPBI.
  3. Verify independent review capability for contested complaints.
- **Limitations & Common Weaknesses**: Routing privacy complaints to general sales or unmonitored general email queues without tracking or statutory advisory fails Section 13.
- **Confidentiality Classification**: TIER-2 (Internal Confidential).
- **Masking & Redaction Requirements**: Template workflows and anonymized aggregate SLA metrics only.
- **Retention Considerations**: Retain dispute logs for 3 years following resolution.
- **Reviewer Guidance**: Scrutinize whether resolved complaint notifications clearly inform the Data Principal of their right to appeal to the Board.

---

### 23. `EVID-CHD-02`: Child Tracking Suppression Technical Proof
- **Title**: Children's Tracking, Profiling & Targeted Advertising Technical Suppression Proof
- **Description**: Technical architectural specifications, code inspection records, and ad-tech configuration proofs demonstrating suppression of tracking, behavioural profiling, and targeted ads for minor accounts.
- **Linked Controls**: `TLI-DPDP-CHD-02`
- **Purpose**: Substantiates strict compliance with Section 9(3) prohibition against tracking, behavioural monitoring, or targeted advertising directed at children.
- **Acceptable Evidence Examples**: Ad-server configuration files disabling retargeting pixel injection for accounts flagged as minors, SDK initialization logs suppressing analytics tracking, database feature flags disabling recommendation algorithms for minor user segments.
- **Status**: Conditional (Mandatory if platform serves minors).
- **Acceptable Alternative Evidence**: Independent ad-tech audit report certifying zero behavioural tracking on minor account tiers.
- **Freshness Guidance**: Current live production deployment.
- **Verification Procedure**:
  1. Inspect frontend source code and network requests for minor accounts to verify absence of third-party tracking pixels (e.g., Meta Pixel, Google AdSense, adjust).
  2. Verify ad server bidding request payloads confirm omission of behavioural segments.
  3. Inspect recommendation engine algorithms to ensure purely contextual, non-profiling logic.
- **Limitations & Common Weaknesses**: Disabling ads on mobile apps while continuing behavioural tracking on web platforms violates Section 9(3).
- **Confidentiality Classification**: TIER-2 (Restricted Security).
- **Masking & Redaction Requirements**: Sanitize API keys and internal microservice endpoint URLs.
- **Retention Considerations**: Architecture baselines maintained per release.
- **Reviewer Guidance**: Conduct dynamic traffic inspection using developer tools on synthetic minor user profiles.

---

### 24. `EVID-SDF-02`: DPIA Methodology & Completed Assessments
- **Title**: Data Protection Impact Assessment (DPIA) Methodology & Executed Reports
- **Description**: Formal DPIA framework methodology, assessment questionnaires, risk scoring rubrics, and copies of completed DPIA reports for high-risk processing activities.
- **Linked Controls**: `TLI-DPDP-SDF-02`
- **Purpose**: Proves statutory execution of periodic Data Protection Impact Assessments by Significant Data Fiduciaries under Section 10(2)(c) and Rule 12.
- **Acceptable Evidence Examples**: Approved DPIA Policy and Procedure, risk scoring matrix, completed DPIA reports for major automated processing, AI deployment, or biometrics initiatives, and documented risk mitigation sign-offs.
- **Status**: Conditional (Mandatory for Significant Data Fiduciaries).
- **Acceptable Alternative Evidence**: ISO/IEC 27701 privacy risk assessments paired with executive DPIA summary.
- **Freshness Guidance**: Within last 12 months for active high-risk systems.
- **Verification Procedure**:
  1. Confirm DPIA assesses necessity, proportionality, data principal harm, and mitigation measures.
  2. Verify involvement and formal sign-off of the Data Protection Officer.
  3. Inspect implementation tracking of mitigation actions identified during the DPIA.
- **Limitations & Common Weaknesses**: High-level checklists completed in minutes without technical architecture analysis or risk evaluation fail statutory DPIA requirements.
- **Confidentiality Classification**: TIER-2 (Internal Confidential).
- **Masking & Redaction Requirements**: Redact trade secrets or unannounced proprietary product features; retain privacy impact analysis and risk ratings.
- **Retention Considerations**: Retain for the lifespan of the processing activity plus 5 years.
- **Reviewer Guidance**: Evaluate whether DPIAs are initiated during design phases (Privacy by Design) or only retrospectively.

---

### 25. `EVID-XBD-01`: Cross-Border Data Transfer Inventory
- **Title**: Cross-Border Personal Data Transfer Inventory & Destination Register
- **Description**: Comprehensive technical register detailing all outbound transfers of personal data outside India, including destination countries, transfer mechanisms, cloud hosting regions, and third-party recipients.
- **Linked Controls**: `TLI-DPDP-XBD-01`
- **Purpose**: Demonstrates jurisdictional visibility and compliance with Section 16 cross-border transfer rules and Central Government blacklists.
- **Acceptable Evidence Examples**: Cross-border data mapping table, cloud region configuration reports (e.g., AWS global infrastructure inventory), SaaS vendor data residency matrices, and network routing configurations.
- **Status**: Conditional (Mandatory for organisations transferring personal data outside India).
- **Acceptable Alternative Evidence**: Enterprise data flow diagrams explicitly labelling geographic boundaries and transit routes.
- **Freshness Guidance**: Annual review or upon infrastructure migration.
- **Verification Procedure**:
  1. Match destination countries against Central Government notified negative list / restricted jurisdictions.
  2. Verify that transfers comply with applicable bilateral or sectoral transfer restrictions.
  3. Confirm that contractually bound foreign sub-processors adhere to DPDPA equivalent safeguards.
- **Limitations & Common Weaknesses**: Assuming data stays in India without verifying actual backup, CDN cache, or analytics processing locations fails this control.
- **Confidentiality Classification**: TIER-2 (Internal Confidential).
- **Masking & Redaction Requirements**: Sanitize internal server IPs and subnets; preserve country names and cloud regions.
- **Retention Considerations**: Active document.
- **Reviewer Guidance**: Check where database backups, analytics logs, and customer support portal data reside.

---

### 26. `EVID-XBD-02`: Sectoral Data Localization System Audit Report
- **Title**: Sectoral Data Localization & Storage Regulatory Audit Report
- **Description**: Formal compliance audit report or regulatory filing attesting to strict domestic data localization mandated by sector-specific regulators (e.g., RBI payment system data directive, IRDAI insurance guidelines).
- **Linked Controls**: `TLI-DPDP-XBD-02`
- **Purpose**: Demonstrates adherence to Section 16(2) preservation of higher sectoral data localization standards.
- **Acceptable Evidence Examples**: CERT-In empaneled System Audit Report (SAR) on RBI Storage of Payment System Data, IRDAI data storage compliance certificate, or TRAI telecom data storage attestation.
- **Status**: Conditional (Mandatory for regulated financial, insurance, or telecom entities).
- **Acceptable Alternative Evidence**: Internal audit report signed by Chief Information Security Officer (CISO) and statutory auditors verifying domestic storage.
- **Freshness Guidance**: Within last 12 months / annual statutory filing.
- **Verification Procedure**:
  1. Confirm end-to-end data processing and storage resides strictly on servers physically located in India.
  2. Verify that cross-border processing for fraud detection or settlement adheres strictly to sectoral turnaround and deletion windows.
  3. Inspect auditor opinion and attestation signature blocks.
- **Limitations & Common Weaknesses**: Claiming DPDPA Section 16 allows unrestricted transfers while ignoring strict RBI/IRDAI domestic storage mandates is legally invalid.
- **Confidentiality Classification**: TIER-2 (Regulatory Audit).
- **Masking & Redaction Requirements**: Redact commercial audit fee figures. Retain audit scope, findings, and auditor attestation.
- **Retention Considerations**: Retain for statutory regulatory retention period (minimum 5 years).
- **Reviewer Guidance**: Cross-check with sectoral regulatory requirements applicable to the client's industry.

---

### 27. `EVID-RSK-01`: Enterprise Statutory Penalty Deficit Exposure Risk
- **Title**: Enterprise Statutory Penalty Deficit Exposure Risk Assessment
- **Description**: Executive-level risk exposure register quantifying organizational financial liability across the five Schedule penalty brackets based on identified compliance gaps.
- **Linked Controls**: `TLI-DPDP-PEN-01`
- **Purpose**: Establishes executive visibility over statutory monetary penalty exposure under Section 33 and the DPDPA Schedule (up to ₹250 Crore per breach).
- **Acceptable Evidence Examples**: Enterprise risk register privacy addendum, Board Audit Committee compliance presentation, executive gap analysis exposure dashboard, or TLI Gap Analysis Report executive briefing.
- **Status**: Mandatory for all organisations.
- **Acceptable Alternative Evidence**: Chief Risk Officer (CRO) quarterly regulatory liability assessment memo.
- **Freshness Guidance**: Bi-annual executive review.
- **Verification Procedure**:
  1. Verify quantification of maximum exposure across statutory penalty brackets (₹250 Cr, ₹200 Cr, ₹150 Cr, ₹50 Cr, ₹10,000).
  2. Confirm linkage between unmitigated operational deficits and statutory exposure tiers.
  3. Verify reporting to Board Audit Committee or Chief Executive Officer.
- **Limitations & Common Weaknesses**: Highlighting operational risks without quantifying statutory financial liability fails to drive board-level remediation.
- **Confidentiality Classification**: TIER-2 (Corporate Risk).
- **Masking & Redaction Requirements**: Redact unapproved future budget allocations. Retain risk scores and exposure figures.
- **Retention Considerations**: Retain for 3 years.
- **Reviewer Guidance**: Cross-reference the exposure model with the output of the TLI Provisional Scoring and Risk Engine.

---

## 4. Evidence Handling, Masking Standards & Review Protocols

### 4.1 Strict Masking & Safe Upload Protocols
To satisfy TLI evidentiary integrity while preventing privacy violations, client organisations must follow strict pre-upload hygiene:
1. **Zero Raw Sensitive Personal Identifiers**: Live government identity numbers (Aadhaar, PAN, Passport, Driving License) must **never** be uploaded. Where operational UI proof is required, synthetic test identifiers (`XXXX-XXXX-1234`, `TEST-PAN-001`) must be used.
2. **Zero Production Credentials**: Database connection strings, API tokens, JWT secrets, TLS private keys, and passwords must be purged prior to submission.
3. **Anonymized Operational Samples**: Where real operational tickets (DSARs, breach notifications) are submitted, Data Principal names, email addresses, and phone numbers must be redacted using permanent masking tools (blackout redaction, not transparent overlay).

### 4.2 TLI Reviewer Evidence Sufficiency Checklist
For every evidence submission, the TLI consultant must verify:
- [ ] **Authenticity**: Originates from an authorized corporate system, signed executive, or verifiable live environment.
- [ ] **Current Relevance**: Satisfies the prescribed freshness guidance and reflects current operations.
- [ ] **Direct Nexus**: Directly addresses the specific compliance question and statutory requirement of the linked control.
- [ ] **Completeness**: Contains necessary operational depth, not just marketing statements or draft policies.

