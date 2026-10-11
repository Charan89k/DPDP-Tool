#!/usr/bin/env python3
"""
TLI DPDP Compliance Gap Analysis Tool — Canonical Library SQL Seed Generator

Generates idempotent SQL migration (migrations/003_seed_canonical_library.sql)
from canonical Phase 2 datasets:
- data/legal_sources.json
- data/dpdp_controls.json
- data/evidence_catalogue.json
"""

import json
import uuid
import sys
import os

NAMESPACE = uuid.NAMESPACE_DNS
FRAMEWORK_CODE = "DPDPA-2023-V1.0"
FRAMEWORK_UUID = str(uuid.uuid5(NAMESPACE, f"truthlabs:dpdp:framework:{FRAMEWORK_CODE}"))
SCORING_CODE = "SCORING-V1-STANDARD-WEIGHTED"
SCORING_UUID = str(uuid.uuid5(NAMESPACE, f"truthlabs:dpdp:scoring:{SCORING_CODE}"))

TOPIC_METADATA = {
    "NOTICE_TRANSPARENCY": {
        "name": "Notice & Transparency Architecture",
        "description": "Itemised, standalone notices presented prior to or at time of consent collection.",
        "statutory_focus": "Section 5 r/w Rule 3",
        "weight": 1.25,
        "order_index": 1
    },
    "CONSENT_MANAGEMENT": {
        "name": "Consent Architecture & Consent Managers",
        "description": "Unbundled, freely given, specific, informed and unambiguous consent mechanisms.",
        "statutory_focus": "Section 6 r/w Rules 4-5",
        "weight": 1.25,
        "order_index": 2
    },
    "LEGITIMATE_USES": {
        "name": "Legitimate Uses & Legal Grounds",
        "description": "Exhaustive statutory legitimate grounds for processing without affirmative consent.",
        "statutory_focus": "Section 7",
        "weight": 1.0,
        "order_index": 3
    },
    "FIDUCIARY_DUTIES": {
        "name": "Data Fiduciary General Obligations",
        "description": "Completeness, accuracy, technical and organizational safeguards, and grievance redressal.",
        "statutory_focus": "Section 8(1)-(4), 8(10)",
        "weight": 1.0,
        "order_index": 4
    },
    "PROCESSOR_OVERSIGHT": {
        "name": "Data Processor Oversight & Contracts",
        "description": "Valid data processing agreements, technical instructions, and sub-processor governance.",
        "statutory_focus": "Section 8(2)",
        "weight": 1.0,
        "order_index": 5
    },
    "SECURITY_SAFEGUARDS": {
        "name": "Security Safeguards & Technical Measures",
        "description": "Reasonable technical and organizational security safeguards to prevent data breaches.",
        "statutory_focus": "Section 8(5)",
        "weight": 1.5,
        "order_index": 6
    },
    "BREACH_READINESS": {
        "name": "Personal Data Breach Readiness & Notification",
        "description": "Intimation of personal data breaches to the Data Protection Board and affected Data Principals.",
        "statutory_focus": "Section 8(6) r/w Rule 7",
        "weight": 1.5,
        "order_index": 7
    },
    "RETENTION_ERASURE": {
        "name": "Data Retention & Purpose Erasure",
        "description": "Data erasure upon purpose fulfillment, consent withdrawal, or statutory retention expiration.",
        "statutory_focus": "Section 8(7), 8(8)",
        "weight": 1.0,
        "order_index": 8
    },
    "CHILDREN_DISABLED_DATA": {
        "name": "Children & Persons with Disabilities Safeguards",
        "description": "Verifiable parental consent, age verification, and prohibition of behavioral tracking.",
        "statutory_focus": "Section 9 r/w Rule 8",
        "weight": 1.25,
        "order_index": 9
    },
    "SDF_GOVERNANCE": {
        "name": "Significant Data Fiduciary (SDF) Governance",
        "description": "Enhanced obligations: Resident DPO, Independent Data Auditor, periodic DPIAs and audits.",
        "statutory_focus": "Section 10 r/w Rules 9-10",
        "weight": 1.25,
        "order_index": 10
    },
    "DATA_PRINCIPAL_RIGHTS": {
        "name": "Data Principal Rights & Grievance Redressal",
        "description": "Rights of access, correction, erasure, grievance redressal, and nomination.",
        "statutory_focus": "Sections 11-14 r/w Rules 11-14",
        "weight": 1.25,
        "order_index": 11
    },
    "CROSS_BORDER_TRANSFERS": {
        "name": "Cross-Border Personal Data Transfers",
        "description": "Transfers of personal data outside India subject to Central Government restriction lists.",
        "statutory_focus": "Section 16",
        "weight": 1.0,
        "order_index": 12
    },
    "PENALTY_READINESS": {
        "name": "Statutory Penalties & Adjudication Readiness",
        "description": "Penalty exposure tracking, mitigating defense documentation, and DPBI inquiry readiness.",
        "statutory_focus": "Section 33 r/w Schedule",
        "weight": 1.0,
        "order_index": 13
    }
}

