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
| **28** | [Phase 3C Application Core, Authentication & API Scaffolding](28_phase_3c_application_core_authentication_and_api.md) | Next.js 15 App Router foundation, TLI enterprise shell, jose session cookies, DEC-04 SSO alignment, 7-role RBAC, and executeWithRls pool integration. |
| **29** | [Phase 3C.1 Authentication & RLS Security Gate Review](29_phase_3c_authentication_and_rls_security_review.md) | Security audit and remediation report: production synthetic credentials fail-closed, mandatory JWT secrets, rate limiting, and DB-verified RLS execution. |
| **30** | [Phase 3C.2 Final Security Verification & Commit Readiness](30_phase_3c_final_security_and_commit_readiness.md) | Final verification report: proxy header IP resolution, RLS cleanup ordering, 27-test application suite, and READY TO COMMIT certification. |
| **31** | [Phase 3D Assessment Workflow Implementation Plan](31_phase_3d_assessment_workflow_implementation_plan.md) | Architectural specification, questionnaire engine, scoring & gap algorithms, review state machine, and phased implementation roadmap. |
| **32** | [Phase 3D Governance & Scoring Readiness Review](32_phase_3d_governance_and_scoring_readiness_review.md) | Canonical decision register reconciliation, statutory penalty audit, deterministic scoring mathematics, and Phase 3D.1 foundation readiness gate. |
| **33** | [Phase 3D Canonical Governance Reconciliation & Foundation Gate](33_phase_3d_canonical_governance_reconciliation.md) | Authoritative decision audit (DEC-01..10), 13 database domain counts, 14-state lifecycle reconciliation, and foundation readiness gate. |
| **34** | [Phase 3D.UI.1 Questionnaire Structure, Local Storage Vault & Editorial Redesign](34_phase_3d_ui_questionnaire_and_storage_implementation.md) | Canonical MCQ pagination engine (max 4 questions/section), local disk evidence vault, fail-closed quarantine download gate, and editorial audit login redesign. |
| **35** | [Phase 3D UI Refinement & Demo Access](35_ui_refinement_and_demo_access.md) | Restrained enterprise consulting visual refinement, local demo accounts (`consultant.demo` & `customer.demo`), questionnaire navigation, and document report preview. |
| **36** | [Post-Login Failure Diagnosis & Recovery Report](36_post_login_failure_diagnosis_and_recovery.md) | Empirical root cause analysis of post-login server crashes, column mismatch remediation, Migration 006 RLS scoping, and 55-test verification. |
| **37** | [Migration 006 Security Review & Policy Remediation Report](37_migration_006_security_review.md) | Security audit of Migration 006 RLS policies, discovery of High-severity `FOR ALL` write vulnerability, Migration 007 remediation, and 60-test verification. |
| **38** | [Canonical Questionnaire Alignment & Implementation Audit](38_canonical_questionnaire_alignment.md) | Exact 60-question extraction, 8-section UI alignment, Migration 008 RLS responses, mandatory N/A justification, and 69 automated tests. |
| **39** | [Exact Reference UI Implementation & Architectural Alignment](39_reference_ui_implementation.md) | Full faithful reproduction of six approved reference screenshots (Dashboard, New Assessment, Questionnaire, Evidence, Summary), navigation tokens, and 69-test verification. |
| **40** | [Reference UI QA & Verification Report](40_reference_ui_qa_report.md) | Pixel-accurate visual verification, headless browser screenshot audits, 10 functional workflow tests, RLS security boundary tests, and production build gate. |
| **41** | [Final Pre-Commit Acceptance Review](41_final_precommit_acceptance_review.md) | Comprehensive pre-commit acceptance audit across UI reproduction, canonical questionnaire parity, PostgreSQL RLS, evidence vault, and test execution. |
| **42** | [Assessor Review Workspace & Clarifications Engine](42_assessor_review_workspace.md) | Phase 3D.2 Assessor Review Workspace, Migration 009 RLS evaluations, question-level clarifications, queue metrics, and 76 automated tests. |
| **43** | [Evidence Vault & Clarification Workflows](43_evidence_and_clarification_workflows.md) | Phase 3D.3 Evidence Vault Lifecycle, Migration 010 RLS policies, VERIFIED/REJECTED assessor decisions, immutable review history, independent Evidence Coverage metrics, and 87 automated tests. |
| **44** | [Deterministic Scoring Engine](44_deterministic_scoring_engine.md) | Phase 3D.4 Pure deterministic scoring engine, provisional methodology labeling (DEC-08/09), 4 independent metrics, non-compensatory Statutory Deficit Register, RLS snapshot persistence, and 98 automated tests. |
| **45** | [Assessment Lifecycle & Approval Controls](45_assessment_lifecycle_and_approval_controls.md) | Phase 3D.5 Canonical 14-state lifecycle machine, role transition authority matrix, server-side precondition guards, kernel-enforced forensic immutability, re-audit cloning, and 111 automated tests. |
| **46** | [Frontend Workspaces Completion](46_frontend_workspaces_completion.md) | Phase 3D.6 Role-specific assessment workspaces (Assessor, Client, Lead Consultant), live data integration, RLS data segregation, zero-mock cleanup, and 111 automated tests. |

