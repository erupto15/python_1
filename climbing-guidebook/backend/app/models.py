from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(120), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    telegram_id: Mapped[Optional[int]] = mapped_column(
        BigInteger().with_variant(Integer, "sqlite"), unique=True, nullable=True, index=True
    )
    telegram_username: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    comments: Mapped[list["Comment"]] = relationship(back_populates="user")


class Area(Base):
    __tablename__ = "areas"

    id: Mapped[int] = mapped_column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    latitude: Mapped[Optional[float]] = mapped_column(Float)
    longitude: Mapped[Optional[float]] = mapped_column(Float)
    created_by: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    sectors: Mapped[list["Sector"]] = relationship(back_populates="area", cascade="all, delete-orphan")


class Sector(Base):
    __tablename__ = "sectors"

    id: Mapped[int] = mapped_column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    area_id: Mapped[int] = mapped_column(ForeignKey("areas.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    created_by: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    area: Mapped["Area"] = relationship(back_populates="sectors")


class Route(Base):
    __tablename__ = "routes"

    id: Mapped[int] = mapped_column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    sector_id: Mapped[int] = mapped_column(ForeignKey("sectors.id", ondelete="RESTRICT"), nullable=False, index=True)
    area_id: Mapped[int] = mapped_column(ForeignKey("areas.id", ondelete="RESTRICT"), nullable=False, index=True)
    created_by: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    grade: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    length_m: Mapped[Optional[float]] = mapped_column(Float)
    bolts: Mapped[Optional[int]] = mapped_column(Integer)
    sector_label: Mapped[Optional[str]] = mapped_column(String(255))
    category: Mapped[Optional[str]] = mapped_column(String(64))
    rating: Mapped[Optional[float]] = mapped_column(Float)
    latitude: Mapped[Optional[float]] = mapped_column(Float)
    longitude: Mapped[Optional[float]] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    photos: Mapped[list["Photo"]] = relationship(
        back_populates="route",
        cascade="all, delete-orphan",
    )
    comments: Mapped[list["Comment"]] = relationship(
        back_populates="route",
        cascade="all, delete-orphan",
    )


class Boulder(Base):
    __tablename__ = "boulders"

    id: Mapped[int] = mapped_column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    sector_id: Mapped[int] = mapped_column(ForeignKey("sectors.id", ondelete="RESTRICT"), nullable=False, index=True)
    area_id: Mapped[int] = mapped_column(ForeignKey("areas.id", ondelete="RESTRICT"), nullable=False, index=True)
    created_by: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    grade: Mapped[str] = mapped_column(String(32), nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(64))
    rating: Mapped[Optional[float]] = mapped_column(Float)
    height_m: Mapped[Optional[float]] = mapped_column(Float)
    latitude: Mapped[Optional[float]] = mapped_column(Float)
    longitude: Mapped[Optional[float]] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    photos: Mapped[list["Photo"]] = relationship(
        back_populates="boulder",
        cascade="all, delete-orphan",
    )
    comments: Mapped[list["Comment"]] = relationship(
        back_populates="boulder",
        cascade="all, delete-orphan",
    )


class Photo(Base):
    __tablename__ = "photos"
    __table_args__ = (
        CheckConstraint(
            "(climb_type = 'route' AND route_id IS NOT NULL AND boulder_id IS NULL) "
            "OR (climb_type = 'boulder' AND boulder_id IS NOT NULL AND route_id IS NULL)",
            name="photos_one_climb",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    climb_type: Mapped[str] = mapped_column(String(16), nullable=False)
    route_id: Mapped[Optional[int]] = mapped_column(ForeignKey("routes.id", ondelete="CASCADE"), index=True)
    boulder_id: Mapped[Optional[int]] = mapped_column(ForeignKey("boulders.id", ondelete="CASCADE"), index=True)
    uploaded_by: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"))
    image_url: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    climb_name: Mapped[Optional[str]] = mapped_column(String(255))
    climb_category: Mapped[Optional[str]] = mapped_column(String(64))
    file_name: Mapped[Optional[str]] = mapped_column(String(255))
    mime_type: Mapped[Optional[str]] = mapped_column(String(128))
    file_size_bytes: Mapped[Optional[int]] = mapped_column(BigInteger().with_variant(Integer, "sqlite"))
    markup: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    route: Mapped[Optional["Route"]] = relationship(back_populates="photos", foreign_keys=[route_id])
    boulder: Mapped[Optional["Boulder"]] = relationship(back_populates="photos", foreign_keys=[boulder_id])


class Comment(Base):
    __tablename__ = "comments"
    __table_args__ = (
        CheckConstraint(
            "(climb_type = 'route' AND route_id IS NOT NULL AND boulder_id IS NULL) "
            "OR (climb_type = 'boulder' AND boulder_id IS NOT NULL AND route_id IS NULL)",
            name="comments_one_climb",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    climb_type: Mapped[str] = mapped_column(String(16), nullable=False)
    route_id: Mapped[Optional[int]] = mapped_column(ForeignKey("routes.id", ondelete="CASCADE"), index=True)
    boulder_id: Mapped[Optional[int]] = mapped_column(ForeignKey("boulders.id", ondelete="CASCADE"), index=True)
    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("comments.id", ondelete="CASCADE"))
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    user: Mapped["User"] = relationship(back_populates="comments")
    route: Mapped[Optional["Route"]] = relationship(back_populates="comments", foreign_keys=[route_id])
    boulder: Mapped[Optional["Boulder"]] = relationship(back_populates="comments", foreign_keys=[boulder_id])
