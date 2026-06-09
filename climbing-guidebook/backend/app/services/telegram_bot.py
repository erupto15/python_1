from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_client: httpx.AsyncClient | None = None


def _api_base() -> str | None:
    token = (settings.telegram_bot_token or "").strip()
    if not token:
        return None
    return f"https://api.telegram.org/bot{token}"


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(12.0, connect=4.0),
            limits=httpx.Limits(max_keepalive_connections=4, max_connections=8),
        )
    return _client


async def close_telegram_client() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


async def call_telegram_api(method: str, payload: dict[str, Any] | None = None) -> dict[str, Any] | None:
    base = _api_base()
    if not base:
        logger.warning("telegram_bot_token is not configured")
        return None
    try:
        response = await _get_client().post(f"{base}/{method}", json=payload or {})
        response.raise_for_status()
        data = response.json()
        if not data.get("ok"):
            logger.warning("telegram api %s failed: %s", method, data)
        return data
    except httpx.HTTPError as exc:
        logger.warning("telegram api %s error: %s", method, exc)
        return None


async def send_message(
    chat_id: int,
    text: str,
    reply_markup: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    payload: dict[str, Any] = {"chat_id": chat_id, "text": text}
    if reply_markup is not None:
        payload["reply_markup"] = reply_markup
    return await call_telegram_api("sendMessage", payload)
