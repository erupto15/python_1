"""Вход в APK через deep link t.me/bot?start=login_… (без oauth.telegram.org)."""

from __future__ import annotations

import secrets
import threading
import time
from dataclasses import dataclass, field
from typing import Any

from fastapi import HTTPException, status

_APK_LOGIN_TTL_SEC = 300
_lock = threading.Lock()
_sessions: dict[str, "_ApkLoginSession"] = {}


@dataclass
class _ApkLoginSession:
    start_param: str
    created_at: float
    expires_at: float
    status: str = "pending"
    access_token: str | None = None
    user: dict[str, Any] | None = field(default=None)


def _purge_expired(now: float | None = None) -> None:
    ts = now if now is not None else time.time()
    stale = [k for k, s in _sessions.items() if s.expires_at <= ts]
    for k in stale:
        _sessions.pop(k, None)


def create_apk_login_session() -> _ApkLoginSession:
    now = time.time()
    token = secrets.token_urlsafe(18)
    start_param = f"login_{token}"
    session = _ApkLoginSession(
        start_param=start_param,
        created_at=now,
        expires_at=now + _APK_LOGIN_TTL_SEC,
    )
    with _lock:
        _purge_expired(now)
        _sessions[start_param] = session
    return session


def get_apk_login_session(start_param: str) -> _ApkLoginSession | None:
    key = (start_param or "").strip()
    if not key:
        return None
    now = time.time()
    with _lock:
        _purge_expired(now)
        session = _sessions.get(key)
        if not session:
            return None
        if session.expires_at <= now:
            _sessions.pop(key, None)
            return None
        return session


def complete_apk_login_session(start_param: str, access_token: str, user: dict[str, Any]) -> bool:
    key = (start_param or "").strip()
    if not key:
        return False
    now = time.time()
    with _lock:
        session = _sessions.get(key)
        if not session or session.expires_at <= now:
            _sessions.pop(key, None)
            return False
        session.status = "ready"
        session.access_token = access_token
        session.user = user
        return True


def consume_apk_login_session(start_param: str) -> tuple[str, dict[str, Any]] | None:
    key = (start_param or "").strip()
    if not key:
        return None
    now = time.time()
    with _lock:
        session = _sessions.get(key)
        if not session or session.status != "ready" or not session.access_token:
            return None
        if session.expires_at <= now:
            _sessions.pop(key, None)
            return None
        token = session.access_token
        user = session.user or {}
        _sessions.pop(key, None)
        return token, user
