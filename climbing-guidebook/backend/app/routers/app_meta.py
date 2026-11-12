from __future__ import annotations

import asyncio
import hashlib
import logging
import re
import time
from pathlib import Path
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse

from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/app", tags=["app"])

FRONTEND_ROOT = Path(__file__).resolve().parents[3]
WEB_BUILD_FILES = ("index.html", "boot.js", "app.js", "styles.css", "map-tiles.js")

ANDROID_TAG_PREFIX = "android-v"
ANDROID_APK_MEDIA_TYPE = "application/vnd.android.package-archive"
_RELEASE_CACHE_TTL_SEC = 300.0
_VERSION_CODE_RE = re.compile(r"-c(\d+)\.apk$", re.IGNORECASE)

_web_build_cache: tuple[tuple[float, ...], str] | None = None
_release_cache: tuple[float, dict[str, Any] | None] | None = None
_apk_download_lock = asyncio.Lock()


def _web_build() -> str:
    global _web_build_cache
    paths = [FRONTEND_ROOT / name for name in WEB_BUILD_FILES]
    mtimes = tuple(p.stat().st_mtime if p.is_file() else 0.0 for p in paths)
    if _web_build_cache and _web_build_cache[0] == mtimes:
        return _web_build_cache[1]
    digest = hashlib.sha256()
    for p in paths:
        if p.is_file():
            digest.update(p.read_bytes())
    build = digest.hexdigest()[:16]
    _web_build_cache = (mtimes, build)
    return build


def _parse_android_release(release: dict[str, Any]) -> dict[str, Any] | None:
    if release.get("draft") or release.get("prerelease"):
        return None
    tag = str(release.get("tag_name") or "")
    if not tag.startswith(ANDROID_TAG_PREFIX):
        return None
    for asset in release.get("assets") or []:
        name = str(asset.get("name") or "")
        match = _VERSION_CODE_RE.search(name)
        if not match:
            continue
        return {
            "version_code": int(match.group(1)),
            "version_name": tag[len(ANDROID_TAG_PREFIX):],
            "asset_name": name,
            "size": int(asset.get("size") or 0),
            "download_url": str(asset.get("browser_download_url") or ""),
            "notes": str(release.get("body") or "").strip()[:2000],
        }
    return None


async def _latest_android_release() -> dict[str, Any] | None:
    global _release_cache
    now = time.monotonic()
    if _release_cache and (now - _release_cache[0]) < _RELEASE_CACHE_TTL_SEC:
        return _release_cache[1]

    repo = (settings.android_release_repo or "").strip()
    if not repo:
        _release_cache = (now, None)
        return None

    latest: dict[str, Any] | None = None
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=5.0)) as client:
            response = await client.get(
                f"https://api.github.com/repos/{repo}/releases",
                params={"per_page": 20},
                headers={"Accept": "application/vnd.github+json"},
            )
            response.raise_for_status()
            for release in response.json():
                parsed = _parse_android_release(release)
                if parsed and (latest is None or parsed["version_code"] > latest["version_code"]):
                    latest = parsed
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("android release lookup failed: %s", exc)
        if _release_cache:
            return _release_cache[1]
        return None

    _release_cache = (now, latest)
    return latest


def _apk_dir() -> Path:
    path = settings.media_upload_path / "android"
    path.mkdir(parents=True, exist_ok=True)
    return path


async def _ensure_apk_cached(release: dict[str, Any]) -> Path:
    target = _apk_dir() / release["asset_name"]
    expected_size = release["size"]
    if target.is_file() and (not expected_size or target.stat().st_size == expected_size):
        return target

    async with _apk_download_lock:
        if target.is_file() and (not expected_size or target.stat().st_size == expected_size):
            return target
        tmp = target.with_suffix(".part")
        async with httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=10.0), follow_redirects=True) as client:
            async with client.stream("GET", release["download_url"]) as response:
                response.raise_for_status()
                with tmp.open("wb") as fh:
                    async for chunk in response.aiter_bytes(1024 * 256):
                        fh.write(chunk)
        if expected_size and tmp.stat().st_size != expected_size:
            tmp.unlink(missing_ok=True)
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="APK download incomplete")
        tmp.replace(target)
        for old in _apk_dir().glob("*.apk"):
            if old != target:
                old.unlink(missing_ok=True)
        return target


@router.get("/version")
async def app_version() -> dict[str, Any]:
    release = await _latest_android_release()
    android = None
    if release:
        android = {
            "version_code": release["version_code"],
            "version_name": release["version_name"],
            "size": release["size"],
            "notes": release["notes"],
            "apk_url": f"/api/app/android/apk?v={release['version_code']}",
        }
    return {"web_build": _web_build(), "android": android}


@router.get("/android/apk")
async def android_apk() -> FileResponse:
    release = await _latest_android_release()
    if not release:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No Android release")
    try:
        path = await _ensure_apk_cached(release)
    except httpx.HTTPError as exc:
        logger.warning("android apk download failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="APK unavailable") from exc
    return FileResponse(
        path,
        media_type=ANDROID_APK_MEDIA_TYPE,
        filename=release["asset_name"],
        headers={"Cache-Control": "no-store"},
    )
