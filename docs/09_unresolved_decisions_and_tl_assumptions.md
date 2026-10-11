# 09. Stakeholder Decision Register and Architectural Assumptions — Refined

## 1. Classification of Requirements, Recommendations & Assumptions

To maintain absolute transparency and prevent unauthorized engineering assumptions, all project specifications are categorized into:
1. **Confirmed Requirements**: Directly mandated in project specifications.
2. **Architectural Recommendations**: Proposed by the engineering architecture team based on security and operational best practices.
3. **Working Assumptions**: Baseline assumptions adopted during Phase 1 design.
4. **Stakeholder Decisions Requiring TLI Approval**: Critical business, legal, hosting, and governance choices requiring formal sign-off.

---

## 2. Requirements & Assumptions Baseline

| Category | Confirmed Requirement | Architectural Recommendation | Working Assumption |
|---|---|---|---|
| **Legal Basis** | Controls must strictly map to DPDPA 2023 without inventing requirements. Scores must never declare statutory compliance. | Versioned framework engine (`DPDPA-2023-V1.0`) with extensible schema for DPDP Rules 2025. | TLI Legal Counsel will provide authoritative review of the seeded control library prior to client use. |
| **Tenant Isolation** | Strict isolation between client organisations and least-privilege RBAC. | PostgreSQL Row-Level Security (RLS) with transaction-local context (`set_config(..., true)`) and `FORCE ROW LEVEL SECURITY`. | A shared database with RLS provides sufficient cryptographic and logical isolation for the multi-tenant SaaS tier. |
| **Evidence Privacy** | Private by default, zero public access, no client data used for AI training. | S3 SSE-KMS, 10-min PUT / 15-min GET presigned URLs, risk-based evidence sanitization policy with pre-upload certification. | Client organisations designate internal admins to verify that operational records are masked prior to submission. |
| **Scoring Mechanics** | Deterministic, transparent, explainable, and testable. | Non-compensatory dual metric: Implementation Maturity (0–5) + Statutory Deficit / Red-Flag count. | Mathematical weights will prioritize critical statutory duties under Sections 8(5), 8(6), and 9. |
| **Architecture Scale** | Maintainable, production-oriented application. | Single full-stack Next.js 14+ application + managed PostgreSQL for MVP; Redis/BullMQ scaling add-ons triggered only when justified. | Concurrency during initial rollout will be in the low hundreds, well within single-cluster Next.js capacity. |

---

## 3. Formal Stakeholder Decision Register

The table below outlines the core decisions requiring formal sign-off from Truth Labs International leadership before or during development:

