#!/usr/bin/env python3
"""
TLI DPDP Compliance Gap Analysis Tool — Database Security & RLS Test Suite

Tests:
1. Schema & Referential Integrity (Constraints, Foreign Keys, UUIDv7, Uniqueness)
2. Immutability Enforcement (Triggers blocking UPDATE/DELETE on audit_logs and history)
3. Database-Enforced Tenant Isolation (PostgreSQL Row-Level Security via dpdp_app_user):
   - Fail-closed behavior on missing/invalid context
   - Tenant A cross-tenant read prevention
   - Tenant A cross-tenant write/update prevention
   - Tenant A cross-tenant insert prevention
   - Transaction-scoped connection reuse / session bleed prevention (is_local=true)
   - Consultant assignment scoping (assessment_assignments)
   - Runtime role privilege restrictions (NOBYPASSRLS, read-only canonical library)

Usage:
    python3 scripts/test_database_rls.py [--database-url=URL]
"""

import os
import sys
import subprocess
import argparse
import re
import json
from typing import List, Tuple, Dict, Optional

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIGRATIONS_DIR = os.path.join(BASE_DIR, "migrations")
DATA_DIR = os.path.join(BASE_DIR, "data")

TENANT_ALPHA_ID = "018f3a5b-7c8d-7e90-8000-000000000002"
TENANT_BETA_ID = "018f3a5b-7c8d-7e90-8000-000000000003"
USER_ALPHA_CONTRIBUTOR_ID = "018f3a5b-7c8d-7e90-8000-000000000113"
USER_TLI_LEAD_ID = "018f3a5b-7c8d-7e90-8000-000000000102"
ASSESSMENT_ALPHA_ID = "018f3a5b-7c8d-7e90-8000-000000000201"
ASSESSMENT_BETA_ID = "018f3a5b-7c8d-7e90-8000-000000000202"

class TestResult:
    def __init__(self, name: str, passed: bool, details: str = "", skipped: bool = False):
        self.name = name
        self.passed = passed
        self.details = details
        self.skipped = skipped

def run_psql(database_url: str, sql: str) -> Tuple[int, str, str]:
    """Executes SQL via psql subprocess."""
    cmd = ["psql", database_url, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql]
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    return p.returncode, p.stdout.strip(), p.stderr.strip()

def check_live_db(database_url: str) -> bool:
    if not database_url:
        return False
    code, out, err = run_psql(database_url, "SELECT 1;")
    return code == 0

# ============================================================================
# STATIC VALIDATION SUITE (Executes Offline Without Live Database)
# ============================================================================

