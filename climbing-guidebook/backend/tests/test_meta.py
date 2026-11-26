from __future__ import annotations

import io

import pytest

from app.routers import app_meta, telegram

# --- служебные эндпоинты ------------------------------------------------------------------


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["database"] == "sqlite"
    assert body["persistent_storage"] is False
    assert set(body["catalog_counts"]) == {"areas", "sectors", "routes", "boulders", "photos"}


def test_map_tiles_config_defaults_to_osm(client):
    assert client.get("/api/map-tiles-config").json() == {"provider": "osm"}


def test_unknown_api_path_is_404(client):
    assert client.get("/api/definitely-not-here").status_code == 404


# --- конфигурация ---------------------------------------------------------------------------

_PROD_DB_URL = "postgresql://user:pass@db.example.com:5432/guide"


def _settings(**overrides):
    from app.config import Settings

    return Settings(_env_file=None, database_url=_PROD_DB_URL, **overrides)


@pytest.mark.parametrize("secret", [None, "", "   "])
def test_production_refuses_default_or_empty_jwt_secret(monkeypatch, secret):
    from pydantic import ValidationError

    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("JWT_SECRET", raising=False)
    overrides = {} if secret is None else {"jwt_secret": secret}
    with pytest.raises(ValidationError, match="JWT_SECRET"):
        _settings(**overrides)


