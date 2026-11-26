from __future__ import annotations

import logging
import secrets
import threading
import time
from collections import deque
from datetime import datetime, timedelta, timezone
from ipaddress import ip_address

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import validate_email
from pydantic_core import PydanticCustomError
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import schemas, security
from app.config import settings
from app.db import get_db
from app.deps import get_current_user_allow_password_change
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

RESET_REQUEST_COOLDOWN_SEC = 60.0
TEMP_PASSWORD_TTL = timedelta(hours=24)
TEMP_PASSWORD_LENGTH = 10
# Без похожих символов (0/O, 1/l/I), чтобы пароль из письма легко перепечатать.
TEMP_PASSWORD_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"

DETAIL_EMAIL_TAKEN = "Пользователь с такой почтой уже зарегистрирован"
DETAIL_BAD_CREDENTIALS = "Неверная почта или пароль"
DETAIL_INACTIVE = "Аккаунт отключён"
DETAIL_TOO_MANY_ATTEMPTS = "Слишком много попыток, попробуйте позже"
DETAIL_RESET_UNAVAILABLE = "Восстановление пароля временно недоступно"
DETAIL_RESET_COOLDOWN = "Новый пароль уже отправлен, повторите через минуту"
DETAIL_BAD_EMAIL = "Некорректная почта"
DETAIL_BAD_CURRENT_PASSWORD = "Неверный текущий пароль"
DETAIL_SAME_PASSWORD = "Новый пароль совпадает с текущим — придумайте другой"
DETAIL_BAD_PASSWORD = f"Пароль должен быть от {PASSWORD_MIN_LEN} до {PASSWORD_MAX_LEN} символов"
DETAIL_BAD_DISPLAY_NAME = f"Укажите имя (от 1 до {DISPLAY_NAME_MAX_LEN} символов)"

RESET_EMAIL_SUBJECT = "Новый пароль для гайда 6А9А"

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
        "access_token": security.create_access_token(user.id, user.token_version or 0),
        "token_type": "bearer",
        "user": schemas.UserRead.model_validate(user),
    }


def _find_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(func.lower(User.email) == email).first()


def _is_trusted_proxy(address: str) -> bool:
    try:
        ip = ip_address(address)
    except ValueError:
        return False
    return any(ip in network for network in settings.trusted_proxy_networks)


def _client_ip(request: Request) -> str:
    """X-Forwarded-For учитываем только от доверенного прокси (Caddy дописывает реальный IP справа)."""
    peer = request.client.host if request.client else "unknown"
    if not _is_trusted_proxy(peer):
        return peer
    chain = [part.strip() for part in request.headers.get("x-forwarded-for", "").split(",")]
    for address in reversed([part for part in chain if part]):
        if not _is_trusted_proxy(address):
            return address
    return peer


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


def _as_utc(value: datetime) -> datetime:
    # SQLite отдаёт naive datetime; в БД пишем UTC.
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _generate_temp_password() -> str:
    return "".join(secrets.choice(TEMP_PASSWORD_ALPHABET) for _ in range(TEMP_PASSWORD_LENGTH))


def _reset_email_body(email: str, temp_password: str) -> str:
    return (
        "Здравствуйте!\n\n"
        "Вы запросили восстановление пароля в гайде 6А9А.\n\n"
        f"Логин: {email}\n"
        f"Временный пароль: {temp_password}\n\n"
        "Это временный пароль, он действует 24 часа. Войдите с ним — приложение сразу попросит "
        "придумать новый постоянный пароль, а прежний после этого перестанет работать. При каждом "
        "новом запросе приходит другой временный пароль, предыдущий из письма отменяется.\n\n"
        "Если вы не запрашивали восстановление, просто проигнорируйте письмо — ваш прежний пароль "
        "продолжает работать.\n"
    )