PENALTY_TIER_MAPPING = {
    # Tier 1: Up to ₹250 Crores
    "TLI-DPDP-SEC-01": "TIER_1_250CR",
    "TLI-DPDP-SEC-02": "TIER_1_250CR",
    # Tier 2: Up to ₹200 Crores
    "TLI-DPDP-BRC-01": "TIER_2_200CR",
    "TLI-DPDP-BRC-02": "TIER_2_200CR",
    "TLI-DPDP-CHD-01": "TIER_2_200CR",
    "TLI-DPDP-CHD-02": "TIER_2_200CR",
    # Tier 3: Up to ₹150 Crores
    "TLI-DPDP-SDF-01": "TIER_3_150CR",
    "TLI-DPDP-SDF-02": "TIER_3_150CR",
    # Tier 4: General breach up to ₹50 Crores (all others)
}

def sql_str(s: str) -> str:
    """Escapes string safely for PostgreSQL literal."""
    if s is None:
        return "NULL"
    escaped = s.replace("'", "''")
    return f"'{escaped}'"

def sql_json(obj: any) -> str:
    """Formats Python object as JSON string literal."""
    if obj is None:
        return "'{}'::jsonb"
    json_str = json.dumps(obj, ensure_ascii=False)
    escaped = json_str.replace("'", "''")
    return f"'{escaped}'::jsonb"

