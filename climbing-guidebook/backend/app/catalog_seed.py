"""Загрузка каталога (районы, секторы, трассы, боулдеры) из YAML в PostgreSQL."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import yaml
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Area, Boulder, Route, Sector, User

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
_DEFAULT_SEED_FILE = _BACKEND_ROOT / "data" / "catalog_seed.yaml"


def resolve_seed_file() -> Path:
    raw = os.getenv("CATALOG_SEED_FILE", "").strip()
    if raw:
        return Path(raw).expanduser().resolve()
    return _DEFAULT_SEED_FILE


def load_seed_document(path: Path | None = None) -> dict[str, Any]:
    seed_path = path or resolve_seed_file()
    if not seed_path.is_file():
        return {}
    with seed_path.open(encoding="utf-8") as handle:
        data = yaml.safe_load(handle) or {}
    if not isinstance(data, dict):
        raise ValueError(f"{seed_path}: корень должен быть объектом YAML")
    return data


def _find_area(db: Session, name: str) -> Area | None:
    return db.query(Area).filter(Area.name == name).first()


def _find_sector(db: Session, area_id: int, name: str) -> Sector | None:
    return (
        db.query(Sector)
        .filter(Sector.area_id == area_id, Sector.name == name)
        .first()
    )


def _find_route(db: Session, sector_id: int, name: str) -> Route | None:
    return (
        db.query(Route)
        .filter(Route.sector_id == sector_id, Route.name == name, Route.deleted_at.is_(None))
        .first()
    )


def _find_boulder(db: Session, sector_id: int, name: str) -> Boulder | None:
    return (
        db.query(Boulder)
        .filter(Boulder.sector_id == sector_id, Boulder.name == name, Boulder.deleted_at.is_(None))
        .first()
    )


def ensure_catalog_seed(db: Session, admin_user: User | None = None) -> dict[str, int]:
    """
    Импортирует catalog_seed.yaml. Возвращает счётчики созданных сущностей.
    Пропускает уже существующие (по имени в рамках родителя).
    """
    if os.getenv("DISABLE_CATALOG_SEED", "").strip().lower() in {"1", "true", "yes"}:
        return {"areas": 0, "sectors": 0, "routes": 0, "boulders": 0, "skipped": True}

    doc = load_seed_document()
    areas_data = doc.get("areas") or []
    if not areas_data:
        return {"areas": 0, "sectors": 0, "routes": 0, "boulders": 0, "skipped": True}

    owner_id = admin_user.id if admin_user else None
    if not owner_id:
        admin = db.query(User).filter(User.email == settings.admin_email.strip().lower()).first()
        owner_id = admin.id if admin else None

    created = {"areas": 0, "sectors": 0, "routes": 0, "boulders": 0, "skipped": False}

    for area_item in areas_data:
        if not isinstance(area_item, dict):
            continue
        area_name = str(area_item.get("name") or "").strip()
        if not area_name:
            continue

        area = _find_area(db, area_name)
        if not area:
            area = Area(
                name=area_name,
                description=area_item.get("description"),
                access=area_item.get("access"),
                season=area_item.get("season"),
                parking=area_item.get("parking"),
                approach=area_item.get("approach"),
                warnings=area_item.get("warnings"),
                image_url=area_item.get("image_url"),
                latitude=area_item.get("latitude"),
                longitude=area_item.get("longitude"),
                created_by=owner_id,
            )
            db.add(area)
            db.flush()
            created["areas"] += 1

        for sector_item in area_item.get("sectors") or []:
            if not isinstance(sector_item, dict):
                continue
            sector_name = str(sector_item.get("name") or "").strip()
            if not sector_name:
                continue

            sector = _find_sector(db, area.id, sector_name)
            if not sector:
                sector = Sector(
                    area_id=area.id,
                    name=sector_name,
                    description=sector_item.get("description"),
                    access=sector_item.get("access"),
                    season=sector_item.get("season"),
                    parking=sector_item.get("parking"),
                    approach=sector_item.get("approach"),
                    warnings=sector_item.get("warnings"),
                    created_by=owner_id,
                )
                db.add(sector)
                db.flush()
                created["sectors"] += 1

            for route_item in sector_item.get("routes") or []:
                if not isinstance(route_item, dict):
                    continue
                route_name = str(route_item.get("name") or "").strip()
                grade = str(route_item.get("grade") or "6a").strip()
                if not route_name:
                    continue
                if _find_route(db, sector.id, route_name):
                    continue
                db.add(
                    Route(
                        sector_id=sector.id,
                        area_id=area.id,
                        name=route_name,
                        description=route_item.get("description"),
                        grade=grade,
                        length_m=route_item.get("length_m"),
                        bolts=route_item.get("bolts"),
                        sector_label=sector_name,
                        category=route_item.get("category"),
                        rating=route_item.get("rating"),
                        latitude=route_item.get("latitude"),
                        longitude=route_item.get("longitude"),
                        created_by=owner_id,
                    )
                )
                created["routes"] += 1

            for boulder_item in sector_item.get("boulders") or []:
                if not isinstance(boulder_item, dict):
                    continue
                boulder_name = str(boulder_item.get("name") or "").strip()
                grade = str(boulder_item.get("grade") or "7A").strip()
                if not boulder_name:
                    continue
                if _find_boulder(db, sector.id, boulder_name):
                    continue
                db.add(
                    Boulder(
                        sector_id=sector.id,
                        area_id=area.id,
                        name=boulder_name,
                        description=boulder_item.get("description"),
                        grade=grade,
                        category=boulder_item.get("category"),
                        rating=boulder_item.get("rating"),
                        height_m=boulder_item.get("height_m"),
                        latitude=boulder_item.get("latitude"),
                        longitude=boulder_item.get("longitude"),
                        created_by=owner_id,
                    )
                )
                created["boulders"] += 1

    db.commit()
    return created
