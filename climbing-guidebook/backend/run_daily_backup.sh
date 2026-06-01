#!/usr/bin/env bash
# Ежедневный локальный бэкап Supabase/PostgreSQL (для cron или launchd).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.venv/bin/activate" ]]; then
  # shellcheck source=/dev/null
  source "$ROOT/.venv/bin/activate"
fi

export BACKUP_DIR="${BACKUP_DIR:-$ROOT/data/backups}"
export BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"

LOG_DIR="$ROOT/data/backups/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/backup-$(date -u +%Y-%m-%d).log"

{
  echo "=== $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
  python3 "$ROOT/backup_supabase_daily.py"
} >>"$LOG_FILE" 2>&1
