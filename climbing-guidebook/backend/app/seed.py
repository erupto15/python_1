"""Однократное создание администратора при старте, если пользователя с таким email ещё нет."""

from sqlalchemy.orm import Session

from app import security
from app.config import settings
from app.models import User


def ensure_admin_user(db: Session) -> None:
    email = settings.admin_email.strip().lower()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        existing.password_hash = security.hash_password(settings.admin_password)
        existing.display_name = settings.admin_display_name
        existing.is_active = True
        db.commit()
        return
    user = User(
        email=email,
        password_hash=security.hash_password(settings.admin_password),
        display_name=settings.admin_display_name,
        is_active=True,
    )
    db.add(user)
    db.commit()
