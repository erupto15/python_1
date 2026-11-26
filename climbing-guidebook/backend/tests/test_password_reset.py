from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.models import PasswordResetCode
from app.routers import auth as auth_router
from app.services import mailer
from conftest import bearer, login, register_user, set_user_active, temp_password_from, unique_email

RESET_URL = "/api/auth/password-reset/request"
CHANGE_URL = "/api/auth/change-password"


def request_reset(client, email):
    return client.post(RESET_URL, json={"email": email})


def expire_cooldown(email: str) -> None:
    """Сдвигает момент последнего запроса в прошлое — как будто минута уже прошла."""
    key = email.strip().lower()
    auth_router._reset_requests[key] -= auth_router.RESET_REQUEST_COOLDOWN_SEC + 1


def issue_temp_password(client, outbox, email) -> str:
    before = len(outbox)
    resp = request_reset(client, email)
    assert resp.status_code == 200, resp.text
    assert len(outbox) == before + 1
    return temp_password_from(outbox[-1])


def latest_reset_record(db_session, user_id) -> PasswordResetCode:
    return (
        db_session.query(PasswordResetCode)
        .filter(PasswordResetCode.user_id == user_id)
        .order_by(PasswordResetCode.id.desc())
        .first()
    )


# --- запрос временного пароля ------------------------------------------------------------


def test_unknown_email_returns_ok_without_sending(client, outbox):
    resp = request_reset(client, unique_email("ghost"))
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
    assert outbox == []


def test_inactive_user_gets_ok_without_email(client, outbox, user):
    set_user_active(user.email, False)
    resp = request_reset(client, user.email)
    assert resp.status_code == 200
    assert outbox == []


def test_reset_unavailable_when_mailer_not_configured(client, outbox, user, monkeypatch):
    monkeypatch.setattr(mailer, "is_configured", lambda: False)
    resp = request_reset(client, user.email)
    assert resp.status_code == 503
    assert resp.json()["detail"] == "Восстановление пароля временно недоступно"
    assert outbox == []


@pytest.mark.parametrize("email", ["not-an-email", "", "bot@telegram.local"])
def test_reset_invalid_email_is_422(client, outbox, email):
    assert request_reset(client, email).status_code == 422
    assert outbox == []


def test_reset_sends_email_with_10_char_temp_password(client, outbox, user):
    resp = request_reset(client, user.email.upper())
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
    assert len(outbox) == 1
    mail = outbox[0]
    assert mail["to"] == user.email.lower()
    assert mail["subject"] == auth_router.RESET_EMAIL_SUBJECT
    assert f"Логин: {user.email.lower()}" in mail["body"]
    temp = temp_password_from(mail)
    assert len(temp) == 10
    assert set(temp) <= set(auth_router.TEMP_PASSWORD_ALPHABET)


def test_reset_record_expires_in_24_hours(client, outbox, user, db_session):
    issue_temp_password(client, outbox, user.email)
    record = latest_reset_record(db_session, user.id)
    expires = record.expires_at if record.expires_at.tzinfo else record.expires_at.replace(tzinfo=timezone.utc)
    delta = expires - datetime.now(timezone.utc)
    assert timedelta(hours=23, minutes=59) < delta <= timedelta(hours=24)
    assert record.used_at is None


def test_reset_cooldown_429_within_a_minute(client, outbox, user):
    assert request_reset(client, user.email).status_code == 200
    again = request_reset(client, f"  {user.email.upper()} ")
    assert again.status_code == 429
    assert again.json()["detail"] == "Новый пароль уже отправлен, повторите через минуту"
    assert len(outbox) == 1

    expire_cooldown(user.email)
    assert request_reset(client, user.email).status_code == 200
    assert len(outbox) == 2


def test_reset_cooldown_applies_to_unknown_emails(client, outbox):
    email = unique_email("ghost")
    assert request_reset(client, email).status_code == 200
    assert request_reset(client, email).status_code == 429


def test_temp_passwords_differ_per_request_and_per_user(client, outbox, user, other_user):
    first = issue_temp_password(client, outbox, user.email)
    expire_cooldown(user.email)
    second = issue_temp_password(client, outbox, user.email)
    other = issue_temp_password(client, outbox, other_user.email)
    assert len({first, second, other}) == 3
    assert outbox[-1]["to"] == other_user.email.lower()


def test_send_failure_returns_503_and_releases_cooldown(client, outbox, user, monkeypatch):
    def _boom(*_args, **_kwargs):
        raise mailer.MailerError("smtp down")

    monkeypatch.setattr(mailer, "send_email_sync", _boom)
    assert request_reset(client, user.email).status_code == 503

    captured = []
    monkeypatch.setattr(mailer, "send_email_sync", lambda to, s, b: captured.append(b))
    assert request_reset(client, user.email).status_code == 200
    assert len(captured) == 1


# --- вход по временному паролю ------------------------------------------------------------


