"""Однократное создание администратора при старте, если пользователя с таким email ещё нет."""

from sqlalchemy.orm import Session

from app import security
from app.config import settings
from app.catalog_seed import ensure_catalog_seed
from app.models import User


def ensure_admin_user(db: Session) -> User:
    email = settings.admin_email.strip().lower()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        existing.password_hash = security.hash_password(settings.admin_password)
        existing.display_name = settings.admin_display_name
        existing.is_active = True
        db.commit()
        return existing
    user = User(
        email=email,
        password_hash=security.hash_password(settings.admin_password),
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
