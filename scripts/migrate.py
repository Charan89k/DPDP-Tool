#!/usr/bin/env python3
"""
TLI DPDP Compliance Gap Analysis Tool — Migration Runner

Applies and verifies versioned SQL migrations using PostgreSQL 'psql' client.
Tracks migration state and file checksums in 'schema_migrations'.

Usage:
    python3 scripts/migrate.py status [--database-url=URL]
    python3 scripts/migrate.py up     [--database-url=URL]
    python3 scripts/migrate.py verify [--database-url=URL]
"""

import os
import sys
import hashlib
import subprocess
import argparse
from typing import List, Tuple, Dict, Optional

MIGRATIONS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "migrations")

def compute_checksum(filepath: str) -> str:
    """Computes SHA-256 checksum of file contents."""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()

def get_migration_files() -> List[Tuple[str, str, str]]:
    """Returns sorted list of (version, name, filepath)."""
    if not os.path.exists(MIGRATIONS_DIR):
        return []
    files = [f for f in os.listdir(MIGRATIONS_DIR) if f.endswith(".sql")]
    files.sort()
    result = []
    for f in files:
        version = f.split("_")[0]
        result.append((version, f, os.path.join(MIGRATIONS_DIR, f)))
    return result

def run_psql(database_url: str, sql: str, capture_output: bool = True) -> Tuple[int, str, str]:
    """Executes SQL string via psql subprocess."""
    cmd = ["psql", database_url, "-v", "ON_ERROR_STOP=1", "-c", sql]
    p = subprocess.run(cmd, stdout=subprocess.PIPE if capture_output else None,
                       stderr=subprocess.PIPE if capture_output else None,
                       text=True)
    return p.returncode, p.stdout or "", p.stderr or ""

def run_psql_file(database_url: str, filepath: str) -> Tuple[int, str, str]:
    """Executes an SQL file via psql subprocess within a single atomic transaction."""
    cmd = ["psql", database_url, "-v", "ON_ERROR_STOP=1", "--single-transaction", "-f", filepath]
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    return p.returncode, p.stdout or "", p.stderr or ""

def check_db_connection(database_url: str) -> bool:
    """Checks if the PostgreSQL database is reachable."""
    code, out, err = run_psql(database_url, "SELECT 1;")
    return code == 0

def get_applied_migrations(database_url: str) -> Dict[str, Dict[str, str]]:
    """Retrieves applied migrations from schema_migrations table."""
    check_table_sql = "SELECT to_regclass('public.schema_migrations');"
    code, out, err = run_psql(database_url, check_table_sql)
    if code != 0 or "schema_migrations" not in out:
        return {}

    query_sql = "SELECT version || '|' || name || '|' || checksum || '|' || applied_at FROM schema_migrations ORDER BY version;"
    cmd = ["psql", database_url, "-t", "-A", "-c", query_sql]
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if p.returncode != 0:
        return {}

    applied = {}
    for line in p.stdout.strip().splitlines():
        if not line or "|" not in line:
            continue
        parts = line.split("|")
        if len(parts) >= 4:
            applied[parts[0]] = {
                "name": parts[1],
                "checksum": parts[2],
                "applied_at": parts[3]
            }
    return applied

def cmd_status(database_url: str):
    print("=" * 70)
    print("  TLI DPDP Migration Status")
    print("=" * 70)
    if not check_db_connection(database_url):
        print(f"[ERROR] Cannot connect to database at: {database_url}")
        sys.exit(1)

    applied = get_applied_migrations(database_url)
    migrations = get_migration_files()

    print(f"{'Version':<10} {'Status':<12} {'Applied At':<25} {'Migration Name'}")
    print("-" * 70)
    for version, name, filepath in migrations:
        if version in applied:
            app_info = applied[version]
            status = "APPLIED"
            applied_at = app_info["applied_at"][:19]
        else:
            status = "PENDING"
            applied_at = "-"
        print(f"{version:<10} {status:<12} {applied_at:<25} {name}")
    print("-" * 70)

