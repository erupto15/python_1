"""Лог пролазов, оценки и статистика по трассам (Kilter-style community layer)."""

from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import schemas
from app.db import get_db
from app.deps import get_current_user, get_current_user_optional
from app.models import Area, Boulder, ClimbAscent, ClimbUserRating, Route, Sector, User
from app.services.climb_rating import star_average, sync_climb_star_average

router = APIRouter(tags=["community"])

ASCENT_STYLES = frozenset({"onsight", "flash", "redpoint"})


def _climb_ids(climb_type: str, route_id: Optional[int], boulder_id: Optional[int]) -> tuple[str, Optional[int], Optional[int]]:
    if climb_type == "route":
        if not route_id:
            raise HTTPException(status_code=400, detail="route_id required")
        return climb_type, route_id, None
    if climb_type == "boulder":
        if not boulder_id:
            raise HTTPException(status_code=400, detail="boulder_id required")
        return climb_type, None, boulder_id
    raise HTTPException(status_code=400, detail="Invalid climb_type")


def _ensure_climb_exists(db: Session, climb_type: str, route_id: Optional[int], boulder_id: Optional[int]) -> None:
    if climb_type == "route":
        row = db.get(Route, route_id)
        if not row or row.deleted_at is not None:
            raise HTTPException(status_code=404, detail="Route not found")
        return
    row = db.get(Boulder, boulder_id)
    if not row or row.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Boulder not found")


def _structure_label(db: Session, area_id: int | None, sector_id: int | None) -> str | None:
    parts: list[str] = []
    if area_id:
        area = db.get(Area, area_id)
        if area and area.name:
            parts.append(area.name)
    if sector_id:
        sector = db.get(Sector, sector_id)
        if sector and sector.name:
            parts.append(sector.name)
    return " / ".join(parts) if parts else None


def _user_display(user: User | None) -> str:
    if user is None:
        return "Скалолаз"
    name = (user.display_name or "").strip()
    if name:
        return name
    if user.telegram_username:
        return f"@{user.telegram_username}"
    email = (user.email or "").split("@", 1)[0].strip()
    return email or "Скалолаз"


def _enrich_ascent(db: Session, row: ClimbAscent) -> schemas.AscentReadEnriched:
    name, grade, structure = "", "", None
    if row.climb_type == "route" and row.route_id:
        route = db.get(Route, row.route_id)
        if route and route.deleted_at is None:
            name = route.name
            grade = route.grade
            structure = _structure_label(db, route.area_id, route.sector_id)
    elif row.climb_type == "boulder" and row.boulder_id:
        boulder = db.get(Boulder, row.boulder_id)
        if boulder and boulder.deleted_at is None:
            name = boulder.name
            grade = boulder.grade
            structure = _structure_label(db, boulder.area_id, boulder.sector_id)
    base = schemas.AscentRead.model_validate(row)
    return schemas.AscentReadEnriched(
        **base.model_dump(),
        climb_name=name,
        climb_grade=grade,
        structure_label=structure,
    )


