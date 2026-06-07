from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import schemas
from app.db import get_db
from app.deps import assert_admin, assert_owner, get_current_user
from app.models import Boulder, Photo, Route, User

router = APIRouter(prefix="/photos", tags=["photos"])


def _active_route(db: Session, route_id: int | None) -> Route | None:
    route = db.get(Route, route_id) if route_id is not None else None
    if not route or route.deleted_at is not None:
        return None
    return route


def _active_boulder(db: Session, boulder_id: int | None) -> Boulder | None:
    boulder = db.get(Boulder, boulder_id) if boulder_id is not None else None
    if not boulder or boulder.deleted_at is not None:
        return None
    return boulder


def _validate_photo_payload(payload: schemas.PhotoCreate) -> None:
    if payload.climb_type == "route":
        if payload.route_id is None or payload.boulder_id is not None:
            raise HTTPException(status_code=400, detail="route_id required and boulder_id must be null")
    else:
        if payload.boulder_id is None or payload.route_id is not None:
            raise HTTPException(status_code=400, detail="boulder_id required and route_id must be null")


def _resolve_climb_metadata(
    db: Session, payload: schemas.PhotoCreate
) -> tuple[Route | None, Boulder | None, str | None, str | None]:
    route: Route | None = None
    boulder: Boulder | None = None
    climb_name: str | None = None
    climb_category: str | None = None

    if payload.climb_type == "route":
        route = _active_route(db, payload.route_id)
        if not route:
            raise HTTPException(status_code=404, detail="Route not found")
        climb_name = route.name
        climb_category = route.category
    else:
        boulder = _active_boulder(db, payload.boulder_id)
        if not boulder:
            raise HTTPException(status_code=404, detail="Boulder not found")
        climb_name = boulder.name
        climb_category = boulder.category

    return route, boulder, climb_name, climb_category


@router.get("", response_model=list[schemas.PhotoRead])
def list_photos(db: Session = Depends(get_db)) -> list[Photo]:
    # Compatibility endpoint for stale Mini App clients. Keep it cheap so an old
    # startup path cannot block catalog rendering on a large photo payload.
    return []


@router.get("/by-route/{route_id}", response_model=list[schemas.PhotoRead])
def list_photos_for_route(route_id: int, db: Session = Depends(get_db)) -> list[Photo]:
    if not _active_route(db, route_id):
        return []
    return (
        db.query(Photo)
        .filter(Photo.climb_type == "route", Photo.route_id == route_id)
        .order_by(Photo.id)
        .all()
    )


@router.get("/by-boulder/{boulder_id}", response_model=list[schemas.PhotoRead])
def list_photos_for_boulder(boulder_id: int, db: Session = Depends(get_db)) -> list[Photo]:
    if not _active_boulder(db, boulder_id):
        return []
    return (
        db.query(Photo)
        .filter(Photo.climb_type == "boulder", Photo.boulder_id == boulder_id)
        .order_by(Photo.id)
        .all()
    )


@router.post("", response_model=schemas.PhotoRead, status_code=201)
def create_photo(
    payload: schemas.PhotoCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Photo:
    assert_admin(user)
    _validate_photo_payload(payload)
    _, _, climb_name, climb_category = _resolve_climb_metadata(db, payload)
    data = payload.model_dump()
    data["uploaded_by"] = user.id
    data["climb_name"] = climb_name
    data["climb_category"] = climb_category
    photo = Photo(**data)
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return photo


@router.get("/{photo_id}", response_model=schemas.PhotoRead)
def get_photo(photo_id: int, db: Session = Depends(get_db)) -> Photo:
    photo = db.get(Photo, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    return photo


@router.patch("/{photo_id}", response_model=schemas.PhotoRead)
def update_photo(
    photo_id: int,
    payload: schemas.PhotoUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Photo:
    photo = db.get(Photo, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    assert_owner(user, photo.uploaded_by)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(photo, k, v)
    db.commit()
    db.refresh(photo)
    return photo


@router.delete("/{photo_id}", status_code=204)
def delete_photo(photo_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    photo = db.get(Photo, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    assert_admin(user)
    db.delete(photo)
    db.commit()
