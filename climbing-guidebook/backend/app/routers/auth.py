import time

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import schemas, security
from app.config import settings
from app.db import get_db
from app.deps import get_current_user
from app.models import User
from app.services.telegram_auth import resolve_telegram_bot_username, validate_init_data, validate_login_widget
from app.services.telegram_deeplink_auth import (
    consume_apk_login_session,
    create_apk_login_session,
    get_apk_login_session,
)
from app.services.telegram_user import upsert_telegram_user
router = APIRouter(prefix="/auth", tags=["auth"])


def _telegram_login_response(db: Session, tg_user: dict) -> dict:
    tg_id = int(tg_user["id"])
    username = str(tg_user.get("username") or "").strip() or None
    user = upsert_telegram_user(db, tg_id=tg_id, tg_username=username, user_data=tg_user)
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")
    token = security.create_access_token(user.id)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": schemas.UserRead.model_validate(user),
    }


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


@router.get("/telegram-config", response_model=schemas.TelegramLoginConfigRead)
def telegram_login_config() -> dict[str, str]:
    """Публичный @username бота для Telegram Login Widget (APK / веб вне Mini App)."""
    username = resolve_telegram_bot_username()
    if not username:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Telegram bot is not configured",
        )
    return {"bot_username": username}


@router.post("/telegram", response_model=schemas.Token)
def login_telegram(payload: schemas.TelegramAuthRequest, db: Session = Depends(get_db)) -> dict:
    """Вход через Telegram Mini App (initData)."""
    tg_user = validate_init_data(payload.init_data)
    return _telegram_login_response(db, tg_user)


@router.post("/telegram-widget", response_model=schemas.Token)
def login_telegram_widget(payload: schemas.TelegramLoginWidgetAuthRequest, db: Session = Depends(get_db)) -> dict:
    """Вход через Telegram Login Widget (Android APK, браузер)."""
    tg_user = validate_login_widget(payload.model_dump())
    return _telegram_login_response(db, tg_user)


@router.post("/telegram-deeplink", response_model=schemas.TelegramDeeplinkStartResponse)
def start_telegram_deeplink_login() -> dict:
    """
    Создать одноразовую ссылку t.me/bot?start=login_… для входа в APK без oauth.telegram.org.
    Пользователь подтверждает /start в приложении Telegram; APK опрашивает GET /telegram-deeplink.
    """
    username = resolve_telegram_bot_username()
    if not username:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Telegram bot is not configured",
        )
    session = create_apk_login_session()
    return {
        "start_param": session.start_param,
        "deep_link": f"https://t.me/{username}?start={session.start_param}",
        "expires_in": max(1, int(session.expires_at - session.created_at)),
    }


@router.get("/telegram-deeplink", response_model=schemas.TelegramDeeplinkPollResponse)
def poll_telegram_deeplink_login(start: str = Query(..., min_length=8, max_length=128)) -> dict:
    consumed = consume_apk_login_session(start)
    if consumed:
        token, user = consumed
        user_read = schemas.UserRead.model_validate(user) if user else None
        return {
            "status": "ready",
            "access_token": token,
            "token_type": "bearer",
            "user": user_read,
        }
    session = get_apk_login_session(start)
    if not session:
        return {"status": "expired"}

    remaining = max(0, int(session.expires_at - time.time()))
    return {"status": "pending", "expires_in": remaining}


@router.get("/me", response_model=schemas.UserRead)
def me(current: User = Depends(get_current_user)) -> User:
    return current
