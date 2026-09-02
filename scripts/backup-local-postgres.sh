#!/usr/bin/env bash
# Nightly logical dump of production PostgreSQL when it lives on this VPS.
set -euo pipefail

BACKEND_ENV="${BACKEND_ENV:-/etc/guide-rus/backend.env}"
BACKUP_DIR="${BACKUP_DIR:-/var/lib/guide-rus/pg-backups}"
KEEP_DAYS="${KEEP_DAYS:-7}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PG_URL_PY="${SCRIPT_DIR}/pg_url.py"

if [ ! -f "$BACKEND_ENV" ]; then
  echo "missing $BACKEND_ENV" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$BACKEND_ENV"
set +a

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is empty" >&2
  exit 1
fi

if ! python3 "$PG_URL_PY" is-local --url "$DATABASE_URL"; then
  echo "skip backup: DATABASE_URL is not local"
  exit 0
fi

install -d -m 700 "$BACKUP_DIR"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="${BACKUP_DIR}/guide-rus-${stamp}.dump"
libpq_url="$(python3 "$PG_URL_PY" libpq --url "$DATABASE_URL" --sslmode disable)"

pg_dump --format=custom --no-owner --file="$target" "$libpq_url"
chmod 600 "$target"
find "$BACKUP_DIR" -type f -name 'guide-rus-*.dump' -mtime +"${KEEP_DAYS}" -delete
echo "wrote $target"
