from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


connect_args = {}
if settings.database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.database_url,
    connect_args=connect_args,
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_optional_columns() -> None:
    """Lightweight runtime migration for optional metadata columns."""
    dialect = engine.dialect.name
    if dialect == "postgresql":
        statements = [
            "ALTER TABLE routes ADD COLUMN IF NOT EXISTS category VARCHAR(64)",
            "ALTER TABLE routes ADD COLUMN IF NOT EXISTS rating DOUBLE PRECISION",
            "ALTER TABLE boulders ADD COLUMN IF NOT EXISTS category VARCHAR(64)",
            "ALTER TABLE boulders ADD COLUMN IF NOT EXISTS rating DOUBLE PRECISION",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id BIGINT",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_username VARCHAR(64)",
        ]
    else:
        statements = [
            "ALTER TABLE routes ADD COLUMN category VARCHAR(64)",
            "ALTER TABLE routes ADD COLUMN rating FLOAT",
            "ALTER TABLE boulders ADD COLUMN category VARCHAR(64)",
            "ALTER TABLE boulders ADD COLUMN rating FLOAT",
            "ALTER TABLE users ADD COLUMN telegram_id INTEGER",
            "ALTER TABLE users ADD COLUMN telegram_username VARCHAR(64)",
        ]
    with engine.begin() as conn:
        for stmt in statements:
            try:
                conn.execute(text(stmt))
            except Exception:
                # Column already exists (or backend doesn't support IF NOT EXISTS for ADD COLUMN).
                pass
