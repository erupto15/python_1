from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import schemas
from app.db import get_db
from app.deps import assert_admin, assert_owner, get_current_user
from app.models import Area, Sector, User
from app.services.catalog_delete import soft_delete_sector_with_contents

router = APIRouter(tags=["sectors"])


def _active_area(db: Session, area_id: int) -> Area | None:
    area = db.get(Area, area_id)
    if not area or area.deleted_at is not None:
        return None
    return area


@router.get("/sectors", response_model=list[schemas.SectorRead])
def list_all_sectors(
    include_deleted: bool = Query(False),
    db: Session = Depends(get_db),
) -> list[Sector]:
    q = db.query(Sector)
    if not include_deleted:
        q = q.filter(Sector.deleted_at.is_(None))
    return q.order_by(Sector.id).all()


@router.get("/areas/{area_id}/sectors", response_model=list[schemas.SectorRead])
def list_sectors(area_id: int, db: Session = Depends(get_db)) -> list[Sector]:
    if not _active_area(db, area_id):
        raise HTTPException(status_code=404, detail="Area not found")
    return (
        db.query(Sector)
        .filter(Sector.area_id == area_id, Sector.deleted_at.is_(None))
        .order_by(Sector.id)
        .all()
    )


@router.post("/areas/{area_id}/sectors", response_model=schemas.SectorRead, status_code=201)
def create_sector(
    area_id: int,
    payload: schemas.SectorCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Sector:
    assert_admin(user)
    if not _active_area(db, area_id):
        raise HTTPException(status_code=404, detail="Area not found")
    data = payload.model_dump(exclude_unset=True)
    data.pop("created_by", None)
    data["created_by"] = user.id
    sector = Sector(area_id=area_id, **data)
    db.add(sector)
    db.commit()
    db.refresh(sector)
    return sector


@router.get("/sectors/{sector_id}", response_model=schemas.SectorRead)
def get_sector(sector_id: int, db: Session = Depends(get_db)) -> Sector:
    sector = db.get(Sector, sector_id)
    if not sector or sector.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Sector not found")
    return sector


@router.patch("/sectors/{sector_id}", response_model=schemas.SectorRead)
def update_sector(
    sector_id: int,
    payload: schemas.SectorUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Sector:
    sector = db.get(Sector, sector_id)
    if not sector or sector.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Sector not found")
    assert_admin(user)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(sector, k, v)
    db.commit()
    db.refresh(sector)
    return sector


@router.delete("/sectors/{sector_id}", status_code=204)
def delete_sector(sector_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    sector = db.get(Sector, sector_id)
    if not sector or sector.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Sector not found")
    assert_admin(user)
    soft_delete_sector_with_contents(db, sector)
    db.commit()
