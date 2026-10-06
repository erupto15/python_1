from datetime import datetime, timezone
from hashlib import sha256

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import schemas
from app.db import get_db
from app.models import Area, Boulder, MapFeature, Route, Sector

router = APIRouter(prefix="/catalog", tags=["catalog"])


def _catalog_rows(
    db: Session,
) -> tuple[list[Area], list[Sector], list[Route], list[Boulder], list[MapFeature]]:
    areas = db.query(Area).filter(Area.deleted_at.is_(None)).order_by(Area.id).all()
    sectors = db.query(Sector).filter(Sector.deleted_at.is_(None)).order_by(Sector.id).all()
    routes = db.query(Route).filter(Route.deleted_at.is_(None)).order_by(Route.sort_order, Route.id).all()
    boulders = db.query(Boulder).filter(Boulder.deleted_at.is_(None)).order_by(Boulder.id).all()
    map_features = db.query(MapFeature).order_by(MapFeature.id).all()
    return areas, sectors, routes, boulders, map_features


def _row_group_version_part(class_name: str, rows: list[object]) -> str:
    count = len(rows)
    max_updated_at = None
    for item in rows:
        updated_at = getattr(item, "updated_at", None) or getattr(item, "created_at", None)
        if updated_at and (max_updated_at is None or updated_at > max_updated_at):
            max_updated_at = updated_at
    return f"{class_name}:{count}:{max_updated_at}"


def _catalog_version_from_rows(
    areas: list[Area],
    sectors: list[Sector],
    routes: list[Route],
    boulders: list[Boulder],
    map_features: list[MapFeature],
) -> tuple[str, dict[str, int]]:
    parts = [
        _row_group_version_part("Area", areas),
        _row_group_version_part("Sector", sectors),
        _row_group_version_part("Route", routes),
        _row_group_version_part("Boulder", boulders),
        _row_group_version_part("MapFeature", map_features),
    ]
    version = sha256("|".join(parts).encode("utf-8")).hexdigest()[:16]
    counts = {
        "areas": len(areas),
        "sectors": len(sectors),
        "routes": len(routes),
        "boulders": len(boulders),
        "map_features": len(map_features),
    }
    return version, counts


def _catalog_manifest_stats(db: Session) -> tuple[str | None, str, dict[str, int]]:
    """Быстрая версия каталога без загрузки всех строк (для /manifest)."""
    parts: list[str] = []
    counts: dict[str, int] = {}
    max_updated_at = None
    for model, key in (
        (Area, "areas"),
        (Sector, "sectors"),
        (Route, "routes"),
        (Boulder, "boulders"),
    ):
        count = db.scalar(select(func.count()).select_from(model).where(model.deleted_at.is_(None))) or 0
        counts[key] = int(count)
        updated_at = db.scalar(select(func.max(model.updated_at)).where(model.deleted_at.is_(None)))
        parts.append(f"{model.__name__}:{count}:{updated_at}")
        if updated_at and (max_updated_at is None or updated_at > max_updated_at):
            max_updated_at = updated_at
    map_count = db.scalar(select(func.count()).select_from(MapFeature)) or 0
    counts["map_features"] = int(map_count)
    map_updated_at = db.scalar(select(func.max(MapFeature.updated_at)))
    parts.append(f"MapFeature:{map_count}:{map_updated_at}")
    if map_updated_at and (max_updated_at is None or map_updated_at > max_updated_at):
        max_updated_at = map_updated_at
    version = sha256("|".join(parts).encode("utf-8")).hexdigest()[:16]
    updated_iso = max_updated_at.isoformat() if max_updated_at else None
    return updated_iso, version, counts


@router.get("/manifest")
def catalog_manifest(db: Session = Depends(get_db)) -> dict[str, object]:
    updated_at, version, counts = _catalog_manifest_stats(db)
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": updated_at,
        "version": version,
        "counts": counts,
    }


@router.get("/bundle")
def catalog_bundle(db: Session = Depends(get_db)) -> dict[str, object]:
    areas, sectors, routes, boulders, map_features = _catalog_rows(db)
    version, counts = _catalog_version_from_rows(areas, sectors, routes, boulders, map_features)
    return {
        "manifest": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "version": version,
            "counts": counts,
        },
        "areas": [schemas.AreaRead.model_validate(area).model_dump(mode="json") for area in areas],
        "sectors": [schemas.SectorRead.model_validate(sector).model_dump(mode="json") for sector in sectors],
        "routes": [schemas.RouteRead.model_validate(route).model_dump(mode="json") for route in routes],
        "boulders": [schemas.BoulderRead.model_validate(boulder).model_dump(mode="json") for boulder in boulders],
        "map_features": [
            schemas.MapFeatureRead.model_validate(feature).model_dump(mode="json") for feature in map_features
        ],
    }
