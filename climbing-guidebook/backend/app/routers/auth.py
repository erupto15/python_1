from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import schemas, security
from app.config import settings
from app.db import get_db
from app.deps import get_current_user
from app.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)) -> dict[str, str]:
    """OAuth2: `username` — email (в нижнем регистре) или короткий алиас admin; `password` — пароль."""
    username_raw = (form_data.username or "").strip()
    username_cf = username_raw.casefold()
    admin_email_norm = settings.admin_email.strip().casefold()
    if username_cf == "admin":
        user = db.query(User).filter(func.lower(User.email) == admin_email_norm).first()
    else:
        user = db.query(User).filter(func.lower(User.email) == username_cf).first()
    if not user or not security.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")
    token = security.create_access_token(user.id)
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=schemas.UserRead)
def me(current: User = Depends(get_current_user)) -> User:
    return current