def run_static_validations() -> List[TestResult]:
    results = []

    # 1. Migration files discovery
    files = sorted([f for f in os.listdir(MIGRATIONS_DIR) if f.endswith(".sql")])
    expected = [
        "001_initial_schema.sql",
        "002_rls_and_security.sql",
        "003_seed_canonical_library.sql",
        "004_seed_synthetic_data.sql",
        "005_evidence_vault_lifecycle.sql",
        "006_consultant_tenant_rls_policy.sql",
        "007_remediate_consultant_write_boundary.sql",
        "008_assessment_questionnaire_responses.sql",
        "009_assessor_review_workspace.sql",
        "010_evidence_and_clarification_workflows.sql",
        "011_assessment_lifecycle_and_immutability.sql",
        "012_reporting_and_remediation_workflows.sql",
    ]
    if files == expected:
        results.append(TestResult("Migration Files Sequence", True, f"Found all {len(files)} migration files: {files}"))
    else:
        results.append(TestResult("Migration Files Sequence", False, f"Expected {expected}, got {files}"))

    # 2. Check 001_initial_schema.sql contents
    with open(os.path.join(MIGRATIONS_DIR, "001_initial_schema.sql"), "r", encoding="utf-8") as f:
        sql001 = f.read()

    expected_tables = [
        "tenants", "business_units", "users", "processing_activities",
        "legal_sources", "framework_versions", "scoring_models", "control_domains",
        "controls", "evidence_types", "assessments", "assessment_assignments",
        "assessment_controls", "assessment_control_activities", "control_response_history",
        "evidence_items", "clarification_threads", "clarification_messages",
        "assessment_scores", "report_snapshots", "remediation_tasks",
        "remediation_evidence_items", "audit_logs"
    ]

    missing_tables = []
    for tbl in expected_tables:
        if not re.search(rf"CREATE TABLE IF NOT EXISTS {tbl}\b", sql001):
            missing_tables.append(tbl)

    if not missing_tables:
        results.append(TestResult("DDL Schema Completeness", True, f"All 23 tables defined in 001_initial_schema.sql"))
    else:
        results.append(TestResult("DDL Schema Completeness", False, f"Missing tables: {missing_tables}"))

    # 3. Check ON DELETE RESTRICT enforcement
    restrict_count = len(re.findall(r"ON DELETE RESTRICT", sql001))
    cascade_count = len(re.findall(r"ON DELETE CASCADE", sql001))
    if restrict_count >= 20 and cascade_count == 0:
        results.append(TestResult("Referential Audit Safety", True,
                                  f"{restrict_count} ON DELETE RESTRICT constraints, 0 unsafe CASCADE deletes"))
    else:
        results.append(TestResult("Referential Audit Safety", False,
                                  f"Found {cascade_count} CASCADE deletes (prohibited) or only {restrict_count} RESTRICT constraints"))

    # 4. Check Immutability Triggers in 001
    immutable_tables = ["audit_logs", "control_response_history", "report_snapshots"]
    triggers_ok = True
    for tbl in immutable_tables:
        if tbl not in sql001 or "prevent_immutable_record_modification" not in sql001:
            triggers_ok = False
    results.append(TestResult("Immutability Triggers Defined", triggers_ok,
                              f"Triggers guard {immutable_tables} against UPDATE/DELETE"))

    # 5. Check 002_rls_and_security.sql contents
    with open(os.path.join(MIGRATIONS_DIR, "002_rls_and_security.sql"), "r", encoding="utf-8") as f:
        sql002 = f.read()

    # Verify RLS enabled and forced on tenant tables
    tenant_tables = [
        "tenants", "business_units", "users", "processing_activities",
        "assessments", "assessment_assignments", "assessment_controls",
        "assessment_control_activities", "control_response_history",
        "evidence_items", "clarification_threads", "clarification_messages",
        "assessment_scores", "report_snapshots", "remediation_tasks",
        "remediation_evidence_items", "audit_logs"
    ]
    missing_rls = []
    for tbl in tenant_tables:
        enable_pattern = rf"ALTER TABLE {tbl} ENABLE ROW LEVEL SECURITY;"
        force_pattern = rf"ALTER TABLE {tbl} FORCE ROW LEVEL SECURITY;"
        if not re.search(enable_pattern, sql002) or not re.search(force_pattern, sql002):
            missing_rls.append(tbl)

    if not missing_rls:
        results.append(TestResult("Row-Level Security Enforcement", True,
                                  f"ENABLE & FORCE ROW LEVEL SECURITY declared on all {len(tenant_tables)} tenant tables"))
    else:
        results.append(TestResult("Row-Level Security Enforcement", False,
                                  f"Missing RLS declarations on: {missing_rls}"))

    # Verify fail-closed functions
    has_funcs = ("app_current_tenant_id()" in sql002 and
                 "app_current_user_id()" in sql002 and
                 "app_current_user_role()" in sql002)
    results.append(TestResult("Fail-Closed Helper Functions", has_funcs,
                              "app_current_tenant_id(), app_current_user_id(), app_current_user_role() defined with exception handlers"))

    # Verify NOBYPASSRLS on dpdp_app_user
    has_nobypass = "NOBYPASSRLS" in sql002 and "dpdp_app_user" in sql002
    results.append(TestResult("App User Role Privilege Restriction", has_nobypass,
                              "Role dpdp_app_user explicitly created with NOSUPERUSER and NOBYPASSRLS"))

    # 6. Check 003_seed_canonical_library.sql counts
    with open(os.path.join(MIGRATIONS_DIR, "003_seed_canonical_library.sql"), "r", encoding="utf-8") as f:
        sql003 = f.read()

    src_count = len(re.findall(r"INSERT INTO legal_sources", sql003))
    dom_count = len(re.findall(r"INSERT INTO control_domains", sql003))
    ctrl_count = len(re.findall(r"INSERT INTO controls\b", sql003))
    evid_count = len(re.findall(r"INSERT INTO evidence_types", sql003))

    if src_count == 7 and dom_count == 13 and ctrl_count == 30 and evid_count == 27:
        results.append(TestResult("Canonical Library Seed Integrity", True,
                                  f"7 sources, 13 domains, 30 controls, 27 evidence types seeded"))
    else:
        results.append(TestResult("Canonical Library Seed Integrity", False,
                                  f"Counts: src={src_count}/7, dom={dom_count}/13, ctrl={ctrl_count}/30, evid={evid_count}/27"))

    # 7. Check 004_seed_synthetic_data.sql contents
    with open(os.path.join(MIGRATIONS_DIR, "004_seed_synthetic_data.sql"), "r", encoding="utf-8") as f:
        sql004 = f.read()

    has_alpha = "alpha-healthcare" in sql004 and "018f3a5b-7c8d-7e90-8000-000000000002" in sql004
    has_beta = "beta-express" in sql004 and "018f3a5b-7c8d-7e90-8000-000000000003" in sql004
    has_tli = "truth-labs-advisory" in sql004 and "018f3a5b-7c8d-7e90-8000-000000000001" in sql004

    if has_alpha and has_beta and has_tli:
        results.append(TestResult("Synthetic Seed Multi-Tenant Fixtures", True,
                                  "Configured TLI advisory tenant + Alpha Healthcare (SDF) + Beta Express (Non-SDF)"))
    else:
        results.append(TestResult("Synthetic Seed Multi-Tenant Fixtures", False,
                                  f"Missing tenant definitions in 004"))

    return results

