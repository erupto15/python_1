from __future__ import annotations

import pytest

from app.routers.auth import LOGIN_MAX_FAILURES
from conftest import (
    ADMIN_EMAIL,
    ADMIN_LOGIN,
    ADMIN_PASSWORD,
    bearer,
    login,
    register_user,
    set_user_active,
    unique_email,
)


# --- регистрация ---------------------------------------------------------------------------


def test_register_returns_token_and_user(client):
    email = unique_email("New.User")
    resp = client.post(
        "/api/auth/register",
        json={"email": f"  {email.upper()}  ", "password": "secret123", "display_name": "  Вася  "},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    user = body["user"]
    assert user["email"] == email.lower()
    assert user["display_name"] == "Вася"
    assert user["is_active"] is True
    assert user["must_change_password"] is False

    me = client.get("/api/auth/me", headers=bearer(body["access_token"]))
    assert me.status_code == 200
    assert me.json()["id"] == user["id"]


def test_register_password_min_length_boundary(client):
    resp = client.post(
        "/api/auth/register",
        json={"email": unique_email(), "password": "123456", "display_name": "Six"},
    )
    assert resp.status_code == 201, resp.text


@pytest.mark.parametrize("variant", [str.upper, str.title, lambda e: f"  {e}  "])
def test_register_duplicate_email_case_insensitive(client, variant):
    email = unique_email()
    register_user(client, email=email)
    resp = client.post(
        "/api/auth/register",
        json={"email": variant(email), "password": "another123", "display_name": "Дубль"},
    )
    assert resp.status_code == 409
    assert "уже зарегистрирован" in resp.json()["detail"]


def test_register_admin_email_is_taken(client):
    resp = client.post(
        "/api/auth/register",
        json={"email": ADMIN_EMAIL.upper(), "password": "secret123", "display_name": "Самозванец"},
    )
    # *.local — special-use домен, email-validator отвергает его раньше проверки на дубликат.
    assert resp.status_code in (409, 422)
    assert login(client, ADMIN_EMAIL, ADMIN_PASSWORD).status_code == 200


@pytest.mark.parametrize(
    "payload",
    [
        pytest.param({"email": "not-an-email", "password": "secret123", "display_name": "X"}, id="bad-email"),
        pytest.param({"email": "", "password": "secret123", "display_name": "X"}, id="empty-email"),
        pytest.param({"email": "a@b", "password": "secret123", "display_name": "X"}, id="no-tld"),
        pytest.param({"email": "u@example.com", "password": "12345", "display_name": "X"}, id="short-password"),
        pytest.param({"email": "u@example.com", "password": "x" * 129, "display_name": "X"}, id="long-password"),
        pytest.param({"email": "u@example.com", "password": "secret123", "display_name": "   "}, id="blank-name"),
        pytest.param({"email": "u@example.com", "password": "secret123", "display_name": "n" * 81}, id="long-name"),
        pytest.param({"email": "bot@telegram.local", "password": "secret123", "display_name": "X"}, id="telegram.local"),
        pytest.param({"email": "bot@VK.local", "password": "secret123", "display_name": "X"}, id="vk.local"),
    ],
)
def test_register_validation_errors(client, payload):
    resp = client.post("/api/auth/register", json=payload)
    assert resp.status_code == 422, resp.text
    assert isinstance(resp.json()["detail"], str)


def test_register_missing_fields_is_422(client):
    resp = client.post("/api/auth/register", json={"email": unique_email()})
    assert resp.status_code == 422


# --- вход ---------------------------------------------------------------------------------


def test_login_success_and_email_case_insensitive(client, user):
    for email in (user.email, user.email.upper(), f"  {user.email}  "):
        resp = login(client, email, user.password)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["user"]["id"] == user.id
        assert body["user"]["must_change_password"] is False


def test_login_wrong_password_is_401(client, user):
    resp = login(client, user.email, "wrong-password")
    assert resp.status_code == 401
    assert resp.headers.get("www-authenticate") == "Bearer"
    assert resp.json()["detail"] == "Неверная почта или пароль"


def test_login_unknown_email_is_401_with_same_message(client):
    resp = login(client, unique_email("ghost"), "whatever123")
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Неверная почта или пароль"


def test_login_empty_password_is_401(client, user):
    assert login(client, user.email, "").status_code == 401


@pytest.mark.parametrize("alias", [ADMIN_LOGIN, ADMIN_LOGIN.upper(), f" {ADMIN_LOGIN.title()} "])
def test_admin_short_login_alias(client, alias):
    resp = login(client, alias, ADMIN_PASSWORD)
    assert resp.status_code == 200, resp.text
    assert resp.json()["user"]["email"] == ADMIN_EMAIL


def test_admin_login_by_email(client):
    resp = login(client, ADMIN_EMAIL.upper(), ADMIN_PASSWORD)
    assert resp.status_code == 200
    assert resp.json()["user"]["email"] == ADMIN_EMAIL


def test_admin_alias_wrong_password_is_401(client):
    assert login(client, ADMIN_LOGIN, "nope-nope").status_code == 401


def test_login_inactive_user_is_403(client, user):
    set_user_active(user.email, False)
    resp = login(client, user.email, user.password)
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Аккаунт отключён"
    assert login(client, user.email, "wrong-password").status_code == 401


def test_token_of_deactivated_user_is_rejected(client, user):
    assert client.get("/api/auth/me", headers=user.headers).status_code == 200
    set_user_active(user.email, False)
    assert client.get("/api/auth/me", headers=user.headers).status_code == 401


# --- ограничение числа попыток входа ------------------------------------------------------


def _fail_logins(client, email, n, ip="10.0.0.1"):
    for _ in range(n):
        resp = login(client, email, "wrong-password", headers={"X-Forwarded-For": ip})
        assert resp.status_code == 401, resp.text


def test_login_throttled_after_max_failures(proxied_client, user):
    _fail_logins(proxied_client, user.email, LOGIN_MAX_FAILURES)
    resp = login(proxied_client, user.email, user.password, headers={"X-Forwarded-For": "10.0.0.1"})
    assert resp.status_code == 429
    assert resp.json()["detail"] == "Слишком много попыток, попробуйте позже"


def test_login_throttle_counts_unknown_emails_too(proxied_client):
    email = unique_email("ghost")
    _fail_logins(proxied_client, email, LOGIN_MAX_FAILURES)
    resp = login(proxied_client, email, "x", headers={"X-Forwarded-For": "10.0.0.1"})
    assert resp.status_code == 429


def test_login_throttle_key_is_ip_plus_email(proxied_client, user, other_user):
    _fail_logins(proxied_client, user.email, LOGIN_MAX_FAILURES, ip="10.0.0.1")
    # Другой IP для той же почты — не заблокирован.
    ok = login(proxied_client, user.email, user.password, headers={"X-Forwarded-For": "10.0.0.2"})
    assert ok.status_code == 200
    # Тот же IP, другая почта — не заблокирован.
    ok = login(proxied_client, other_user.email, other_user.password, headers={"X-Forwarded-For": "10.0.0.1"})
    assert ok.status_code == 200


def test_login_throttle_uses_rightmost_untrusted_forwarded_for_address(proxied_client, user):
    # Клиент может прислать что угодно слева; Caddy дописывает реальный адрес справа.
    for spoofed in range(LOGIN_MAX_FAILURES):
        resp = login(
            proxied_client,
            user.email,
            "wrong-password",
            headers={"X-Forwarded-For": f"203.0.113.{spoofed}, 10.0.0.9, 127.0.0.1"},
        )
        assert resp.status_code == 401
    resp = login(proxied_client, user.email, user.password, headers={"X-Forwarded-For": "10.0.0.9"})
    assert resp.status_code == 429


def test_login_throttle_ignores_forwarded_for_from_untrusted_peer(client, user):
    # Peer TestClient — "testclient", не доверенный прокси: подделка X-Forwarded-For не сбрасывает лимит.
    for spoofed in range(LOGIN_MAX_FAILURES):
        resp = login(client, user.email, "wrong-password", headers={"X-Forwarded-For": f"203.0.113.{spoofed}"})
        assert resp.status_code == 401
    resp = login(client, user.email, user.password, headers={"X-Forwarded-For": "198.51.100.7"})
    assert resp.status_code == 429


def test_trusted_proxies_are_configurable(proxied_client, user, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "trusted_proxy_ips", "10.10.0.0/16")
    # 127.0.0.1 больше не доверенный — заголовок игнорируется, ключ = адрес peer.
    _fail_logins(proxied_client, user.email, LOGIN_MAX_FAILURES, ip="10.0.0.1")
    resp = login(proxied_client, user.email, user.password, headers={"X-Forwarded-For": "10.0.0.2"})
    assert resp.status_code == 429


def test_login_throttle_email_key_is_case_insensitive(proxied_client, user):
    _fail_logins(proxied_client, user.email.upper(), LOGIN_MAX_FAILURES)
    resp = login(proxied_client, user.email, user.password, headers={"X-Forwarded-For": "10.0.0.1"})
    assert resp.status_code == 429


def test_admin_alias_and_email_share_throttle_bucket(proxied_client):
    _fail_logins(proxied_client, ADMIN_LOGIN, LOGIN_MAX_FAILURES)
    resp = login(proxied_client, ADMIN_EMAIL, ADMIN_PASSWORD, headers={"X-Forwarded-For": "10.0.0.1"})
    assert resp.status_code == 429


def test_successful_login_resets_failure_counter(proxied_client, user):
    _fail_logins(proxied_client, user.email, LOGIN_MAX_FAILURES - 1)
    ok = login(proxied_client, user.email, user.password, headers={"X-Forwarded-For": "10.0.0.1"})
    assert ok.status_code == 200
    _fail_logins(proxied_client, user.email, LOGIN_MAX_FAILURES - 1)
    ok = login(proxied_client, user.email, user.password, headers={"X-Forwarded-For": "10.0.0.1"})
    assert ok.status_code == 200


# --- /me и прочее ------------------------------------------------------------------------


def test_me_returns_current_user(client, user):
    resp = client.get("/api/auth/me", headers=user.headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == user.email.lower()
    assert body["display_name"] == "Обычный пользователь"
    assert "password_hash" not in body


@pytest.mark.parametrize(
    "headers",
    [
        pytest.param({}, id="no-token"),
        pytest.param({"Authorization": "Bearer not-a-jwt"}, id="garbage-token"),
        pytest.param({"Authorization": "Basic dXNlcjpwYXNz"}, id="wrong-scheme"),
    ],
)
def test_me_requires_valid_token(client, headers):
    assert client.get("/api/auth/me", headers=headers).status_code == 401


def test_token_signed_with_other_secret_is_rejected(client, user):
    from jose import jwt

    forged = jwt.encode({"sub": user.id, "exp": 4102444800}, "other-secret", algorithm="HS256")
    assert client.get("/api/auth/me", headers=bearer(forged)).status_code == 401


def test_legacy_token_without_version_claim_still_works(client, user):
    from jose import jwt

    legacy = jwt.encode({"sub": user.id, "exp": 4102444800}, "test-secret", algorithm="HS256")
    assert client.get("/api/auth/me", headers=bearer(legacy)).status_code == 200


@pytest.mark.parametrize("version", [1, "0", True])
def test_token_with_wrong_version_claim_is_rejected(client, user, version):
    from jose import jwt

    token = jwt.encode({"sub": user.id, "exp": 4102444800, "tv": version}, "test-secret", algorithm="HS256")
    assert client.get("/api/auth/me", headers=bearer(token)).status_code == 401


def test_legacy_users_post_is_forbidden(client):
    resp = client.post("/api/users", json={"email": unique_email(), "password": "secret123"})
    assert resp.status_code == 403


def test_public_user_profile_hides_email(client, user):
    resp = client.get(f"/api/users/{user.id}")
    assert resp.status_code == 200
    assert "email" not in resp.json()
    assert client.get("/api/users/does-not-exist").status_code == 404
