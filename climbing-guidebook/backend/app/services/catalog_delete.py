"""Мягкое каскадное удаление районов и секторов (как у трасс и боулдеров)."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import Area, Boulder, Route, Sector


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _soft_delete_routes(
    db: Session,
    *,
    sector_id: int | None = None,
    area_id: int | None = None,
    at: datetime | None = None,
) -> None:
    ts = at or _now()
    q = db.query(Route).filter(Route.deleted_at.is_(None))
    if sector_id is not None:
        q = q.filter(Route.sector_id == sector_id)
    if area_id is not None:
        q = q.filter(Route.area_id == area_id)
    for route in q.all():
        route.deleted_at = ts


def _soft_delete_boulders(
    db: Session,
    *,
    sector_id: int | None = None,
    area_id: int | None = None,
    at: datetime | None = None,
) -> None:
    ts = at or _now()
    q = db.query(Boulder).filter(Boulder.deleted_at.is_(None))
    if sector_id is not None:
        q = q.filter(Boulder.sector_id == sector_id)
    if area_id is not None:
        q = q.filter(Boulder.area_id == area_id)
    for boulder in q.all():
        boulder.deleted_at = ts


def soft_delete_sector_with_contents(db: Session, sector: Sector) -> None:
    if sector.deleted_at is not None:
        return
    ts = _now()
    _soft_delete_routes(db, sector_id=sector.id, at=ts)
    _soft_delete_boulders(db, sector_id=sector.id, at=ts)
    sector.deleted_at = ts


def soft_delete_area_with_contents(db: Session, area: Area) -> None:
    if area.deleted_at is not None:
        return
    ts = _now()
    sectors = (
        db.query(Sector)
        .filter(Sector.area_id == area.id, Sector.deleted_at.is_(None))
        .all()
    )
    for sector in sectors:
        _soft_delete_routes(db, sector_id=sector.id, at=ts)
        _soft_delete_boulders(db, sector_id=sector.id, at=ts)
        sector.deleted_at = ts
    _soft_delete_routes(db, area_id=area.id, at=ts)
    _soft_delete_boulders(db, area_id=area.id, at=ts)
    area.deleted_at = ts
