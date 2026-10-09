"""Validate Telegram Mini App initData (WebApp) and Login Widget callbacks."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import time
from typing import Any
from urllib.parse import parse_qsl
from urllib.request import urlopen

from fastapi import HTTPException, status

from app.config import Settings, settings

logger = logging.getLogger(__name__)

_bot_username_cache: str = ""


def parse_init_data(init_data: str) -> dict[str, str]:
    pairs = parse_qsl(init_data, keep_blank_values=True)
    return {k: v for k, v in pairs}


def validate_init_data(init_data: str) -> dict[str, Any]:
    """Return parsed Telegram user dict from init_data."""
    raw = (init_data or "").strip()
    if not raw:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="init_data is empty")

    data = parse_init_data(raw)
    token = (settings.telegram_bot_token or "").strip()

    if token:
        received_hash = data.pop("hash", None)
        if not received_hash:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="init_data hash missing")
        check_pairs = [f"{k}={v}" for k, v in sorted(data.items())]
        data_check_string = "\n".join(check_pairs)
        secret_key = hmac.new(b"WebAppData", token.encode(), hashlib.sha256).digest()
        calculated = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(calculated, received_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid init_data signature")

        auth_date = int(data.get("auth_date") or "0")
        max_age = max(60, int(settings.telegram_auth_max_age_sec or 86400))
        if auth_date and time.time() - auth_date > max_age:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="init_data expired")
    elif Settings._is_production_env():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="TELEGRAM_BOT_TOKEN is not configured",
        )

    user_raw = data.get("user")
    if not user_raw:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="init_data user missing")
    try:
        user = json.loads(user_raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user JSON") from exc
    if not isinstance(user, dict) or user.get("id") is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Telegram user")
    return user


def _widget_data_check_string(data: dict[str, Any]) -> str:
    pairs = []
    for key in sorted(data.keys()):
        if key == "hash":
            continue
        val = data[key]
        if val is None:
            continue
        pairs.append(f"{key}={val}")
    return "\n".join(pairs)


def validate_login_widget(data: dict[str, Any]) -> dict[str, Any]:
    """Validate Telegram Login Widget callback and return user dict."""
    if not data or data.get("id") is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Telegram user id missing")

    token = (settings.telegram_bot_token or "").strip()
    payload = {k: v for k, v in data.items() if v is not None and k != "hash"}
    received_hash = str(data.get("hash") or "").strip()

    if token:
        if not received_hash:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Telegram login hash missing")
        check_string = _widget_data_check_string(payload)
        secret_key = hashlib.sha256(token.encode()).digest()
        calculated = hmac.new(secret_key, check_string.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(calculated, received_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Telegram login signature")

        auth_date = int(payload.get("auth_date") or 0)
        max_age = max(60, int(settings.telegram_auth_max_age_sec or 86400))
        if auth_date and time.time() - auth_date > max_age:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Telegram login expired")
    elif Settings._is_production_env():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="TELEGRAM_BOT_TOKEN is not configured",
        )

    tg_id = int(payload["id"])
    user = {
        "id": tg_id,
        "first_name": str(payload.get("first_name") or "").strip(),
        "last_name": str(payload.get("last_name") or "").strip(),
        "username": str(payload.get("username") or "").strip() or None,
        "photo_url": str(payload.get("photo_url") or "").strip() or None,
    }
    if not user["first_name"]:
        user["first_name"] = user["username"] or f"User {tg_id}"
    return user


def resolve_telegram_bot_username() -> str | None:
    """Public @username for Telegram Login Widget (APK / браузер вне Mini App)."""
    global _bot_username_cache
    if _bot_username_cache:
        return _bot_username_cache

    explicit = (settings.telegram_bot_username or "").strip().lstrip("@")
    if explicit:
        _bot_username_cache = explicit
        return explicit

    token = (settings.telegram_bot_token or "").strip()
    if not token:
        return None
    try:
        with urlopen(f"https://api.telegram.org/bot{token}/getMe", timeout=6) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        username = str((body.get("result") or {}).get("username") or "").strip()
        if username:
            _bot_username_cache = username
            return username
    except Exception as exc:
        logger.warning("telegram getMe failed: %s", exc)
    return None
