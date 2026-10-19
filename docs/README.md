# CloudE5 documentation

## Running CloudE5

| Document | Covers |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Components, request flow, deployment modes and design limits |
| [SELF_HOSTING.md](SELF_HOSTING.md) | Installation, configuration, backups, upgrades and troubleshooting |
| [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) | Moving from a laptop trial to a production server |
| [ONBOARDING.md](ONBOARDING.md) | Self-service and administrator-created organisations, roles, two-factor sign-in |
| [SECURITY_MODEL.md](SECURITY_MODEL.md) | Tenant isolation, accounts and sessions, HTTP hardening, evidence files |

## Methodology and reference (`reference/`)

The assessment content and rules the application implements.

| Document | Covers |
|---|---|
| [01 Product requirements](reference/01_product_requirements_specification.md) | Goals, statutory alignment, functional modules and non-functional requirements |
| [02 Roles and permissions](reference/02_roles_and_permissions_matrix.md) | The seven roles and what each may do |
| [03 Assessment workflow](reference/03_assessment_workflow_and_state_machine.md) | Assessment lifecycle states and transitions |
| [09 Decision register](reference/09_unresolved_decisions_and_tl_assumptions.md) | Stakeholder decisions DEC-01 to DEC-10 and working assumptions |
| [11 Legal source register](reference/11_legal_source_register.md) | Primary legal sources (SRC-01 to SRC-07) with citations |
| [12 Source-to-control coverage](reference/12_source_to_control_coverage_matrix.md) | Section-by-section mapping of the DPDP Act and Rules to controls |
| [13 Control library schema](reference/13_control_library_schema_and_data_dictionary.md) | Control fields, enums and JSON Schema |
| [14 Control library v1](reference/14_dpdp_control_library_v1.md) | The 30 controls, their questions, evidence and remediation |
| [15 Evidence catalogue](reference/15_evidence_catalogue.md) | The 27 evidence types and how each is verified |
| [16 Assessment and review guidance](reference/16_assessment_and_review_guidance.md) | How responses and evidence are evaluated |
| [17 Applicability methodology](reference/17_applicability_methodology.md) | Scoping, exclusions and their justification |
| [18 Scoring and risk methodology](reference/18_provisional_scoring_and_risk_methodology.md) | The provisional scoring model and penalty tiers |
| [19 Legal interpretation register](reference/19_legal_review_and_interpretation_register.md) | Interpretations flagged for legal verification |
| [20 Control library versioning](reference/20_control_library_versioning_and_change_management.md) | Versioning rules and assessment version pinning |

## Data

| Asset | Location |
|---|---|
| Legal sources, control library, evidence catalogue | [`data/`](../data/) (JSON and CSV), validated against [`schemas/`](../schemas/) by `python3 scripts/validate_phase2_data.py` |
| Questionnaire (60 questions, 8 sections) | [`data/questionnaire_v1.json`](../data/questionnaire_v1.json), extracted from the Word source in [`data/source/`](../data/source/); `python3 scripts/validate_questionnaire_source_parity.py` checks they match |
| Database schema | [`migrations/sqlite/`](../migrations/sqlite/) |

## Design history (`archive/`)

[`archive/`](archive/) keeps the phase-by-phase build reports (documents 04–08, 10, 21–53) and the
original UI reference images. They describe the platform as it was built at the time, originally as the
TLI DPDP Compliance Gap Analysis Tool on PostgreSQL with Neon and Vercel, including demo accounts that
no longer exist. They are kept for traceability and are not instructions for the current version.
