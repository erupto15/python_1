import hashlib
import hmac
import json
import secrets
import time
from urllib.parse import parse_qsl

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import schemas, security
from app.config import settings
from app.db import get_db
from app.deps import get_current_user
from app.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


def _telegram_email(user_id: int) -> str:
    return f"tg_{user_id}@telegram.local"


def _telegram_display_name(user_data: dict) -> str:
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


def _parse_and_verify_init_data(init_data: str) -> dict:
    bot_token = settings.telegram_bot_token.strip()
    if not bot_token:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Telegram auth is not configured")

    pairs = dict(parse_qsl(init_data, keep_blank_values=True))
    their_hash = pairs.pop("hash", "")
    if not their_hash:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Telegram init data")

    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))
    secret_key = hmac.new(b"WebAppData", bot_token.encode("utf-8"), hashlib.sha256).digest()
    expected_hash = hmac.new(secret_key, data_check_string.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected_hash, their_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Telegram signature")

    auth_date_raw = pairs.get("auth_date", "0")
    try:
        auth_date = int(auth_date_raw)
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Telegram auth date")
    if auth_date <= 0 or abs(int(time.time()) - auth_date) > int(settings.telegram_auth_max_age_sec):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Telegram auth data expired")

    user_raw = pairs.get("user")
    if not user_raw:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Telegram user data is missing")
    try:
        user_data = json.loads(user_raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Telegram user payload")
    if not isinstance(user_data, dict) or "id" not in user_data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Telegram user data")
    return user_data


@router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)) -> dict[str, str]:
    """OAuth2: `username` — email (в нижнем регистре) или короткий алиас admin; `password` — пароль."""
    username_raw = (form_data.username or "").strip()
    username_cf = username_raw.casefold()
    admin_email_norm = settings.admin_email.strip().casefold()
    if username_cf == "admin":
        user = db.query(User).filter(func.lower(User.email) == admin_email_norm).first()
    else:
        user = db.query(User).filter(func.lower(User.email) == username_cf).first()
    if not user or not security.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if (user.email or "").strip().casefold() != admin_email_norm:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admin login is allowed")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")
    token = security.create_access_token(user.id)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": schemas.UserRead.model_validate(user),
    }


@router.post("/telegram", response_model=schemas.Token)
def login_telegram(payload: schemas.TelegramAuthRequest, db: Session = Depends(get_db)) -> dict:
    """
    Автовход из Telegram Mini App: проверка подписи initData, создание/обновление пользователя,
    сохранение telegram_id и telegram_username.
    """
    user_data = _parse_and_verify_init_data(payload.init_data)
    tg_id = int(user_data["id"])
    tg_username = (str(user_data.get("username") or "").strip() or None)
    email = _telegram_email(tg_id)
    display_name = _telegram_display_name(user_data)

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
    else:
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

    token = security.create_access_token(user.id)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": schemas.UserRead.model_validate(user),
    }


@router.get("/me", response_model=schemas.UserRead)
def me(current: User = Depends(get_current_user)) -> User:
    return current
