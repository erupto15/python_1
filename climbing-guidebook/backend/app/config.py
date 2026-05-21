import os
from urllib.parse import urlparse

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "sqlite:///./climbing.db"

    @staticmethod
    def _is_production_env() -> bool:
        env = (
            os.getenv("APP_ENV")
            or os.getenv("ENV")
            or os.getenv("ENVIRONMENT")
            or os.getenv("PYTHON_ENV")
            or ""
        ).strip().lower()
        return env in {"prod", "production"} or os.getenv("RENDER") == "true"

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, v: object) -> object:
        """Render/Heroku отдают postgres:// — для SQLAlchemy + psycopg2 нужен драйвер в URL."""
        if not isinstance(v, str):
            return v
        s = v.strip()
        # Пустая строка в Render (переменная задана, но без значения) ломает SQLAlchemy при импорте engine.
        if not s:
            if cls._is_production_env():
                raise ValueError(
                    "DATABASE_URL пустой в production. Подключите PostgreSQL и укажите "
                    "Internal Database URL в переменной DATABASE_URL."
                )
            return "sqlite:///./climbing.db"
        if s.startswith("postgres://"):
            return "postgresql+psycopg2://" + s[len("postgres://") :]
        if s.startswith("postgresql://") and not s.startswith("postgresql+"):
            return "postgresql+psycopg2://" + s[len("postgresql://") :]
        return s

    @field_validator("database_url", mode="after")
    @classmethod
    def reject_placeholder_database_host(cls, v: str) -> str:
        """Ловит типичную ошибку: в URL оставили слово host из примера вместо реального хоста Render."""
        if not isinstance(v, str):
            return v
        if v.startswith("sqlite"):
            if cls._is_production_env():
                raise ValueError(
                    "SQLite недопустим в production: у web-сервиса временный диск, данные теряются "
                    "после рестарта/деплоя. Укажите PostgreSQL DATABASE_URL."
                )
            return v
        host = (urlparse(v).hostname or "").lower()
        if host in ("host", "хост"):
            raise ValueError(
                "DATABASE_URL указывает заглушечный хост «host»/«хост». "
                "В Render откройте сервис PostgreSQL → Connections → Internal Database URL "
                "и вставьте эту строку целиком в DATABASE_URL веб-сервиса (или Link database)."
            )
        return v

    app_title: str = "Climbing Guidebook API"

    # JWT: в продакшене обязательно задайте JWT_SECRET в окружении
    jwt_secret: str = "dev-only-change-me-use-openssl-rand-hex-32"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7

    # Учётка администратора каталога (создаётся при первом старте, если email свободен)
    admin_email: str = "admin@climbing-guidebook.local"
    admin_password: str = "admin"
    admin_display_name: str = "Administrator"
    telegram_bot_token: str = ""
    telegram_auth_max_age_sec: int = 86400


settings = Settings()