def cmd_up(database_url: str):
    print("=" * 70)
    print("  TLI DPDP Applying Migrations")
    print("=" * 70)
    if not check_db_connection(database_url):
        print(f"[ERROR] Cannot connect to database at: {database_url}")
        sys.exit(1)

    applied = get_applied_migrations(database_url)
    migrations = get_migration_files()

    if not applied:
        # Pre-flight safety check: verify if database is truly clean
        code, out, err = run_psql(
            database_url,
            "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name != 'schema_migrations';"
        )
        if code == 0:
            lines = [l.strip() for l in out.strip().splitlines() if l.strip().isdigit()]
            if lines and int(lines[0]) > 0:
                print(f"[WARNING] Database contains {lines[0]} existing tables in 'public', but no 'schema_migrations' tracking table exists!")
                print("  Proceeding with initial migration sequence...")

    pending_count = 0
    for version, name, filepath in migrations:
        checksum = compute_checksum(filepath)
        if version in applied:
            recorded_checksum = applied[version]["checksum"]
            if recorded_checksum != checksum:
                print(f"[WARNING] Migration {name} checksum mismatch!")
                print(f"  Recorded: {recorded_checksum}")
                print(f"  Current:  {checksum}")
            continue

        print(f"Applying migration: {name} ... ", end="", flush=True)
        code, out, err = run_psql_file(database_url, filepath)
        if code != 0:
            print("FAILED!")
            print("\nError Details:")
            print(err or out)
            sys.exit(1)

        # Record migration in schema_migrations
        record_sql = f"""
        INSERT INTO schema_migrations (version, name, checksum, applied_at)
        VALUES ('{version}', '{name}', '{checksum}', CURRENT_TIMESTAMP)
        ON CONFLICT (version) DO UPDATE SET checksum = EXCLUDED.checksum, applied_at = EXCLUDED.applied_at;
        """
        rcode, rout, rerr = run_psql(database_url, record_sql)
        if rcode != 0:
            print(f"FAILED to record migration in schema_migrations: {rerr}")
            sys.exit(1)

        print("OK")
        pending_count += 1

    if pending_count == 0:
        print("Database schema is already up to date. Zero pending migrations.")
    else:
        print(f"Successfully applied {pending_count} migrations.")

def cmd_verify(database_url: str):
    print("=" * 70)
    print("  TLI DPDP Migration Checksum Verification")
    print("=" * 70)
    if not check_db_connection(database_url):
        print(f"[ERROR] Cannot connect to database at: {database_url}")
        sys.exit(1)

    applied = get_applied_migrations(database_url)
    migrations = get_migration_files()

    all_matched = True
    for version, name, filepath in migrations:
        checksum = compute_checksum(filepath)
        if version not in applied:
            print(f"[PENDING]   {name}")
            all_matched = False
            continue

        recorded = applied[version]["checksum"]
        if recorded == checksum:
            print(f"[VERIFIED]  {name} (SHA-256 match)")
        else:
            print(f"[MISMATCH]  {name}")
            print(f"            Recorded: {recorded}")
            print(f"            Disk:     {checksum}")
            all_matched = False

    if all_matched:
        print("\nAll applied migrations match their disk checksums exactly.")
    else:
        print("\nOne or more migrations have discrepancies or are unapplied.")

def main():
    parser = argparse.ArgumentParser(description="TLI DPDP Migration Runner")
    parser.add_argument("command", choices=["status", "up", "verify"], help="Migration action")
    parser.add_argument("--database-url", default=os.environ.get("DATABASE_URL", ""),
                        help="PostgreSQL connection URL (or set DATABASE_URL env var)")
    args = parser.parse_args()

    db_url = args.database_url
    if not db_url:
        print("[ERROR] DATABASE_URL must be specified via --database-url or environment variable.")
        print("Example: python3 scripts/migrate.py status --database-url=postgresql://user:pass@localhost:5432/dpdp_db")
        sys.exit(1)

    if args.command == "status":
        cmd_status(db_url)
    elif args.command == "up":
        cmd_up(db_url)
    elif args.command == "verify":
        cmd_verify(db_url)

if __name__ == "__main__":
    main()

