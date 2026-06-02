"""Validate Telegram Mini App initData (WebApp)."""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from typing import Any
from urllib.parse import parse_qsl

from fastapi import HTTPException, status

from app.config import Settings, settings


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
