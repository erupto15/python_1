#!/usr/bin/env bash
set -euo pipefail

ROOT_ENV=".env"
BACKEND_ENV="climbing-guidebook/backend/.env"
BACKEND_EXAMPLE="climbing-guidebook/backend/.env.example"

if [[ ! -f "$ROOT_ENV" ]]; then
  echo "Missing $ROOT_ENV. Copy .env.example to .env and fill TELEGRAM_BOT_HTTP_API_TEST." >&2
  exit 1
fi

get_env_value() {
  local key="$1"
  python3 - "$ROOT_ENV" "$key" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
key = sys.argv[2]
for raw in path.read_text().splitlines():
    stripped = raw.strip()
    if not stripped or stripped.startswith("#") or "=" not in raw:
        continue
    name, value = raw.split("=", 1)
    if name.strip() == key:
        print(value.strip().strip('"').strip("'"))
        break
PY
}

TEST_BOT_TOKEN="$(get_env_value TELEGRAM_BOT_HTTP_API_TEST)"
if [[ -z "$TEST_BOT_TOKEN" ]]; then
  echo "TELEGRAM_BOT_HTTP_API_TEST is empty in $ROOT_ENV." >&2
  exit 1
fi

cp "$BACKEND_EXAMPLE" "$BACKEND_ENV"
python3 - "$BACKEND_ENV" "$TEST_BOT_TOKEN" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
token = sys.argv[2]
lines = []
seen = False
for raw in path.read_text().splitlines():
    if raw.startswith("TELEGRAM_BOT_TOKEN="):
        lines.append(f"TELEGRAM_BOT_TOKEN={token}")
        seen = True
    else:
        lines.append(raw)
if not seen:
    lines.append(f"TELEGRAM_BOT_TOKEN={token}")
path.write_text("\n".join(lines).rstrip() + "\n")
PY

echo "Created $BACKEND_ENV for local development."
echo "Local backend will use SQLite and TELEGRAM_BOT_HTTP_API_TEST as TELEGRAM_BOT_TOKEN."
