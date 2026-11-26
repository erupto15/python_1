from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app import schemas
from app.deps import get_current_user
from app.models import User
from app.services.media_storage import save_upload_file

router = APIRouter(prefix="/media", tags=["media"])


@router.post("/upload", response_model=schemas.MediaUploadResponse, status_code=201)
def upload_media(
    file: UploadFile = File(...),
    kind: Optional[str] = Form(None),
    user: User = Depends(get_current_user),
) -> schemas.MediaUploadResponse:
    """Тип (фото/видео) определяется по содержимому; `kind=image|video` лишь требует, чтобы он совпал."""
    if kind not in (None, "image", "video", "auto"):
        raise HTTPException(status_code=400, detail="kind must be image, video or auto")

    requested = kind if kind in ("image", "video") else None
    result = save_upload_file(file, requested_kind=requested)

    return schemas.MediaUploadResponse(
        url=result["url"],
        file_name=result["file_name"],
        mime_type=result["mime_type"],
        file_size_bytes=result["file_size_bytes"],
        media_kind=result["media_kind"],
    )
