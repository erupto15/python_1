from typing import Annotated, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db import get_db
from app.config import settings
from app.models import User
from app.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
optional_bearer = HTTPBearer(auto_error=False)

DETAIL_MUST_CHANGE_PASSWORD = "Сначала смените временный пароль"


def _user_from_token(db: Session, token: str) -> Optional[User]:
    """Активный пользователь, если токен валиден и его версия совпадает с текущей (не отозван)."""
    try:
        user_id, token_version = decode_access_token(token)
    except ValueError:
        return None
    user = db.get(User, user_id)
    if not user or not user.is_active or (user.token_version or 0) != token_version:
        return None
    return user


def get_current_user_allow_password_change(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Session = Depends(get_db),
) -> User:
    """Только для /auth/me и /auth/change-password: пускает и с невыполненной сменой временного пароля."""
    user = _user_from_token(db, token)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def get_current_user(user: User = Depends(get_current_user_allow_password_change)) -> User:
    if user.must_change_password:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=DETAIL_MUST_CHANGE_PASSWORD)
    return user


def get_current_user_optional(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(optional_bearer)],
    db: Session = Depends(get_db),
) -> Optional[User]:
    if not credentials or not credentials.credentials:
        return None
    user = _user_from_token(db, credentials.credentials)
    if user is None or user.must_change_password:
        return None
    return user


def reject_null_fields(data: dict, fields: tuple[str, ...]) -> None:
    """PATCH: явный null для обязательного поля — 422, а не IntegrityError из БД."""
    for field in fields:
        if field in data and data[field] is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Поле «{field}» не может быть пустым",
            )


def assert_owner(user: User, owner_id: Optional[str]) -> None:
    """Если у ресурса указан владелец — менять может только он. Если владелец не задан — доступен любой авторизованный."""
    if owner_id is not None and owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to modify this resource")


def assert_admin(user: User) -> None:
    """Только админ (по ADMIN_EMAIL) может выполнять админские CRUD-операции."""
    if (user.email or "").strip().lower() != settings.admin_email.strip().lower():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
