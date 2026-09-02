#!/usr/bin/env bash
# Idempotent: install PostgreSQL on this VPS, bind it to localhost, and
# (when DATABASE_URL already points at 127.0.0.1) ensure role + database exist.
set -euo pipefail

BACKEND_ENV="${BACKEND_ENV:-/etc/guide-rus/backend.env}"
BACKUP_DIR="${BACKUP_DIR:-/var/lib/guide-rus/pg-backups}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PG_URL_PY="${SCRIPT_DIR}/pg_url.py"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y postgresql postgresql-contrib postgresql-client

install -d -m 750 -g postgres "$BACKUP_DIR"
chmod 750 "$BACKUP_DIR"
chgrp postgres "$BACKUP_DIR" 2>/dev/null || true

preset_url="${DATABASE_URL:-}"
if [ -f "$BACKEND_ENV" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$BACKEND_ENV"
  set +a
fi
if [ -n "$preset_url" ]; then
  DATABASE_URL="$preset_url"
fi

python3 - <<'PY'
from pathlib import Path
import glob

paths = glob.glob("/etc/postgresql/*/main/postgresql.conf")
if not paths:
    raise SystemExit("postgresql.conf not found")
for path in paths:
    text = Path(path).read_text(encoding="utf-8")
    lines = []
    seen = False
    for line in text.splitlines(keepends=True):
        stripped = line.lstrip()
        if stripped.startswith("listen_addresses"):
            lines.append("listen_addresses = 'localhost'\n")
            seen = True
        else:
            lines.append(line)
    if not seen:
        lines.append("\nlisten_addresses = 'localhost'\n")
    Path(path).write_text("".join(lines), encoding="utf-8")
    print(f"set listen_addresses=localhost in {path}")
PY

systemctl enable --now postgresql
systemctl restart postgresql
systemctl is-active --quiet postgresql

ensure_ident() {
  local value="$1"
  local label="$2"
  if [[ ! "$value" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
    echo "Refusing unsafe PostgreSQL ${label}: ${value}" >&2
    exit 1
  fi
}

if [ -n "${DATABASE_URL:-}" ] && python3 "$PG_URL_PY" is-local --url "$DATABASE_URL"; then
  eval "$(
    DATABASE_URL="$DATABASE_URL" PG_URL_PY="$PG_URL_PY" python3 - <<'PY'
import os, shlex, importlib.util
from pathlib import Path
spec = importlib.util.spec_from_file_location("pg_url", Path(os.environ["PG_URL_PY"]))
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
parts = mod.parse_db_url(os.environ["DATABASE_URL"])
print("PG_USER=" + shlex.quote(str(parts["user"])))
print("PG_PASSWORD=" + shlex.quote(str(parts["password"])))
print("PG_DBNAME=" + shlex.quote(str(parts["dbname"])))
PY
  )"
  ensure_ident "$PG_USER" "user"
  ensure_ident "$PG_DBNAME" "database"

  sudo -u postgres psql -v ON_ERROR_STOP=1 \
    --set=pg_user="$PG_USER" \
    --set=pg_password="$PG_PASSWORD" \
    --set=pg_dbname="$PG_DBNAME" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'pg_user', :'pg_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'pg_user')\gexec
SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', :'pg_user', :'pg_password')
WHERE EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'pg_user')\gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'pg_dbname', :'pg_user')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'pg_dbname')\gexec
SQL
  echo "local PostgreSQL role and database ensured"
else
  echo "DATABASE_URL is not local; PostgreSQL is installed and waiting for cutover"
fi

install -d -m 755 /usr/local/lib/guide-rus
install -m 755 "$SCRIPT_DIR/backup-local-postgres.sh" /usr/local/lib/guide-rus/backup-local-postgres.sh
install -m 644 "$SCRIPT_DIR/pg_url.py" /usr/local/lib/guide-rus/pg_url.py

BACKUP_CRON="15 3 * * * /usr/local/lib/guide-rus/backup-local-postgres.sh"
(crontab -l 2>/dev/null | grep -v 'guide-rus-pg-backup\|backup-local-postgres' || true; echo "$BACKUP_CRON") | crontab -

UNIT=/etc/systemd/system/guide-rus-backend.service
if [ -f "$UNIT" ]; then
  python3 - <<'PY'
from pathlib import Path
path = Path("/etc/systemd/system/guide-rus-backend.service")
text = path.read_text(encoding="utf-8")
lines = []
for line in text.splitlines(keepends=True):
    if line.startswith("After="):
        parts = line.split("=", 1)[1].split()
        if "postgresql.service" not in parts:
            parts.append("postgresql.service")
        line = "After=" + " ".join(parts) + "\n"
    elif line.startswith("Wants="):
        parts = line.split("=", 1)[1].split()
        if "postgresql.service" not in parts:
            parts.append("postgresql.service")
        line = "Wants=" + " ".join(parts) + "\n"
    elif not line.endswith("\n"):
        line += "\n"
    lines.append(line)
path.write_text("".join(lines), encoding="utf-8")
print("systemd unit waits for postgresql.service")
PY
  systemctl daemon-reload
fi

echo "local PostgreSQL install complete"
