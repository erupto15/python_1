"""Upsert users authenticated via VK ID (RuStore / APK)."""

from __future__ import annotations

import secrets
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app import security
from app.config import settings
from app.models import User

VK_USER_INFO_URL = "https://id.vk.ru/oauth2/user_info"


def vk_email(user_id: int | str) -> str:
    return f"vk_{user_id}@vk.local"


def vk_display_name(user_data: dict[str, Any]) -> str:
    first = str(user_data.get("first_name") or "").strip()
    last = str(user_data.get("last_name") or "").strip()
    full = " ".join(part for part in [first, last] if part).strip()
    if full:
        return full[:120]
    return f"VK {user_data.get('user_id', '')}"[:120]


def fetch_vk_user_info(access_token: str) -> dict[str, Any]:
    client_id = (settings.vk_id_client_id or "").strip()
    if not client_id:
        raise ValueError("VK ID is not configured on server")
    token = (access_token or "").strip()
    if not token:
        raise ValueError("Empty access token")
    with httpx.Client(timeout=20.0) as client:
        response = client.post(
            VK_USER_INFO_URL,
            data={"client_id": client_id, "access_token": token},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        response.raise_for_status()
        payload = response.json()
    user = payload.get("user")
    if not isinstance(user, dict) or user.get("user_id") in (None, ""):
        raise ValueError("Invalid VK ID user_info response")
    return user


def upsert_vk_user(db: Session, vk_user: dict[str, Any]) -> User:
    vk_id = int(vk_user["user_id"])
    email = vk_email(vk_id)
    display_name = vk_display_name(vk_user)
    avatar = str(vk_user.get("avatar") or "").strip() or None

    user = db.query(User).filter(User.email == email).first()
    if user:
        if display_name:
            user.display_name = display_name[:120]
        if avatar:
            user.telegram_photo_url = avatar[:512]
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    user = User(
        email=email,
        password_hash=security.hash_password(secrets.token_urlsafe(32)),
        display_name=display_name[:120] if display_name else "",
        telegram_photo_url=avatar[:512] if avatar else None,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
