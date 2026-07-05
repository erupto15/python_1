from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import schemas
from app.db import get_db
from app.deps import assert_admin, get_current_user
from app.models import Area, User
from app.services.catalog_delete import soft_delete_area_with_contents

router = APIRouter(prefix="/areas", tags=["areas"])


@router.get("", response_model=list[schemas.AreaRead])
def list_areas(
    include_deleted: bool = Query(False),
    db: Session = Depends(get_db),
) -> list[Area]:
    q = db.query(Area)
    if not include_deleted:
        q = q.filter(Area.deleted_at.is_(None))
    return q.order_by(Area.id).all()


@router.post("", response_model=schemas.AreaRead, status_code=201)
def create_area(
    payload: schemas.AreaCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Area:
    assert_admin(user)
    data = payload.model_dump(exclude_unset=True)
    data.pop("created_by", None)
    data["created_by"] = user.id
    area = Area(**data)
    db.add(area)
    db.commit()
    db.refresh(area)
    return area


@router.get("/{area_id}", response_model=schemas.AreaRead)
def get_area(area_id: int, db: Session = Depends(get_db)) -> Area:
    area = db.get(Area, area_id)
    if not area or area.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Area not found")
    return area


@router.patch("/{area_id}", response_model=schemas.AreaRead)
def update_area(
    area_id: int,
    payload: schemas.AreaUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Area:
    area = db.get(Area, area_id)
    if not area or area.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Area not found")
    assert_admin(user)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(area, k, v)
    db.commit()
    db.refresh(area)
    return area


@router.delete("/{area_id}", status_code=204)
def delete_area(area_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    area = db.get(Area, area_id)
    if not area or area.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Area not found")
    assert_admin(user)
    soft_delete_area_with_contents(db, area)
    db.commit()
