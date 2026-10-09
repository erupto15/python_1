from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, status

from app.config import Settings, settings
from app.db import SessionLocal
from app.services.telegram_bot import edit_message_reply_markup, send_message
from app.services.telegram_deeplink_auth import complete_apk_login_session
from app.services.telegram_user import upsert_telegram_user
from app import security, schemas

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


def _telegram_user_from_message(from_user: dict) -> dict:
    tg_id = int(from_user["id"])
    return {
        "id": tg_id,
        "first_name": str(from_user.get("first_name") or "").strip(),
        "last_name": str(from_user.get("last_name") or "").strip(),
        "username": str(from_user.get("username") or "").strip() or None,
        "photo_url": None,
    }


async def _complete_apk_login_from_telegram(start_param: str, from_user: dict, chat_id: int) -> None:
    db = SessionLocal()
    try:
        tg_user = _telegram_user_from_message(from_user)
        tg_id = int(tg_user["id"])
        username = tg_user.get("username")
        user = upsert_telegram_user(db, tg_id=tg_id, tg_username=username, user_data=tg_user)
        if not user.is_active:
            await send_message(chat_id, "Вход в гайд отключён для этой учётной записи.")
            return
        token = security.create_access_token(user.id)
        user_read = schemas.UserRead.model_validate(user)
        if not complete_apk_login_session(
            start_param,
            token,
            user_read.model_dump(mode="json"),
        ):
            await send_message(
                chat_id,
                "Ссылка для входа устарела. В APK нажмите «Войти через Telegram» ещё раз.",
            )
            return
        await send_message(
            chat_id,
            "Готово — можно вернуться в приложение гайда. Профиль и пролазы подтянутся автоматически.",
        )
    finally:
        db.close()


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

    start_payload = ""
    parts = text.split(maxsplit=1)
    if len(parts) > 1:
        start_payload = parts[1].strip()

    if start_payload.startswith("login_"):
        from_user = message.get("from")
        if isinstance(from_user, dict):
            background_tasks.add_task(_complete_apk_login_from_telegram, start_payload, from_user, chat_id)
        return {"ok": True}

    background_tasks.add_task(_deliver_start_message, chat_id)
    return {"ok": True}
