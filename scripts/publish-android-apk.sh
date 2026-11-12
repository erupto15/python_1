#!/usr/bin/env bash
# Собирает APK и публикует его как GitHub Release (тег android-v<versionName>).
# Сервер (/api/app/version) находит релиз, а установленные APK скачивают обновление сами.
# Перед запуском поднимите versionCode и versionName в android-app/app/build.gradle.
#
# Использование: scripts/publish-android-apk.sh ["Что нового"]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GRADLE="android-app/app/build.gradle"
VER="$(sed -n "s/.*versionName '\([^']*\)'.*/\1/p" "$GRADLE" | head -1)"
CODE="$(sed -n 's/.*versionCode \([0-9][0-9]*\).*/\1/p' "$GRADLE" | head -1)"
TAG="android-v${VER}"
NOTES="${1:-Обновление 6А9А ${VER}}"

if [[ -z "$VER" || -z "$CODE" ]]; then
  echo "Не удалось прочитать versionName/versionCode из $GRADLE" >&2
  exit 1
fi

if gh release view "$TAG" >/dev/null 2>&1; then
  echo "Релиз $TAG уже существует — поднимите versionCode/versionName в $GRADLE" >&2
  exit 1
fi

"$ROOT/scripts/build-android-apk.sh"

SRC_APK="android-app/app/build/outputs/apk/release/app-release.apk"
if [[ ! -f "$SRC_APK" ]]; then
  SRC_APK="android-app/app/build/outputs/apk/release/app-release-unsigned.apk"
fi
OUT="$ROOT/dist/6a9a-guide-v${VER}-c${CODE}.apk"
cp "$SRC_APK" "$OUT"

gh release create "$TAG" "$OUT" \
  --target main \
  --title "Android ${VER}" \
  --notes "$NOTES"

echo ""
echo "Опубликовано: $TAG ($OUT)"
echo "Установленные приложения получат обновление в течение ~5 минут (кэш сервера)."
