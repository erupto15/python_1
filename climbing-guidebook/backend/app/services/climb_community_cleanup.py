"""Удаление пролазов и оценок при удалении трасс/боулдеров из каталога."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import Boulder, ClimbAscent, ClimbUserRating, Route


def purge_ascents_and_ratings_for_route(db: Session, route_id: int) -> None:
    db.query(ClimbAscent).filter(
        ClimbAscent.climb_type == "route",
        ClimbAscent.route_id == route_id,
    ).delete(synchronize_session=False)
    db.query(ClimbUserRating).filter(
        ClimbUserRating.climb_type == "route",
        ClimbUserRating.route_id == route_id,
    ).delete(synchronize_session=False)


def purge_ascents_and_ratings_for_boulder(db: Session, boulder_id: int) -> None:
    db.query(ClimbAscent).filter(
        ClimbAscent.climb_type == "boulder",
        ClimbAscent.boulder_id == boulder_id,
    ).delete(synchronize_session=False)
    db.query(ClimbUserRating).filter(
        ClimbUserRating.climb_type == "boulder",
        ClimbUserRating.boulder_id == boulder_id,
    ).delete(synchronize_session=False)


def _delete_route_community_not_in_catalog(db: Session, active_ids: set[int]) -> int:
    q = db.query(ClimbAscent).filter(ClimbAscent.climb_type == "route", ClimbAscent.route_id.isnot(None))
    if active_ids:
        q = q.filter(~ClimbAscent.route_id.in_(active_ids))
    removed = q.count()
    if removed:
        if active_ids:
            db.query(ClimbAscent).filter(
                ClimbAscent.climb_type == "route",
                ClimbAscent.route_id.isnot(None),
                ~ClimbAscent.route_id.in_(active_ids),
            ).delete(synchronize_session=False)
        else:
            db.query(ClimbAscent).filter(ClimbAscent.climb_type == "route").delete(synchronize_session=False)

    rq = db.query(ClimbUserRating).filter(
        ClimbUserRating.climb_type == "route",
        ClimbUserRating.route_id.isnot(None),
    )
    if active_ids:
        rq = rq.filter(~ClimbUserRating.route_id.in_(active_ids))
        rq.delete(synchronize_session=False)
    else:
        db.query(ClimbUserRating).filter(ClimbUserRating.climb_type == "route").delete(synchronize_session=False)
    return removed


def _delete_boulder_community_not_in_catalog(db: Session, active_ids: set[int]) -> int:
    q = db.query(ClimbAscent).filter(ClimbAscent.climb_type == "boulder", ClimbAscent.boulder_id.isnot(None))
    if active_ids:
        q = q.filter(~ClimbAscent.boulder_id.in_(active_ids))
    removed = q.count()
    if removed:
        if active_ids:
            db.query(ClimbAscent).filter(
                ClimbAscent.climb_type == "boulder",
                ClimbAscent.boulder_id.isnot(None),
                ~ClimbAscent.boulder_id.in_(active_ids),
            ).delete(synchronize_session=False)
        else:
            db.query(ClimbAscent).filter(ClimbAscent.climb_type == "boulder").delete(synchronize_session=False)

    rq = db.query(ClimbUserRating).filter(
        ClimbUserRating.climb_type == "boulder",
        ClimbUserRating.boulder_id.isnot(None),
    )
    if active_ids:
        rq = rq.filter(~ClimbUserRating.boulder_id.in_(active_ids))
        rq.delete(synchronize_session=False)
    else:
        db.query(ClimbUserRating).filter(ClimbUserRating.climb_type == "boulder").delete(synchronize_session=False)
    return removed


def purge_community_for_soft_deleted_climbs(db: Session) -> int:
    """Убрать из логбуков пролазы по удалённым или отсутствующим объектам каталога."""
    active_route_ids = {
        row[0]
        for row in db.query(Route.id).filter(Route.deleted_at.is_(None)).all()
    }
    active_boulder_ids = {
        row[0]
        for row in db.query(Boulder.id).filter(Boulder.deleted_at.is_(None)).all()
    }
    removed = 0
    removed += _delete_route_community_not_in_catalog(db, active_route_ids)
    removed += _delete_boulder_community_not_in_catalog(db, active_boulder_ids)
    return removed
