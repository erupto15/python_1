"""Хранение загруженных фото/видео на диске (uploads/)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from fastapi import HTTPException, UploadFile, status

from app.config import settings

MediaKind = Literal["image", "video"]

DETAIL_UNSUPPORTED_MEDIA = (
    "Неподдерживаемый формат файла: можно загружать фото (JPEG, PNG, WebP, GIF, HEIC) "
    "и видео (MP4, MOV, 3GP, WebM, MKV, AVI)"
)
DETAIL_EMPTY_FILE = "Пустой файл"
DETAIL_NOT_AN_IMAGE = "Файл не является фото"
DETAIL_NOT_A_VIDEO = "Файл не является видео"

_CHUNK_SIZE = 1024 * 1024

# Major brand ISO BMFF (байты 8..12 после `ftyp`) → тип. Неизвестные бренды считаем MP4.
_HEIF_BRANDS = {
    b"heic": ("image/heic", ".heic"),
    b"heix": ("image/heic", ".heic"),
    b"hevc": ("image/heic", ".heic"),
    b"hevx": ("image/heic", ".heic"),
    b"heim": ("image/heic", ".heic"),
    b"heis": ("image/heic", ".heic"),
    b"mif1": ("image/heif", ".heif"),
    b"msf1": ("image/heif", ".heif"),
}


@dataclass(frozen=True)
class DetectedMedia:
    kind: MediaKind
    mime_type: str
    extension: str


def ensure_upload_dir() -> Path:
    root = settings.media_upload_path
    root.mkdir(parents=True, exist_ok=True)
    return root


def detect_media_type(head: bytes) -> DetectedMedia | None:
    """Тип по сигнатуре (magic bytes); присланным Content-Type и имени файла не доверяем."""
    if head.startswith(b"\xff\xd8\xff"):
        return DetectedMedia("image", "image/jpeg", ".jpg")
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return DetectedMedia("image", "image/png", ".png")
    if head.startswith((b"GIF87a", b"GIF89a")):
        return DetectedMedia("image", "image/gif", ".gif")
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return DetectedMedia("image", "image/webp", ".webp")
    if head[:4] == b"RIFF" and head[8:12] == b"AVI ":
        return DetectedMedia("video", "video/x-msvideo", ".avi")
    if head.startswith(b"\x1a\x45\xdf\xa3"):
        # EBML: WebM и Matroska различаются DocType в заголовке.
        if b"webm" in head[:64]:
            return DetectedMedia("video", "video/webm", ".webm")
        return DetectedMedia("video", "video/x-matroska", ".mkv")
    if head[4:8] == b"ftyp" and len(head) >= 12:
        brand = head[8:12]
        if brand in _HEIF_BRANDS:
            mime, ext = _HEIF_BRANDS[brand]
            return DetectedMedia("image", mime, ext)
        if brand == b"qt  ":
            return DetectedMedia("video", "video/quicktime", ".mov")
        if brand.startswith(b"3g"):
            return DetectedMedia("video", "video/3gpp", ".3gp")
        if brand == b"M4V ":
            return DetectedMedia("video", "video/x-m4v", ".m4v")
        return DetectedMedia("video", "video/mp4", ".mp4")
    return None


def _check_declared_kind(detected: DetectedMedia, declared_mime: str | None, requested_kind: str | None) -> None:
    """Если клиент явно заявил фото/видео, а внутри другое — отказ (подтип вроде png/jpeg не сверяем)."""
    declared = (declared_mime or "").lower()
    expected = requested_kind
    if expected is None and declared.startswith(("image/", "video/")):
        expected = declared.split("/", 1)[0]
    if expected in ("image", "video") and expected != detected.kind:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=DETAIL_NOT_AN_IMAGE if expected == "image" else DETAIL_NOT_A_VIDEO,
        )


def save_upload_file(file: UploadFile, *, requested_kind: str | None = None) -> dict:
    """Сохраняет UploadFile на диск и возвращает метаданные о файле.

    Тип и расширение определяются только по содержимому; подкаталог — images/ или videos/.
    """
    try:
        first_chunk = file.file.read(_CHUNK_SIZE)
        if not first_chunk:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=DETAIL_EMPTY_FILE)
        detected = detect_media_type(first_chunk[:64])
        if detected is None:
            raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=DETAIL_UNSUPPORTED_MEDIA)
        _check_declared_kind(detected, file.content_type, requested_kind)

        subdir = "videos" if detected.kind == "video" else "images"
        target_dir = ensure_upload_dir() / subdir
        target_dir.mkdir(parents=True, exist_ok=True)
        stored_name = f"{uuid.uuid4()}{detected.extension}"
        target_path = target_dir / stored_name

        max_bytes = settings.media_max_upload_bytes
        size = 0
        try:
            with target_path.open("wb") as out:
                chunk = first_chunk
                while chunk:
                    size += len(chunk)
                    if size > max_bytes:
                        raise HTTPException(
                            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail=f"Файл слишком большой: максимум {max_bytes} байт",
                        )
                    out.write(chunk)
                    chunk = file.file.read(_CHUNK_SIZE)
        except Exception:
            target_path.unlink(missing_ok=True)
            raise
    finally:
        try:
            file.file.close()
        except Exception:
            pass

    url = f"{settings.media_url_prefix.rstrip('/')}/{subdir}/{stored_name}"

    return {
        "url": url,
        "file_name": file.filename,
        "mime_type": detected.mime_type,
        "file_size_bytes": size,
        "stored_name": stored_name,
        "media_kind": detected.kind,
    }
