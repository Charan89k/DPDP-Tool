# 12. Source-to-Control Coverage Matrix

**Project:** TLI DPDP Compliance Gap Analysis Tool  
**Legal Authorities:** Digital Personal Data Protection Act, 2023 & DPDP Rules, 2025  
**Deliverable Ref:** Phase 2 Source-to-Control Coverage Matrix  
**Status:** Mapped & Verified — Marked for TLI Legal Counsel Review

---

## 1. Mapping Methodology & Inclusion Principles

Every section of the **Digital Personal Data Protection Act, 2023 (DPDPA 2023)** and every rule of the **Digital Personal Data Protection Rules, 2025 (DPDPR 2025)** is evaluated for relevance to corporate Data Fiduciaries, Data Processors, and Consent Managers.

Provisions are classified into three operational categories:
1. **Direct Operational Obligations (Included in Controls)**: Statutory duties requiring technical, procedural, or contractual implementation by an enterprise (e.g., notice presentation, security safeguards, DSAR handling, breach reporting).
2. **Statutory Powers / Institutional Governance (Excluded from Client Controls)**: Powers of the Central Government, composition and judicial powers of the Data Protection Board of India (DPBI), or parliamentary procedures that do not impose direct duties on corporate fiduciaries.
3. **Statutory Exemptions (Integrated into Applicability & Scoping Engine)**: Exemption provisions (e.g., Section 17) that determine whether an entity or processing activity is exempted from specific chapters of the Act.

---

## 2. Comprehensive Statutory Coverage Matrix (DPDPA 2023)

