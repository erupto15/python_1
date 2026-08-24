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
            "ALTER TABLE areas ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ",
            "ALTER TABLE sectors ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ",
            "ALTER TABLE areas ADD COLUMN IF NOT EXISTS access TEXT",
            "ALTER TABLE areas ADD COLUMN IF NOT EXISTS season TEXT",
            "ALTER TABLE areas ADD COLUMN IF NOT EXISTS parking TEXT",
            "ALTER TABLE areas ADD COLUMN IF NOT EXISTS approach TEXT",
            "ALTER TABLE areas ADD COLUMN IF NOT EXISTS warnings TEXT",
            "ALTER TABLE areas ADD COLUMN IF NOT EXISTS image_url TEXT",
            "ALTER TABLE sectors ADD COLUMN IF NOT EXISTS access TEXT",
            "ALTER TABLE sectors ADD COLUMN IF NOT EXISTS season TEXT",
            "ALTER TABLE sectors ADD COLUMN IF NOT EXISTS parking TEXT",
            "ALTER TABLE sectors ADD COLUMN IF NOT EXISTS approach TEXT",
            "ALTER TABLE sectors ADD COLUMN IF NOT EXISTS warnings TEXT",
            "ALTER TABLE sectors ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION",
            "ALTER TABLE sectors ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION",
            "ALTER TABLE routes ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0",
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
            "ALTER TABLE areas ADD COLUMN deleted_at TEXT",
            "ALTER TABLE sectors ADD COLUMN deleted_at TEXT",
            "ALTER TABLE areas ADD COLUMN access TEXT",
            "ALTER TABLE areas ADD COLUMN season TEXT",
            "ALTER TABLE areas ADD COLUMN parking TEXT",
            "ALTER TABLE areas ADD COLUMN approach TEXT",
            "ALTER TABLE areas ADD COLUMN warnings TEXT",
            "ALTER TABLE areas ADD COLUMN image_url TEXT",
            "ALTER TABLE sectors ADD COLUMN access TEXT",
            "ALTER TABLE sectors ADD COLUMN season TEXT",
            "ALTER TABLE sectors ADD COLUMN parking TEXT",
            "ALTER TABLE sectors ADD COLUMN approach TEXT",
            "ALTER TABLE sectors ADD COLUMN warnings TEXT",
            "ALTER TABLE sectors ADD COLUMN latitude REAL",
            "ALTER TABLE sectors ADD COLUMN longitude REAL",
            "ALTER TABLE routes ADD COLUMN sort_order INTEGER DEFAULT 0",
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

        # One-time: if every route still has the column default (0), seed from id.
        try:
            stats = conn.execute(
                text(
                    "SELECT COUNT(*), COALESCE(MAX(sort_order), 0), COALESCE(MIN(sort_order), 0) "
                    "FROM routes"
                )
            ).one()
            count, max_so, min_so = int(stats[0] or 0), int(stats[1] or 0), int(stats[2] or 0)
            if count > 0 and max_so == 0 and min_so == 0:
                conn.execute(text("UPDATE routes SET sort_order = id"))
        except Exception:
            pass
