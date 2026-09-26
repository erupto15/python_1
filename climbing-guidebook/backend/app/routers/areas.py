import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app import schemas
from app.db import get_db
from app.deps import assert_admin, get_current_user
from app.models import Area, User
from app.services.area_guide_pdf import (
    area_pdf_filename,
    build_area_guide_pdf,
    pdf_attachment_content_disposition,
)
from app.services.catalog_delete import soft_delete_area_with_contents

logger = logging.getLogger(__name__)

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


@router.get("/{area_id}/guide.pdf")
def download_area_guide_pdf(area_id: int, db: Session = Depends(get_db)) -> Response:
    area = db.get(Area, area_id)
    if not area or area.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Area not found")
    try:
        pdf_bytes = build_area_guide_pdf(db, area_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Area not found") from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("area guide PDF failed for area_id=%s", area_id)
        raise HTTPException(status_code=500, detail="PDF generation failed") from exc
    filename = area_pdf_filename(area)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": pdf_attachment_content_disposition(filename),
            "Cache-Control": "no-store",
        },
    )


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
