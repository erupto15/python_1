from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import schemas
from app.db import get_db
from app.deps import assert_admin, assert_owner, get_current_user
from app.models import Area, Photo, Route, Sector, User

router = APIRouter(prefix="/routes", tags=["routes"])


def _validate_active_sector_area(db: Session, sector_id: int | None, area_id: int | None) -> Sector:
    if sector_id is None or area_id is None:
        raise HTTPException(status_code=400, detail="sector_id and area_id are required")
    area = db.get(Area, area_id)
    if not area or area.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Area not found")
    sector = db.get(Sector, sector_id)
    if not sector or sector.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Sector not found")
    if sector.area_id != area.id:
        raise HTTPException(status_code=400, detail="Sector does not belong to area")
    return sector


@router.get("", response_model=list[schemas.RouteRead])
def list_routes(
    sector_id: int | None = None,
    include_deleted: bool = Query(False),
    db: Session = Depends(get_db),
) -> list[Route]:
    q = db.query(Route)
    if sector_id is not None:
        q = q.filter(Route.sector_id == sector_id)
    if not include_deleted:
        q = q.filter(Route.deleted_at.is_(None))
    return q.order_by(Route.id).all()


@router.post("", response_model=schemas.RouteRead, status_code=201)
def create_route(
    payload: schemas.RouteCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Route:
    assert_admin(user)
    data = payload.model_dump()
    data.pop("created_by", None)
    _validate_active_sector_area(db, payload.sector_id, payload.area_id)
    data["created_by"] = user.id
    route = Route(**data)
    db.add(route)
    db.commit()
    db.refresh(route)
    return route


@router.get("/{route_id}", response_model=schemas.RouteRead)
def get_route(route_id: int, db: Session = Depends(get_db)) -> Route:
    route = db.get(Route, route_id)
    if not route or route.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Route not found")
    return route


@router.get("/{route_id}/photos", response_model=list[schemas.PhotoRead])
def list_route_photos_legacy(route_id: int, db: Session = Depends(get_db)) -> list[Photo]:
    route = db.get(Route, route_id)
    if not route or route.deleted_at is not None:
        return []
    return (
        db.query(Photo)
        .filter(Photo.climb_type == "route", Photo.route_id == route_id)
        .order_by(Photo.id)
        .all()
    )


@router.patch("/{route_id}", response_model=schemas.RouteRead)
def update_route(
    route_id: int,
    payload: schemas.RouteUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Route:
    route = db.get(Route, route_id)
    if not route or route.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Route not found")
    assert_admin(user)
    assert_owner(user, route.created_by)
    data = payload.model_dump(exclude_unset=True)
    if "sector_id" in data or "area_id" in data:
        _validate_active_sector_area(
            db,
            data.get("sector_id", route.sector_id),
            data.get("area_id", route.area_id),
        )
    for k, v in data.items():
        setattr(route, k, v)
    db.commit()
    db.refresh(route)
    return route


@router.delete("/{route_id}", status_code=204)
def delete_route(route_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    route = db.get(Route, route_id)
    if not route or route.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Route not found")
    assert_admin(user)
    route.deleted_at = datetime.now(timezone.utc)
    db.commit()
