from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import schemas
from app.db import get_db
from app.deps import get_current_user
from app.models import Boulder, ClimbAscent, ClimbUserRating, Route, User

router = APIRouter(prefix="/users", tags=["users"])


@router.post("", response_model=schemas.UserRead, status_code=201)
def register_user() -> User:
    raise HTTPException(status_code=403, detail="User self-registration is disabled")


def _profile_counts(db: Session, user_id: str) -> dict[str, int]:
    sends = (
        db.query(func.count(ClimbAscent.id))
        .filter(ClimbAscent.user_id == user_id, ClimbAscent.status == "send")
        .scalar()
        or 0
    )
    styles = (
        db.query(func.count(ClimbAscent.id))
        .filter(
            ClimbAscent.user_id == user_id,
            ClimbAscent.status == "send",
            ClimbAscent.ascent_style.in_(("onsight", "flash", "redpoint")),
        )
        .scalar()
        or 0
    )
    ratings = db.query(func.count(ClimbUserRating.id)).filter(ClimbUserRating.user_id == user_id).scalar() or 0
    routes = db.query(func.count(Route.id)).filter(Route.created_by == user_id, Route.deleted_at.is_(None)).scalar() or 0
    boulders = (
        db.query(func.count(Boulder.id)).filter(Boulder.created_by == user_id, Boulder.deleted_at.is_(None)).scalar() or 0
    )
    return {
        "sends_count": int(sends),
        "styles_count": int(styles),
        "attempts_count": int(styles),
        "ratings_count": int(ratings),
        "created_routes_count": int(routes),
        "created_boulders_count": int(boulders),
    }


@router.get("/me/profile", response_model=schemas.UserProfileRead)
def my_profile(current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    counts = _profile_counts(db, current.id)
    return {
        "id": current.id,
        "display_name": current.display_name,
        "telegram_username": current.telegram_username,
        "created_at": current.created_at,
        **counts,
    }


@router.get("/{user_id}/profile", response_model=schemas.UserProfileRead)
def get_user_profile(user_id: str, db: Session = Depends(get_db)) -> dict:
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=404, detail="User not found")
    counts = _profile_counts(db, user.id)
    return {
        "id": user.id,
        "display_name": user.display_name,
        "telegram_username": user.telegram_username,
        "created_at": user.created_at,
        **counts,
    }


@router.get("/{user_id}", response_model=schemas.UserPublicRead)
def get_user(user_id: str, db: Session = Depends(get_db)) -> User:
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("/upsert-telegram", response_model=schemas.TelegramUserUpsertResponse)
def upsert_telegram_user(_: schemas.TelegramUserUpsertRequest) -> None:
    raise HTTPException(
        status_code=410,
        detail="Legacy Telegram upsert is disabled; use /api/auth/telegram with signed initData",
    )