def test_production_accepts_custom_jwt_secret(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    assert _settings(jwt_secret="a" * 64).jwt_secret == "a" * 64


def test_development_allows_default_jwt_secret(monkeypatch):
    from app.config import DEFAULT_JWT_SECRET

    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.delenv("JWT_SECRET", raising=False)
    assert _settings().jwt_secret == DEFAULT_JWT_SECRET


@pytest.fixture
def fresh_release_cache(monkeypatch):
    monkeypatch.setattr(app_meta, "_release_cache", None)


def test_app_version_without_github(client, fresh_release_cache):
    """Сеть заблокирована фикстурой — запрос к GitHub падает, android = null."""
    resp = client.get("/api/app/version")
    assert resp.status_code == 200
    body = resp.json()
    assert body["android"] is None
    assert isinstance(body["web_build"], str) and len(body["web_build"]) == 16


def test_app_version_with_release(client, fresh_release_cache, monkeypatch):
    release = {
        "version_code": 42,
        "version_name": "1.2.3",
        "asset_name": "guide-c42.apk",
        "size": 1024,
        "download_url": "https://example.invalid/guide-c42.apk",
        "notes": "Исправления",
    }

    async def _fake_release():
        return release

    monkeypatch.setattr(app_meta, "_latest_android_release", _fake_release)
    body = client.get("/api/app/version").json()
    assert body["android"] == {
        "version_code": 42,
        "version_name": "1.2.3",
        "size": 1024,
        "notes": "Исправления",
        "apk_url": "/api/app/android/apk?v=42",
    }


def test_android_apk_404_without_release(client, fresh_release_cache):
    assert client.get("/api/app/android/apk").status_code == 404


@pytest.mark.parametrize(
    ("release", "expected"),
    [
        ({"tag_name": "android-v1.0.5", "assets": [{"name": "app-c105.apk", "size": 10}]}, 105),
        ({"tag_name": "android-v1.0.5", "draft": True, "assets": [{"name": "app-c105.apk"}]}, None),
        ({"tag_name": "android-v1.0.5", "prerelease": True, "assets": [{"name": "app-c105.apk"}]}, None),
        ({"tag_name": "web-v1.0.5", "assets": [{"name": "app-c105.apk"}]}, None),
        ({"tag_name": "android-v1.0.5", "assets": [{"name": "app.apk"}]}, None),
    ],
)
def test_parse_android_release(release, expected):
    parsed = app_meta._parse_android_release(release)
    assert (parsed["version_code"] if parsed else None) == expected


# --- telegram webhook (без сети) ---------------------------------------------------------


@pytest.fixture
def sent_telegram(monkeypatch):
    calls: list[dict] = []

    async def _fake_send_message(**kwargs):
        calls.append(kwargs)
        return {"ok": True, "result": {"message_id": 1}}

    monkeypatch.setattr(telegram, "send_message", _fake_send_message)
    monkeypatch.setattr(telegram, "_start_guide_messages", {})
    return calls


def test_telegram_webhook_ignores_non_start(client, sent_telegram):
    resp = client.post("/api/telegram/webhook", json={"message": {"text": "hello", "chat": {"id": 1}}})
    assert resp.json() == {"ok": True}
    assert sent_telegram == []


def test_telegram_webhook_start_sends_mini_app_button(client, sent_telegram):
    resp = client.post("/api/telegram/webhook", json={"message": {"text": "/start", "chat": {"id": 77}}})
    assert resp.json() == {"ok": True}
    assert len(sent_telegram) == 1
    assert sent_telegram[0]["chat_id"] == 77
    button = sent_telegram[0]["reply_markup"]["inline_keyboard"][0][0]
    assert button["web_app"]["url"].endswith("/")


def test_telegram_webhook_checks_secret(client, sent_telegram, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "telegram_webhook_secret", "s3cret")
    update = {"message": {"text": "/start", "chat": {"id": 5}}}
    assert client.post("/api/telegram/webhook", json=update).status_code == 403
    ok = client.post(
        "/api/telegram/webhook", json=update, headers={"X-Telegram-Bot-Api-Secret-Token": "s3cret"}
    )
    assert ok.status_code == 200
    assert len(sent_telegram) == 1


# --- загрузка медиа -----------------------------------------------------------------------

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
JPEG_BYTES = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00" + b"\x00" * 32
GIF_BYTES = b"GIF89a" + b"\x00" * 32
WEBP_BYTES = b"RIFF\x24\x00\x00\x00WEBPVP8 " + b"\x00" * 32
HEIC_BYTES = b"\x00\x00\x00\x18ftypheic\x00\x00\x00\x00mif1heic" + b"\x00" * 16
MOV_BYTES = b"\x00\x00\x00\x14ftypqt  \x00\x00\x02\x00qt  " + b"\x00" * 16
MP4_BYTES = b"\x00\x00\x00\x18ftypisom\x00\x00\x02\x00isomiso2" + b"\x00" * 16
WEBM_BYTES = b"\x1a\x45\xdf\xa3\x9f\x42\x86\x81\x01\x42\xf7\x81\x01\x42\x82\x84webm" + b"\x00" * 16


def _upload(client, headers, name, content, mime, kind=None):
    data = {"kind": kind} if kind else None
    return client.post(
        "/api/media/upload", files={"file": (name, io.BytesIO(content), mime)}, data=data, headers=headers
    )


def test_media_upload_requires_auth(client):
    assert _upload(client, {}, "a.png", PNG_BYTES, "image/png").status_code == 401


def test_media_upload_image_and_serve(client, user):
    resp = _upload(client, user.headers, "photo.png", PNG_BYTES, "image/png")
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["media_kind"] == "image"
    assert body["file_size_bytes"] == len(PNG_BYTES)
    assert body["url"].startswith("/uploads/images/") and body["url"].endswith(".png")
    assert body["mime_type"] == "image/png"
    served = client.get(body["url"])
    assert served.status_code == 200
    assert served.content == PNG_BYTES
    assert served.headers["x-content-type-options"] == "nosniff"
    assert "sandbox" in served.headers["content-security-policy"]


@pytest.mark.parametrize(
    ("name", "content", "kind", "url_suffix"),
    [
        ("clip.mov", MOV_BYTES, "video", ".mov"),
        ("clip.mp4", MP4_BYTES, "video", ".mp4"),
        ("clip.webm", WEBM_BYTES, "video", ".webm"),
        ("photo.jpg", JPEG_BYTES, "image", ".jpg"),
        ("photo.webp", WEBP_BYTES, "image", ".webp"),
        ("photo.gif", GIF_BYTES, "image", ".gif"),
        ("IMG_0001.HEIC", HEIC_BYTES, "image", ".heic"),
    ],
)
def test_media_upload_type_detected_by_content(client, user, name, content, kind, url_suffix):
    # Мобильные клиенты нередко присылают octet-stream — тип определяется по сигнатуре.
    resp = _upload(client, user.headers, name, content, "application/octet-stream")
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["media_kind"] == kind
    assert body["url"].startswith(f"/uploads/{kind}s/") and body["url"].endswith(url_suffix)


def test_media_upload_extension_comes_from_content_not_filename(client, user):
    resp = _upload(client, user.headers, "photo.svg", JPEG_BYTES, "image/svg+xml")
    assert resp.status_code == 201, resp.text
    assert resp.json()["url"].endswith(".jpg")
    assert resp.json()["mime_type"] == "image/jpeg"
    assert client.get(resp.json()["url"]).headers["content-type"] == "image/jpeg"


@pytest.mark.parametrize(
    ("name", "content", "mime", "kind", "status"),
    [
        ("doc.txt", b"hello", "text/plain", None, 415),
        ("empty.png", b"", "image/png", None, 400),
        ("a.png", PNG_BYTES, "image/png", "audio", 400),
        ("a.svg", b"<svg xmlns='http://www.w3.org/2000/svg'><script>1</script></svg>", "image/svg+xml", None, 415),
        ("clip.mov", PNG_BYTES, "video/quicktime", None, 400),
        ("photo.png", MP4_BYTES, "application/octet-stream", "image", 400),
    ],
)
def test_media_upload_rejections(client, user, name, content, mime, kind, status):
    resp = _upload(client, user.headers, name, content, mime, kind)
    assert resp.status_code == status
    assert isinstance(resp.json()["detail"], str)


def test_media_upload_size_limit(client, user, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "media_max_upload_bytes", 10)
    assert _upload(client, user.headers, "big.png", PNG_BYTES, "image/png").status_code == 413


@pytest.mark.parametrize("name", ["evil.html", "evil.png"])
def test_media_upload_rejects_html_disguised_as_image(client, user, name):
    payload = b"<script>alert(1)</script>"
    resp = _upload(client, user.headers, name, payload, "image/png")
    assert resp.status_code == 415
    assert "Неподдерживаемый формат" in resp.json()["detail"]


# --- ИИ-помощник (локальный разбор без ключа) ----------------------------------------------


def test_assistant_search_query_requires_input(client):
    assert client.post("/api/assistant/search-query", data={"prompt": "  "}).status_code == 400


def test_assistant_parse_admin_only(client, user):
    assert client.post("/api/assistant/parse", data={"prompt": "Сектор Скала"}).status_code == 401
    assert client.post("/api/assistant/parse", data={"prompt": "Сектор Скала"}, headers=user.headers).status_code == 403
