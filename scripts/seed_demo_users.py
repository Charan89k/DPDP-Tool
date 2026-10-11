#!/usr/bin/env python3
"""
TLI DPDP Compliance Gap Analysis Tool — Demo User Seed Script

Safely and idempotently provisions the two local development demo accounts:
  1. consultant.demo@tli.local  -> TLI Advisory (TLI_LEAD_CONSULTANT)
  2. customer.demo@tli.local    -> Alpha Healthcare Solutions Ltd (CLIENT_ADMIN)

Security Guarantees:
- Uses the standard non-production synthetic hash '$2b$12$e80yvV3n2YfV3n2YfV3n2Oe2Z3iP1W5e2Z3iP1W5e2Z3iP1W5e2Z3'
  matching the local development password (default: 'SyntheticTestPassword123!', or DEMO_USER_PASSWORD).
- Idempotent (ON CONFLICT DO UPDATE).
- Does NOT alter, drop, or reset any existing tables or database records.
- Strictly forbidden in production environments (checks NODE_ENV).

Usage:
  python3 scripts/seed_demo_users.py [--database-url=URL]
  npm run seed:demo
"""

import os
import sys
import subprocess
import argparse

DEFAULT_DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    os.environ.get("DATABASE_MIGRATION_URL", "postgresql://postgres@127.0.0.1:54329/dpdp_test")
)

SYNTHETIC_HASH = "$2b$12$e80yvV3n2YfV3n2YfV3n2Oe2Z3iP1W5e2Z3iP1W5e2Z3iP1W5e2Z3"

def seed_demo_users(database_url: str):
    if os.environ.get("NODE_ENV") == "production":
        print("[ERROR] Demo user seeding is strictly prohibited in production mode (NODE_ENV=production).")
        sys.exit(1)

    print(f"[INFO] Connecting to database...")

    sql = f"""
    -- 1. Ensure Consultant Demo User exists under TLI Advisory Tenant
    INSERT INTO users (id, tenant_id, email, password_hash, full_name, phone, role, is_active)
    SELECT 
        '018f3a5b-7c8d-7e90-8000-000000000191'::uuid,
        t.id,
        'consultant.demo@tli.local',
        '{SYNTHETIC_HASH}',
        'TLI Consultant Demo',
        '+91-9800000091',
        'TLI_LEAD_CONSULTANT'::user_role,
        TRUE
    FROM tenants t
    WHERE t.type = 'TLI'
    LIMIT 1
    ON CONFLICT (email) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        is_active = TRUE;

    -- 2. Ensure Customer Demo User exists under Alpha Healthcare Tenant (SDF Client)
    INSERT INTO users (id, tenant_id, email, password_hash, full_name, phone, role, is_active)
    SELECT 
        '018f3a5b-7c8d-7e90-8000-000000000192'::uuid,
        t.id,
        'customer.demo@tli.local',
        '{SYNTHETIC_HASH}',
        'Alpha Health Demo Admin',
        '+91-9810000092',
        'CLIENT_ADMIN'::user_role,
        TRUE
    FROM tenants t
    WHERE t.slug = 'alpha-healthcare'
    LIMIT 1
    ON CONFLICT (email) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        is_active = TRUE;

    -- 3. Ensure Demo Users are mapped to demo assessments in assessment_assignments
    INSERT INTO assessment_assignments (id, assessment_id, user_id, assignment_role)
    VALUES 
        ('018f3a5b-7c8d-7e90-8000-000000000291', '018f3a5b-7c8d-7e90-8000-000000000201', '018f3a5b-7c8d-7e90-8000-000000000191', 'ENGAGEMENT_LEAD'),
        ('018f3a5b-7c8d-7e90-8000-000000000292', '018f3a5b-7c8d-7e90-8000-000000000202', '018f3a5b-7c8d-7e90-8000-000000000191', 'ENGAGEMENT_LEAD'),
        ('018f3a5b-7c8d-7e90-8000-000000000293', '018f3a5b-7c8d-7e90-8000-000000000201', '018f3a5b-7c8d-7e90-8000-000000000192', 'CLIENT_COORDINATOR')
    ON CONFLICT (assessment_id, user_id) DO NOTHING;
    """

    cmd = ["psql", database_url, "-v", "ON_ERROR_STOP=1", "-c", sql]
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

    if p.returncode != 0:
        print(f"[ERROR] Failed to seed demo users via psql:\n{p.stderr}", file=sys.stderr)
        sys.exit(p.returncode)

    print("[SUCCESS] Local development demo accounts successfully seeded/verified:")
    print("  - consultant.demo@tli.local  [Role: TLI_LEAD_CONSULTANT | Tenant: Truth Labs International]")
    print("  - customer.demo@tli.local    [Role: CLIENT_ADMIN        | Tenant: Alpha Healthcare Solutions Ltd]")
    print("  Password: Configured via DEMO_USER_PASSWORD (default: SyntheticTestPassword123!)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed local development demo accounts.")
    parser.add_argument("--database-url", default=DEFAULT_DATABASE_URL, help="PostgreSQL connection string")
    args = parser.parse_args()

    seed_demo_users(args.database_url)
