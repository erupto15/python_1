from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import schemas
from app.db import get_db
from app.deps import assert_admin, get_current_user
from app.models import MapFeature, User

router = APIRouter(prefix="/map-features", tags=["map-features"])


@router.get("", response_model=list[schemas.MapFeatureRead])
def list_map_features(
    area_id: int | None = Query(None),
    db: Session = Depends(get_db),
) -> list[MapFeature]:
    q = db.query(MapFeature)
    if area_id is not None:
        q = q.filter(MapFeature.area_id == area_id)
    return q.order_by(MapFeature.id).all()


@router.post("", response_model=schemas.MapFeatureRead, status_code=201)
def create_map_feature(
    payload: schemas.MapFeatureCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MapFeature:
    assert_admin(user)
    data = payload.model_dump(exclude_unset=True)
    data.pop("created_by", None)
    data["created_by"] = user.id
    feature = MapFeature(**data)
    db.add(feature)
    db.commit()
    db.refresh(feature)
    return feature


@router.patch("/{feature_id}", response_model=schemas.MapFeatureRead)
def update_map_feature(
    feature_id: int,
    payload: schemas.MapFeatureUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MapFeature:
    feature = db.get(MapFeature, feature_id)
    if not feature:
        raise HTTPException(status_code=404, detail="Map feature not found")
    assert_admin(user)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(feature, k, v)
    db.commit()
    db.refresh(feature)
    return feature


@router.delete("/{feature_id}", status_code=204)
def delete_map_feature(
    feature_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    feature = db.get(MapFeature, feature_id)
    if not feature:
        raise HTTPException(status_code=404, detail="Map feature not found")
    assert_admin(user)
    db.delete(feature)
    db.commit()
