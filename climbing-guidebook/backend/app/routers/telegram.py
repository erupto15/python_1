from __future__ import annotations

from typing import Any

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, status

from app.config import Settings, settings
from app.services.telegram_bot import send_message

router = APIRouter(prefix="/telegram", tags=["telegram"])


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


async def _deliver_start_message(chat_id: int) -> None:
    await send_message(
        chat_id=chat_id,
        text="Открывай скалолазный гайд:",
        reply_markup=_start_reply_markup(),
    )


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