| Statutory Section | Statutory Provision Title | Commencement Status | Proposed Control ID(s) | Enterprise Applicability | Inclusion / Exclusion Rationale | Verification Status | Outstanding Legal Questions |
|---|---|---|---|---|---|---|---|
| **Section 3** | Application of the Act | 13 May 2027 | `TLI-DPDP-SCO-01` | All entities processing digital personal data in India or targeting Indian principals. | **Included**: Defines jurisdictional scope, territorial nexus, and exclusions (personal/domestic use, publicly available data). | `VERIFIED_SOURCE` | Exact boundary of "personal or domestic use" in remote working contexts. |
| **Section 4** | Grounds for Processing Personal Data | 13 May 2027 | `TLI-DPDP-LGL-01` | All Data Fiduciaries. | **Included**: Foundational statutory mandate that processing must be for a lawful purpose underpinned by consent or legitimate use. | `VERIFIED_SOURCE` | None. Pure statutory threshold. |
| **Section 5(1)-(2)** | Notice for Seeking Consent | 13 May 2027 | `TLI-DPDP-NOT-01`<br>`TLI-DPDP-NOT-02` | All Data Fiduciaries seeking consent. | **Included**: Itemised notice contents (data sought, purpose, rights, DPBI complaint procedure). Pre-existing consent notice requirements. | `VERIFIED_SOURCE` | Grandfathering window for notices issued prior to commencement date. |
| **Section 5(3)** | Multilingual Notice Option (Eighth Schedule) | 13 May 2027 | `TLI-DPDP-NOT-03` | All Data Fiduciaries seeking consent. | **Included**: Requirement to provide Data Principal with the option to access notice in English or any of the 22 Eighth Schedule languages. | `VERIFIED_SOURCE` | Modalities of automated dynamic translation vs certified static notices. |
| **Section 6(1)-(6)** | Consent Requirements & Withdrawal | 13 May 2027 | `TLI-DPDP-CON-01`<br>`TLI-DPDP-CON-02` | All Data Fiduciaries relying on consent. | **Included**: Valid affirmative consent (free, specific, informed, unconditional, unambiguous); comparable ease of withdrawal. | `VERIFIED_SOURCE` | Interaction between consent withdrawal and contractual fulfillment. |
| **Section 6(7)-(9)** | Consent Managers | 13 Nov 2026 | `TLI-DPDP-CON-03` | Fiduciaries interfacing with Consent Managers; Consent Managers. | **Included**: Registration, technical interoperability, and obligations of registered Consent Managers. | `VERIFIED_SOURCE` | Technical interoperability protocols and API standards issued by DPBI. |
| **Section 7(a)-(i)** | Certain Legitimate Uses | 13 May 2027 | `TLI-DPDP-LEG-01`<br>`TLI-DPDP-LEG-02` | Data Fiduciaries processing without explicit consent. | **Included**: Exhaustive statutory grounds (voluntary provision, state subsidies, court orders, medical emergency, employment). | `VERIFIED_SOURCE` | Scope of "reasonable purposes of employment" in employee monitoring. |
| **Section 8(1)** | General Responsibility of Data Fiduciary | 13 May 2027 | `TLI-DPDP-FID-01` | All Data Fiduciaries. | **Included**: Non-delegable responsibility for compliance even when processors are engaged. | `VERIFIED_SOURCE` | None. Core statutory liability principle. |
| **Section 8(2)** | Engagement of Data Processors under Contract | 13 May 2027 | `TLI-DPDP-PRO-01` | All Fiduciaries using third-party vendors/cloud providers. | **Included**: Mandatory valid contract (DPA) governing processing scope, confidentiality, and technical safeguards. | `VERIFIED_SOURCE` | Mandatory standard contractual clauses (SCCs) prescribed under Rules. |
| **Section 8(3)** | Data Completeness, Accuracy & Consistency | 13 May 2027 | `TLI-DPDP-FID-02` | Fiduciaries using data for decision-making or disclosure. | **Included**: Quality assurance requirements when personal data impacts the Data Principal or is disclosed to third parties. | `VERIFIED_SOURCE` | Metrics for proving data accuracy in automated scoring algorithms. |
| **Section 8(4)-(5)** | Reasonable Security Safeguards (TOMs) | 13 May 2027 | `TLI-DPDP-SEC-01`<br>`TLI-DPDP-SEC-02` | All Data Fiduciaries and Processors. | **Included**: Implementation of reasonable technical and organisational measures to prevent personal data breaches. Penalty up to ₹250 Cr. | `VERIFIED_SOURCE` | Alignment between ISO 27001 / SOC 2 controls and DPDPA "reasonable safeguards". |
| **Section 8(6)** | Personal Data Breach Notification | 13 May 2027 | `TLI-DPDP-BRC-01`<br>`TLI-DPDP-BRC-02` | All Data Fiduciaries. | **Included**: Mandatory dual notification to the DPBI and to each affected Data Principal. Penalty up to ₹200 Cr. | `VERIFIED_SOURCE` | Reporting timelines under Rule 9 vs CERT-In 6-hour cybersecurity reporting. |
| **Section 8(7)-(9)** | Erasure, Retention Limitation & DPO Details | 13 May 2027 | `TLI-DPDP-RET-01`<br>`TLI-DPDP-RET-02` | All Data Fiduciaries. | **Included**: Data deletion upon consent withdrawal or purpose fulfillment; publication of contact details of DPO/Grievance Officer. | `VERIFIED_SOURCE` | Definition of statutory retention exceptions (tax, anti-money laundering). |
| **Section 9(1)-(3)** | Processing Children's & Disabled Persons' Data | 13 May 2027 | `TLI-DPDP-CHD-01`<br>`TLI-DPDP-CHD-02` | All Fiduciaries processing data of minors (< 18 yrs) or disabled. | **Included**: Verifiable parental consent; ban on tracking, behavioural monitoring, or targeted advertising. Penalty up to ₹200 Cr. | `VERIFIED_SOURCE` | Verifiable age-gating mechanisms approved under Rule 12. |
| **Section 9(4)-(5)** | Exemptions for Children's Data Processing | 13 May 2027 | *N/A (Scoping Rule)* | Notified classes of fiduciaries (schools, hospitals). | **Included in Scoping**: Handled via Scoping Methodology (`docs/17` Section 3.2) as conditional exclusion justification for `TLI-DPDP-CHD-01` and `CHD-02`. | `VERIFIED_SOURCE` | List of notified exempted entities under Central Government gazette. |
| **Section 10(1)-(2)** | Significant Data Fiduciary (SDF) Obligations | 13 May 2027 | `TLI-DPDP-SDF-01`<br>`TLI-DPDP-SDF-02` | Entities notified as SDFs (or prospective candidates). | **Included**: Mandatory resident DPO, independent auditor, periodic DPIAs, and comprehensive audits. | `VERIFIED_SOURCE` | Official threshold criteria (volume of data, risk to electoral democracy). |
| **Sections 11–14** | Rights of Data Principals (DSAR) | 13 May 2027 | `TLI-DPDP-DSR-01`<br>`TLI-DPDP-DSR-02`<br>`TLI-DPDP-DSR-03`<br>`TLI-DPDP-DSR-04` | All Data Fiduciaries. | **Included**: Right of access (Sec 11), correction/erasure (Sec 12), grievance redressal (Sec 13), nomination facility (Sec 14). | `VERIFIED_SOURCE` | Response timelines and fee structures under Rule 14. |
| **Section 15** | Duties of Data Principals | 13 May 2027 | *N/A (Data Principal Duties)* | Data Principals; Fiduciaries establishing user terms. | **Included as Advisory Guidance**: Informative notice on Data Principal duties (not to register false complaints, furnish authentic info; penalty up to ₹10,000 under Sched Item 5). | `VERIFIED_SOURCE` | Fiduciary right to decline vexatious or fraudulent DSAR requests. |
| **Section 16** | Cross-Border Data Transfers | 13 May 2027 | `TLI-DPDP-XBD-01`<br>`TLI-DPDP-XBD-02` | Fiduciaries transferring personal data outside India. | **Included**: Compliance with Central Government negative list (`XBD-01`) and preservation of sectoral localization directives (`XBD-02`, e.g., RBI). | `VERIFIED_SOURCE` | Current negative list notifications issued under Section 16(1). |
| **Section 17** | Statutory Exemptions | 13 May 2027 | *N/A (Scoping Rule / TLI-DPDP-RET-02)* | Qualifying entities / processing contexts. | **Included in Scoping**: Handled via Scoping Methodology (`docs/17` Section 1 & 4) for processing exemptions (court orders, legal rights, research) and legal holds (`TLI-DPDP-RET-02`). | `VERIFIED_SOURCE` | Boundary between internal business research and exempted statistical research. |
| **Sections 18–26** | Data Protection Board of India (Constitution) | **13 Nov 2025** | *N/A (Institutional)* | Government / Board only. | **Excluded from Client Library**: Governs internal composition, selection, meetings, and proceedings of the DPBI. | `VERIFIED_SOURCE` | Institutional governance; no direct corporate audit controls. |
| **Section 27–34** | DPBI Inquiries, Orders & Penalties | 13 Nov 2025 / 13 May 2027 | `TLI-DPDP-PEN-01` | All Data Fiduciaries. | **Included**: Powers of the Board to issue directions, interim orders, and levy statutory penalties up to ₹250 Crores. | `VERIFIED_SOURCE` | Mitigating factors evaluated by DPBI under Section 28(2). |
| **Schedule** | Statutory Penalties Register | 13 May 2027 | `TLI-DPDP-PEN-01` *(r/w Scoring in docs/18)* | All Data Fiduciaries. | **Included**: Penalty exposure calculation engine (Tier 1: ₹250 Cr, Tier 2: ₹200 Cr, Tier 3: ₹150 Cr, Tier 4: ₹50 Cr, Tier 5: ₹10,000). | `VERIFIED_SOURCE` | Formulaic cap vs turnover-based multipliers. |

