"""Community star ratings (8a.nu style: 1–3 stars, route average = mean of votes)."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import Boulder, ClimbUserRating, Route

STAR_SCALE_MAX = 3


def star_average(stars: list[int]) -> float | None:
    """Arithmetic mean of user star votes, as on 8a.nu tick lists (star average)."""
    if not stars:
        return None
    return round(sum(stars) / len(stars), 1)


def _rating_rows(
    db: Session,
    climb_type: str,
    route_id: int | None,
    boulder_id: int | None,
) -> list[int]:
    q = db.query(ClimbUserRating.stars).filter(ClimbUserRating.climb_type == climb_type)
    if climb_type == "route":
        q = q.filter(ClimbUserRating.route_id == route_id)
    else:
        q = q.filter(ClimbUserRating.boulder_id == boulder_id)
    return [int(row[0]) for row in q.all()]


def sync_climb_star_average(
    db: Session,
    climb_type: str,
    route_id: int | None = None,
    boulder_id: int | None = None,
) -> tuple[float | None, int]:
    stars = _rating_rows(db, climb_type, route_id, boulder_id)
    count = len(stars)
    avg = star_average(stars)
    if climb_type == "route":
        climb = db.get(Route, route_id)
    else:
        climb = db.get(Boulder, boulder_id)
    if climb is not None:
        climb.rating = avg
        db.add(climb)
        db.commit()
    return avg, count