def test_old_password_works_until_temp_password_used(client, outbox, user):
    issue_temp_password(client, outbox, user.email)
    resp = login(client, user.email, user.password)
    assert resp.status_code == 200
    assert resp.json()["user"]["must_change_password"] is False


def test_login_with_temp_password_forces_change_and_disables_old(client, outbox, user):
    temp = issue_temp_password(client, outbox, user.email)

    resp = login(client, user.email, temp)
    assert resp.status_code == 200, resp.text
    assert resp.json()["user"]["must_change_password"] is True
    me = client.get("/api/auth/me", headers=bearer(resp.json()["access_token"]))
    assert me.json()["must_change_password"] is True

    assert login(client, user.email, user.password).status_code == 401
    # До смены пароля временный продолжает работать.
    again = login(client, user.email, temp)
    assert again.status_code == 200
    assert again.json()["user"]["must_change_password"] is True


def test_temp_password_login_is_case_insensitive_on_email(client, outbox, user):
    temp = issue_temp_password(client, outbox, user.email)
    assert login(client, user.email.upper(), temp).status_code == 200


def test_new_request_invalidates_previous_temp_password(client, outbox, user):
    first = issue_temp_password(client, outbox, user.email)
    expire_cooldown(user.email)
    second = issue_temp_password(client, outbox, user.email)

    assert login(client, user.email, first).status_code == 401
    assert login(client, user.email, second).status_code == 200


def test_temp_password_of_another_user_does_not_work(client, outbox, user, other_user):
    other_temp = issue_temp_password(client, outbox, other_user.email)
    assert login(client, user.email, other_temp).status_code == 401


def test_expired_temp_password_is_rejected(client, outbox, user, db_session):
    temp = issue_temp_password(client, outbox, user.email)
    record = latest_reset_record(db_session, user.id)
    record.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    db_session.commit()

    assert login(client, user.email, temp).status_code == 401
    assert login(client, user.email, user.password).status_code == 200


def test_temp_password_valid_until_just_before_expiry(client, outbox, user, db_session):
    temp = issue_temp_password(client, outbox, user.email)
    record = latest_reset_record(db_session, user.id)
    record.expires_at = datetime.now(timezone.utc) + timedelta(minutes=1)
    db_session.commit()

    assert login(client, user.email, temp).status_code == 200


def test_temp_password_counts_as_failure_when_wrong(client, outbox, user):
    issue_temp_password(client, outbox, user.email)
    resp = login(client, user.email, "WRONGTEMP1")
    assert resp.status_code == 401


# --- смена пароля ------------------------------------------------------------------------


def _login_with_temp(client, outbox, user):
    temp = issue_temp_password(client, outbox, user.email)
    resp = login(client, user.email, temp)
    assert resp.status_code == 200
    return temp, resp.json()["access_token"]


def test_change_password_after_temp_login_needs_no_current(client, outbox, user):
    temp, token = _login_with_temp(client, outbox, user)

    resp = client.post(CHANGE_URL, json={"new_password": "brand-new-1"}, headers=bearer(token))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["access_token"]
    assert body["user"]["must_change_password"] is False

    assert login(client, user.email, "brand-new-1").status_code == 200
    assert login(client, user.email, temp).status_code == 401
    assert login(client, user.email, user.password).status_code == 401
    me = client.get("/api/auth/me", headers=bearer(body["access_token"]))
    assert me.json()["must_change_password"] is False


def test_change_password_after_temp_login_rejects_same_as_temp(client, outbox, user):
    temp, token = _login_with_temp(client, outbox, user)
    resp = client.post(CHANGE_URL, json={"new_password": temp}, headers=bearer(token))
    assert resp.status_code == 422


def test_change_password_requires_current_when_not_forced(client, user):
    resp = client.post(CHANGE_URL, json={"new_password": "brand-new-1"}, headers=user.headers)
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Неверный текущий пароль"


def test_change_password_wrong_current_is_400(client, user):
    resp = client.post(
        CHANGE_URL,
        json={"current_password": "wrong-current", "new_password": "brand-new-1"},
        headers=user.headers,
    )
    assert resp.status_code == 400
    assert login(client, user.email, user.password).status_code == 200


def test_change_password_same_as_current_is_422(client, user):
    resp = client.post(
        CHANGE_URL,
        json={"current_password": user.password, "new_password": user.password},
        headers=user.headers,
    )
    assert resp.status_code == 422
    assert "совпадает" in resp.json()["detail"]


@pytest.mark.parametrize("new_password", ["12345", "", "x" * 129])
def test_change_password_bad_length_is_422(client, user, new_password):
    resp = client.post(
        CHANGE_URL,
        json={"current_password": user.password, "new_password": new_password},
        headers=user.headers,
    )
    assert resp.status_code == 422


