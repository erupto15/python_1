"""Каскадное удаление районов и секторов вместе с содержимым."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import Area, Boulder, Route, Sector


def _hard_delete_routes(db: Session, *, sector_id: int | None = None, area_id: int | None = None) -> None:
    q = db.query(Route)
    if sector_id is not None:
        q = q.filter(Route.sector_id == sector_id)
    if area_id is not None:
        q = q.filter(Route.area_id == area_id)
    for route in q.all():
        db.delete(route)


def _hard_delete_boulders(db: Session, *, sector_id: int | None = None, area_id: int | None = None) -> None:
    q = db.query(Boulder)
    if sector_id is not None:
        q = q.filter(Boulder.sector_id == sector_id)
    if area_id is not None:
        q = q.filter(Boulder.area_id == area_id)
    for boulder in q.all():
        db.delete(boulder)


def delete_sector_with_contents(db: Session, sector: Sector) -> None:
    _hard_delete_routes(db, sector_id=sector.id)
    _hard_delete_boulders(db, sector_id=sector.id)
    db.delete(sector)


def delete_area_with_contents(db: Session, area: Area) -> None:
    _hard_delete_routes(db, area_id=area.id)
    _hard_delete_boulders(db, area_id=area.id)
    db.delete(area)
