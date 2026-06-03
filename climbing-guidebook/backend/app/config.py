import os
from pathlib import Path
from typing import Any
from urllib.parse import quote_plus, urlparse

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, PydanticBaseSettingsSource, SettingsConfigDict

from app.yaml_settings import YamlSettingsSource

_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_ROOT_ENV_FILE = _PROJECT_ROOT / ".env"
_DEFAULT_SQLITE_URL = f"sqlite:///{(_PROJECT_ROOT / 'climbing-guidebook/backend/climbing.db').resolve()}"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ROOT_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        # Первый источник в pydantic-settings имеет наивысший приоритет.
        return (
            init_settings,
            env_settings,
            dotenv_settings,
            YamlSettingsSource(settings_cls),
            file_secret_settings,
        )

    database_url: str = _DEFAULT_SQLITE_URL

    # Альтернатива DATABASE_URL: задайте POSTGRES_HOST + POSTGRES_PASSWORD (+ опционально порт/юзер/базу)
    postgres_host: str = ""
    postgres_port: int = 5432
    postgres_user: str = "postgres"
    postgres_password: str = ""
    postgres_db: str = "postgres"

    @model_validator(mode="before")
    @classmethod
    def assemble_database_url_from_postgres_parts(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data

        raw_url = (data.get("database_url") or os.getenv("DATABASE_URL") or "").strip()
        if raw_url and not raw_url.startswith("sqlite"):
            return data

        host = (data.get("postgres_host") or os.getenv("POSTGRES_HOST") or "").strip()
        password = data.get("postgres_password")
        if password is None:
            password = os.getenv("POSTGRES_PASSWORD", "")
        password = str(password).strip()

        use_parts = bool(host and password)
        if not use_parts:
            return data

        port = data.get("postgres_port") or os.getenv("POSTGRES_PORT") or 5432
        user = (data.get("postgres_user") or os.getenv("POSTGRES_USER") or "postgres").strip()
        db = (data.get("postgres_db") or os.getenv("POSTGRES_DB") or "postgres").strip()
        data["database_url"] = (
            f"postgresql+psycopg2://{quote_plus(user)}:{quote_plus(password)}"
            f"@{host}:{port}/{db}"
        )
        return data

    @staticmethod
    def _is_production_env() -> bool:
        env = (
            os.getenv("APP_ENV")
            or os.getenv("ENV")
            or os.getenv("ENVIRONMENT")
            or os.getenv("PYTHON_ENV")
            or ""
        ).strip().lower()
        return env in {"prod", "production"}

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, v: object) -> object:
        """postgres:// URLs need an explicit psycopg2 driver for SQLAlchemy."""
        if not isinstance(v, str):
            return v
        s = v.strip()
        if not s:
            if cls._is_production_env():
                raise ValueError(
                    "DATABASE_URL пустой в production. Подключите PostgreSQL и укажите "
                    "PostgreSQL connection string в переменной DATABASE_URL."
                )
            return _DEFAULT_SQLITE_URL
        if s.startswith("postgres://"):
            s = "postgresql+psycopg2://" + s[len("postgres://") :]
        if s.startswith("postgresql://") and not s.startswith("postgresql+"):
            s = "postgresql+psycopg2://" + s[len("postgresql://") :]
        if s.startswith("sqlite:///") and not s.startswith("sqlite:////") and s != "sqlite:///:memory:":
            sqlite_path = s[len("sqlite:///") :]
            if sqlite_path:
                s = f"sqlite:///{(_PROJECT_ROOT / sqlite_path).resolve()}"
        return s

    @field_validator("database_url", mode="after")
    @classmethod
    def reject_placeholder_database_host(cls, v: str) -> str:
        """Ловит типичную ошибку: в URL оставили слово host из примера."""
        if not isinstance(v, str):
            return v
        if v.startswith("sqlite"):
            if cls._is_production_env():
                raise ValueError(
                    "SQLite недопустим в production: данные теряются после рестарта/деплоя. "
                    "Укажите PostgreSQL DATABASE_URL или POSTGRES_* переменные."
                )
            return v
        host = (urlparse(v).hostname or "").lower()
        if host in ("host", "хост"):
            raise ValueError(
                "DATABASE_URL указывает заглушечный хост «host»/«хост». "
                "Вставьте реальную PostgreSQL connection string в DATABASE_URL."
            )
        return v

    app_title: str = "Climbing Guidebook API"

    # JWT: в продакшене обязательно задайте JWT_SECRET в окружении
    jwt_secret: str = "dev-only-change-me-use-openssl-rand-hex-32"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7

    # Учётка администратора каталога (создаётся при первом старте, если email свободен)
    admin_email: str = "admin@climbing-guidebook.local"
    admin_password: str = ""
    admin_display_name: str = "Administrator"
    telegram_bot_token: str = ""
    telegram_auth_max_age_sec: int = 86400


settings = Settings()
