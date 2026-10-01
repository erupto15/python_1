#!/usr/bin/env bash
# Копирует текущий frontend Mini App в android-app assets (без backend и медиа).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/climbing-guidebook"
DST="$ROOT/android-app/app/src/main/assets/guidebook"

rm -rf "$DST"
mkdir -p "$DST/icons"

copy_file() {
  local f="$1"
  if [[ -f "$SRC/$f" ]]; then
    cp "$SRC/$f" "$DST/$f"
  fi
}

for f in index.html app.js boot.js styles.css sw.js map-tiles.js telegram-web-app.js; do
  copy_file "$f"
done

if [[ -d "$SRC/icons" ]]; then
  cp -R "$SRC/icons/." "$DST/icons/"
fi

if [[ -d "$SRC/vendor" ]]; then
  mkdir -p "$DST/vendor"
  cp -R "$SRC/vendor/." "$DST/vendor/"
fi

echo "Synced guidebook assets -> $DST"
find "$DST" -type f | wc -l | xargs echo "Files:"
