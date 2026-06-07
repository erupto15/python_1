"""8a.nu-style performance points from logbook sends."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import Boulder, ClimbAscent, Route, User

# French grades: 8a redpoint = 1000, +50 per (+) step (8a.nu model).
GRADE_POINTS: dict[str, int] = {
    "4": 150,
    "4+": 175,
    "5": 200,
    "5+": 225,
    "5a": 250,
    "5a+": 275,
    "5b": 300,
    "5b+": 325,
    "5c": 350,
    "5c+": 375,
    "6a": 400,
    "6a+": 450,
    "6b": 500,
    "6b+": 550,
    "6c": 600,
    "6c+": 650,
    "7a": 700,
    "7a+": 750,
    "7b": 800,
    "7b+": 850,
    "7c": 900,
    "7c+": 950,
    "8a": 1000,
    "8a+": 1050,
    "8b": 1100,
    "8b+": 1150,
    "8c": 1200,
    "8c+": 1250,
    "9a": 1300,
    "9a+": 1350,
    "9b": 1400,
    "9b+": 1450,
    "9c": 1500,
    "9c+": 1550,
}

STYLE_BONUS = {
    "onsight": 147,
    "flash": 53,
    "redpoint": 0,
}
SECOND_GO_BONUS = 2


def normalize_grade(grade: str, *, is_boulder: bool = False) -> str:
    if not grade:
        return ""
    s = str(grade).strip()
    m45 = re.match(r"^(4|5)(\+)?$", s)
    if m45:
        return m45.group(1) + (m45.group(2) or "")
    m = re.match(r"^([6-9])([A-Za-z])(\+)?$", s)
    if m:
        letter = m.group(2).upper() if is_boulder else m.group(2).lower()
        return m.group(1) + letter + (m.group(3) or "")
    return s.lower() if not is_boulder else s


def grade_base_points(grade: str, *, is_boulder: bool = False) -> int | None:
    key = normalize_grade(grade, is_boulder=is_boulder)
    lookup = key.lower() if is_boulder else key
    return GRADE_POINTS.get(lookup)


def ascent_points(
    grade: str,
    *,
    is_boulder: bool,
    ascent_style: str | None,
    tries: int,
) -> int | None:
    base = grade_base_points(grade, is_boulder=is_boulder)
    if base is None:
        return None
    bonus = 0
    style = (ascent_style or "").strip().lower()
    if style == "onsight":
        bonus += STYLE_BONUS["onsight"]
    elif style == "flash":
        bonus += STYLE_BONUS["flash"]
    elif style == "redpoint" and tries == 2:
        bonus += SECOND_GO_BONUS
    return base + bonus


@dataclass
class UserScoreTotals:
    user_id: str
    route_points: int = 0
    boulder_points: int = 0
    route_top_count: int = 0
    boulder_top_count: int = 0

    @property
    def total_points(self) -> int:
        return self.route_points + self.boulder_points


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


def _climb_key(row: ClimbAscent) -> tuple[str, str, int] | None:
    if row.climb_type == "route" and row.route_id is not None:
        return ("route", row.user_id, row.route_id)
    if row.climb_type == "boulder" and row.boulder_id is not None:
        return ("boulder", row.user_id, row.boulder_id)
    return None


def _top_sum(values: list[int], top_n: int) -> tuple[int, int]:
    if not values:
        return 0, 0
    picked = sorted(values, reverse=True)[:top_n]
    return sum(picked), len(picked)


def build_leaderboard(
    db: Session,
    *,
    top_performances: int = 10,
    months: int = 12,
) -> dict:
    since = datetime.now(timezone.utc) - timedelta(days=months * 30)
    sends = (
        db.query(ClimbAscent)
        .filter(
            ClimbAscent.status == "send",
            ClimbAscent.logged_at >= since,
        )
        .order_by(ClimbAscent.logged_at.desc())
        .all()
    )

    route_cache: dict[int, Route | None] = {}
    boulder_cache: dict[int, Boulder | None] = {}

    def get_route(route_id: int) -> Route | None:
        if route_id not in route_cache:
            row = db.get(Route, route_id)
            route_cache[route_id] = row if row and row.deleted_at is None else None
        return route_cache[route_id]

    def get_boulder(boulder_id: int) -> Boulder | None:
        if boulder_id not in boulder_cache:
            row = db.get(Boulder, boulder_id)
            boulder_cache[boulder_id] = row if row and row.deleted_at is None else None
        return boulder_cache[boulder_id]

    best_by_climb: dict[tuple[str, str, int], int] = {}
    for row in sends:
        key = _climb_key(row)
        if key is None:
            continue
        climb_type, user_id, climb_id = key
        if climb_type == "route":
            climb = get_route(climb_id)
        else:
            climb = get_boulder(climb_id)
        if climb is None or not climb.grade:
            continue
        pts = ascent_points(
            climb.grade,
            is_boulder=(climb_type == "boulder"),
            ascent_style=row.ascent_style,
            tries=row.tries,
        )
        if pts is None:
            continue
        prev = best_by_climb.get(key)
        if prev is None or pts > prev:
            best_by_climb[key] = pts

    per_user_routes: dict[str, list[int]] = {}
    per_user_boulders: dict[str, list[int]] = {}
    for (climb_type, user_id, _climb_id), pts in best_by_climb.items():
        if climb_type == "route":
            per_user_routes.setdefault(user_id, []).append(pts)
        else:
            per_user_boulders.setdefault(user_id, []).append(pts)

    user_ids = set(per_user_routes) | set(per_user_boulders)
    totals: list[UserScoreTotals] = []
    for user_id in user_ids:
        route_pts, route_cnt = _top_sum(per_user_routes.get(user_id, []), top_performances)
        boulder_pts, boulder_cnt = _top_sum(per_user_boulders.get(user_id, []), top_performances)
        totals.append(
            UserScoreTotals(
                user_id=user_id,
                route_points=route_pts,
                boulder_points=boulder_pts,
                route_top_count=route_cnt,
                boulder_top_count=boulder_cnt,
            )
        )

    totals.sort(key=lambda t: (-t.total_points, -t.route_points, -t.boulder_points, t.user_id))

    rows: list[dict] = []
    for idx, item in enumerate(totals, start=1):
        user = db.get(User, item.user_id)
        rows.append(
            {
                "rank": idx,
                "user_id": item.user_id,
                "display_name": _user_display(user),
                "telegram_username": user.telegram_username if user else None,
                "route_points": item.route_points,
                "boulder_points": item.boulder_points,
                "total_points": item.total_points,
                "route_top_count": item.route_top_count,
                "boulder_top_count": item.boulder_top_count,
            }
        )

    return {
        "top_performances": top_performances,
        "months": months,
        "rows": rows,
    }
