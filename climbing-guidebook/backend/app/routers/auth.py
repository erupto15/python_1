from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
import threading
import time
from collections import deque
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import validate_email
from pydantic_core import PydanticCustomError
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import schemas, security
from app.config import settings
from app.db import get_db
from app.deps import get_current_user
from app.models import PasswordResetCode, User
from app.services import mailer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

PASSWORD_MIN_LEN = 6
PASSWORD_MAX_LEN = 128
DISPLAY_NAME_MAX_LEN = 80
_RESERVED_EMAIL_DOMAINS = {"telegram.local", "vk.local"}

LOGIN_MAX_FAILURES = 10
LOGIN_FAILURE_WINDOW_SEC = 10 * 60

RESET_CODE_TTL = timedelta(minutes=30)
RESET_CODE_MAX_ATTEMPTS = 5
RESET_REQUEST_COOLDOWN_SEC = 60.0

DETAIL_EMAIL_TAKEN = "Пользователь с такой почтой уже зарегистрирован"
DETAIL_BAD_CREDENTIALS = "Неверная почта или пароль"
DETAIL_INACTIVE = "Аккаунт отключён"
DETAIL_TOO_MANY_ATTEMPTS = "Слишком много попыток, попробуйте позже"
DETAIL_RESET_UNAVAILABLE = "Восстановление пароля временно недоступно"
DETAIL_RESET_COOLDOWN = "Код уже отправлен, повторите через минуту"
DETAIL_BAD_CODE = "Неверный или просроченный код"
DETAIL_BAD_EMAIL = "Некорректная почта"
DETAIL_BAD_PASSWORD = f"Пароль должен быть от {PASSWORD_MIN_LEN} до {PASSWORD_MAX_LEN} символов"
DETAIL_BAD_DISPLAY_NAME = f"Укажите имя (от 1 до {DISPLAY_NAME_MAX_LEN} символов)"

RESET_EMAIL_SUBJECT = "Код для восстановления пароля 6А9А"

_login_failures: dict[tuple[str, str], deque[float]] = {}
_reset_requests: dict[str, float] = {}
_throttle_lock = threading.Lock()


def _normalize_email(raw: str) -> str:
    return (raw or "").strip().lower()


def _validated_email(raw: str) -> str:
    email = _normalize_email(raw)
    try:
        _, normalized = validate_email(email)
    except (PydanticCustomError, ValueError):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=DETAIL_BAD_EMAIL)
    normalized = normalized.strip().lower()
    if normalized.rsplit("@", 1)[-1] in _RESERVED_EMAIL_DOMAINS:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=DETAIL_BAD_EMAIL)
    return normalized


def _validated_password(raw: str) -> str:
    if not (PASSWORD_MIN_LEN <= len(raw or "") <= PASSWORD_MAX_LEN):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=DETAIL_BAD_PASSWORD)
    return raw


def _token_response(user: User) -> dict:
    return {
        "access_token": security.create_access_token(user.id),
        "token_type": "bearer",
        "user": schemas.UserRead.model_validate(user),
    }


def _find_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(func.lower(User.email) == email).first()


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    first = forwarded.split(",", 1)[0].strip()
    if first:
        return first
    return request.client.host if request.client else "unknown"


def _recent_failures(key: tuple[str, str], now: float) -> deque[float] | None:
    bucket = _login_failures.get(key)
    if bucket is None:
        return None
    while bucket and now - bucket[0] > LOGIN_FAILURE_WINDOW_SEC:
        bucket.popleft()
    if not bucket:
        _login_failures.pop(key, None)
        return None
    return bucket


def _login_is_throttled(key: tuple[str, str]) -> bool:
    with _throttle_lock:
        bucket = _recent_failures(key, time.monotonic())
        return bucket is not None and len(bucket) >= LOGIN_MAX_FAILURES


def _register_login_failure(key: tuple[str, str]) -> None:
    now = time.monotonic()
    with _throttle_lock:
        if len(_login_failures) > 10_000:
            for stale_key in list(_login_failures):
                _recent_failures(stale_key, now)
        _login_failures.setdefault(key, deque()).append(now)


def _reset_login_failures(key: tuple[str, str]) -> None:
    with _throttle_lock:
        _login_failures.pop(key, None)


def _claim_reset_slot(email: str) -> bool:
    now = time.monotonic()
    with _throttle_lock:
        if len(_reset_requests) > 10_000:
            for stale_email, ts in list(_reset_requests.items()):
                if now - ts >= RESET_REQUEST_COOLDOWN_SEC:
                    _reset_requests.pop(stale_email, None)
        last = _reset_requests.get(email)
        if last is not None and now - last < RESET_REQUEST_COOLDOWN_SEC:
            return False
        _reset_requests[email] = now
        return True


def _release_reset_slot(email: str) -> None:
    with _throttle_lock:
        _reset_requests.pop(email, None)


