from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class TelegramAuthRequest(BaseModel):
    init_data: str = Field(min_length=1)


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    display_name: str = Field(default="", max_length=120)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return str(v).strip().lower()


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    display_name: str
    is_active: bool
    created_at: datetime
    telegram_id: Optional[int] = None
    telegram_username: Optional[str] = None
    telegram_photo_url: Optional[str] = None


class UserPublicRead(BaseModel):
    """Публичный профиль без email."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    display_name: str
    telegram_username: Optional[str] = None
    telegram_photo_url: Optional[str] = None
    created_at: datetime


class UserProfileRead(UserPublicRead):
    sends_count: int = 0
    styles_count: int = 0
    ratings_count: int = 0
    created_routes_count: int = 0
    created_boulders_count: int = 0
    # Обратная совместимость (styles_count)
    attempts_count: int = 0


class TelegramUserUpsertRequest(BaseModel):
    telegram_id: int
    username: Optional[str] = Field(None, max_length=64)


class TelegramUserUpsertResponse(BaseModel):
    ok: bool = True
    user: UserRead


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Optional[UserRead] = None


class AreaCreate(BaseModel):
    name: str = Field(max_length=255)
    description: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_by: Optional[str] = None


class AreaUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class AreaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    created_by: Optional[str]
    created_at: datetime
    updated_at: datetime


class SectorCreate(BaseModel):
    name: str = Field(max_length=255)
    description: Optional[str] = None
    created_by: Optional[str] = None


class SectorUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None


class SectorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    area_id: int
    name: str
    description: Optional[str]
    created_by: Optional[str]
    created_at: datetime
    updated_at: datetime


class RouteCreate(BaseModel):
    sector_id: int
    area_id: int
    name: str = Field(max_length=255)
    description: Optional[str] = None
    grade: str = Field(max_length=32)
    length_m: Optional[float] = None
    bolts: Optional[int] = None
    sector_label: Optional[str] = Field(None, max_length=255)
    category: Optional[str] = Field(None, max_length=64)
    rating: Optional[float] = Field(None, ge=0, le=3)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_by: Optional[str] = None


class RouteUpdate(BaseModel):
    sector_id: Optional[int] = None
    area_id: Optional[int] = None
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    grade: Optional[str] = Field(None, max_length=32)
    length_m: Optional[float] = None
    bolts: Optional[int] = None
    sector_label: Optional[str] = Field(None, max_length=255)
    category: Optional[str] = Field(None, max_length=64)
    rating: Optional[float] = Field(None, ge=0, le=3)
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class RouteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sector_id: int
    area_id: int
    created_by: Optional[str]
    name: str
    description: Optional[str]
    grade: str
    length_m: Optional[float]
    bolts: Optional[int]
    sector_label: Optional[str]
    category: Optional[str]
    rating: Optional[float]
    latitude: Optional[float]
    longitude: Optional[float]
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime]


class BoulderCreate(BaseModel):
    sector_id: int
    area_id: int
    name: str = Field(max_length=255)
    description: Optional[str] = None
    grade: str = Field(max_length=32)
    category: Optional[str] = Field(None, max_length=64)
    rating: Optional[float] = Field(None, ge=0, le=3)
    height_m: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_by: Optional[str] = None


class BoulderUpdate(BaseModel):
    sector_id: Optional[int] = None
    area_id: Optional[int] = None
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    grade: Optional[str] = Field(None, max_length=32)
    category: Optional[str] = Field(None, max_length=64)
    rating: Optional[float] = Field(None, ge=0, le=3)
    height_m: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class BoulderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sector_id: int
    area_id: int
    created_by: Optional[str]
    name: str
    description: Optional[str]
    grade: str
    category: Optional[str]
    rating: Optional[float]
    height_m: Optional[float]
    latitude: Optional[float]
    longitude: Optional[float]
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime]


class PhotoCreate(BaseModel):
    climb_type: Literal["route", "boulder"]
    route_id: Optional[int] = None
    boulder_id: Optional[int] = None
    image_url: str
    description: Optional[str] = None
    file_name: Optional[str] = Field(None, max_length=255)
    mime_type: Optional[str] = Field(None, max_length=128)
    file_size_bytes: Optional[int] = None
    markup: Optional[dict[str, Any]] = None


class PhotoUpdate(BaseModel):
    image_url: Optional[str] = None
    description: Optional[str] = None
    file_name: Optional[str] = Field(None, max_length=255)
    mime_type: Optional[str] = Field(None, max_length=128)
    file_size_bytes: Optional[int] = None
    markup: Optional[dict[str, Any]] = None


class PhotoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    climb_type: str
    route_id: Optional[int]
    boulder_id: Optional[int]
    uploaded_by: Optional[str]
    image_url: str
    description: Optional[str]
    climb_name: Optional[str]
    climb_category: Optional[str]
    file_name: Optional[str]
    mime_type: Optional[str]
    file_size_bytes: Optional[int]
    markup: Optional[dict[str, Any]]
    created_at: datetime
    updated_at: datetime


class CommentCreate(BaseModel):
    climb_type: Literal["route", "boulder"]
    route_id: Optional[int] = None
    boulder_id: Optional[int] = None
    body: str
    parent_id: Optional[int] = None


class CommentUpdate(BaseModel):
    body: str


class CommentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: str
    climb_type: str
    route_id: Optional[int]
    boulder_id: Optional[int]
    parent_id: Optional[int]
    body: str
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime]


AscentStyle = Literal["onsight", "flash", "redpoint"]


class AscentCreate(BaseModel):
    climb_type: Literal["route", "boulder"]
    route_id: Optional[int] = None
    boulder_id: Optional[int] = None
    status: Literal["send", "attempt"] = "send"
    ascent_style: Optional[AscentStyle] = None
    tries: int = Field(default=1, ge=1, le=999)
    notes: Optional[str] = Field(None, max_length=2000)

    @field_validator("ascent_style", mode="before")
    @classmethod
    def normalize_style(cls, v: object) -> object:
        if v is None or v == "":
            return None
        return str(v).strip().lower()


class AscentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: str
    climb_type: str
    route_id: Optional[int]
    boulder_id: Optional[int]
    status: str
    ascent_style: Optional[str] = None
    tries: int
    notes: Optional[str]
    logged_at: datetime
    created_at: datetime


class AscentReadEnriched(AscentRead):
    climb_name: str = ""
    climb_grade: str = ""
    structure_label: Optional[str] = None


class ClimbRatingUpsert(BaseModel):
    climb_type: Literal["route", "boulder"]
    route_id: Optional[int] = None
    boulder_id: Optional[int] = None
    stars: int = Field(ge=1, le=3)
    felt_grade: Optional[str] = Field(None, max_length=32)


class ClimbRatingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: str
    climb_type: str
    route_id: Optional[int]
    boulder_id: Optional[int]
    stars: int
    felt_grade: Optional[str]
    created_at: datetime
    updated_at: datetime


class ClimbSendEntry(BaseModel):
    user_display_name: str
    ascent_style: Optional[str] = None
    tries: int = 1
    logged_at: datetime


class ClimbCommunityStats(BaseModel):
    climb_type: str
    route_id: Optional[int] = None
    boulder_id: Optional[int] = None
    send_count: int = 0
    attempt_count: int = 0
    ratings_count: int = 0
    avg_stars: Optional[float] = None
    felt_grades: list[str] = Field(default_factory=list)
    recent_sends: list[ClimbSendEntry] = Field(default_factory=list)
    my_status: Optional[str] = None
    my_tries: Optional[int] = None
    my_stars: Optional[int] = None
    my_felt_grade: Optional[str] = None


class MyAscentSummary(BaseModel):
    sent_route_ids: list[int] = Field(default_factory=list)
    sent_boulder_ids: list[int] = Field(default_factory=list)
    attempted_route_ids: list[int] = Field(default_factory=list)
    attempted_boulder_ids: list[int] = Field(default_factory=list)


class LeaderboardRow(BaseModel):
    rank: int
    user_id: str
    display_name: str
    telegram_username: Optional[str] = None
    route_points: int = 0
    boulder_points: int = 0
    total_points: int = 0
    route_top_count: int = 0
    boulder_top_count: int = 0


class LeaderboardRead(BaseModel):
    top_performances: int = 10
    months: int = 12
    rows: list[LeaderboardRow] = Field(default_factory=list)
    my_rank: Optional[int] = None
    my_row: Optional[LeaderboardRow] = None
