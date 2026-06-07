from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import schemas
from app.db import get_db
from app.deps import assert_admin, assert_owner, get_current_user
from app.models import Boulder, Photo, User

router = APIRouter(prefix="/boulders", tags=["boulders"])


@router.get("", response_model=list[schemas.BoulderRead])
def list_boulders(
    sector_id: int | None = None,
    include_deleted: bool = Query(False),
    db: Session = Depends(get_db),
) -> list[Boulder]:
    q = db.query(Boulder)
    if sector_id is not None:
        q = q.filter(Boulder.sector_id == sector_id)
    if not include_deleted:
        q = q.filter(Boulder.deleted_at.is_(None))
    return q.order_by(Boulder.id).all()


@router.post("", response_model=schemas.BoulderRead, status_code=201)
def create_boulder(
    payload: schemas.BoulderCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Boulder:
    assert_admin(user)
    data = payload.model_dump()
    data.pop("created_by", None)
    data["created_by"] = user.id
    boulder = Boulder(**data)
    db.add(boulder)
    db.commit()
    db.refresh(boulder)
    return boulder


@router.get("/{boulder_id}", response_model=schemas.BoulderRead)
def get_boulder(boulder_id: int, db: Session = Depends(get_db)) -> Boulder:
    b = db.get(Boulder, boulder_id)
    if not b or b.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Boulder not found")
    return b


@router.get("/{boulder_id}/photos", response_model=list[schemas.PhotoRead])
def list_boulder_photos_legacy(boulder_id: int, db: Session = Depends(get_db)) -> list[Photo]:
    boulder = db.get(Boulder, boulder_id)
    if not boulder or boulder.deleted_at is not None:
        return []
    return (
        db.query(Photo)
        .filter(Photo.climb_type == "boulder", Photo.boulder_id == boulder_id)
        .order_by(Photo.id)
        .all()
    )


@router.patch("/{boulder_id}", response_model=schemas.BoulderRead)
def update_boulder(
    boulder_id: int,
    payload: schemas.BoulderUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Boulder:
    b = db.get(Boulder, boulder_id)
    if not b or b.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Boulder not found")
    assert_owner(user, b.created_by)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(b, k, v)
    db.commit()
    db.refresh(b)
    return b


@router.delete("/{boulder_id}", status_code=204)
def delete_boulder(boulder_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    b = db.get(Boulder, boulder_id)
    if not b or b.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Boulder not found")
    assert_admin(user)
    b.deleted_at = datetime.now(timezone.utc)
    db.commit()
