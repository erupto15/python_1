"""Хранение загруженных фото/видео на диске (uploads/)."""

from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.config import settings

_EXTRA_EXTENSIONS = {".mov", ".m4v", ".3gp", ".heic", ".heif"}


def ensure_upload_dir() -> Path:
    root = settings.media_upload_path
    root.mkdir(parents=True, exist_ok=True)
    return root


def _guess_extension(file_name: str | None, mime_type: str | None) -> str:
    if file_name:
        ext = Path(file_name).suffix.lower()
        if ext:
            return ext
    if mime_type:
        guess = {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
            "image/gif": ".gif",
            "image/heic": ".heic",
            "image/heif": ".heif",
            "video/mp4": ".mp4",
            "video/quicktime": ".mov",
            "video/webm": ".webm",
            "video/3gpp": ".3gp",
        }.get(mime_type.lower())
        if guess:
            return guess
    return ""


def _validate_media_type(file_name: str | None, mime_type: str | None) -> None:
    mime = (mime_type or "").lower()
    ext = Path(file_name or "").suffix.lower()

    if mime.startswith("image/") or mime.startswith("video/"):
        return
    if ext in _EXTRA_EXTENSIONS:
        return
    # Некоторые мобильные клиенты отправляют общий octet-stream — доверяем расширению.
    if mime in ("application/octet-stream", "") and ext in _EXTRA_EXTENSIONS:
        return

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Unsupported media type: only images and videos are allowed",
    )


def save_upload_file(file: UploadFile, *, subdir: str) -> dict:
    """Сохраняет UploadFile на диск и возвращает метаданные о файле."""

    _validate_media_type(file.filename, file.content_type)

    root = ensure_upload_dir()
    target_dir = root / subdir
    target_dir.mkdir(parents=True, exist_ok=True)

    ext = _guess_extension(file.filename, file.content_type)
    stored_name = f"{uuid.uuid4()}{ext}"
    target_path = target_dir / stored_name

    max_bytes = settings.media_max_upload_bytes
    size = 0
    try:
        with target_path.open("wb") as out:
            while True:
                chunk = file.file.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > max_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File too large: max {max_bytes} bytes",
                    )
                out.write(chunk)
    except HTTPException:
        target_path.unlink(missing_ok=True)
        raise
    except Exception:
        target_path.unlink(missing_ok=True)
        raise
    finally:
        try:
            file.file.close()
        except Exception:
            pass

    if size == 0:
        target_path.unlink(missing_ok=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file upload")

    url = f"{settings.media_url_prefix.rstrip('/')}/{subdir}/{stored_name}"

    return {
        "url": url,
        "file_name": file.filename,
        "mime_type": file.content_type,
        "file_size_bytes": size,
        "stored_name": stored_name,
    }
