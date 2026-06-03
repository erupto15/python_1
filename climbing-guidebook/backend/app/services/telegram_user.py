"""Upsert Telegram-linked users (shared by auth and users routers)."""

from __future__ import annotations

import secrets
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app import security
from app.config import settings
from app.models import User


def telegram_email(user_id: int) -> str:
    return f"tg_{user_id}@telegram.local"


def telegram_display_name(user_data: dict) -> str:
    first_name = str(user_data.get("first_name") or "").strip()
    last_name = str(user_data.get("last_name") or "").strip()
    full_name = " ".join(part for part in [first_name, last_name] if part).strip()
    if full_name:
        return full_name[:120]
    username = str(user_data.get("username") or "").strip()
    if username:
        return f"@{username}"[:120]
    return f"Telegram {user_data.get('id', '')}"[:120]


def fetch_telegram_profile_photo_url(tg_id: int) -> str | None:
    token = (settings.telegram_bot_token or "").strip()
    if not token:
        return None
    base = f"https://api.telegram.org/bot{token}"
    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.get(
                f"{base}/getUserProfilePhotos",
                params={"user_id": tg_id, "limit": 1},
            )
            response.raise_for_status()
            payload = response.json()
            if not payload.get("ok"):
                return None
            photos = (payload.get("result") or {}).get("photos") or []
            if not photos or not photos[0]:
                return None
            file_id = photos[0][-1]["file_id"]
            file_response = client.get(f"{base}/getFile", params={"file_id": file_id})
            file_response.raise_for_status()
            file_payload = file_response.json()
            if not file_payload.get("ok"):
                return None
            file_path = (file_payload.get("result") or {}).get("file_path")
            if not file_path:
                return None
            return f"https://api.telegram.org/file/bot{token}/{file_path}"
    except (httpx.HTTPError, KeyError, TypeError, ValueError):
        return None


def resolve_telegram_photo_url(tg_id: int, user_data: dict[str, Any] | None) -> str | None:
    photo_url = str((user_data or {}).get("photo_url") or "").strip() or None
    if photo_url:
        return photo_url[:512]
    return fetch_telegram_profile_photo_url(tg_id)


def upsert_telegram_user(db: Session, tg_id: int, tg_username: str | None, user_data: dict | None = None) -> User:
    email = telegram_email(tg_id)
    display_name = telegram_display_name(user_data or {"id": tg_id, "username": tg_username})
    photo_url = resolve_telegram_photo_url(tg_id, user_data)

    user = db.query(User).filter(User.telegram_id == tg_id).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()

    if user:
        user.telegram_id = tg_id
        user.telegram_username = tg_username
        if photo_url:
            user.telegram_photo_url = photo_url[:512]
        if display_name:
            user.display_name = display_name[:120]
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    user = User(
        email=email,
        password_hash=security.hash_password(secrets.token_urlsafe(32)),
        display_name=display_name[:120] if display_name else "",
        telegram_id=tg_id,
        telegram_username=tg_username,
        telegram_photo_url=photo_url[:512] if photo_url else None,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
