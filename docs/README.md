# TLI DPDP Compliance Gap Analysis Tool — Architecture & Specifications

This repository contains the enterprise architecture, security design, database specifications, and implementation roadmap for the **Truth Labs International (TLI) DPDP Compliance Gap Analysis Tool**.

The platform is purpose-built to enable TLI consultants and client organisations to perform deterministic, auditable, and multi-tenant compliance evaluations against India's **Digital Personal Data Protection Act, 2023 (DPDPA 2023)** and forthcoming **DPDP Rules, 2025**.

---

## Documentation Index & Authoritative Guide

| Ref | Document | Authoritative Topic |
|---|---|---|
| **01** | [Product Requirements Specification](01_product_requirements_specification.md) | Business goals, DPDPA 2023 statutory alignment, functional modules, and NFRs. |
| **02** | [User Roles and Permission Matrix](02_roles_and_permissions_matrix.md) | 7-role multi-tenant RBAC, least privilege rules, and operational permission matrices. |
| **03** | [Assessment Workflow and State Machine](03_assessment_workflow_and_state_machine.md) | State machine transitions, exception workflows, partial reviews, and remediation gates. |
| **04** | [Database Schema and ERD](04_database_schema_and_erd.md) | PostgreSQL 16+ DDL, UUIDv7 strategy, RoPA tables, safe foreign keys, and Mermaid ERD. |
| **05** | [Tenant Isolation and Evidence Security](05_tenant_isolation_and_evidence_security.md) | PostgreSQL RLS policies, connection pooling safety, private S3 vault, and risk-based masking. |
| **06** | [System Architecture and Deployment Proposal](06_system_architecture_and_deployment.md) | Next.js full-stack topology, MVP simplicity, scaling triggers, and cloud sovereignty. |
| **07** | [Testing Strategy and Threat Model](07_testing_strategy_and_threat_model.md) | STRIDE threat matrix, automated testing pyramid, and synthetic data protocol. |
| **08** | [Implementation Roadmap](08_implementation_roadmap.md) | Six canonical product phases, verifiable milestones, deliverables, and verification gates. |
| **09** | [Stakeholder Decision Register & Assumptions](09_unresolved_decisions_and_tl_assumptions.md) | Master Stakeholder Decision Register (DEC-01 to DEC-10), defaults, and blocker status. |
| **10** | [Phase 1 Review & Validation Summary](10_phase_1_review_and_validation_summary.md) | Executive review summary: issues found, corrections made, verified facts, and readiness report. |

---

## Phase 2: DPDP Control Library & Evidence Catalogue

| Ref | Document | Authoritative Topic |
|---|---|---|
| **11** | [Authoritative Legal Source Register](11_legal_source_register.md) | 7 primary legal sources (`SRC-01` to `SRC-07`), gazette citations, URLs, issuing authorities, and commencement schedule. |
| **QG** | [Phase 2 Quality Gate Review](11_phase_2_quality_gate_review.md) | Independent audit report, issue classification (3 High, 2 Medium, 3 Low), and remediation conditions. |
| **12** | [Source-to-Control Coverage Matrix](12_source_to_control_coverage_matrix.md) | Section-by-section statutory mapping of DPDPA 2023 and DPDP Rules 2025; coverage, exclusions, and government powers. |
| **13** | [Control-Library Schema & Data Dictionary](13_control_library_schema_and_data_dictionary.md) | Field definitions, database constraints, enums, response options architecture, and Draft 2020-12 JSON Schema. |
| **14** | [DPDP Control Library v1.0.0](14_dpdp_control_library_v1.md) | Master catalogue of 30 production-grade controls (`TLI-DPDP-SCO-01` to `PEN-01`), questions, evidence, and CAPA remediation. |
| **15** | [Evidence Catalogue & Verification Standards](15_evidence_catalogue.md) | Master catalogue of 27 evidence types (`EVID-ROPA-01` to `RSK-01`), verification procedures, limitations, and masking standards. |
| **16** | [Assessment & Review Guidance](16_assessment_and_review_guidance.md) | Objective evaluation standards for 5 response states, 4-step evidence verification protocol, and non-compensatory scoring rules. |
| **17** | [Applicability & Scoping Methodology](17_applicability_methodology.md) | Scoping decision trees, non-excludable baselines, justification criteria, approval gates, and specific scoping rules. |
| **18** | [Provisional Scoring & Risk Methodology](18_provisional_scoring_and_risk_methodology.md) | Mathematical model (`SCORING-V1-PROVISIONAL`): Maturity Score (0–5), Coverage %, Deficit Counter, and Statutory Penalty Tiers. |
| **19** | [Legal Review & Interpretation Register](19_legal_review_and_interpretation_register.md) | 10 itemized legal interpretation records (`LEG-INT-01` to `LEG-INT-10`) flagged `LEGAL_VERIFICATION_REQUIRED` for TLI Counsel. |
| **20** | [Control Library Versioning & Change Management](20_control_library_versioning_and_change_management.md) | Semantic versioning rules, control lifecycle states, impact analysis, and assessment version pinning. |
| **21** | [Phase 2 QA & Handover Report](21_phase_2_completion_and_quality_report.md) | Initial verification metrics, referential integrity results, and handover declaration. |
| **22** | [Phase 2 Remediation & Readiness Report](22_phase_2_remediation_and_readiness_report.md) | Controlled remediation report, verification commands, remaining stakeholder gates, and Phase 3 readiness clearance. |