| Ref | Decision Item | Recommended Default | Alternatives Considered & Consequences | Implementation Blocker? |
|---|---|---|---|:---:|
| **DEC-01** | **Consultant-Led vs. Standalone Client Self-Assessments** | **Consultant-Led Engagement Model**: Assessments can only be scoped, peer-reviewed, and finalized by assigned TLI consultants. Client users can only author draft responses and submit evidence. | *Alternative: Pure Self-Service SaaS*.<br>**Consequences**: Allows clients to self-generate reports without TLI review. May lead to clients misinterpreting statutory requirements and relying on inaccurate self-evaluations. Dilutes TLI forensic advisory brand. | **No** (Blocks Phase 3 workflow logic; Recommended default implemented initially). |
| **DEC-02** | **Report Branding & Co-Branding Authority** | **TLI Forensic Audit Branding Only**: Issued final reports feature official Truth Labs International forensic branding, methodology badges, and signature of the TLI Lead Consultant. Client logo appears only as the "Assessed Subject". | *Alternative: Full White-Label / Co-Branding*.<br>**Consequences**: Client logo appears alongside TLI logo on report header. Requires building dynamic tenant logo upload and letterhead configuration in the PDF engine. | **No** (Blocks Phase 5 report templates). |
| **DEC-03** | **Hosting Provider & Data Location** | **AWS ap-south-1 (Mumbai)**: Primary production database and S3 evidence vault hosted in AWS Mumbai, with optional cross-region backup to AWS Hyderabad (`ap-south-2`). | *Alternatives: Microsoft Azure Central India, GCP Mumbai, or Sovereign Indian Clouds (Yotta, CtrlS)*.<br>**Consequences**: All options satisfy Indian data residency under DPDPA Section 16. AWS provides native S3 Object Lock (WORM) and managed KMS. Azure is advantageous if enterprise clients mandate Azure AD federation. | **No** (Blocks Phase 6 production deployment; local Docker stack is cloud-agnostic). |
| **DEC-04** | **Authentication & Enterprise SSO Federation** | **Phased Authentication**: Launch MVP with email/password (Argon2id) and TOTP Multi-Factor Authentication; introduce enterprise SAML 2.0 / OIDC federation (Azure AD, Okta) in Phase 3/4. | *Alternative: Mandatory SAML 2.0 SSO from Day 1*.<br>**Consequences**: Increases Phase 2 development scope by 1–2 weeks; requires mock enterprise IdP setup in test environments. | **No** (Does not block Phase 2 core development). |
| **DEC-05** | **Evidence Handling & PII Masking Policy** | **Risk-Based Evidence Classification**: Prohibit unmasked live customer PII (full 12-digit Aadhaar, unmasked PAN, biometric data); permit blank templates, synthetic records, and masked samples (`XXXX-XXXX-1234`). | *Alternative: Absolute Blanket Ban on any document mentioning Aadhaar/PAN*.<br>**Consequences**: Prevents clients from submitting valid proof of their KYC consent notices or collection forms, crippling auditability. | **Yes** (Must be approved before Phase 2 evidence catalogue seed). |
| **DEC-06** | **Evidence Antivirus & Malware Scanning Solution** | **AWS GuardDuty S3 Malware Protection** for production cloud; lightweight containerized ClamAV daemon for staging/local dev. | *Alternative: Synchronous In-Process Virus Scanning*.<br>**Consequences**: Synchronous scanning in Next.js web process risks CPU starvation on 50 MB uploads; event-driven S3 scanning decouples scanning from web latency. | **No** (Blocks Phase 3 evidence pipeline). |
| **DEC-07** | **Data Retention & Historical Snapshot Immutability** | **5-Year Retention with WORM Object Lock**: Issued assessment reports and associated evidence snapshots locked for 5 years in compliance mode. Deletion requires dual-custody authorization from TLI Super Admin and Client Admin. | *Alternative: Indefinite Archive or Client-Controlled Deletion*.<br>**Consequences**: Client-controlled deletion risks destroying audit evidence needed for DPBI regulatory defense; indefinite storage increases long-term encrypted storage costs. | **No** (Blocks Phase 5 snapshot locking). |
| **DEC-08** | **Legal Review Ownership & DPDP Rules 2025 Integration** | **TLI Legal Advisory Sign-off**: TLI legal counsel reviews the seeded statutory control library (`DPDPA-2023-V1.0`). As central rules are gazetted by MeitY, new modular versions (`DPDPA-RULES-2025-V1.0`) are seeded without mutating active assessments. | *Alternative: Engineering-curated control library without legal sign-off*.<br>**Consequences**: Severe legal liability if control guidance misinterprets statutory text or penal tiers. | **Yes** (Must be formally owned by TLI Legal before Phase 2 completion). |
| **DEC-09** | **Approved MVP Scope & Acceptance Criteria** | **Six-Phase Canonical MVP**: Complete Phases 1 through 5, delivering working assessment interfaces, deterministic scoring, PDF reports, and remediation tracking. Closed pilot testing conducted in Phase 6. | *Alternative: Truncated MVP (Questionnaire only, no scoring or reporting)*.<br>**Consequences**: Fails to deliver core business value (gap analysis and client reports) for TLI consultants. | **Yes** (Requires stakeholder alignment before proceeding to Phase 2). |
| **DEC-10** | **Statutory Legal Disclaimer Language** | **Approved Standard Advisory Disclaimer**: Embed explicit legal disclaimer on all executive reports clarifying that the assessment is an independent advisory gap analysis and not a legal immunity certificate from the Data Protection Board of India. | *Alternative: No disclaimer or informal disclaimer*.<br>**Consequences**: Exposes TLI to third-party liability if an assessed client suffers a data breach and claims TLI "certified" their statutory compliance. | **No** (Blocks Phase 5 report generation). |

---

## 4. Proposed Executive Report Legal Disclaimer

For formal review and approval by TLI Legal Counsel under **DEC-10**:

> *"IMPORTANT LEGAL NOTICE AND DISCLAIMER:  
> This Digital Personal Data Protection Compliance Gap Analysis Report represents an independent professional advisory evaluation conducted by Truth Labs International (TLI) based strictly upon documentary evidence, technical representations, and operational disclosures furnished by the client organisation as of the date of issuance.  
> 
> This report does NOT constitute a legal certification of immunity from statutory enforcement, nor an official endorsement or approval by the Data Protection Board of India (DPBI) or the Central Government. Under the Digital Personal Data Protection Act, 2023, compliance with statutory obligations (including the maintenance of reasonable security safeguards and the reporting of personal data breaches) is a continuous, non-compensatory legal and operational duty of the Data Fiduciary.  
> 
> Truth Labs International disclaims all warranties, express or implied, regarding any future regulatory determinations, audits, or penalties levied by competent authorities."*