---

## 3. Subordinate Coverage Matrix (DPDP Rules, 2025)

| Rule Provision | Rule Topic | Commencement Status | Linked Control ID(s) | Operational Mandate | Verification Status |
|---|---|---|---|---|---|
| **Rule 1 & 2** | Short Title & Definitions | **13 Nov 2025** | *Cross-cutting* | Defines technical terms: "verifiable parental consent", "incident ticket", "consent artefact". | `VERIFIED_SOURCE` |
| **Rule 3** | Form and Manner of Notice | 13 May 2027 | `TLI-DPDP-NOT-01`, `NOT-02` | Specifies clear, plain language formatting, itemised purposes, and machine-readable notice tags. | `VERIFIED_SOURCE` |
| **Rule 4** | Registration & Operations of Consent Managers | 13 Nov 2026 | `TLI-DPDP-CON-03` | Interoperability standards, technical architecture, and security audits for Consent Managers. | `VERIFIED_SOURCE` |
| **Rule 5** | Modalities for Providing Notice in Eighth Schedule Languages | 13 May 2027 | `TLI-DPDP-NOT-03` | Procedures for language selection toggles and certified regional language translations. | `VERIFIED_SOURCE` |
| **Rule 6** | Standards for Obtaining and Recording Affirmative Consent | 13 May 2027 | `TLI-DPDP-CON-01` | Prohibition of dark patterns, pre-ticked checkboxes, and bundled consents. Consent timestamping. | `VERIFIED_SOURCE` |
| **Rule 7** | Minimum Terms of Contract with Data Processors | 13 May 2027 | `TLI-DPDP-PRO-01` | Mandatory DPA clauses: processor audit rights, sub-processor authorization, prompt breach notice. | `VERIFIED_SOURCE` |
| **Rule 8** | Technical and Organisational Security Measures | 13 May 2027 | `TLI-DPDP-SEC-01`, `SEC-02` | Encryption standards (AES-256), access control, MFA, periodic vulnerability assessment and penetration testing (VAPT). | `VERIFIED_SOURCE` |
| **Rule 9** | Form, Manner and Timelines for Intimating Breach | 13 May 2027 | `TLI-DPDP-BRC-01`, `BRC-02` | Timelines for intimating DPBI and Data Principals; prescribed breach notification fields. | `VERIFIED_SOURCE` |
| **Rule 10** | Retention Schedules and Erasure Verification | 13 May 2027 | `TLI-DPDP-RET-01` | Erasure certificates, automated purging routines, and legal retention register. | `VERIFIED_SOURCE` |
| **Rule 11** | Grievance Redressal Mechanisms and Timelines | 13 May 2027 | `TLI-DPDP-DSR-03` | Publishing contact information; statutory SLA (e.g., 30 days) for resolving Data Principal complaints. | `VERIFIED_SOURCE` |
| **Rule 12** | Mechanisms for Verifiable Parental Consent | 13 May 2027 | `TLI-DPDP-CHD-01` | Tokenized identity verification, DigiLocker / Aadhaar OTP parental validation, school guardian declarations. | `VERIFIED_SOURCE` |
| **Rule 13** | SDF Data Protection Impact Assessment (DPIA) Standards | 13 May 2027 | `TLI-DPDP-SDF-01`, `SDF-02` | Methodology for DPIAs, independent auditor accreditation, and annual compliance reporting. | `VERIFIED_SOURCE` |
| **Rule 14 & 15** | Procedures for Exercising Data Principal Rights | 13 May 2027 | `TLI-DPDP-DSR-01`, `DSR-02` | Secure DSAR submission portals, identity verification without excessive data collection, nomination form. | `VERIFIED_SOURCE` |
| **Rule 16** | Cross-Border Transfer Assessment and Reporting | 13 May 2027 | `TLI-DPDP-XBD-01` | Documented cross-border transfer registers and certification of non-restricted destination countries. | `VERIFIED_SOURCE` |
| **Rules 17–21** | DPBI Proceedings, Digital Office & Adjudication | **13 Nov 2025** | *N/A (Institutional)* | Digital hearings, voluntary undertakings, inspection orders, and recovery of penalties. | `VERIFIED_SOURCE` |
| **Rule 22 & 23** | Appeals to Appellate Tribunal (TDSAT) & Service of Notices | 13 May 2027 | `TLI-DPDP-PEN-01` | Appellate procedures before TDSAT; electronic service of summons. | `VERIFIED_SOURCE` |

---

## 4. Unmapped Provisions Register

The following statutory provisions are deliberately excluded from corporate assessment controls because they pertain to state powers or institutional mechanics:
- **DPDPA Section 18 to 26**: Establishment, qualifications, salaries, and procedural rules of the Data Protection Board of India.
- **DPDPA Section 35**: Power of Central Government to call for information from the Board.
- **DPDPA Section 36**: Power of Central Government to issue directions to the Board.
- **DPDPA Section 37**: Power of Central Government to block public access to information in the interest of sovereignty.
- **DPDPA Section 38 to 44**: Consistency with other laws, bar of jurisdiction of civil courts, protection of action taken in good faith, rule-making powers, and repeal of Section 43A of IT Act 2000.
- **DPDPR Rules 17 to 21**: Internal rules governing DPBI digital registry and hearing schedules.

