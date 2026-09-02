#!/usr/bin/env bash
# Delete Timeweb Managed PostgreSQL, its floating IP, and the unused S3 bucket.
# Dry-run by default. Requires TIMEWEB_TOKEN. Does not print secrets.
#
# Usage:
#   TIMEWEB_TOKEN=... bash scripts/teardown-managed-timeweb.sh
#   TIMEWEB_TOKEN=... CONFIRM=yes bash scripts/teardown-managed-timeweb.sh
set -euo pipefail

if [ -z "${TIMEWEB_TOKEN:-}" ] && [ -f "${ROOT_ENV:-.env}" ]; then
  # shellcheck disable=SC1090
  set -a
  source "${ROOT_ENV:-.env}"
  set +a
fi

if [ -z "${TIMEWEB_TOKEN:-}" ]; then
  echo "TIMEWEB_TOKEN is required." >&2
  exit 1
fi

API="${TIMEWEB_API:-https://api.timeweb.cloud}"
AUTH_HEADER="Authorization: Bearer ${TIMEWEB_TOKEN}"
CONFIRM="${CONFIRM:-}"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

get() {
  local path="$1"
  local out="$2"
  local code
  code="$(curl -sS -o "$out" -w '%{http_code}' -H "$AUTH_HEADER" "${API}${path}")"
  if [ "$code" != "200" ]; then
    echo "GET ${path} -> HTTP ${code}" >&2
    head -c 400 "$out" >&2 || true
    echo >&2
    return 1
  fi
}

delete() {
  local path="$1"
  local code
  code="$(curl -sS -o "$tmp/delete.json" -w '%{http_code}' -X DELETE -H "$AUTH_HEADER" "${API}${path}")"
  echo "DELETE ${path} -> HTTP ${code}"
  if [ "$code" != "200" ] && [ "$code" != "204" ] && [ "$code" != "202" ]; then
    head -c 400 "$tmp/delete.json" || true
    echo
    return 1
  fi
}

get /api/v1/dbs "$tmp/dbs.json"
get /api/v1/storages/buckets "$tmp/buckets.json"
get /api/v1/floating-ips "$tmp/ips.json"

python3 - "$tmp" <<'PY'
import json, sys
from pathlib import Path

root = Path(sys.argv[1])
dbs = json.loads((root / "dbs.json").read_text()).get("dbs") or json.loads((root / "dbs.json").read_text()).get("databases") or []
buckets = json.loads((root / "buckets.json").read_text()).get("buckets") or []
ips = json.loads((root / "ips.json").read_text()).get("ips") or json.loads((root / "ips.json").read_text()).get("floating_ips") or []

db_ids = []
bucket_ids = []
ip_ids = []

print("Managed databases:")
for db in dbs:
    ident = db.get("id")
    name = db.get("name") or db.get("login") or ""
    db_type = db.get("type") or db.get("hash_type") or ""
    print(f"  id={ident} name={name} type={db_type}")
    if ident is not None:
        db_ids.append(str(ident))

print("S3 buckets:")
for bucket in buckets:
    ident = bucket.get("id")
    name = bucket.get("name") or bucket.get("full_name") or ""
    used = ((bucket.get("disk_stats") or [{}])[0] if isinstance(bucket.get("disk_stats"), list) else bucket.get("disk_stats") or {})
    used_kb = used.get("used") if isinstance(used, dict) else None
    print(f"  id={ident} name={name} used_kb={used_kb}")
    if ident is not None:
        bucket_ids.append(str(ident))

print("Floating IPs:")
for ip in ips:
    ident = ip.get("id")
    address = ip.get("ip") or ip.get("address") or ""
    comment = ip.get("comment") or ip.get("resource_type") or ip.get("type") or ""
    print(f"  id={ident} ip={address} {comment}")
    # Keep the VPS public IP; drop IPs attached to databases.
    resource = str(ip.get("resource_type") or ip.get("type") or comment or "").lower()
    if "db" in resource or "database" in resource or "postgres" in resource:
        if ident is not None:
            ip_ids.append(str(ident))

(root / "db_ids").write_text("\n".join(db_ids) + ("\n" if db_ids else ""))
(root / "bucket_ids").write_text("\n".join(bucket_ids) + ("\n" if bucket_ids else ""))
(root / "ip_ids").write_text("\n".join(ip_ids) + ("\n" if ip_ids else ""))
PY

echo
if [ "$CONFIRM" != "yes" ]; then
  echo "Dry run. Re-run with CONFIRM=yes after 24-48h on local Postgres."
  echo "This will delete every managed DB and S3 bucket on the account, plus DB floating IPs."
  exit 0
fi

while IFS= read -r bucket_id; do
  [ -z "$bucket_id" ] && continue
  delete "/api/v1/storages/buckets/${bucket_id}"
done < "$tmp/bucket_ids"

while IFS= read -r db_id; do
  [ -z "$db_id" ] && continue
  delete "/api/v1/dbs/${db_id}"
done < "$tmp/db_ids"

while IFS= read -r ip_id; do
  [ -z "$ip_id" ] && continue
  delete "/api/v1/floating-ips/${ip_id}"
done < "$tmp/ip_ids"

echo "teardown requests sent"
