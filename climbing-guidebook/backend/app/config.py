from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "sqlite:///./climbing.db"
    app_title: str = "Climbing Guidebook API"

    # JWT: в продакшене обязательно задайте JWT_SECRET в окружении
    jwt_secret: str = "dev-only-change-me-use-openssl-rand-hex-32"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7

    # Учётка администратора каталога (создаётся при первом старте, если email свободен)
    admin_email: str = "admin@climbing-guidebook.local"
    admin_password: str = "admin"
    admin_display_name: str = "Administrator"


settings = Settings()