@router.get("/me/ascents/summary", response_model=schemas.MyAscentSummary)
def my_ascent_summary(
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> schemas.MyAscentSummary:
    rows = db.query(ClimbAscent).filter(ClimbAscent.user_id == current.id).all()
    sent_r: set[int] = set()
    sent_b: set[int] = set()
    att_r: set[int] = set()
    att_b: set[int] = set()
    for row in rows:
        if row.climb_type == "route" and row.route_id is not None:
            if row.status == "send":
                sent_r.add(row.route_id)
            else:
                att_r.add(row.route_id)
        elif row.climb_type == "boulder" and row.boulder_id is not None:
            if row.status == "send":
                sent_b.add(row.boulder_id)
            else:
                att_b.add(row.boulder_id)
    return schemas.MyAscentSummary(
        sent_route_ids=sorted(sent_r),
        sent_boulder_ids=sorted(sent_b),
        attempted_route_ids=sorted(att_r - sent_r),
        attempted_boulder_ids=sorted(att_b - sent_b),
    )


@router.get("/me/ascents", response_model=list[schemas.AscentReadEnriched])
def list_my_ascents(
    limit: int = Query(200, ge=1, le=500),
    status: Optional[Literal["send", "attempt"]] = None,
    styles_only: bool = Query(False, description="Только онсайт / флэш / редпоинт"),
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[schemas.AscentReadEnriched]:
    q = db.query(ClimbAscent).filter(ClimbAscent.user_id == current.id)
    if status:
        q = q.filter(ClimbAscent.status == status)
    if styles_only:
        q = q.filter(
            ClimbAscent.status == "send",
            ClimbAscent.ascent_style.in_(tuple(ASCENT_STYLES)),
        )
    rows = q.order_by(ClimbAscent.logged_at.desc()).limit(limit).all()
    return [_enrich_ascent(db, row) for row in rows]


@router.post("/ascents", response_model=schemas.AscentRead, status_code=201)
def log_ascent(
    payload: schemas.AscentCreate,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ClimbAscent:
    climb_type, route_id, boulder_id = _climb_ids(payload.climb_type, payload.route_id, payload.boulder_id)
    _ensure_climb_exists(db, climb_type, route_id, boulder_id)
    style = (payload.ascent_style or "").strip().lower() or None
    if payload.status == "send" and not style:
        style = "redpoint"
    if style and style not in ASCENT_STYLES:
        raise HTTPException(status_code=400, detail="Invalid ascent_style")
    if style and payload.status != "send":
        raise HTTPException(status_code=400, detail="ascent_style applies only to sends")
    if payload.status == "attempt":
        style = None
    row = ClimbAscent(
        user_id=current.id,
        climb_type=climb_type,
        route_id=route_id,
        boulder_id=boulder_id,
        status=payload.status,
        ascent_style=style,
        tries=payload.tries,
        notes=(payload.notes or "").strip() or None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/ascents/{ascent_id}", status_code=204)
def delete_ascent(
    ascent_id: int,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    row = db.get(ClimbAscent, ascent_id)
    if not row or row.user_id != current.id:
        raise HTTPException(status_code=404, detail="Ascent not found")
    db.delete(row)
    db.commit()


@router.put("/ratings", response_model=schemas.ClimbRatingRead)
def upsert_rating(
    payload: schemas.ClimbRatingUpsert,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ClimbUserRating:
    climb_type, route_id, boulder_id = _climb_ids(payload.climb_type, payload.route_id, payload.boulder_id)
    _ensure_climb_exists(db, climb_type, route_id, boulder_id)

    q = db.query(ClimbUserRating).filter(ClimbUserRating.user_id == current.id, ClimbUserRating.climb_type == climb_type)
    if climb_type == "route":
        q = q.filter(ClimbUserRating.route_id == route_id)
    else:
        q = q.filter(ClimbUserRating.boulder_id == boulder_id)
    row = q.first()
    felt = (payload.felt_grade or "").strip() or None
    if row:
        row.stars = payload.stars
        row.felt_grade = felt
    else:
        row = ClimbUserRating(
            user_id=current.id,
            climb_type=climb_type,
            route_id=route_id,
            boulder_id=boulder_id,
            stars=payload.stars,
            felt_grade=felt,
        )
        db.add(row)
    db.commit()
    db.refresh(row)
    sync_climb_star_average(db, climb_type, route_id, boulder_id)
    return row


@router.delete("/ratings", status_code=204)
def delete_rating(
    climb_type: Literal["route", "boulder"],
    route_id: Optional[int] = None,
    boulder_id: Optional[int] = None,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    climb_type, route_id, boulder_id = _climb_ids(climb_type, route_id, boulder_id)
    q = db.query(ClimbUserRating).filter(ClimbUserRating.user_id == current.id, ClimbUserRating.climb_type == climb_type)
    if climb_type == "route":
        q = q.filter(ClimbUserRating.route_id == route_id)
    else:
        q = q.filter(ClimbUserRating.boulder_id == boulder_id)
    row = q.first()
    if not row:
        return
    db.delete(row)
    db.commit()
    sync_climb_star_average(db, climb_type, route_id, boulder_id)


@router.get("/climbs/stats", response_model=schemas.ClimbCommunityStats)
def climb_stats(
    climb_type: Literal["route", "boulder"],
    route_id: Optional[int] = None,
    boulder_id: Optional[int] = None,
    current: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
) -> schemas.ClimbCommunityStats:
    climb_type, route_id, boulder_id = _climb_ids(climb_type, route_id, boulder_id)
    _ensure_climb_exists(db, climb_type, route_id, boulder_id)

    ascent_q = db.query(ClimbAscent).filter(ClimbAscent.climb_type == climb_type)
    rating_q = db.query(ClimbUserRating).filter(ClimbUserRating.climb_type == climb_type)
    if climb_type == "route":
        ascent_q = ascent_q.filter(ClimbAscent.route_id == route_id)
        rating_q = rating_q.filter(ClimbUserRating.route_id == route_id)
    else:
        ascent_q = ascent_q.filter(ClimbAscent.boulder_id == boulder_id)
        rating_q = rating_q.filter(ClimbUserRating.boulder_id == boulder_id)

    send_count = ascent_q.filter(ClimbAscent.status == "send").count()
    attempt_count = ascent_q.filter(ClimbAscent.status == "attempt").count()
    star_rows = [int(row[0]) for row in rating_q.with_entities(ClimbUserRating.stars).all()]
    ratings_count = len(star_rows)
    avg = star_average(star_rows)
    climb = db.get(Route, route_id) if climb_type == "route" else db.get(Boulder, boulder_id)
    if climb is not None and climb.rating != avg:
        climb.rating = avg
        db.add(climb)
        db.commit()
    if climb_type == "route":
        felt_rows = (
            db.query(ClimbUserRating.felt_grade)
            .filter(
                ClimbUserRating.climb_type == "route",
                ClimbUserRating.route_id == route_id,
                ClimbUserRating.felt_grade.isnot(None),
            )
            .limit(20)
            .all()
        )
    else:
        felt_rows = (
            db.query(ClimbUserRating.felt_grade)
            .filter(
                ClimbUserRating.climb_type == "boulder",
                ClimbUserRating.boulder_id == boulder_id,
                ClimbUserRating.felt_grade.isnot(None),
            )
            .limit(20)
            .all()
        )

    my_status = my_tries = my_stars = my_felt = None
    if current:
        my_rows = ascent_q.filter(ClimbAscent.user_id == current.id).order_by(ClimbAscent.logged_at.desc()).all()
        if my_rows:
            my_status = my_rows[0].status
            my_tries = my_rows[0].tries
            for r in my_rows:
                if r.status == "send":
                    my_status = "send"
                    my_tries = r.tries
                    break
        my_rating = rating_q.filter(ClimbUserRating.user_id == current.id).first()
        if my_rating:
            my_stars = my_rating.stars
            my_felt = my_rating.felt_grade

    felt_grades = [str(g[0]) for g in felt_rows if g and g[0]]

    recent_rows = (
        ascent_q.filter(ClimbAscent.status == "send")
        .order_by(ClimbAscent.logged_at.desc())
        .limit(20)
        .all()
    )
    recent_sends = [
        schemas.ClimbSendEntry(
            user_display_name=_user_display(db.get(User, row.user_id)),
            ascent_style=row.ascent_style,
            tries=row.tries,
            logged_at=row.logged_at,
        )
        for row in recent_rows
    ]

    return schemas.ClimbCommunityStats(
        climb_type=climb_type,
        route_id=route_id,
        boulder_id=boulder_id,
        send_count=send_count,
        attempt_count=attempt_count,
        ratings_count=ratings_count,
        avg_stars=avg,
        felt_grades=felt_grades,
        recent_sends=recent_sends,
        my_status=my_status,
        my_tries=my_tries,
        my_stars=my_stars,
        my_felt_grade=my_felt,
    )
