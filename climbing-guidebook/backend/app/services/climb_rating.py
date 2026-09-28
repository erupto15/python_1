"""Community star ratings (1–3 stars) and route display rating from admin baseline + votes."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import Boulder, ClimbUserRating, Route

STAR_SCALE_MAX = 3
ROUTE_VOTE_BLEND_K = 3.0


def star_average(stars: list[int]) -> float | None:
    """Arithmetic mean of user star votes."""
    if not stars:
        return None
    return round(sum(stars) / len(stars), 1)


def compute_route_display_rating(admin_rating: float | None, vote_stars: list[int]) -> float | None:
    """
    Public route rating: admin baseline adjusted toward community votes.
    With no votes — admin value; with votes — blend admin_rating and mean(stars).
    """
    if not vote_stars:
        if admin_rating is None:
            return None
        return round(max(1.0, min(STAR_SCALE_MAX, float(admin_rating))), 1)
    community = star_average(vote_stars)
    if community is None:
        return None
    if admin_rating is None:
        return community
    n = len(vote_stars)
    weight = n / (n + ROUTE_VOTE_BLEND_K)
    blended = float(admin_rating) + (community - float(admin_rating)) * weight
    return round(max(1.0, min(STAR_SCALE_MAX, blended)), 1)


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
) -> tuple[float | None, int, float | None]:
    """
    Returns (community_avg, vote_count, display_rating_on_climb).
    For routes display_rating follows admin_rating + votes; for boulders = community avg.
    """
    stars = _rating_rows(db, climb_type, route_id, boulder_id)
    count = len(stars)
    avg = star_average(stars)
    display: float | None
    if climb_type == "route":
        climb = db.get(Route, route_id)
        admin = getattr(climb, "admin_rating", None) if climb is not None else None
        if admin is None and climb is not None and climb.rating is not None and not stars:
            admin = climb.rating
        display = compute_route_display_rating(admin, stars)
    else:
        climb = db.get(Boulder, boulder_id)
        display = avg
    if climb is not None:
        climb.rating = display
        db.add(climb)
        db.commit()
    return avg, count, display


def upsert_climb_user_rating(
    db: Session,
    *,
    user_id: str,
    climb_type: str,
    route_id: int | None,
    boulder_id: int | None,
    stars: int,
    felt_grade: str | None,
) -> ClimbUserRating:
    q = db.query(ClimbUserRating).filter(
        ClimbUserRating.user_id == user_id,
        ClimbUserRating.climb_type == climb_type,
    )
    if climb_type == "route":
        q = q.filter(ClimbUserRating.route_id == route_id)
    else:
        q = q.filter(ClimbUserRating.boulder_id == boulder_id)
    row = q.first()
    felt = (felt_grade or "").strip() or None
    if row:
        row.stars = stars
        if felt is not None:
            row.felt_grade = felt
    else:
        row = ClimbUserRating(
            user_id=user_id,
            climb_type=climb_type,
            route_id=route_id,
            boulder_id=boulder_id,
            stars=stars,
            felt_grade=felt,
        )
        db.add(row)
    db.commit()
    db.refresh(row)
    sync_climb_star_average(db, climb_type, route_id, boulder_id)
    return row