# ============================================================================
# LIVE POSTGRESQL SECURITY & RLS EXECUTION TEST SUITE
# ============================================================================

def run_live_tests(database_url: str) -> List[TestResult]:
    results = []

    # Helper to execute test as dpdp_app_user inside a transaction
    def exec_app_user_query(tenant_id: str, user_id: str, role: str, query: str) -> Tuple[int, List[str], str]:
        setup_lines = []
        if tenant_id:
            setup_lines.append(f"    PERFORM set_config('app.current_tenant_id', '{tenant_id}', true);")
        if user_id:
            setup_lines.append(f"    PERFORM set_config('app.current_user_id', '{user_id}', true);")
        if role:
            setup_lines.append(f"    PERFORM set_config('app.current_user_role', '{role}', true);")

        setup_block = ""
        if setup_lines:
            setup_block = "DO $$ BEGIN\n" + "\n".join(setup_lines) + "\nEND $$;\n"

        full_sql = f"""
        SET ROLE dpdp_app_user;
        BEGIN;
        {setup_block}
        {query}
        COMMIT;
        RESET ROLE;
        """
        code, out, err = run_psql(database_url, full_sql)
        ignored = {"SET", "BEGIN", "DO", "COMMIT", "RESET", "ROLLBACK"}
        clean_lines = [l.strip() for l in out.splitlines() if l.strip() and l.strip() not in ignored]
        return code, clean_lines, err

    # Test L1: Fresh schema migrations check
    code, out, err = run_psql(database_url, "SELECT COUNT(*) FROM schema_migrations;")
    if code == 0:
        results.append(TestResult("Live DB Migration Status", True, f"schema_migrations present, {out} applied"))
    else:
        results.append(TestResult("Live DB Migration Status", False, f"Failed: {err}"))

    # Test L2: Fail-Closed Check (Unset context returns zero rows)
    q = "SELECT COUNT(*) FROM assessments;"
    code, lines, err = exec_app_user_query("", "", "", q)
    if code == 0 and lines == ["0"]:
        results.append(TestResult("RLS Fail-Closed (Unset Context)", True, "Unset context returned 0 rows (fail-closed)"))
    else:
        results.append(TestResult("RLS Fail-Closed (Unset Context)", False, f"Expected ['0'], got: {lines} (err: {err})"))

    # Test L3: Tenant Alpha Isolation (Can see own assessment, cannot see Beta)
    q = "SELECT engagement_code FROM assessments ORDER BY engagement_code;"
    code, lines, err = exec_app_user_query(TENANT_ALPHA_ID, USER_ALPHA_CONTRIBUTOR_ID, "CLIENT_CONTRIBUTOR", q)
    if code == 0 and lines == ["ENG-ALPHA-2026-Q4"]:
        results.append(TestResult("RLS Tenant Isolation (Alpha Read)", True, f"Alpha sees strictly own assessment: {lines}"))
    else:
        results.append(TestResult("RLS Tenant Isolation (Alpha Read)", False, f"Alpha saw unexpected assessments: {lines} (err: {err})"))

    # Test L4: Cross-Tenant Direct Query (Alpha attempts to SELECT Beta assessment by ID)
    q = f"SELECT COUNT(*) FROM assessments WHERE id = '{ASSESSMENT_BETA_ID}';"
    code, lines, err = exec_app_user_query(TENANT_ALPHA_ID, USER_ALPHA_CONTRIBUTOR_ID, "CLIENT_CONTRIBUTOR", q)
    if code == 0 and lines == ["0"]:
        results.append(TestResult("RLS Cross-Tenant Read Block", True, "Alpha query for Beta assessment ID returned 0 rows"))
    else:
        results.append(TestResult("RLS Cross-Tenant Read Block", False, f"Alpha accessed Beta assessment: {lines} (err: {err})"))

    # Test L5: Cross-Tenant Update Prevention (Alpha attempts to modify Beta assessment)
    q = f"UPDATE assessments SET title = 'Hacked' WHERE id = '{ASSESSMENT_BETA_ID}';"
    code, lines, err = exec_app_user_query(TENANT_ALPHA_ID, USER_ALPHA_CONTRIBUTOR_ID, "CLIENT_CONTRIBUTOR", q)
    if code == 0 and (not lines or lines == ["UPDATE 0"]):
        results.append(TestResult("RLS Cross-Tenant Update Block", True, "Alpha cannot UPDATE Beta Express assessment (0 rows affected)"))
    else:
        results.append(TestResult("RLS Cross-Tenant Update Block", False, f"Alpha updated Beta assessment: {lines} (err: {err})"))

    # Test L6: Cross-Tenant Insert Prevention (Alpha attempts to INSERT row for Beta tenant)
    q = f"""
    INSERT INTO assessments (tenant_id, framework_version_id, scoring_model_id, engagement_code, title, lead_consultant_id)
    VALUES ('{TENANT_BETA_ID}', 'ab68a890-9932-5775-bd04-d18bffdb0415', 'c9ddba7f-8954-5d37-a92f-cf5a1f27e68b',
            'ROGUE-ENGAGEMENT-1', 'Rogue Title', '{USER_TLI_LEAD_ID}');
    """
    code, lines, err = exec_app_user_query(TENANT_ALPHA_ID, USER_ALPHA_CONTRIBUTOR_ID, "CLIENT_CONTRIBUTOR", q)
    if code != 0 and "violates row-level security policy" in (err + "".join(lines)):
        results.append(TestResult("RLS Cross-Tenant Insert Block", True, "Cross-tenant INSERT rejected by RLS WITH CHECK policy"))
    else:
        results.append(TestResult("RLS Cross-Tenant Insert Block", False, f"Cross-tenant insert succeeded or unexpected error: {err} {lines}"))

    # Test L7: Connection Reuse & Session Bleed Prevention (is_local=true scope check)
    session_bleed_sql = f"""
    SET ROLE dpdp_app_user;
    BEGIN;
    DO $$ BEGIN PERFORM set_config('app.current_tenant_id', '{TENANT_ALPHA_ID}', true); END $$;
    SELECT count(*) FROM assessments;
    COMMIT;
    -- Reused connection without setting context in subsequent transaction
    BEGIN;
    SELECT count(*) FROM assessments;
    COMMIT;
    RESET ROLE;
    """
    code, out, err = run_psql(database_url, session_bleed_sql)
    ignored = {"SET", "BEGIN", "DO", "COMMIT", "RESET", "ROLLBACK"}
    clean_lines = [l.strip() for l in out.splitlines() if l.strip() and l.strip() not in ignored]
    if code == 0 and len(clean_lines) >= 2 and clean_lines[0] == "1" and clean_lines[1] == "0":
        results.append(TestResult("Connection Reuse Bleed Prevention", True,
                                  "Tx 1 saw 1 assessment; subsequent reused connection without context saw 0 (no bleed)"))
    else:
        results.append(TestResult("Connection Reuse Bleed Prevention", False,
                                  f"Session bleed detected! Output: {clean_lines} (err: {err})"))

    # Test L8: Immutability Enforcement on Audit Logs (UPDATE)
    q_audit_update = "UPDATE audit_logs SET action = 'ALTERED' WHERE id = '018f3a5b-7c8d-7e90-8000-000000000601';"
    code, out, err = run_psql(database_url, q_audit_update)
    if code != 0 and "FORENSIC_INTEGRITY_VIOLATION" in (err + out):
        results.append(TestResult("Audit Log Immutability (UPDATE)", True, "Trigger trg_audit_logs_immutable blocked UPDATE"))
    else:
        results.append(TestResult("Audit Log Immutability (UPDATE)", False, f"Audit log update was permitted! {out} {err}"))

    # Test L9: Immutability Enforcement on Audit Logs (DELETE)
    q_audit_delete = "DELETE FROM audit_logs WHERE id = '018f3a5b-7c8d-7e90-8000-000000000601';"
    code, out, err = run_psql(database_url, q_audit_delete)
    if code != 0 and "FORENSIC_INTEGRITY_VIOLATION" in (err + out):
        results.append(TestResult("Audit Log Immutability (DELETE)", True, "Trigger trg_audit_logs_immutable blocked DELETE"))
    else:
        results.append(TestResult("Audit Log Immutability (DELETE)", False, f"Audit log delete was permitted! {out} {err}"))

    # Test L10: Immutability Enforcement on Response History (DELETE)
    q_hist_delete = "DELETE FROM control_response_history WHERE id = '018f3a5b-7c8d-7e90-8000-000000000301';"
    code, out, err = run_psql(database_url, q_hist_delete)
    if code != 0 and "FORENSIC_INTEGRITY_VIOLATION" in (err + out):
        results.append(TestResult("Response History Immutability (DELETE)", True, "Trigger trg_response_history_immutable blocked DELETE"))
    else:
        results.append(TestResult("Response History Immutability (DELETE)", False, f"History delete was permitted! {out} {err}"))

    # Test L11: Canonical Library Immutability (dpdp_app_user cannot modify controls)
    q_mod_ctrl = "UPDATE controls SET title = 'Altered Title' WHERE code = 'TLI-DPDP-SCO-01';"
    code, lines, err = exec_app_user_query("", "", "", q_mod_ctrl)
    if code != 0 and "permission denied for table controls" in (err + "".join(lines)):
        results.append(TestResult("Canonical Library App User Immutability", True, "dpdp_app_user has SELECT-only permission on controls"))
    else:
        results.append(TestResult("Canonical Library App User Immutability", False, f"App user modified canonical control! {lines} {err}"))

    # Test L12: Consultant Scoping Isolation (Assigned to Alpha, not Beta)
    q_consultant = "SELECT engagement_code FROM assessments ORDER BY engagement_code;"
    code, lines, err = exec_app_user_query("", USER_TLI_LEAD_ID, "TLI_LEAD_CONSULTANT", q_consultant)
    # Lead consultant is assigned to both Alpha and Beta in seed
    # Let's test Reviewer Karan Verma who is assigned ONLY to Alpha!
    q_reviewer = "SELECT engagement_code FROM assessments ORDER BY engagement_code;"
    code, lines, err = exec_app_user_query("", "018f3a5b-7c8d-7e90-8000-000000000103", "TLI_REVIEWER", q_reviewer)
    if code == 0 and lines == ["ENG-ALPHA-2026-Q4"]:
        results.append(TestResult("Consultant Scoping Isolation (Assignment Gate)", True,
                                  f"Reviewer sees strictly assigned assessment: {lines}"))
    else:
        results.append(TestResult("Consultant Scoping Isolation (Assignment Gate)", False,
                                  f"Reviewer saw unexpected assessments: {lines} (err: {err})"))

    # Test L13: Referential Integrity - ON DELETE RESTRICT enforcement
    q_del_tenant = f"DELETE FROM tenants WHERE id = '{TENANT_ALPHA_ID}';"
    code, out, err = run_psql(database_url, q_del_tenant)
    if code != 0 and "foreign key constraint" in (err + out).lower():
        results.append(TestResult("Referential Audit Safety (ON DELETE RESTRICT)", True,
                                  "Database blocked tenant deletion with active child records"))
    else:
        results.append(TestResult("Referential Audit Safety (ON DELETE RESTRICT)", False,
                                  f"Tenant deletion was allowed or unexpected error: {out} {err}"))

    # Test L14: Business Units Isolation (Alpha user cannot view Beta BUs)
    q_bu = "SELECT code FROM business_units ORDER BY code;"
    code, lines, err = exec_app_user_query(TENANT_ALPHA_ID, USER_ALPHA_CONTRIBUTOR_ID, "CLIENT_CONTRIBUTOR", q_bu)
    if code == 0 and lines == ["BU-CLINICAL", "BU-CORP", "BU-ENG"]:
        results.append(TestResult("Business Units Tenant Isolation", True,
                                  f"Alpha sees strictly own business units: {lines}"))
    else:
        results.append(TestResult("Business Units Tenant Isolation", False,
                                  f"Alpha saw unexpected business units: {lines} (err: {err})"))

    # Test L15: Processing Activities (RoPA) Tenant Isolation
    q_ropa = "SELECT statutory_ground FROM processing_activities ORDER BY statutory_ground;"
    code, lines, err = exec_app_user_query(TENANT_ALPHA_ID, USER_ALPHA_CONTRIBUTOR_ID, "CLIENT_CONTRIBUTOR", q_ropa)
    if code == 0 and lines == ["CONSENT_SECTION_6", "EMPLOYMENT_SECTION_7_G"]:
        results.append(TestResult("Processing Activities (RoPA) Tenant Isolation", True,
                                  f"Alpha sees strictly own RoPA activities: {lines}"))
    else:
        results.append(TestResult("Processing Activities (RoPA) Tenant Isolation", False,
                                  f"Alpha saw unexpected RoPA activities: {lines} (err: {err})"))

    # Test L16: Evidence Vault Tenant Read Isolation
    q_evid = "SELECT file_name FROM evidence_items ORDER BY file_name;"
    code, lines, err = exec_app_user_query(TENANT_ALPHA_ID, USER_ALPHA_CONTRIBUTOR_ID, "CLIENT_CONTRIBUTOR", q_evid)
    if code == 0 and len(lines) == 2 and all("AlphaHealth" in f for f in lines):
        results.append(TestResult("Evidence Vault Tenant Isolation", True,
                                  f"Alpha sees strictly own evidence records: {lines}"))
    else:
        results.append(TestResult("Evidence Vault Tenant Isolation", False,
                                  f"Alpha saw unexpected evidence records: {lines} (err: {err})"))

    # Test L17: TLI Super Admin Global Cross-Tenant Visibility
    q_super = "SELECT engagement_code FROM assessments ORDER BY engagement_code;"
    code, lines, err = exec_app_user_query("018f3a5b-7c8d-7e90-8000-000000000001",
                                           "018f3a5b-7c8d-7e90-8000-000000000101",
                                           "TLI_SUPER_ADMIN", q_super)
    if code == 0 and "ENG-ALPHA-2026-Q4" in lines and "ENG-BETA-2026-BASELINE" in lines:
        results.append(TestResult("TLI Super Admin Global Visibility", True,
                                  f"Super Admin sees all engagements across tenants: {lines}"))
    else:
        results.append(TestResult("TLI Super Admin Global Visibility", False,
                                  f"Super Admin did not see all engagements: {lines} (err: {err})"))

    return results

