from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

import logging

from sqlalchemy import func, select

from app.config import settings
from app.db import Base, SessionLocal, engine, ensure_optional_columns

logger = logging.getLogger(__name__)
from app.models import Area, Boulder, Photo, Route, Sector
from app.routers import areas, auth, boulders, comments, community, photos, routes_api, sectors, telegram, users
from app.seed import bootstrap_catalog

FRONTEND_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_INDEX = FRONTEND_ROOT / "index.html"
FRONTEND_HEADERS = {
    "Cache-Control": "no-store, max-age=0",
    "Pragma": "no-cache",
}


@asynccontextmanager
async def lifespan(_: FastAPI):
    dialect = engine.dialect.name
    if dialect == "sqlite":
        logger.warning(
            "БД: SQLite (%s). Для production задайте DATABASE_URL на PostgreSQL.",
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
app.include_router(community.router, prefix="/api")
app.include_router(telegram.router, prefix="/api")


@app.get("/health")
def health() -> dict[str, str | bool | int | dict[str, int]]:
    dialect = engine.dialect.name
    persistent = dialect != "sqlite"
    counts = {"areas": 0, "sectors": 0, "routes": 0, "boulders": 0, "photos": 0}
    try:
        db = SessionLocal()
        try:
            counts = {
                "areas": db.scalar(select(func.count()).select_from(Area)) or 0,
                "sectors": db.scalar(select(func.count()).select_from(Sector)) or 0,
                "routes": db.scalar(select(func.count()).select_from(Route)) or 0,
                "boulders": db.scalar(select(func.count()).select_from(Boulder)) or 0,
                "photos": db.scalar(select(func.count()).select_from(Photo)) or 0,
            }
        finally:
            db.close()
    except Exception as exc:
        logger.warning("health catalog counts failed: %s", exc)
    db_host = engine.url.host or ""
    return {
        "status": "ok",
        "database": dialect,
        "persistent_storage": persistent,
        "database_host": db_host,
        "catalog_counts": counts,
    }


@app.get("/", include_in_schema=False)
def frontend_index() -> FileResponse:
    return FileResponse(FRONTEND_INDEX, headers=FRONTEND_HEADERS)


@app.get("/{path:path}", include_in_schema=False)
def frontend_fallback(path: str) -> FileResponse:
    if path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(FRONTEND_INDEX, headers=FRONTEND_HEADERS)
