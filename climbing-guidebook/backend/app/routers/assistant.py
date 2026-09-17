from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.deps import assert_admin, get_current_user
from app.models import User
from app.schemas import AssistantDraft, AssistantSearchQuery
from app.services.assistant_parse import extract_assistant_search_query, parse_assistant_request

router = APIRouter(prefix="/assistant", tags=["assistant"])


async def _read_assistant_photo(photo: UploadFile | None) -> tuple[bytes | None, str]:
    if photo is None:
        return None, "image/jpeg"
    mime = photo.content_type or "image/jpeg"
    image_bytes = await photo.read()
    if len(image_bytes) > 8 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Фото для помощника должно быть меньше 8 МБ",
        )
    return image_bytes, mime


@router.post("/search-query", response_model=AssistantSearchQuery)
async def search_catalog_query(
    prompt: str = Form(""),
    photo: UploadFile | None = File(None),
) -> AssistantSearchQuery:
    text = (prompt or "").strip()
    image_bytes, mime = await _read_assistant_photo(photo)
    if not text and not image_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Добавьте запрос или фото",
        )
    return extract_assistant_search_query(text, image_bytes, mime)


@router.post("/parse", response_model=AssistantDraft)
async def parse_catalog_draft(
    prompt: str = Form(""),
    photo: UploadFile | None = File(None),
    user: User = Depends(get_current_user),
) -> AssistantDraft:
    assert_admin(user)
    text = (prompt or "").strip()
    image_bytes, mime = await _read_assistant_photo(photo)
    if not text and not image_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Добавьте описание или фото",
        )
    return parse_assistant_request(text, image_bytes, mime)