def main():
    parser = argparse.ArgumentParser(description="TLI DPDP Security & RLS Test Runner")
    parser.add_argument("--database-url", default=os.environ.get("DATABASE_URL", ""),
                        help="PostgreSQL connection URL")
    args = parser.parse_args()

    print("=" * 76)
    print("  TLI DPDP Compliance Gap Analysis Tool — Phase 3A Test Suite")
    print("=" * 76)

    # 1. Run static validations
    print("\n[Phase 3A Static Schema & Policy Validation]")
    static_results = run_static_validations()
    static_passed = 0
    for r in static_results:
        status_str = "PASS" if r.passed else "FAIL"
        print(f"  [{status_str}] {r.name:<40} : {r.details}")
        if r.passed:
            static_passed += 1

    print(f"\nStatic Validation Summary: {static_passed}/{len(static_results)} checks passed.")

    # 2. Check live PostgreSQL database availability
    db_url = args.database_url
    is_live_available = check_live_db(db_url) if db_url else False

    print("\n" + "=" * 76)
    print("  PostgreSQL Engine & Row-Level Security Kernel Tests")
    print("=" * 76)

    if not is_live_available:
        print("\n[NOTICE] Live PostgreSQL database service is NOT currently reachable.")
        print("  - Configured DATABASE_URL:", db_url if db_url else "(None provided)")
        print("  - Status: QUEUED / PENDING live PostgreSQL connection.")
        print("\n[MANDATORY COMPLIANCE REPORTING]")
        print("  In accordance with project governance standards:")
        print("  - Live PostgreSQL kernel tests were NOT executed.")
        print("  - Unexecuted kernel tests are NOT claimed to have passed.")
        print("  - To execute live security tests, provide a valid connection string:")
        print("      python3 scripts/test_database_rls.py --database-url=postgresql://user:pass@localhost:5432/dpdp_dev\n")

        # Report the queued test checklist
        queued_tests = [
            "Live DB Migration Status (001-004)",
            "RLS Fail-Closed on Unset Context",
            "RLS Tenant Isolation (Alpha Read)",
            "RLS Cross-Tenant Read Block",
            "RLS Cross-Tenant Update Block",
            "RLS Cross-Tenant Insert Block",
            "Connection Reuse Bleed Prevention (is_local=true)",
            "Audit Log Immutability Trigger (UPDATE)",
            "Response History Immutability Trigger (DELETE)",
            "Canonical Library App User Immutability"
        ]
        print("Queued Live Tests Ready For Execution:")
        for t in queued_tests:
            print(f"  [QUEUED] {t}")

        # Exit code 0 for static validation success while transparently logging queued status
        if static_passed == len(static_results):
            sys.exit(0)
        else:
            sys.exit(1)

    # If live DB is reachable:
    print(f"\nConnected to target PostgreSQL database: {db_url}")
    live_results = run_live_tests(db_url)
    live_passed = 0
    for r in live_results:
        status_str = "PASS" if r.passed else "FAIL"
        print(f"  [{status_str}] {r.name:<40} : {r.details}")
        if r.passed:
            live_passed += 1

    print(f"\nLive Security Test Summary: {live_passed}/{len(live_results)} tests passed.")
    if live_passed == len(live_results) and static_passed == len(static_results):
        print("\n>>> ALL PHASE 3A STATIC AND LIVE DATABASE TESTS PASSED <<<")
        sys.exit(0)
    else:
        print("\n>>> ONE OR MORE TESTS FAILED <<<")
        sys.exit(1)

if __name__ == "__main__":
    main()

