# Self-hosting CloudE5

CloudE5 runs as one container with a persistent data volume. All state lives in that volume:

| Path in container | Contents |
|---|---|
| `/data/db/cloude5.db` | SQLite database (plus `-wal`/`-shm` files while running) |
| `/data/evidence/` | Uploaded evidence files |
| `/data/backups/` | Backups written by the backup commands |

Nothing else needs to be backed up. The container's own filesystem is read-only.

## When SQLite is the right choice

SQLite in WAL mode comfortably serves a single application server with dozens of concurrent users
and many organisations. Choose a different database only if you need several application servers
behind a load balancer, or sustained write loads far beyond interactive use. Never put the database
on a network filesystem (NFS, SMB) or share one file between servers.

## 1. Requirements

- Linux server (x86_64 or arm64) with Docker Engine and the Compose plugin
- A DNS name pointing at the server (for HTTPS)
- An SMTP account for transactional email (verification, password reset, invitations)
- 2 GB RAM and enough disk for evidence plus backups

## 2. Install

```bash
git clone <your CloudE5 repository> cloude5 && cd cloude5
cp .env.example .env
openssl rand -base64 48        # paste as SESSION_SECRET
nano .env                      # set CLOUDE5_PUBLIC_URL, SESSION_SECRET and SMTP_* values
docker compose build
docker compose run --rm cloude5 migrate
docker compose run --rm cloude5 admin:create --email=you@example.com --name="Your Name"
```

`admin:create` writes a generated password to `/data/cloude5-admin-credentials.txt` inside the
volume (mode 0600). Read it once, sign in, and delete it:

```bash
docker compose run --rm cloude5 cat /data/cloude5-admin-credentials.txt
docker compose run --rm cloude5 rm /data/cloude5-admin-credentials.txt
```

To choose the password yourself instead, run `admin:create` with `-e CLOUDE5_ADMIN_PASSWORD=...`
(minimum 14 characters).

## 3. Start with HTTPS

The bundled Caddy proxy obtains certificates automatically:

```bash
CLOUDE5_DOMAIN=cloude5.example.com docker compose --profile proxy up -d
```

Or run your own reverse proxy (nginx, Traefik) and forward to `127.0.0.1:3000`, preserving the
`Host` header and setting `X-Forwarded-Proto`. HTTPS is required in production: session cookies are
marked `Secure` and will not be sent over plain HTTP. Allow request bodies of at least 55 MB for
evidence uploads.

Without the proxy profile:

```bash
docker compose up -d
```

## 4. Verify

```bash
curl -fsS https://cloude5.example.com/api/health    # database reachable
curl -fsS https://cloude5.example.com/api/ready     # migrations, storage, configuration
docker compose run --rm cloude5 verify               # integrity and foreign key checks
docker compose logs -f cloude5
```

`/api/ready` reports `not_ready` if SMTP or required settings are missing; registration cannot work
without email.

## Configuration reference

| Variable | Required | Purpose |
|---|---|---|
| `CLOUDE5_PUBLIC_URL` | yes | Public base URL used in email links and same-origin checks |
| `SESSION_SECRET` | yes | ≥ 32 random characters; changing it signs everyone out |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | yes | Email delivery |
| `CLOUDE5_DATABASE_PATH` | set by image | SQLite file (`/data/db/cloude5.db`) |
| `CLOUDE5_EVIDENCE_DIR` | set by image | Evidence directory (`/data/evidence`) |
| `TRUST_CLOUDFLARE_IP_HEADER` | no | `true` only if Cloudflare fronts the server |

## Backups

Back up the database **and** the evidence directory together.

```bash
docker compose exec cloude5 cloude5-entrypoint backup-all
```

This writes `/data/backups/cloude5-<timestamp>.db` (a consistent online snapshot, integrity-checked,
mode 0600) and `/data/backups/evidence-<timestamp>.tar.gz`. Schedule it, for example nightly with
cron on the host:

