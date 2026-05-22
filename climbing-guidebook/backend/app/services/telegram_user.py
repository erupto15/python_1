"""Upsert Telegram-linked users (shared by auth and users routers)."""

from __future__ import annotations

import secrets

from sqlalchemy.orm import Session

from app import security
from app.models import User


def telegram_email(user_id: int) -> str:
    return f"tg_{user_id}@telegram.local"


def telegram_display_name(user_data: dict) -> str:
    first_name = str(user_data.get("first_name") or "").strip()
    last_name = str(user_data.get("last_name") or "").strip()
    username = str(user_data.get("username") or "").strip()
    full_name = " ".join(part for part in [first_name, last_name] if part).strip()
    if full_name and username:
        return f"{full_name} (@{username})"[:120]
    if full_name:
        return full_name[:120]
    if username:
        return f"@{username}"[:120]
    return f"Telegram {user_data.get('id', '')}"[:120]


def upsert_telegram_user(db: Session, tg_id: int, tg_username: str | None, user_data: dict | None = None) -> User:
    email = telegram_email(tg_id)
    display_name = telegram_display_name(user_data or {"id": tg_id, "username": tg_username})

    user = db.query(User).filter(User.telegram_id == tg_id).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()

    if user:
        user.telegram_id = tg_id
        user.telegram_username = tg_username
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
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
