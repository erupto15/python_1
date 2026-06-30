from datetime import datetime, timezone
from hashlib import sha256

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import schemas
from app.db import get_db
from app.models import Area, Boulder, Route, Sector

router = APIRouter(prefix="/catalog", tags=["catalog"])


def _catalog_rows(db: Session) -> tuple[list[Area], list[Sector], list[Route], list[Boulder]]:
    areas = db.query(Area).filter(Area.deleted_at.is_(None)).order_by(Area.id).all()
    sectors = db.query(Sector).filter(Sector.deleted_at.is_(None)).order_by(Sector.id).all()
    routes = db.query(Route).filter(Route.deleted_at.is_(None)).order_by(Route.id).all()
    boulders = db.query(Boulder).filter(Boulder.deleted_at.is_(None)).order_by(Boulder.id).all()
    return areas, sectors, routes, boulders


def _catalog_version(*groups: list[object]) -> str:
    parts: list[str] = []
    for group in groups:
        for item in group:
            item_id = getattr(item, "id", "")
            updated_at = getattr(item, "updated_at", None) or getattr(item, "created_at", None)
            parts.append(f"{item.__class__.__name__}:{item_id}:{updated_at}")
    return sha256("|".join(parts).encode("utf-8")).hexdigest()[:16]


@router.get("/manifest")
def catalog_manifest(db: Session = Depends(get_db)) -> dict[str, object]:
    areas, sectors, routes, boulders = _catalog_rows(db)
    max_updated_at = None
    for model in (Area, Sector, Route, Boulder):
        value = db.scalar(select(func.max(model.updated_at)).where(model.deleted_at.is_(None)))
        if value and (max_updated_at is None or value > max_updated_at):
            max_updated_at = value
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": max_updated_at.isoformat() if max_updated_at else None,
        "version": _catalog_version(areas, sectors, routes, boulders),
        "counts": {
            "areas": len(areas),
            "sectors": len(sectors),
            "routes": len(routes),
            "boulders": len(boulders),
        },
    }


@router.get("/bundle")
def catalog_bundle(db: Session = Depends(get_db)) -> dict[str, object]:
    areas, sectors, routes, boulders = _catalog_rows(db)
    return {
        "manifest": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "version": _catalog_version(areas, sectors, routes, boulders),
            "counts": {
                "areas": len(areas),
                "sectors": len(sectors),
                "routes": len(routes),
                "boulders": len(boulders),
            },
        },
        "areas": [schemas.AreaRead.model_validate(area).model_dump(mode="json") for area in areas],
        "sectors": [schemas.SectorRead.model_validate(sector).model_dump(mode="json") for sector in sectors],
        "routes": [schemas.RouteRead.model_validate(route).model_dump(mode="json") for route in routes],
        "boulders": [schemas.BoulderRead.model_validate(boulder).model_dump(mode="json") for boulder in boulders],
    }