def generate_sql():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_dir = os.path.join(base_dir, "data")
    migrations_dir = os.path.join(base_dir, "migrations")

    with open(os.path.join(data_dir, "legal_sources.json"), "r", encoding="utf-8") as f:
        sources = json.load(f)

    with open(os.path.join(data_dir, "dpdp_controls.json"), "r", encoding="utf-8") as f:
        controls = json.load(f)

    with open(os.path.join(data_dir, "evidence_catalogue.json"), "r", encoding="utf-8") as f:
        evidence = json.load(f)

    sql_lines = [
        "-- ============================================================================",
        "-- Migration: 003_seed_canonical_library.sql",
        "-- Description: Canonical DPDP legal sources, control framework v1.0, and evidence catalogue",
        "-- Generated deterministically from data/ canonical datasets",
        "-- Version: 1.0.0",
        "-- Author: Principal Software Architect / Database Security Engineer",
        "-- Target: PostgreSQL 16+",
        "-- ============================================================================",
        "",
        "-- 1. FRAMEWORK VERSION",
        f"INSERT INTO framework_versions (id, code, name, description, legal_basis, status, effective_date)",
        f"VALUES ({sql_str(FRAMEWORK_UUID)}, {sql_str(FRAMEWORK_CODE)},",
        f"  'India Digital Personal Data Protection Act, 2023 Framework (v1.0)',",
        f"  'Canonical compliance baseline derived from DPDPA 2023 and DPDP Rules 2025.',",
        f"  'Digital Personal Data Protection Act, 2023 (Act No. 22 of 2023)',",
        f"  'ACTIVE', '2025-11-13')",
        f"ON CONFLICT (code) DO UPDATE SET",
        f"  name = EXCLUDED.name, description = EXCLUDED.description, status = EXCLUDED.status;",
        "",
        "-- 2. SCORING MODEL",
        f"INSERT INTO scoring_models (id, code, name, version, formula_definition, status)",
        f"VALUES ({sql_str(SCORING_UUID)}, {sql_str(SCORING_CODE)},",
        f"  'TLI DPDP Standard Weighted Risk and Maturity Model v1.0', '1.0.0',",
        f"  {sql_json({'method': 'WEIGHTED_DOMAIN_AVERAGE', 'scale': '0-5', 'penalty_tiers': {'TIER_1': 2500000000, 'TIER_2': 2000000000, 'TIER_3': 1500000000, 'TIER_4': 500000000, 'TIER_5': 10000}})},",
        f"  'ACTIVE')",
        f"ON CONFLICT (code) DO UPDATE SET",
        f"  name = EXCLUDED.name, formula_definition = EXCLUDED.formula_definition, status = EXCLUDED.status;",
        "",
        "-- 3. LEGAL SOURCES REGISTER (7 CANONICAL AUTHORITIES)"
    ]

    source_uuid_map = {}
    for s in sources:
        sid = s["source_id"]
        suuid = str(uuid.uuid5(NAMESPACE, f"truthlabs:dpdp:legal_source:{sid}"))
        source_uuid_map[sid] = suuid
        sql_lines.extend([
            f"INSERT INTO legal_sources (id, source_id, title, citation, issuing_authority, publication_date, gazette_reference, source_type, commencement_status, url, verification_status)",
            f"VALUES ({sql_str(suuid)}, {sql_str(sid)}, {sql_str(s['title'])}, {sql_str(s['citation'])},",
            f"  {sql_str(s['issuing_authority'])}, {sql_str(s['publication_date'])}, {sql_str(s['gazette_reference'])},",
            f"  {sql_str(s['source_type'])}::legal_source_type, {sql_str(s['commencement_status'])}::source_commencement_status,",
            f"  {sql_str(s['url'])}, {sql_str(s['verification_status'])})",
            f"ON CONFLICT (source_id) DO UPDATE SET",
            f"  title = EXCLUDED.title, citation = EXCLUDED.citation, issuing_authority = EXCLUDED.issuing_authority,",
            f"  commencement_status = EXCLUDED.commencement_status, url = EXCLUDED.url, verification_status = EXCLUDED.verification_status;",
            ""
        ])

    sql_lines.append("-- 4. CONTROL DOMAINS (13 CANONICAL TOPICS)")
    domain_uuid_map = {}
    for topic, meta in TOPIC_METADATA.items():
        duuid = str(uuid.uuid5(NAMESPACE, f"truthlabs:dpdp:control_domain:{topic}"))
        domain_uuid_map[topic] = duuid
        sql_lines.extend([
            f"INSERT INTO control_domains (id, framework_version_id, code, name, description, statutory_focus, weight, order_index)",
            f"VALUES ({sql_str(duuid)}, {sql_str(FRAMEWORK_UUID)}, {sql_str(topic)}, {sql_str(meta['name'])},",
            f"  {sql_str(meta['description'])}, {sql_str(meta['statutory_focus'])}, {meta['weight']}, {meta['order_index']})",
            f"ON CONFLICT (framework_version_id, code) DO UPDATE SET",
            f"  name = EXCLUDED.name, description = EXCLUDED.description, statutory_focus = EXCLUDED.statutory_focus,",
            f"  weight = EXCLUDED.weight, order_index = EXCLUDED.order_index;",
            ""
        ])

    sql_lines.append("-- 5. CONTROLS (30 CANONICAL CONTROLS)")
    for i, c in enumerate(controls, start=1):
        cid = c["control_id"]
        cuuid = str(uuid.uuid5(NAMESPACE, f"truthlabs:dpdp:control:{cid}"))
        domain_uuid = domain_uuid_map[c["topic"]]
        source_uuid = source_uuid_map[c["source_id"]]
        tier = PENALTY_TIER_MAPPING.get(cid, "TIER_4_50CR")
        is_sdf_only = (c["obligation_type"] == "SDF_MANDATORY_CONDITIONAL")
        weight = 1.5 if tier == "TIER_1_250CR" else (1.25 if tier == "TIER_2_200CR" else 1.0)

        sql_lines.extend([
            f"INSERT INTO controls (id, framework_version_id, domain_id, code, control_version, source_id, source_provision,",
            f"  title, intent, obligation_type, legal_reference_summary, applicability_conditions, applicability_rationale,",
            f"  assessment_question, implementation_expectations, acceptable_evidence, evidence_limitations, assessment_guidance,",
            f"  risk_guidance, suggested_remediation, related_control_ids, penalty_tier, default_weight, order_index, is_sdf_only,",
            f"  legal_review_status, methodology_review_status, review_notes)",
            f"VALUES ({sql_str(cuuid)}, {sql_str(FRAMEWORK_UUID)}, {sql_str(domain_uuid)}, {sql_str(cid)}, {sql_str(c['control_version'])},",
            f"  {sql_str(source_uuid)}, {sql_str(c['source_provision'])}, {sql_str(c['title'])}, {sql_str(c['objective'])},",
            f"  {sql_str(c['obligation_type'])}::obligation_type, {sql_str(c['legal_reference_summary'])},",
            f"  {sql_str(c['applicability_conditions'])}, {sql_str(c['applicability_rationale'])},",
            f"  {sql_str(c['assessment_question'])}, {sql_str(c['implementation_expectations'])},",
            f"  {sql_json(c['acceptable_evidence'])}, {sql_str(c['evidence_limitations'])},",
            f"  {sql_str(c['assessment_guidance'])}, {sql_str(c['risk_guidance'])},",
            f"  {sql_str(c['suggested_remediation'])}, {sql_json(c.get('related_control_ids', []))},",
            f"  {sql_str(tier)}::penalty_tier, {weight}, {i}, {'TRUE' if is_sdf_only else 'FALSE'},",
            f"  {sql_str(c['legal_review_status'])}, {sql_str(c['methodology_review_status'])}, {sql_str(c.get('review_notes', ''))})",
            f"ON CONFLICT (framework_version_id, code) DO UPDATE SET",
            f"  title = EXCLUDED.title, intent = EXCLUDED.intent, source_provision = EXCLUDED.source_provision,",
            f"  obligation_type = EXCLUDED.obligation_type, legal_reference_summary = EXCLUDED.legal_reference_summary,",
            f"  assessment_question = EXCLUDED.assessment_question, implementation_expectations = EXCLUDED.implementation_expectations,",
            f"  acceptable_evidence = EXCLUDED.acceptable_evidence, penalty_tier = EXCLUDED.penalty_tier,",
            f"  legal_review_status = EXCLUDED.legal_review_status, methodology_review_status = EXCLUDED.methodology_review_status;",
            ""
        ])

    sql_lines.append("-- 6. EVIDENCE CATALOGUE (27 CANONICAL EVIDENCE TYPES)")
    for e in evidence:
        eid = e["evidence_type_id"]
        euuid = str(uuid.uuid5(NAMESPACE, f"truthlabs:dpdp:evidence_type:{eid}"))
        sql_lines.extend([
            f"INSERT INTO evidence_types (id, evidence_type_id, title, description, linked_controls, status, confidentiality_tier,",
            f"  recommended_freshness, acceptable_examples, alternative_evidence, verification_procedure, limitations_and_weaknesses,",
            f"  masking_and_redaction_requirements, retention_considerations, reviewer_guidance)",
            f"VALUES ({sql_str(euuid)}, {sql_str(eid)}, {sql_str(e['title'])}, {sql_str(e['description'])},",
            f"  {sql_json(e['linked_controls'])}, {sql_str(e['status'])}, {sql_str(e['confidentiality_tier'])},",
            f"  {sql_str(e.get('recommended_freshness', ''))}, {sql_json(e.get('acceptable_examples', []))},",
            f"  {sql_str(e.get('alternative_evidence', ''))}, {sql_json(e.get('verification_procedure', []))},",
            f"  {sql_str(e.get('limitations_and_weaknesses', ''))}, {sql_str(e.get('masking_and_redaction_requirements', ''))},",
            f"  {sql_str(e.get('retention_considerations', ''))}, {sql_str(e.get('reviewer_guidance', ''))})",
            f"ON CONFLICT (evidence_type_id) DO UPDATE SET",
            f"  title = EXCLUDED.title, description = EXCLUDED.description, linked_controls = EXCLUDED.linked_controls,",
            f"  confidentiality_tier = EXCLUDED.confidentiality_tier, acceptable_examples = EXCLUDED.acceptable_examples,",
            f"  verification_procedure = EXCLUDED.verification_procedure, masking_and_redaction_requirements = EXCLUDED.masking_and_redaction_requirements;",
            ""
        ])

    output_path = os.path.join(migrations_dir, "003_seed_canonical_library.sql")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(sql_lines) + "\n")

    print(f"Successfully generated {output_path}")
    print(f"  - Framework Versions: 1")
    print(f"  - Scoring Models:     1")
    print(f"  - Legal Sources:      {len(sources)}")
    print(f"  - Control Domains:    {len(TOPIC_METADATA)}")
    print(f"  - Controls:           {len(controls)}")
    print(f"  - Evidence Types:     {len(evidence)}")

if __name__ == "__main__":
    generate_sql()

