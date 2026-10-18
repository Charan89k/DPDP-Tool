# CloudE5

CloudE5 is a self-hostable, multi-tenant platform for assessing an organisation's readiness for
India's **Digital Personal Data Protection Act, 2023 (DPDP Act)**. Organisations register, answer a
guided 60-question assessment mapped to a documented control library, attach supporting evidence,
and receive an explainable gap register, provisional readiness metrics, and a corrective action plan.

> CloudE5 is a self-assessment tool. Its results are generated from the information an organisation
> provides using a documented, provisional methodology. They are not legal advice and are not a
> determination of compliance with the DPDP Act or the DPDP Rules.

## Features

- Organisation self-registration with email verification, password reset and invitations
- Optional two-factor sign-in (authenticator app codes and single-use recovery codes), database-backed
  rate limits, CSRF checks and strict security headers
- Role-based access: organisation administrators, business-unit leads, contributors and viewers;
  platform administrators, lead consultants and reviewers for assisted assessments
- Guided questionnaire (8 areas, 60 questions) with autosave and mandatory justification for
  "Not applicable"
- Evidence vault with type and content validation, private per-organisation storage and review states
- Deterministic gap analysis and scoring with every finding traceable to the answer and control
- Clarification threads, assessor review, report generation (.docx) and remediation (CAPA) tracking
- Tenant isolation enforced for every query (see [docs/SECURITY_MODEL.md](docs/SECURITY_MODEL.md))
- SQLite storage, Docker deployment, health/readiness probes, backup and restore commands

## Quick start (development)

Requires Node.js 22+.

```bash
npm ci
npm run db:migrate          # creates .cloude5/cloude5.db
npm run db:seed-demo        # optional synthetic demo data (never in production)
npm run dev                 # http://localhost:3000
```

Without SMTP settings, development emails (verification and reset links) are written to
`.cloude5/dev-outbox/`.

## Production

See **[docs/SELF_HOSTING.md](docs/SELF_HOSTING.md)** for installation on a Linux server with Docker,
configuration, HTTPS, backups, upgrades and troubleshooting.

## Checks

```bash
npm test          # builds a template SQLite database and runs the full test suite
npx tsc --noEmit  # type check
npm run lint      # ESLint
npm run build     # production build
```

## Repository layout

| Path | Contents |
|---|---|
| `app/` | Next.js App Router pages and API routes |
| `components/` | UI components |
| `lib/db/sqlite/` | SQLite connection, query client, tenant policy layer, migrations runner |
| `lib/auth/`, `lib/organization/`, `lib/onboarding/` | Accounts, sessions, organisations, invitations |
| `lib/scoring/`, `lib/gaps/`, `lib/lifecycle/`, `lib/reports/`, `lib/remediation/` | Assessment methodology |
| `migrations/sqlite/` | Versioned SQLite migrations (never edit an applied migration) |
| `migrations/postgres/` | Historical PostgreSQL migrations (reference and data import only) |
| `data/` | Canonical control library, evidence catalogue and questionnaire |
| `scripts/` | Operations CLI, admin bootstrap, PostgreSQL import, test database preparation |
| `deploy/` | Container entrypoint and Caddy configuration |
| `docs/` | Methodology, legal source register and design history |
