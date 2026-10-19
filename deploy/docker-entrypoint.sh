#!/bin/sh
# CloudE5 container entrypoint.
#   serve                       Start the web server (default). Refuses to start without a database.
#   migrate | status | verify   Database operations (see scripts/cloude5-db.ts).
#   backup [file]               Online database backup (default under /data/backups).
#   restore <file> --confirm    Restore a database backup (stop the web container first).
#   verify-email <email> --confirm   Operator override when SMTP is unavailable.
#   reset-mfa <email> --confirm      Operator override for a user locked out of two-factor.
#   backup-all                  Database backup plus an evidence archive under /data/backups.
#   admin:create --email=... --name="..."   Create the first platform administrator.
set -eu

DB_CLI="node --experimental-strip-types --disable-warning=ExperimentalWarning scripts/cloude5-db.ts"
command="${1:-serve}"
[ "$#" -gt 0 ] && shift

case "$command" in
  serve)
    if [ ! -f "$CLOUDE5_DATABASE_PATH" ]; then
      echo "CloudE5: no database found at $CLOUDE5_DATABASE_PATH." >&2
      echo "Initialise it first:  docker compose run --rm cloude5 migrate" >&2
      exit 1
    fi
    mkdir -p "$CLOUDE5_EVIDENCE_DIR"
    exec node server.js
    ;;
  migrate|status|verify|backup|restore|verify-email|reset-mfa)
    exec $DB_CLI "$command" "$@"
    ;;
  backup-all)
    stamp="$(date -u +%Y%m%dT%H%M%SZ)"
    # Backups contain every tenant's data: owner-only, like the database backup itself.
    umask 077
    mkdir -p /data/backups
    $DB_CLI backup "/data/backups/cloude5-$stamp.db"
    tar -C "$(dirname "$CLOUDE5_EVIDENCE_DIR")" -czf "/data/backups/evidence-$stamp.tar.gz" "$(basename "$CLOUDE5_EVIDENCE_DIR")"
    echo "Evidence archive written: /data/backups/evidence-$stamp.tar.gz"
    ;;
  admin:create)
    # The root filesystem is read-only; generated credentials go to the data volume.
    exec node --experimental-strip-types --disable-warning=ExperimentalWarning scripts/create-platform-admin.ts \
      "$@" --credentials-file=/data/cloude5-admin-credentials.txt
    ;;
  *)
    exec "$command" "$@"
    ;;
esac
