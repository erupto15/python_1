from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import logging

from app.config import settings
from app.db import Base, SessionLocal, engine, ensure_optional_columns

logger = logging.getLogger(__name__)
from app.routers import areas, auth, boulders, comments, photos, routes_api, sectors, users
from app.seed import bootstrap_catalog


@asynccontextmanager
async def lifespan(_: FastAPI):
    dialect = engine.dialect.name
    if dialect == "sqlite":
        logger.warning(
            "БД: SQLite (%s). Данные НЕ сохраняются между деплоями на Render. "
            "Задайте DATABASE_URL на PostgreSQL (Supabase).",
            settings.database_url,
        )
    else:
        host = engine.url.host or "(local)"
        logger.info("БД: %s, host=%s, database=%s", dialect, host, engine.url.database)

    Base.metadata.create_all(bind=engine)
    ensure_optional_columns()
    db = SessionLocal()
    try:
        bootstrap_catalog(db)
    finally:
        db.close()
    yield


app = FastAPI(title=settings.app_title, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(areas.router, prefix="/api")
app.include_router(sectors.router, prefix="/api")
app.include_router(routes_api.router, prefix="/api")
app.include_router(boulders.router, prefix="/api")
app.include_router(photos.router, prefix="/api")
app.include_router(comments.router, prefix="/api")


@app.get("/health")
def health() -> dict[str, str | bool]:
    dialect = engine.dialect.name
    persistent = dialect != "sqlite"
    return {
        "status": "ok",
        "database": dialect,
        "persistent_storage": persistent,
    }
