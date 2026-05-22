from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import schemas
from app.db import get_db
from app.models import User
from app.services.telegram_user import upsert_telegram_user

router = APIRouter(prefix="/users", tags=["users"])


@router.post("", response_model=schemas.UserRead, status_code=201)
def register_user() -> User:
    raise HTTPException(status_code=403, detail="User self-registration is disabled")


@router.get("/{user_id}", response_model=schemas.UserRead)
def get_user(user_id: str, db: Session = Depends(get_db)) -> User:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("/upsert-telegram", response_model=schemas.TelegramUserUpsertResponse)
def upsert_telegram_user(payload: schemas.TelegramUserUpsertRequest, db: Session = Depends(get_db)) -> dict:
    """
    Аналог примера Express+pg:
    INSERT ... ON CONFLICT (telegram_id) DO UPDATE SET telegram_username=...
    """
    user = upsert_telegram_user(
        db,
        tg_id=int(payload.telegram_id),
        tg_username=(str(payload.username or "").strip() or None),
    )
    return {"ok": True, "user": schemas.UserRead.model_validate(user)}