def _hash_reset_code(user_id: str, code: str) -> str:
    return hmac.new(
        settings.jwt_secret.encode("utf-8"),
        f"{user_id}:{code}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def _as_utc(value: datetime) -> datetime:
    # SQLite отдаёт naive datetime; в БД пишем UTC.
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _reset_email_body(code: str) -> str:
    return (
        "Здравствуйте!\n\n"
        f"Ваш код для восстановления пароля в гайде 6А9А: {code}\n\n"
        "Код действует 30 минут. Если вы не запрашивали восстановление пароля, "
        "просто проигнорируйте это письмо.\n"
    )


@router.post("/register", response_model=schemas.Token, status_code=status.HTTP_201_CREATED)
def register(payload: schemas.RegisterRequest, db: Session = Depends(get_db)) -> dict:
    email = _validated_email(payload.email)
    password = _validated_password(payload.password)
    display_name = (payload.display_name or "").strip()
    if not (1 <= len(display_name) <= DISPLAY_NAME_MAX_LEN):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=DETAIL_BAD_DISPLAY_NAME)

    if _find_user_by_email(db, email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=DETAIL_EMAIL_TAKEN)

    user = User(
        email=email,
        password_hash=security.hash_password(password),
        display_name=display_name,
        is_active=True,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=DETAIL_EMAIL_TAKEN)
    db.refresh(user)
    return _token_response(user)


@router.post("/login", response_model=schemas.Token)
def login(payload: schemas.LoginRequest, request: Request, db: Session = Depends(get_db)) -> dict:
    """`email` — почта (регистр не важен) или короткий алиас `admin`; `password` — пароль."""
    email = _normalize_email(payload.email)
    if email == "admin":
        email = _normalize_email(settings.admin_email)

    throttle_key = (_client_ip(request), email)
    if _login_is_throttled(throttle_key):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=DETAIL_TOO_MANY_ATTEMPTS)

    user = _find_user_by_email(db, email) if email else None
    if not user or not payload.password or not security.verify_password(payload.password, user.password_hash):
        _register_login_failure(throttle_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=DETAIL_BAD_CREDENTIALS,
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=DETAIL_INACTIVE)
    _reset_login_failures(throttle_key)
    return _token_response(user)


@router.post("/password-reset/request", response_model=schemas.OkResponse)
def password_reset_request(payload: schemas.PasswordResetRequest, db: Session = Depends(get_db)) -> dict:
    if not mailer.is_configured():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=DETAIL_RESET_UNAVAILABLE)
    email = _validated_email(payload.email)
    if not _claim_reset_slot(email):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=DETAIL_RESET_COOLDOWN)

    user = _find_user_by_email(db, email)
    if not user or not user.is_active:
        return {"ok": True}

    now = datetime.now(timezone.utc)
    db.query(PasswordResetCode).filter(
        PasswordResetCode.user_id == user.id,
        PasswordResetCode.used_at.is_(None),
    ).update({PasswordResetCode.used_at: now}, synchronize_session=False)

    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(
        PasswordResetCode(
            user_id=user.id,
            code_hash=_hash_reset_code(user.id, code),
            expires_at=now + RESET_CODE_TTL,
            attempts=0,
        )
    )
    db.commit()

    try:
        mailer.send_email_sync(user.email, RESET_EMAIL_SUBJECT, _reset_email_body(code))
    except Exception:
        logger.exception("Failed to send password reset email to user %s", user.id)
        _release_reset_slot(email)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=DETAIL_RESET_UNAVAILABLE)
    return {"ok": True}


@router.post("/password-reset/confirm", response_model=schemas.Token)
def password_reset_confirm(payload: schemas.PasswordResetConfirm, db: Session = Depends(get_db)) -> dict:
    email = _normalize_email(payload.email)
    new_password = _validated_password(payload.new_password)
    code = (payload.code or "").strip()

    user = _find_user_by_email(db, email) if email else None
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=DETAIL_BAD_CODE)

    now = datetime.now(timezone.utc)
    record = (
        db.query(PasswordResetCode)
        .filter(PasswordResetCode.user_id == user.id, PasswordResetCode.used_at.is_(None))
        .order_by(PasswordResetCode.id.desc())
        .first()
    )
    if not record or _as_utc(record.expires_at) <= now or record.attempts >= RESET_CODE_MAX_ATTEMPTS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=DETAIL_BAD_CODE)

    if not code.isdigit() or not hmac.compare_digest(record.code_hash, _hash_reset_code(user.id, code)):
        record.attempts = (record.attempts or 0) + 1
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=DETAIL_BAD_CODE)

    record.used_at = now
    user.password_hash = security.hash_password(new_password)
    db.commit()
    db.refresh(user)
    return _token_response(user)


@router.get("/me", response_model=schemas.UserRead)
def me(current: User = Depends(get_current_user)) -> User:
    return current