```cron
15 2 * * * cd /opt/cloude5 && docker compose exec -T cloude5 cloude5-entrypoint backup-all >> /var/log/cloude5-backup.log 2>&1
```

Copy backups off the server (they contain all customer data; encrypt them in transit and at rest),
and prune old ones. A reasonable policy is 14 daily and 8 weekly copies. Test a restore regularly.

Every upgrade also writes `/data/db/backups/pre-migration-<timestamp>.db` automatically before
changing the schema.

## Restore

```bash
docker compose stop cloude5
docker compose run --rm cloude5 restore /data/backups/cloude5-<timestamp>.db --confirm
docker compose run --rm cloude5 sh -c 'rm -rf /data/evidence && mkdir -p /data/evidence && tar -C /data -xzf /data/backups/evidence-<timestamp>.tar.gz'
docker compose run --rm cloude5 migrate
docker compose up -d
```

`restore` verifies the backup's integrity and keeps a copy of the current database as
`pre-restore-<timestamp>.db` before replacing it. Restore the evidence archive from the same
timestamp as the database.

## Upgrade

```bash
docker compose run --rm cloude5 backup-all     # extra safety copy
git pull
docker compose build
docker compose stop cloude5
docker compose run --rm cloude5 migrate        # backs up automatically before applying migrations
docker compose up -d
```

The application refuses to start while migrations are pending, so an upgrade can never run new code
against an old schema.

## Roll back

If an upgrade misbehaves:

```bash
docker compose stop cloude5
git checkout <previous release tag> && docker compose build
docker compose run --rm cloude5 restore /data/db/backups/pre-migration-<timestamp>.db --confirm
docker compose up -d
```

A database migrated by a newer release is refused by an older release (it will not silently
downgrade); always restore the pre-migration backup when rolling back across migrations.

## Operations reference

| Command (`docker compose run --rm cloude5 …`) | Purpose |
|---|---|
| `migrate` | Create or upgrade the database |
| `status` | List applied and pending migrations |
| `verify` | Integrity check, foreign keys, migration checksums |
| `backup [file]` | Database backup |
| `backup-all` | Database backup plus evidence archive |
| `restore <file> --confirm` | Restore a database backup (stop the app first) |
| `verify-email <email> --confirm` | Mark an address verified when email is unavailable (confirm the address out of band first) |
| `admin:create --email=… --name="…" [--reset-password]` | Create the platform administrator, or reset its password |

## Migrating from the PostgreSQL deployment

Earlier versions stored data in PostgreSQL (Neon). To move that data into a new CloudE5 installation:

1. Create a branch or copy of the source database and test against it first.
2. On a new installation, run the import **instead of** the first `migrate` (it creates and migrates
   the database itself and refuses to overwrite an existing one):

   ```bash
   docker compose run --rm -e SOURCE_DATABASE_URL='postgresql://…' cloude5 \
     npm run db:import-postgres -- --report=/data/import-report.json
   ```

3. Review `/data/import-report.json`: per-table source and imported row counts, foreign key and integrity
   results. It contains no credentials or password hashes.

The import opens the source read-only, runs in one transaction, and rolls back completely on any
count mismatch or integrity failure. Existing accounts keep their passwords and are treated as
verified.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Container exits: "no database found" | The volume is not mounted or `migrate` was never run. Check `docker compose config`, then run `migrate`. CloudE5 never creates an empty database implicitly. |
| "Database schema is not up to date" | Run `migrate` after upgrading. |
| "Applied migrations differ from this release's files" | A migration file was edited. Restore the original files from the release. |
| Users cannot sign in after registering | Email verification is required. Check SMTP settings and `/api/ready`; as a fallback use `verify-email`. |
| Sign-in works but you are immediately signed out | The site is served over plain HTTP; serve it over HTTPS. |
| "Cross-site request rejected" | The browser's origin does not match. Set `CLOUDE5_PUBLIC_URL` to the exact public URL and make the proxy forward `Host`. |
| "The database is busy" | A long operation held the database. Retry; persistent occurrences indicate a stuck process — restart the container. |
