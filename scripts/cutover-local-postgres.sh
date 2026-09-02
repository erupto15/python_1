#!/usr/bin/env bash
# One-shot: dump the current DATABASE_URL (managed PostgreSQL) into Postgres
# on this VPS, then point /etc/guide-rus/backend.env at 127.0.0.1.
#
# After success, copy DATABASE_URL from backend.env into GitHub secret
# DATABASE_URL before the next Deploy to Timeweb run.
set -euo pipefail

BACKEND_ENV="${BACKEND_ENV:-/etc/guide-rus/backend.env}"
BACKUP_DIR="${BACKUP_DIR:-/var/lib/guide-rus/pg-backups}"
LOCAL_URL_FILE="${LOCAL_URL_FILE:-/etc/guide-rus/local-database.url}"
APP_DIR="${APP_DIR:-/opt/guide-rus/current}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PG_URL_PY="${SCRIPT_DIR}/pg_url.py"
LOCAL_USER="${LOCAL_PG_USER:-guide_rus}"
LOCAL_DB="${LOCAL_PG_DB:-guide_rus}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root on the VPS." >&2
  exit 1
fi

if [ ! -f "$BACKEND_ENV" ]; then
  echo "missing $BACKEND_ENV" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$BACKEND_ENV"
set +a

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is empty in backend.env" >&2
  exit 1
fi

if python3 "$PG_URL_PY" is-local --url "$DATABASE_URL"; then
  echo "DATABASE_URL already points at localhost; nothing to cut over."
  python3 "$PG_URL_PY" json --url "$DATABASE_URL"
  exit 0
fi

bash "$SCRIPT_DIR/install-local-postgres.sh"

install -d -m 700 "$BACKUP_DIR"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
dump_file="${BACKUP_DIR}/cutover-from-managed-${stamp}.dump"

source_libpq="$(python3 "$PG_URL_PY" libpq --url "$DATABASE_URL")"
echo "dumping managed PostgreSQL to $dump_file"
systemctl stop guide-rus-backend
trap 'systemctl start guide-rus-backend || true' ERR

pg_dump --format=custom --no-owner --file="$dump_file" "$source_libpq"
chmod 600 "$dump_file"

if [ -f "$LOCAL_URL_FILE" ]; then
  local_sqlalchemy="$(cat "$LOCAL_URL_FILE")"
else
  local_password="$(openssl rand -hex 24)"
  local_sqlalchemy="$(
    python3 - <<PY
import importlib.util
from pathlib import Path
spec = importlib.util.spec_from_file_location("pg_url", Path(r"${PG_URL_PY}"))
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
parts = {
    "user": r"${LOCAL_USER}",
    "password": r"${local_password}",
    "host": "127.0.0.1",
    "port": 5432,
    "dbname": r"${LOCAL_DB}",
    "sslmode": "",
}
print(mod.sqlalchemy_url(parts, sslmode=""))
PY
  )"
  umask 077
  printf '%s\n' "$local_sqlalchemy" > "$LOCAL_URL_FILE"
  chmod 600 "$LOCAL_URL_FILE"
fi

DATABASE_URL="$local_sqlalchemy" bash "$SCRIPT_DIR/install-local-postgres.sh"

eval "$(
  DATABASE_URL="$local_sqlalchemy" PG_URL_PY="$PG_URL_PY" python3 - <<'PY'
import os, shlex, importlib.util
from pathlib import Path
spec = importlib.util.spec_from_file_location("pg_url", Path(os.environ["PG_URL_PY"]))
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
parts = mod.parse_db_url(os.environ["DATABASE_URL"])
print("PG_USER=" + shlex.quote(str(parts["user"])))
print("PG_DBNAME=" + shlex.quote(str(parts["dbname"])))
PY
)"

sudo -u postgres psql -v ON_ERROR_STOP=1 --set=pg_dbname="$PG_DBNAME" <<'SQL'
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = :'pg_dbname'
  AND pid <> pg_backend_pid();
SQL

# Restore into an empty database so the cutover is repeatable if it failed mid-way.
sudo -u postgres psql -v ON_ERROR_STOP=1 \
  --set=pg_user="$PG_USER" \
  --set=pg_dbname="$PG_DBNAME" <<'SQL'
SELECT format('DROP DATABASE IF EXISTS %I', :'pg_dbname')\gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'pg_dbname', :'pg_user')\gexec
SQL

sudo -u postgres pg_restore --no-owner --no-acl --exit-on-error --dbname="$PG_DBNAME" "$dump_file"
sudo -u postgres psql -v ON_ERROR_STOP=1 \
  --set=pg_user="$PG_USER" \
  --set=pg_dbname="$PG_DBNAME" <<'SQL'
SELECT format('GRANT ALL ON SCHEMA public TO %I', :'pg_user')\gexec
SELECT format('GRANT ALL ON ALL TABLES IN SCHEMA public TO %I', :'pg_user')\gexec
SELECT format('GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO %I', :'pg_user')\gexec
SELECT format('ALTER DATABASE %I OWNER TO %I', :'pg_dbname', :'pg_user')\gexec
SQL

python3 "$PG_URL_PY" overlay --url "$local_sqlalchemy" --env-file "$BACKEND_ENV"
chmod 600 "$BACKEND_ENV"

trap - ERR
systemctl start guide-rus-backend

ok=0
body=""
for attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do
  if body="$(curl -fsS --max-time 10 http://127.0.0.1:8000/health 2>/dev/null)"; then
    ok=1
    break
  fi
  echo "waiting for backend health (attempt ${attempt}/12)…" >&2
  sleep 2
done
if [ "$ok" -ne 1 ]; then
  echo "backend did not become healthy after cutover" >&2
  systemctl status guide-rus-backend --no-pager || true
  journalctl -u guide-rus-backend -n 80 --no-pager || true
  exit 1
fi

HEALTH_JSON="$body" python3 - <<'PY'
import json, os, sys
body = json.loads(os.environ["HEALTH_JSON"])
if body.get("status") != "ok":
    sys.exit("health status is not ok")
if body.get("database") != "postgresql":
    sys.exit(f"expected postgresql, got {body.get('database')!r}")
host = str(body.get("database_host") or "")
if host not in {"127.0.0.1", "localhost"}:
    sys.exit(f"expected database_host 127.0.0.1, got {host!r}")
if not body.get("persistent_storage"):
    sys.exit("persistent_storage is false")
counts = body.get("catalog_counts") or {}
total = sum(int(counts.get(k) or 0) for k in ("areas", "sectors", "routes", "boulders"))
print(
    "cutover ok:",
    f"host={host}",
    f"areas={counts.get('areas')}",
    f"sectors={counts.get('sectors')}",
    f"routes={counts.get('routes')}",
    f"boulders={counts.get('boulders')}",
    f"photos={counts.get('photos')}",
)
if total == 0:
    sys.exit("catalog is empty after restore")
PY

echo
echo "Cutover complete."
echo "Update GitHub secret DATABASE_URL from $BACKEND_ENV (or $LOCAL_URL_FILE)"
echo "before the next Deploy to Timeweb run, otherwise GitHub will write the old managed URL."
echo "Keep Timeweb Managed PostgreSQL and S3 for 24-48h as rollback."
