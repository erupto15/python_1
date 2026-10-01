#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

"$ROOT/scripts/sync-android-assets.sh"

cd android-app
chmod +x gradlew
./gradlew assembleRelease --no-daemon

APK="app/build/outputs/apk/release/app-release.apk"
if [[ ! -f "$APK" ]]; then
  APK="app/build/outputs/apk/release/app-release-unsigned.apk"
fi

if [[ -f "$APK" ]]; then
  OUT="$ROOT/dist"
  mkdir -p "$OUT"
  VER="$(grep "versionName" app/build.gradle | head -1 | sed -n "s/.*versionName '\([^']*\)'.*/\1/p")"
  NAME="6a9a-guide-$(date +%Y%m%d)-v${VER:-unknown}.apk"
  cp "$APK" "$OUT/$NAME"
  echo ""
  echo "APK: $OUT/$NAME"
else
  echo "APK not found under app/build/outputs/apk/release/" >&2
  exit 1
fi