---

## Machine-Readable Data Assets & Schemas

| Asset | Records / Specs | Location & Formats | Description |
|---|:---:|:---:|---|
| **Authoritative Legal Sources** | 7 | [JSON](../data/legal_sources.json) \| [CSV](../data/legal_sources.csv) | Primary legal authorities with gazette citations, issuing bodies, verified URLs, and commencement timeline. |
| **DPDP Control Library v1** | 30 | [JSON](../data/dpdp_controls.json) \| [CSV](../data/dpdp_controls.csv) | Master controls with statutory provisions, questions, evidence links, and review status flags. |
| **Questionnaire v1 Manifest** | 60 | [JSON](../data/questionnaire_v1.json) | Authoritative 60-question questionnaire extracted from Word document with exact wording, 5 options, and sections. |
| **Evidence Catalogue** | 27 | [JSON](../data/evidence_catalogue.json) \| [CSV](../data/evidence_catalogue.csv) | Evidence types with linked controls, verification procedures, confidentiality tiers, and masking rules. |
| **Formal JSON Schemas** | 3 Schemas | [`schemas/`](../schemas/) | Formal Draft 2020-12 schemas for controls, evidence items, and legal sources. |
| **Automated Data Validator** | Test Suite | [`scripts/validate_phase2_data.py`](../scripts/validate_phase2_data.py) | Standalone, offline Python test runner enforcing 100% schema compliance and referential integrity. |
| **PostgreSQL Migrations** | 11 Files | [`migrations/`](../migrations/) | Versioned DDL migrations: schema, RLS policies, canonical library, synthetic fixtures, evidence lifecycle, consultant RLS scoping, write boundary remediation, questionnaire responses, assessor review workspace, evidence & clarification workflows, and assessment lifecycle & immutability. |
| **Migration Runner** | Script | [`scripts/migrate.py`](../scripts/migrate.py) | Migration CLI runner tracking `schema_migrations` with SHA-256 checksum verification. |
| **Database Security Test Suite** | Test Suite | [`scripts/test_database_rls.py`](../scripts/test_database_rls.py) | Automated test suite verifying schema constraints, immutability triggers, and PostgreSQL RLS tenant isolation. |
| **Evidence Storage Test Suite** | Test Suite | [`scripts/test_evidence_vault.py`](../scripts/test_evidence_vault.py) | Automated test suite verifying presigned S3 workflows, file signature checks, malware quarantine, and tenant boundaries. |
| **Application & Auth Test Suite** | Test Suite | [`tests/`](../tests/) | Automated Node test suite verifying JWT session security, open redirects, 7-role RBAC, and live PostgreSQL RLS pool isolation. |

---

## Core Architectural Principles

1. **Strict Statutory Alignment**: Controls, notices, and gap assessments reference specific sections of the DPDP Act 2023 and official rules without inventing statutory requirements.
2. **Non-Compensatory Evaluation**: Numerical maturity scores never declare statutory compliance. Critical statutory non-compliances (such as security safeguards or breach notification deficits) are recorded in an explicit Statutory Deficit Register.
3. **Defense-in-Depth Multi-Tenancy**: Tenant isolation is enforced at the application layer, database kernel (PostgreSQL Row-Level Security with transaction-scoped variables), and storage tier (partitioned private S3 buckets).
4. **Privacy-by-Default Evidence Management**: Zero public storage buckets, 10/15-minute presigned URLs, magic-byte header validation, risk-based data masking, and absolute exclusion from external AI model training.
5. **Immutable Audit Integrity**: Historical assessments and report snapshots are protected with `ON DELETE RESTRICT`, cryptographic SHA-256 dataset hashes, and tamper-evident append-only audit logging.
