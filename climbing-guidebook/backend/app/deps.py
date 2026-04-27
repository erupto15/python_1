from typing import Annotated, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.db import get_db
from app.config import settings
from app.models import User
from app.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Session = Depends(get_db),
) -> User:
    try:
        user_id = decode_access_token(token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def assert_owner(user: User, owner_id: Optional[str]) -> None:
    """Если у ресурса указан владелец — менять может только он. Если владелец не задан — доступен любой авторизованный."""
    if owner_id is not None and owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to modify this resource")


def assert_admin(user: User) -> None:
    """Только админ (по ADMIN_EMAIL) может выполнять админские CRUD-операции."""
    if (user.email or "").strip().lower() != settings.admin_email.strip().lower():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
