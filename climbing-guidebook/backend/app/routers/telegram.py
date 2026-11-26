from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, status

from app.config import Settings, settings
from app.services.telegram_bot import edit_message_reply_markup, send_message

router = APIRouter(prefix="/telegram", tags=["telegram"])

# chat_id -> (message_id с кнопкой «Открыть гайд», monotonic ts последней отправки)
_start_guide_messages: dict[int, tuple[int, float]] = {}
_START_GUIDE_RESEND_COOLDOWN_SEC = 12.0


def _mini_app_url() -> str:
    base = (settings.public_url or "").strip().rstrip("/")
    if not base:
        if Settings._is_production_env():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="PUBLIC_URL is not configured",
            )
        base = "http://127.0.0.1:8000"
    return f"{base}/"


def _start_reply_markup() -> dict[str, Any]:
    return {
        "inline_keyboard": [
            [
                {
                    "text": "Открыть гайд",
                    "web_app": {"url": _mini_app_url()},
                }
            ]
        ]
    }


async def _strip_start_guide_button(chat_id: int, message_id: int) -> None:
    await edit_message_reply_markup(
        chat_id,
        message_id,
        reply_markup={"inline_keyboard": []},
    )


async def _deliver_start_message(chat_id: int) -> None:
    now = time.monotonic()
    prev = _start_guide_messages.get(chat_id)
    if prev and (now - prev[1]) < _START_GUIDE_RESEND_COOLDOWN_SEC:
        return

    if prev:
        await _strip_start_guide_button(chat_id, prev[0])

    result = await send_message(
        chat_id=chat_id,
        text="Открывай скалолазный гайд:",
        reply_markup=_start_reply_markup(),
    )
    if not result or not result.get("ok"):
        return
    body = result.get("result")
    if not isinstance(body, dict):
        return
    message_id = body.get("message_id")
    if isinstance(message_id, int):
        _start_guide_messages[chat_id] = (message_id, now)


@router.post("/webhook")
async def telegram_webhook(
    update: dict[str, Any],
    background_tasks: BackgroundTasks,
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
) -> dict[str, bool]:
    expected_secret = (settings.telegram_webhook_secret or "").strip()
    if expected_secret and x_telegram_bot_api_secret_token != expected_secret:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid Telegram webhook secret")

    message = update.get("message")
    if not isinstance(message, dict):
        return {"ok": True}

    text = str(message.get("text") or "").strip()
    if not text.startswith("/start"):
        return {"ok": True}

    chat = message.get("chat")
    if not isinstance(chat, dict):
        return {"ok": True}

    chat_id = chat.get("id")
    if not isinstance(chat_id, int):
        return {"ok": True}

    background_tasks.add_task(_deliver_start_message, chat_id)
    return {"ok": True}
