"""Общие фикстуры: временная SQLite-БД, TestClient, перехват писем, сброс rate-limit.

Настройки приложения читаются из окружения при импорте `app.config`, поэтому env
выставляется здесь, на уровне модуля, до любого импорта `app`.
"""

from __future__ import annotations

import os
import re
import shutil
import tempfile
import uuid
from pathlib import Path

_TMP_DIR = Path(tempfile.mkdtemp(prefix="climbing-tests-"))

_TEST_ENV = {
    "DATABASE_URL": f"sqlite:///{_TMP_DIR / 'test.db'}",
    "APP_ENV": "development",
    "ADMIN_EMAIL": "admin@test.local",
    "ADMIN_LOGIN": "admin4test",
    "ADMIN_PASSWORD": "adminpass123",
    "ADMIN_DISPLAY_NAME": "Test Admin",
    "JWT_SECRET": "test-secret",
    "TELEGRAM_BOT_TOKEN": "",
    "TELEGRAM_WEBHOOK_SECRET": "",
    "PUBLIC_URL": "",
    "DISABLE_CATALOG_SEED": "1",
    "CATALOG_SEED_FILE": str(_TMP_DIR / "no-seed.yaml"),
    "CONFIG_FILE": str(_TMP_DIR / "no-settings.yaml"),
    "MEDIA_UPLOAD_DIR": str(_TMP_DIR / "uploads"),
    "SMTP_HOST": "",
    "SMTP_USER": "",
    "SMTP_PASSWORD": "",
    "SMTP_FROM": "",
    "ASSISTANT_API_KEY": "",
    "CARTO_BASEMAPS_API_KEY": "",
}
for _key in ("POSTGRES_HOST", "POSTGRES_PASSWORD", "ENV", "ENVIRONMENT", "PYTHON_ENV"):
    os.environ.pop(_key, None)
os.environ.update(_TEST_ENV)

import bcrypt  # noqa: E402

_original_gensalt = bcrypt.gensalt


def _fast_gensalt(rounds: int = 4, prefix: bytes = b"2b") -> bytes:
    # Минимальная стоимость bcrypt: хеши остаются настоящими, но тесты в разы быстрее.
    return _original_gensalt(4, prefix)


bcrypt.gensalt = _fast_gensalt

import httpx  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.config import settings  # noqa: E402
from app.db import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models import User  # noqa: E402
from app.routers import auth as auth_router  # noqa: E402
from app.services import mailer  # noqa: E402

ADMIN_EMAIL = _TEST_ENV["ADMIN_EMAIL"]
ADMIN_LOGIN = _TEST_ENV["ADMIN_LOGIN"]
ADMIN_PASSWORD = _TEST_ENV["ADMIN_PASSWORD"]
DEFAULT_PASSWORD = "secret123"
TEMP_PASSWORD_RE = re.compile(r"Временный пароль: (\S+)")

assert settings.database_url.startswith("sqlite:///") and str(_TMP_DIR) in settings.database_url, (
    "Тесты должны работать на временной SQLite-БД, а не на рабочей"
)


def pytest_sessionfinish(session, exitstatus):  # noqa: ARG001
    shutil.rmtree(_TMP_DIR, ignore_errors=True)


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def proxied_client(client):
    """Запросы как от Caddy на том же хосте: peer 127.0.0.1 — доверенный прокси по умолчанию."""
    return TestClient(app, client=("127.0.0.1", 50000))


@pytest.fixture(autouse=True)
def _block_outgoing_http(monkeypatch):
    """Любой исходящий async-запрос (GitHub releases, Telegram) падает как сетевой сбой."""

    async def _no_network(self, request, *args, **kwargs):  # noqa: ARG001
        raise httpx.ConnectError(f"network disabled in tests: {request.url}", request=request)

    monkeypatch.setattr(httpx.AsyncClient, "send", _no_network)


@pytest.fixture(autouse=True)
def _reset_auth_rate_limits(monkeypatch):
    auth_router._login_failures.clear()
    auth_router._reset_requests.clear()
    monkeypatch.setattr(auth_router, "RESET_REQUEST_COOLDOWN_SEC", 60.0)
    yield
    auth_router._login_failures.clear()
    auth_router._reset_requests.clear()


@pytest.fixture(autouse=True)
def outbox(monkeypatch):
    """Перехваченные письма: список dict(to, subject, body). SMTP считается настроенным."""
    sent: list[dict[str, str]] = []

    def _capture(to: str, subject: str, body: str) -> None:
        sent.append({"to": to, "subject": subject, "body": body})

    monkeypatch.setattr(mailer, "is_configured", lambda: True)
    monkeypatch.setattr(mailer, "send_email_sync", _capture)
    return sent


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def unique_email(prefix: str = "user") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}@example.com"


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def temp_password_from(mail: dict[str, str]) -> str:
    match = TEMP_PASSWORD_RE.search(mail["body"])
    assert match, f"В письме нет временного пароля: {mail['body']!r}"
    return match.group(1)


def login(client: TestClient, email: str, password: str, **kwargs) -> httpx.Response:
    return client.post("/api/auth/login", json={"email": email, "password": password}, **kwargs)


def set_user_active(email: str, active: bool) -> None:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email.lower()).one()
        user.is_active = active
        db.commit()
    finally:
        db.close()


class RegisteredUser:
    def __init__(self, email: str, password: str, token: str, data: dict):
        self.email = email
        self.password = password
        self.token = token
        self.data = data

    @property
    def id(self) -> str:
        return self.data["id"]

    @property
    def headers(self) -> dict[str, str]:
        return bearer(self.token)


def register_user(
    client: TestClient,
    email: str | None = None,
    password: str = DEFAULT_PASSWORD,
    display_name: str = "Скалолаз",
) -> RegisteredUser:
    email = email or unique_email()
    resp = client.post(
        "/api/auth/register",
        json={"email": email, "password": password, "display_name": display_name},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    return RegisteredUser(email=email, password=password, token=body["access_token"], data=body["user"])


@pytest.fixture
def user(client) -> RegisteredUser:
    return register_user(client, display_name="Обычный пользователь")


@pytest.fixture
def other_user(client) -> RegisteredUser:
    return register_user(client, display_name="Другой пользователь")


@pytest.fixture
def admin_headers(client) -> dict[str, str]:
    resp = login(client, ADMIN_LOGIN, ADMIN_PASSWORD)
    assert resp.status_code == 200, resp.text
    return bearer(resp.json()["access_token"])


@pytest.fixture
def catalog(client, admin_headers) -> dict[str, dict]:
    """Район → сектор → трасса + боулдер, созданные админом через API."""
    area = client.post(
        "/api/areas",
        json={"name": f"Район {uuid.uuid4().hex[:6]}", "latitude": 44.5, "longitude": 34.1},
        headers=admin_headers,
    )
    assert area.status_code == 201, area.text
    area = area.json()
    sector = client.post(
        f"/api/areas/{area['id']}/sectors", json={"name": "Сектор А"}, headers=admin_headers
    )
    assert sector.status_code == 201, sector.text
    sector = sector.json()
    route = client.post(
        "/api/routes",
        json={"sector_id": sector["id"], "area_id": area["id"], "name": "Трасса 1", "grade": "6a"},
        headers=admin_headers,
    )
    assert route.status_code == 201, route.text
    boulder = client.post(
        "/api/boulders",
        json={"sector_id": sector["id"], "area_id": area["id"], "name": "Боулдер 1", "grade": "6a"},
        headers=admin_headers,
    )
    assert boulder.status_code == 201, boulder.text
    return {"area": area, "sector": sector, "route": route.json(), "boulder": boulder.json()}
