"""Однократное создание администратора при старте, если пользователя с таким email ещё нет."""

from sqlalchemy import func
from sqlalchemy.orm import Session

from app import security
from app.config import settings
from app.catalog_seed import ensure_catalog_seed
from app.models import User


def ensure_admin_user(db: Session) -> User:
    email = settings.admin_email.strip().lower()
    password = (settings.admin_password or "").strip()
    existing = db.query(User).filter(func.lower(User.email) == email).first()
    if existing:
        if password:
            existing.password_hash = security.hash_password(password)
        existing.display_name = settings.admin_display_name
        existing.is_active = True
        db.commit()
        return existing
    if not password:
        raise ValueError(
            "ADMIN_PASSWORD не задан. Укажите в .env или config/settings.yaml "
            "(файл в .gitignore) перед первым запуском."
        )
    user = User(
        email=email,
        password_hash=security.hash_password(password),
        display_name=settings.admin_display_name,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def bootstrap_catalog(db: Session) -> None:
    """Администратор + опциональный каталог из data/catalog_seed.yaml."""
    admin = ensure_admin_user(db)
    stats = ensure_catalog_seed(db, admin)
    if not stats.get("skipped"):
        print(
            "Catalog seed:",
            f"areas={stats['areas']}, sectors={stats['sectors']}, "
            f"routes={stats['routes']}, boulders={stats['boulders']}",
        )