---

## Phase 3: Core Platform Architecture & Implementation

| Ref | Document | Authoritative Topic |
|---|---|---|
| **23** | [Phase 3A Database Implementation](23_phase_3a_database_implementation.md) | Relational schema (23 tables), PostgreSQL RLS isolation, migration runner, synthetic multi-tenant seed fixtures, and test suite. |
| **24** | [Phase 3A.1 Live Database Verification](24_phase_3a_live_database_verification.md) | Live PostgreSQL 18.6 testing, RLS boundary tests, search-path hardening, root-cause fixes, and final PASS verdict. |
| **25** | [Phase 3B Evidence Storage Vault](25_phase_3b_evidence_storage_vault.md) | Provider-neutral S3 storage vault, presigned POST/GET workflows, magic byte validation, fail-closed malware quarantine, and automated tests. |
| **26** | [Phase 3B.1 Evidence Vault Security Review & Remediation](26_phase_3b_security_review_and_remediation.md) | Security audit, opaque S3 key remediation, presigned PUT disallowance, upload expiry enforcement, 39 automated tests, and canonical DEC-01..10 governance alignment. |
| **27** | [Phase 3B.2 Pre-Commit Integrity Review](27_phase_3b_precommit_integrity_review.md) | Final pre-commit integrity audit, live migration checksum verification, presigned URL post-issuance revocation analysis, and READY TO COMMIT certification. |

---

## Machine-Readable Data Assets & Schemas

| Asset | Records / Specs | Location & Formats | Description |
|---|:---:|:---:|---|
| **Authoritative Legal Sources** | 7 | [JSON](../data/legal_sources.json) \| [CSV](../data/legal_sources.csv) | Primary legal authorities with gazette citations, issuing bodies, verified URLs, and commencement timeline. |
| **DPDP Control Library v1** | 30 | [JSON](../data/dpdp_controls.json) \| [CSV](../data/dpdp_controls.csv) | Master controls with statutory provisions, questions, evidence links, and review status flags. |
| **Evidence Catalogue** | 27 | [JSON](../data/evidence_catalogue.json) \| [CSV](../data/evidence_catalogue.csv) | Evidence types with linked controls, verification procedures, confidentiality tiers, and masking rules. |
| **Formal JSON Schemas** | 3 Schemas | [`schemas/`](../schemas/) | Formal Draft 2020-12 schemas for controls, evidence items, and legal sources. |
| **Automated Data Validator** | Test Suite | [`scripts/validate_phase2_data.py`](../scripts/validate_phase2_data.py) | Standalone, offline Python test runner enforcing 100% schema compliance and referential integrity. |
| **PostgreSQL Migrations** | 5 Files | [`migrations/`](../migrations/) | Versioned DDL migrations: schema, RLS policies, canonical library, synthetic fixtures, and evidence lifecycle. |
| **Migration Runner** | Script | [`scripts/migrate.py`](../scripts/migrate.py) | Migration CLI runner tracking `schema_migrations` with SHA-256 checksum verification. |
| **Database Security Test Suite** | Test Suite | [`scripts/test_database_rls.py`](../scripts/test_database_rls.py) | Automated test suite verifying schema constraints, immutability triggers, and PostgreSQL RLS tenant isolation. |
| **Evidence Storage Test Suite** | Test Suite | [`scripts/test_evidence_vault.py`](../scripts/test_evidence_vault.py) | Automated test suite verifying presigned S3 workflows, file signature checks, malware quarantine, and tenant boundaries. |

---

## Core Architectural Principles

1. **Strict Statutory Alignment**: Controls, notices, and gap assessments reference specific sections of the DPDP Act 2023 and official rules without inventing statutory requirements.
2. **Non-Compensatory Evaluation**: Numerical maturity scores never declare statutory compliance. Critical statutory non-compliances (such as security safeguards or breach notification deficits) are recorded in an explicit Statutory Deficit Register.
3. **Defense-in-Depth Multi-Tenancy**: Tenant isolation is enforced at the application layer, database kernel (PostgreSQL Row-Level Security with transaction-scoped variables), and storage tier (partitioned private S3 buckets).
4. **Privacy-by-Default Evidence Management**: Zero public storage buckets, 10/15-minute presigned URLs, magic-byte header validation, risk-based data masking, and absolute exclusion from external AI model training.
5. **Immutable Audit Integrity**: Historical assessments and report snapshots are protected with `ON DELETE RESTRICT`, cryptographic SHA-256 dataset hashes, and tamper-evident append-only audit logging.