def _invalidate_reset_passwords(db: Session, user: User, now: datetime, except_id: int | None = None) -> None:
    query = db.query(PasswordResetCode).filter(
        PasswordResetCode.user_id == user.id,
        PasswordResetCode.used_at.is_(None),
    )
    if except_id is not None:
        query = query.filter(PasswordResetCode.id != except_id)
    query.update({PasswordResetCode.used_at: now}, synchronize_session=False)


def _revoke_sessions(user: User) -> None:
    """Все ранее выданные токены перестают действовать (см. deps: claim `tv`)."""
    user.token_version = (user.token_version or 0) + 1


def _consume_temp_password(db: Session, user: User, password: str) -> bool:
    """Пароль из письма заменяет прежний (тот перестаёт работать), дальше обязательна смена на свой."""
    if not user.is_active:
        return False
    now = datetime.now(timezone.utc)
    record = (
        db.query(PasswordResetCode)
        .filter(PasswordResetCode.user_id == user.id, PasswordResetCode.used_at.is_(None))
        .order_by(PasswordResetCode.id.desc())
        .first()
    )
    if not record or _as_utc(record.expires_at) <= now:
        return False
    if not security.verify_password(password, record.code_hash):
        return False
    _invalidate_reset_passwords(db, user, now)
    user.password_hash = record.code_hash
    user.must_change_password = True
    _revoke_sessions(user)
    db.commit()
    db.refresh(user)
    return True


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
    """`email` — почта (регистр не важен) или логин администратора `ADMIN_LOGIN`; `password` — пароль."""
    email = _normalize_email(payload.email)
    admin_login = _normalize_email(settings.admin_login)
    if admin_login and email == admin_login:
        email = _normalize_email(settings.admin_email)

    throttle_key = (_client_ip(request), email)
    if _login_is_throttled(throttle_key):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=DETAIL_TOO_MANY_ATTEMPTS)

    user = _find_user_by_email(db, email) if email else None
    password_ok = bool(user and payload.password) and (
        security.verify_password(payload.password, user.password_hash)
        or _consume_temp_password(db, user, payload.password)
    )
    if not password_ok:
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
    temp_password = _generate_temp_password()
    record = PasswordResetCode(
        user_id=user.id,
        code_hash=security.hash_password(temp_password),
        expires_at=now + TEMP_PASSWORD_TTL,
        attempts=0,
    )
    db.add(record)
    db.commit()

    try:
        mailer.send_email_sync(user.email, RESET_EMAIL_SUBJECT, _reset_email_body(user.email, temp_password))
    except Exception:
        logger.exception("Failed to send password reset email to user %s", user.id)
        # Письмо не ушло — новый пароль никто не знает, а предыдущий из письма остаётся в силе.
        db.delete(record)
        db.commit()
        _release_reset_slot(email)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=DETAIL_RESET_UNAVAILABLE)

    _invalidate_reset_passwords(db, user, now, except_id=record.id)
    db.commit()
    return {"ok": True}


@router.post("/change-password", response_model=schemas.Token)
def change_password(
    payload: schemas.PasswordChangeRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user_allow_password_change),
) -> dict:
    """Свой новый пароль. После входа по паролю из письма текущий пароль не спрашиваем.

    Остальные сессии отзываются; в ответе — свежий токен для текущего устройства.
    """
    new_password = _validated_password(payload.new_password)
    if not current.must_change_password:
        if not payload.current_password or not security.verify_password(
            payload.current_password, current.password_hash
        ):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=DETAIL_BAD_CURRENT_PASSWORD)
    if security.verify_password(new_password, current.password_hash):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=DETAIL_SAME_PASSWORD)

    _invalidate_reset_passwords(db, current, datetime.now(timezone.utc))
    current.password_hash = security.hash_password(new_password)
    current.must_change_password = False
    _revoke_sessions(current)
    db.commit()
    db.refresh(current)
    return _token_response(current)


@router.get("/me", response_model=schemas.UserRead)
def me(current: User = Depends(get_current_user_allow_password_change)) -> User:
    return current
