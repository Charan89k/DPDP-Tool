# 19. Legal-Review and Interpretation Register

**Project:** TLI DPDP Compliance Gap Analysis Tool  
**Framework Version:** `DPDPA-2023-V1.0`  
**Deliverable Ref:** Phase 2 Legal-Review & Interpretation Register  
**Status:** Canonical Register for TLI Legal Counsel Sign-off (Decision DEC-08)

---

## 1. Objectives & Governance

In compliance with project directives, **engineering teams must never invent, infer, or silently hard-code statutory obligations**. Where statutory text or subordinate rules leave operational ambiguities, this register records the specific legal question, documents the provisional assumption adopted in the draft control library, and defines the exact review required from Truth Labs International's authorized legal counsel.

All items in this register carry the status **`LEGAL_VERIFICATION_REQUIRED`**.

---

## 2. Itemized Legal Interpretation Register

| Item ID | Statutory / Rule Reference | Legal Ambiguity & Practical Question | Provisional Interpretation in Library v1.0 | Specific Question for TLI Legal Counsel | Blocker Status |
|---|---|---|---|---|:---:|
| **LEG-INT-01** | **Section 5(3) r/w Rule 5**<br>Multilingual Notice Option | Does Section 5(3) require an organisation to pre-translate and publish notices in all 22 Eighth Schedule languages upfront, or does it require an accessible mechanism (e.g. language selector or on-demand translation) to provide the notice upon request? | Control `TLI-DPDP-NOT-03` requires an operational multilingual option mechanism (UI toggle / certified translation repository) rather than demanding static translation across all 22 languages for purely internal B2B workflows. | *Confirm whether maintaining English + major regional operating languages with a verified mechanism to provide any of the 22 languages on request satisfies Section 5(3).* | **Phase 2 Blocker** |
| **LEG-INT-02** | **Section 6(7)-(9) r/w Rule 4**<br>Consent Manager Interoperability | If a registered Consent Manager fails or transmits inaccurate consent instructions, does the Data Fiduciary remain strictly liable before the DPBI for processing in reliance on the Consent Manager's dispatch? | Control `TLI-DPDP-CON-03` treats Consent Manager integration as a technical interoperability duty commencing 13 Nov 2026, requiring immutable logging of received consent artifacts. | *Clarify legal apportionment of statutory liability between Data Fiduciary and registered Consent Manager under Section 6(8) and 6(9).* | Non-blocking |
| **LEG-INT-03** | **Section 7(g)**<br>Employment Legitimate Uses | What are the lawful outer boundaries of "purposes of employment or safeguarding employer from loss"? Can keystroke logging, active screen recording, or facial recognition entry gates be justified under Section 7(g) without explicit consent? | Control `TLI-DPDP-LEG-02` restricts Section 7(g) to conventional HR operations, benefits, and proportionate loss prevention, advising that invasive surveillance requires explicit consent and proportionality review. | *Provide authoritative legal guidance on workplace surveillance and biometric attendance systems under Section 7(g).* | Non-blocking |
| **LEG-INT-04** | **Section 8(2) r/w Rule 7**<br>Mandatory Processor Contract Clauses | Does Rule 7 prescribe mandatory standard contractual clauses (SCCs) that must be adopted verbatim, or does it prescribe minimum mandatory topics that can be incorporated into customized vendor agreements? | Control `TLI-DPDP-PRO-01` evaluates contracts against the minimum substantive requirements of Rule 7 (confidentiality, security, breach notice, audit rights). | *Confirm whether customized master services agreements with privacy addenda satisfy Rule 7 or if MeitY model contractual clauses are mandatory.* | Non-blocking |
| **LEG-INT-05** | **Section 8(6) r/w Rule 9 & CERT-In**<br>Breach Notification Interplay | How does the DPDPA Section 8(6) breach notification timeline under Rule 9 interact with the CERT-In 6-hour cybersecurity reporting mandate under the Information Technology Act? | Control `TLI-DPDP-BRC-01` and `BRC-02` evaluate dual notification readiness, tracking CERT-In 6-hour requirements alongside DPBI notification procedures. | *Confirm official legal harmonisation between CERT-In cybersecurity directions and DPDPA personal data breach intimations.* | Non-blocking |
| **LEG-INT-06** | **Section 9(1)-(3) r/w Rule 12**<br>Age Verification & Parental Consent | Does the statutory definition of a "child" (individual who has not completed 18 years) require active age verification on all digital platforms, or only platforms whose content is accessible to or targeted at children? | Control `TLI-DPDP-CHD-01` mandates neutral age-gating and verified parental consent for consumer platforms accessible to minors, allowing exclusion only for verified B2B systems. | *Confirm acceptable methods of "verifiable parental consent" under Rule 12 (DigiLocker tokenization, Aadhaar OTP of parent, or third-party age assurance).* | **Phase 2 Blocker** |
| **LEG-INT-07** | **Section 9(4)-(5)**<br>Children's Data Exemption Scope | Which categories of Data Fiduciaries are exempted by the Central Government from Section 9(1) or 9(3) restrictions under executive notifications? | Evaluated as a conditional scoping exclusion rule under Scoping Methodology (`docs/17` Section 3.2) applying to `TLI-DPDP-CHD-01` and `TLI-DPDP-CHD-02`, referencing official Central Government exemption gazette orders. | *Confirm whether educational institutions and healthcare providers have been formally gazetted under Section 9(4) or 9(5).* | Non-blocking |
| **LEG-INT-08** | **Section 10(1)**<br>Significant Data Fiduciary (SDF) Criteria | In the absence of an individual gazette notification scheduling a specific client entity, can an organisation be assessed against Section 10 obligations as a "prospective candidate"? | Control `TLI-DPDP-SDF-01` marks Section 10 as conditional: mandatory only for officially notified SDFs, and treated as an optional advisory module for SDF candidates. | *Confirm legal criteria for identifying SDF candidacy prior to individual Central Government notification.* | Non-blocking |
| **LEG-INT-09** | **Section 16(1)-(2) & Sectoral Rules**<br>Cross-Border Negative List vs RBI | Under Section 16(1), transfer of personal data is permitted to all countries except those blacklisted by the Central Government. How does this negative-list regime interact with RBI directives requiring payment system data to reside exclusively in India? | Control `TLI-DPDP-XBD-01` evaluates the general Section 16(1) negative list, while `TLI-DPDP-XBD-02` evaluates strict domestic storage under Section 16(2) preservation of sectoral laws. | *Confirm that financial fiduciaries must comply with 100% domestic localization under RBI directives notwithstanding Section 16(1) cross-border permissions.* | Non-blocking |
| **LEG-INT-10** | **Removal of Difficulties Order 2026**<br>Technical Scope of S.O. 4120(E) | What is the precise statutory effect of the Digital Personal Data Protection (Removal of Difficulties) Order, 2026 published on 7 October 2026 regarding Sections 9 and 10? | Reflected in controls `TLI-DPDP-CHD-01` and `TLI-DPDP-SDF-01` as statutory editorial and technical alignment. | *Provide formal legal verification of S.O. 4120(E) text and its application to verifiable parental consent standards.* | Non-blocking |

---

## 3. Formal Sign-Off Workflow for TLI Legal Counsel

To transition any item in this register from `LEGAL_VERIFICATION_REQUIRED` to `APPROVED_BY_TLI_LEGAL`, the following review steps must be completed:

1. **Counsel Assignment**: TLI General Counsel assigns the specific item to a designated privacy legal counsel.
2. **Statutory Cross-Examination**: Legal counsel cross-examines the proposed control against the official Gazette text, MeitY notifications, and high court precedents.
3. **Written Advisory Memorandum**: Legal counsel submits a written opinion endorsing the control text, recommending adjustments, or adding specific qualification notes.
4. **Digital Cryptographic Stamp**: Upon approval, the control record's `legal_review_status` is updated to `APPROVED_BY_TLI_LEGAL` with counsel user ID and timestamp recorded in the immutable audit log.

