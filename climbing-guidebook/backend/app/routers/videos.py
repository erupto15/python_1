from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import schemas
from app.db import get_db
from app.deps import assert_admin, get_current_user
from app.models import Boulder, Route, User, Video

router = APIRouter(prefix="/videos", tags=["videos"])


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


def _validate_video_payload(payload: schemas.VideoCreate) -> None:
    if payload.climb_type == "route":
        if payload.route_id is None or payload.boulder_id is not None:
            raise HTTPException(status_code=400, detail="route_id required and boulder_id must be null")
    else:
        if payload.boulder_id is None or payload.route_id is not None:
            raise HTTPException(status_code=400, detail="boulder_id required and route_id must be null")


@router.get("/by-route/{route_id}", response_model=list[schemas.VideoRead])
def list_videos_for_route(route_id: int, db: Session = Depends(get_db)) -> list[Video]:
    if not _active_route(db, route_id):
        return []
    return (
        db.query(Video)
        .filter(Video.climb_type == "route", Video.route_id == route_id)
        .order_by(Video.id)
        .all()
    )


@router.get("/by-boulder/{boulder_id}", response_model=list[schemas.VideoRead])
def list_videos_for_boulder(boulder_id: int, db: Session = Depends(get_db)) -> list[Video]:
    if not _active_boulder(db, boulder_id):
        return []
    return (
        db.query(Video)
        .filter(Video.climb_type == "boulder", Video.boulder_id == boulder_id)
        .order_by(Video.id)
        .all()
    )


@router.post("", response_model=schemas.VideoRead, status_code=201)
def create_video(
    payload: schemas.VideoCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Video:
    assert_admin(user)
    _validate_video_payload(payload)
    if payload.climb_type == "route" and not _active_route(db, payload.route_id):
        raise HTTPException(status_code=404, detail="Route not found")
    if payload.climb_type == "boulder" and not _active_boulder(db, payload.boulder_id):
        raise HTTPException(status_code=404, detail="Boulder not found")
    data = payload.model_dump()
    data["uploaded_by"] = user.id
    video = Video(**data)
    db.add(video)
    db.commit()
    db.refresh(video)
    return video


@router.get("/{video_id}", response_model=schemas.VideoRead)
def get_video(video_id: int, db: Session = Depends(get_db)) -> Video:
    video = db.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return video


@router.delete("/{video_id}", status_code=204)
def delete_video(video_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    video = db.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    assert_admin(user)
    db.delete(video)
    db.commit()