def test_change_password_success_with_current(client, user):
    resp = client.post(
        CHANGE_URL,
        json={"current_password": user.password, "new_password": "brand-new-1"},
        headers=user.headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["user"]["must_change_password"] is False
    assert login(client, user.email, user.password).status_code == 401
    assert login(client, user.email, "brand-new-1").status_code == 200


def test_change_password_cancels_pending_temp_password(client, outbox, user):
    temp = issue_temp_password(client, outbox, user.email)
    resp = client.post(
        CHANGE_URL,
        json={"current_password": user.password, "new_password": "brand-new-1"},
        headers=user.headers,
    )
    assert resp.status_code == 200
    assert login(client, user.email, temp).status_code == 401


def test_change_password_requires_auth(client):
    resp = client.post(CHANGE_URL, json={"current_password": "a", "new_password": "brand-new-1"})
    assert resp.status_code == 401


def test_send_failure_keeps_previous_temp_password(client, outbox, user, monkeypatch, db_session):
    first = issue_temp_password(client, outbox, user.email)
    expire_cooldown(user.email)

    def _boom(*_args, **_kwargs):
        raise mailer.MailerError("smtp down")

    monkeypatch.setattr(mailer, "send_email_sync", _boom)
    assert request_reset(client, user.email).status_code == 503
    assert login(client, user.email, first).status_code == 200


def test_temp_password_not_consumed_for_inactive_user(client, outbox, user, db_session):
    temp = issue_temp_password(client, outbox, user.email)
    set_user_active(user.email, False)
    assert login(client, user.email, temp).status_code == 401
    record = latest_reset_record(db_session, user.id)
    assert record.used_at is None

    set_user_active(user.email, True)
    # Прежний пароль не заменён, временный по-прежнему действует.
    assert login(client, user.email, user.password).status_code == 200
    assert login(client, user.email, temp).json()["user"]["must_change_password"] is True


# --- отзыв сессий и обязательная смена временного пароля ----------------------------------


def test_change_password_revokes_other_sessions(client, user):
    other_device = login(client, user.email, user.password).json()["access_token"]
    resp = client.post(
        CHANGE_URL,
        json={"current_password": user.password, "new_password": "brand-new-1"},
        headers=user.headers,
    )
    assert resp.status_code == 200
    fresh = resp.json()["access_token"]

    assert client.get("/api/auth/me", headers=user.headers).status_code == 401
    assert client.get("/api/auth/me", headers=bearer(other_device)).status_code == 401
    assert client.get("/api/auth/me", headers=bearer(fresh)).status_code == 200
    assert client.get("/api/users/me/profile", headers=bearer(fresh)).status_code == 200


def test_temp_password_login_revokes_existing_sessions(client, outbox, user):
    _temp, temp_token = _login_with_temp(client, outbox, user)
    assert client.get("/api/auth/me", headers=user.headers).status_code == 401
    assert client.get("/api/auth/me", headers=bearer(temp_token)).status_code == 200


def test_repeated_temp_login_keeps_session_until_change(client, outbox, user):
    temp, first_token = _login_with_temp(client, outbox, user)
    assert login(client, user.email, temp).status_code == 200
    # Повторный вход тем же временным паролем уже не «потребляет» письмо и не отзывает токены.
    assert client.get("/api/auth/me", headers=bearer(first_token)).status_code == 200


def test_must_change_password_blocks_other_endpoints(client, outbox, user, catalog):
    _temp, token = _login_with_temp(client, outbox, user)
    headers = bearer(token)

    blocked = client.get("/api/users/me/profile", headers=headers)
    assert blocked.status_code == 403
    assert blocked.json()["detail"] == "Сначала смените временный пароль"
    comment = client.post(
        "/api/comments",
        json={"climb_type": "route", "route_id": catalog["route"]["id"], "body": "Привет"},
        headers=headers,
    )
    assert comment.status_code == 403
    # Необязательная авторизация: такой токен — как аноним.
    stats = client.get(
        "/api/climbs/stats", params={"climb_type": "route", "route_id": catalog["route"]["id"]}, headers=headers
    )
    assert stats.status_code == 200
    assert client.get("/api/auth/me", headers=headers).status_code == 200

    changed = client.post(CHANGE_URL, json={"new_password": "brand-new-1"}, headers=headers)
    assert changed.status_code == 200
    new_headers = bearer(changed.json()["access_token"])
    assert client.get("/api/users/me/profile", headers=new_headers).status_code == 200


def test_full_recovery_flow_end_to_end(client, outbox):
    u = register_user(client, password="original-pw")
    temp = issue_temp_password(client, outbox, u.email)
    token = login(client, u.email, temp).json()["access_token"]
    changed = client.post(CHANGE_URL, json={"new_password": "final-pw-1"}, headers=bearer(token))
    assert changed.status_code == 200

    expire_cooldown(u.email)
    temp2 = issue_temp_password(client, outbox, u.email)
    assert temp2 != temp
    assert login(client, u.email, "final-pw-1").status_code == 200
    assert login(client, u.email, temp2).json()["user"]["must_change_password"] is True
