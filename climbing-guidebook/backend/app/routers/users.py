import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import schemas, security
from app.db import get_db
from app.models import User

router = APIRouter(prefix="/users", tags=["users"])


def _telegram_email(user_id: int) -> str:
    return f"tg_{user_id}@telegram.local"


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
    tg_id = int(payload.telegram_id)
    tg_username = (str(payload.username or "").strip() or None)
    email = _telegram_email(tg_id)

    user = db.query(User).filter(User.telegram_id == tg_id).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()

    if user:
        user.telegram_id = tg_id
        user.telegram_username = tg_username
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        user = User(
            email=email,
            password_hash=security.hash_password(secrets.token_urlsafe(32)),
            display_name=(f"@{tg_username}" if tg_username else f"Telegram {tg_id}")[:120],
            telegram_id=tg_id,
            telegram_username=tg_username,
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    return {"ok": True, "user": schemas.UserRead.model_validate(user)}
