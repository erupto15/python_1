from pathlib import Path
from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app import schemas
from app.deps import get_current_user
from app.models import User
from app.services.media_storage import save_upload_file

router = APIRouter(prefix="/media", tags=["media"])

_VIDEO_EXTENSIONS = {".mov", ".m4v", ".3gp", ".mp4", ".webm", ".avi", ".mkv"}


def _resolve_media_kind(file_name: str | None, mime_type: str | None, requested: str | None) -> Literal["image", "video"]:
    if requested in ("image", "video"):
        return requested  # type: ignore[return-value]
    mime = (mime_type or "").lower()
    if mime.startswith("video/"):
        return "video"
    if mime.startswith("image/"):
        return "image"
    # Некоторые мобильные клиенты присылают video/*.mov как application/octet-stream.
    ext = Path(file_name or "").suffix.lower()
    if ext in _VIDEO_EXTENSIONS:
        return "video"
    return "image"


@router.post("/upload", response_model=schemas.MediaUploadResponse, status_code=201)
def upload_media(
    file: UploadFile = File(...),
    kind: Optional[str] = Form(None),
    user: User = Depends(get_current_user),
) -> schemas.MediaUploadResponse:
    if kind not in (None, "image", "video", "auto"):
        raise HTTPException(status_code=400, detail="kind must be image, video or auto")

    requested = kind if kind in ("image", "video") else None
    media_kind = _resolve_media_kind(file.filename, file.content_type, requested)
    subdir = "videos" if media_kind == "video" else "images"

    result = save_upload_file(file, subdir=subdir)

    return schemas.MediaUploadResponse(
        url=result["url"],
        file_name=result["file_name"],
        mime_type=result["mime_type"],
        file_size_bytes=result["file_size_bytes"],
        media_kind=media_kind,
    )
