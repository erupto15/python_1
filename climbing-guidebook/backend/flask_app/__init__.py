"""Flask: альтернативная точка входа с тем же SQLAlchemy и настройками из YAML / .env."""

from __future__ import annotations

from flask import Flask, jsonify
from sqlalchemy import text

from app.config import settings
from app.db import Base, SessionLocal, engine, ensure_optional_columns
from app.seed import bootstrap_catalog


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["DATABASE_URL"] = settings.database_url
    app.config["APP_TITLE"] = settings.app_title

    @app.get("/health")
    def health() -> tuple[dict, int]:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return jsonify(status="ok", app=settings.app_title), 200

    @app.get("/api/db-info")
    def db_info() -> dict:
        url = engine.url
        return {
            "driver": url.drivername,
            "database": url.database,
            "host": url.host,
            "configured_via": "config/settings.yaml, .env, or DATABASE_URL",
        }

    return app


def init_database() -> None:
    """Создать таблицы и администратора (как при старте FastAPI)."""
    Base.metadata.create_all(bind=engine)
    ensure_optional_columns()
    db = SessionLocal()
    try:
        bootstrap_catalog(db)
    finally:
        db.close()
