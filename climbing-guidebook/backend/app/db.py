from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


connect_args = {}
if settings.database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine_kwargs = {
    "connect_args": connect_args,
    "echo": False,
}
if not settings.database_url.startswith("sqlite"):
    # Managed PostgreSQL can close idle SSL sessions; validate pooled connections
    # before reuse so the first user after idle does not receive a 500.
    engine_kwargs.update(
        pool_pre_ping=True,
        pool_recycle=300,
    )

engine = create_engine(
    settings.database_url,
    **engine_kwargs,
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
            "ALTER TABLE photos ADD COLUMN IF NOT EXISTS climb_name VARCHAR(255)",
            "ALTER TABLE photos ADD COLUMN IF NOT EXISTS climb_category VARCHAR(64)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id BIGINT",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_username VARCHAR(64)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_photo_url VARCHAR(512)",
            "ALTER TABLE climb_ascents ADD COLUMN IF NOT EXISTS ascent_style VARCHAR(16)",
        ]
    else:
        statements = [
            "ALTER TABLE routes ADD COLUMN category VARCHAR(64)",
            "ALTER TABLE routes ADD COLUMN rating FLOAT",
            "ALTER TABLE boulders ADD COLUMN category VARCHAR(64)",
            "ALTER TABLE boulders ADD COLUMN rating FLOAT",
            "ALTER TABLE photos ADD COLUMN climb_name VARCHAR(255)",
            "ALTER TABLE photos ADD COLUMN climb_category VARCHAR(64)",
            "ALTER TABLE users ADD COLUMN telegram_id INTEGER",
            "ALTER TABLE users ADD COLUMN telegram_username VARCHAR(64)",
            "ALTER TABLE users ADD COLUMN telegram_photo_url VARCHAR(512)",
            "ALTER TABLE climb_ascents ADD COLUMN ascent_style VARCHAR(16)",
        ]
    with engine.begin() as conn:
        for stmt in statements:
            try:
                conn.execute(text(stmt))
            except Exception:
                # Column already exists (or backend doesn't support IF NOT EXISTS for ADD COLUMN).
                pass

        # Backfill photo metadata for older records where these fields were absent before.
        backfill_sql = [
            """
            UPDATE photos
            SET climb_name = (
                SELECT routes.name FROM routes WHERE routes.id = photos.route_id
            )
            WHERE climb_type = 'route' AND route_id IS NOT NULL AND (climb_name IS NULL OR climb_name = '')
            """,
            """
            UPDATE photos
            SET climb_category = (
                SELECT routes.category FROM routes WHERE routes.id = photos.route_id
            )
            WHERE climb_type = 'route' AND route_id IS NOT NULL AND climb_category IS NULL
            """,
            """
            UPDATE photos
            SET climb_name = (
                SELECT boulders.name FROM boulders WHERE boulders.id = photos.boulder_id
            )
            WHERE climb_type = 'boulder' AND boulder_id IS NOT NULL AND (climb_name IS NULL OR climb_name = '')
            """,
            """
            UPDATE photos
            SET climb_category = (
                SELECT boulders.category FROM boulders WHERE boulders.id = photos.boulder_id
            )
            WHERE climb_type = 'boulder' AND boulder_id IS NOT NULL AND climb_category IS NULL
            """,
        ]
        for stmt in backfill_sql:
            try:
                conn.execute(text(stmt))
            except Exception:
                # Keep startup resilient if one DB backend rejects a statement.
                pass
