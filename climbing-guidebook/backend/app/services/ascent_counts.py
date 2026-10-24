from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Boulder, ClimbAscent, Route


def attach_send_counts(db: Session, routes: list[Route] | None = None, boulders: list[Boulder] | None = None) -> None:
    route_rows = list(routes or [])
    boulder_rows = list(boulders or [])
    route_ids = [row.id for row in route_rows]
    boulder_ids = [row.id for row in boulder_rows]
    route_counts: dict[int, int] = {}
    boulder_counts: dict[int, int] = {}
    if route_ids:
        counted = (
            db.query(ClimbAscent.route_id, func.count())
            .filter(
                ClimbAscent.climb_type == "route",
                ClimbAscent.status == "send",
                ClimbAscent.route_id.in_(route_ids),
            )
            .group_by(ClimbAscent.route_id)
            .all()
        )
        route_counts = {int(route_id): int(count) for route_id, count in counted if route_id is not None}
    if boulder_ids:
        counted = (
            db.query(ClimbAscent.boulder_id, func.count())
            .filter(
                ClimbAscent.climb_type == "boulder",
                ClimbAscent.status == "send",
                ClimbAscent.boulder_id.in_(boulder_ids),
            )
            .group_by(ClimbAscent.boulder_id)
            .all()
        )
        boulder_counts = {int(boulder_id): int(count) for boulder_id, count in counted if boulder_id is not None}
    for row in route_rows:
        row.send_count = route_counts.get(int(row.id), 0)
    for row in boulder_rows:
        row.send_count = boulder_counts.get(int(row.id), 0)
