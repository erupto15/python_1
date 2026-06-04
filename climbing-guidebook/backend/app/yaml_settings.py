"""Загрузка настроек из YAML (config/settings.yaml или CONFIG_FILE)."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import yaml
from pydantic.fields import FieldInfo
from pydantic_settings import BaseSettings, PydanticBaseSettingsSource

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
_DEFAULT_YAML = _BACKEND_ROOT / "config" / "settings.yaml"


def resolve_config_path() -> Path:
    raw = os.getenv("CONFIG_FILE", "").strip()
    if raw:
        return Path(raw).expanduser().resolve()
    return _DEFAULT_YAML


def flatten_yaml_config(data: dict[str, Any]) -> dict[str, Any]:
    """Преобразует вложенный YAML в поля Settings."""
    out: dict[str, Any] = {}

    database = data.get("database") or {}
    if database.get("url"):
        out["database_url"] = database["url"]

    app_cfg = data.get("app") or {}
    if app_cfg.get("title"):
        out["app_title"] = app_cfg["title"]

    jwt = data.get("jwt") or {}
    if jwt.get("secret"):
        out["jwt_secret"] = jwt["secret"]
    if jwt.get("algorithm"):
        out["jwt_algorithm"] = jwt["algorithm"]
    if jwt.get("access_token_expire_minutes") is not None:
        out["access_token_expire_minutes"] = jwt["access_token_expire_minutes"]

    admin = data.get("admin") or {}
    if admin.get("email"):
        out["admin_email"] = admin["email"]
    if admin.get("password"):
        out["admin_password"] = admin["password"]
    if admin.get("display_name"):
        out["admin_display_name"] = admin["display_name"]

    telegram = data.get("telegram") or {}
    if "bot_token" in telegram:
        out["telegram_bot_token"] = telegram["bot_token"] or ""
    if telegram.get("auth_max_age_sec") is not None:
        out["telegram_auth_max_age_sec"] = telegram["auth_max_age_sec"]

    return out


def load_yaml_settings(path: Path | None = None) -> dict[str, Any]:
    config_path = path or resolve_config_path()
    if not config_path.is_file():
        return {}
    with config_path.open(encoding="utf-8") as handle:
        raw = yaml.safe_load(handle) or {}
    if not isinstance(raw, dict):
        raise ValueError(f"Корень {config_path} должен быть объектом YAML (mapping).")
    out = flatten_yaml_config(raw)
    # DATABASE_URL из systemd / GitHub deploy всегда важнее settings.yaml
    if os.getenv("DATABASE_URL", "").strip():
        out.pop("database_url", None)
    return out


class YamlSettingsSource(PydanticBaseSettingsSource):
    def get_field_value(self, field: FieldInfo, field_name: str) -> tuple[Any, str, bool]:
        return self._values.get(field_name), field_name, False

    def prepare_field_value(self, field_name: str, field: FieldInfo, value: Any, value_is_complex: bool) -> Any:
        return value

    def __init__(self, settings_cls: type[BaseSettings]) -> None:
        super().__init__(settings_cls)
        self._values = load_yaml_settings()

    def __call__(self) -> dict[str, Any]:
        return self._values
