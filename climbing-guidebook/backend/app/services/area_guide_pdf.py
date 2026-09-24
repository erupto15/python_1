"""PDF-гайд по району: описание, секторы, трассы/боулдеры, фото."""

from __future__ import annotations

import base64
import io
import logging
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
from urllib.parse import unquote

import httpx
from fpdf import FPDF
from PIL import Image
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Area, Boulder, Photo, Route, Sector

logger = logging.getLogger(__name__)

_GUIDE_FIELDS: tuple[tuple[str, str], ...] = (
    ("access", "Доступ"),
    ("season", "Сезон"),
    ("parking", "Парковка"),
    ("approach", "Подход"),
    ("warnings", "Внимание"),
)

_FONT_CANDIDATES: tuple[Path, ...] = (
    Path(__file__).resolve().parent.parent / "assets" / "fonts" / "DejaVuSans.ttf",
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    Path("/usr/share/fonts/dejavu/DejaVuSans.ttf"),
)

_FONT_DOWNLOAD_URLS: tuple[str, ...] = (
    "https://sourceforge.net/projects/dejavu/files/dejavu/2.37/dejavu-fonts-ttf-2.37.zip/download",
)


def _safe_pdf_text(value: Any) -> str:
    text = str(value or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    return text


def _resolve_font_path() -> Path:
    for candidate in _FONT_CANDIDATES:
        if candidate.is_file():
            return candidate
    cache_dir = settings.media_upload_path / "_pdf_assets"
    cache_dir.mkdir(parents=True, exist_ok=True)
    cached = cache_dir / "DejaVuSans.ttf"
    if cached.is_file():
        return cached
    for url in _FONT_DOWNLOAD_URLS:
        try:
            with httpx.Client(follow_redirects=True, timeout=60.0) as client:
                resp = client.get(url)
                if resp.status_code != 200:
                    continue
                content = resp.content
                if url.endswith(".zip") or content[:2] == b"PK":
                    import zipfile

                    with zipfile.ZipFile(io.BytesIO(content)) as zf:
                        for name in zf.namelist():
                            if name.endswith("DejaVuSans.ttf"):
                                cached.write_bytes(zf.read(name))
                                return cached
                elif len(content) > 100_000:
                    cached.write_bytes(content)
                    return cached
        except Exception as exc:
            logger.warning("PDF font download failed from %s: %s", url, exc)
    raise RuntimeError(
        "Не найден шрифт DejaVu для PDF. Установите fonts-dejavu-core на сервере "
        "или положите DejaVuSans.ttf в backend/app/assets/fonts/."
    )


def _load_image_bytes(image_url: str) -> bytes | None:
    raw = unquote(str(image_url or "").strip())
    if not raw:
        return None
    if raw.startswith("data:"):
        match = re.match(r"data:[^;]+;base64,(.+)", raw, flags=re.DOTALL | re.IGNORECASE)
        if not match:
            return None
        try:
            return base64.b64decode(match.group(1), validate=False)
        except Exception:
            return None
    prefix = settings.media_url_prefix.rstrip("/")
    if raw.startswith(prefix + "/") or raw.startswith(prefix):
        rel = raw[len(prefix) :].lstrip("/")
        path = settings.media_upload_path / rel
        if path.is_file():
            try:
                return path.read_bytes()
            except OSError:
                return None
    if raw.startswith("/uploads/"):
        rel = raw[len("/uploads/") :]
        path = settings.media_upload_path / rel
        if path.is_file():
            try:
                return path.read_bytes()
            except OSError:
                return None
    if raw.startswith(("http://", "https://")):
        try:
            with httpx.Client(follow_redirects=True, timeout=20.0) as client:
                resp = client.get(raw)
                if resp.status_code == 200 and resp.content:
                    return resp.content
        except Exception:
            return None
    return None


def _prepare_jpeg(raw: bytes, *, max_width: int = 680) -> bytes | None:
    try:
        with Image.open(io.BytesIO(raw)) as im:
            im = im.convert("RGB")
            width, height = im.size
            if width > max_width:
                new_h = max(1, int(height * max_width / width))
                im = im.resize((max_width, new_h), Image.Resampling.LANCZOS)
            out = io.BytesIO()
            im.save(out, format="JPEG", quality=84, optimize=True)
            return out.getvalue()
    except Exception as exc:
        logger.debug("PDF image prepare failed: %s", exc)
        return None


class _GuidePDF(FPDF):
    def __init__(self, font_path: Path) -> None:
        super().__init__(orientation="P", unit="mm", format="A4")
        self._font_path = font_path
        self._font_ready = False

    def setup_fonts(self) -> None:
        if self._font_ready:
            return
        self.add_font("Guide", "", str(self._font_path))
        self._font_ready = True

    def section_title(self, title: str, *, size: int = 14) -> None:
        self.setup_fonts()
        self.set_font("Guide", "", size)
        self.set_text_color(30, 30, 34)
        self.multi_cell(0, 8, _safe_pdf_text(title))
        self.ln(2)

    def body_text(self, text: str, *, size: int = 10) -> None:
        body = _safe_pdf_text(text)
        if not body:
            return
        self.setup_fonts()
        self.set_font("Guide", "", size)
        self.set_text_color(45, 45, 52)
        self.multi_cell(0, 5.5, body)
        self.ln(1)

    def meta_line(self, text: str) -> None:
        self.setup_fonts()
        self.set_font("Guide", "", 9)
        self.set_text_color(110, 110, 120)
        self.multi_cell(0, 5, _safe_pdf_text(text))
        self.ln(1)

    def try_embed_image(self, image_url: str, *, caption: str = "") -> None:
        raw = _load_image_bytes(image_url)
        if not raw:
            return
        jpeg = _prepare_jpeg(raw)
        if not jpeg:
            return
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=True) as tmp:
            tmp.write(jpeg)
            tmp.flush()
            usable_w = self.w - self.l_margin - self.r_margin
            if self.get_y() > self.h - 70:
                self.add_page()
            try:
                self.image(tmp.name, w=usable_w)
            except Exception as exc:
                logger.debug("PDF embed image failed: %s", exc)
                return
        if caption:
            self.meta_line(caption)
        self.ln(2)


def _write_guide_block(pdf: _GuidePDF, entity: Any, title: str) -> None:
    pdf.section_title(title, size=12)
    desc = _safe_pdf_text(getattr(entity, "description", None))
    if desc:
        pdf.body_text(desc)
    for attr, label in _GUIDE_FIELDS:
        val = _safe_pdf_text(getattr(entity, attr, None))
        if val:
            pdf.body_text(f"{label}: {val}", size=9)
    pdf.ln(2)


def build_area_guide_pdf(db: Session, area_id: int) -> bytes:
    area = db.get(Area, area_id)
    if not area or area.deleted_at is not None:
        raise ValueError("area_not_found")

    sectors = (
        db.query(Sector)
        .filter(Sector.area_id == area_id, Sector.deleted_at.is_(None))
        .order_by(Sector.name, Sector.id)
        .all()
    )
    sector_ids = [int(s.id) for s in sectors]
    routes: list[Route] = []
    boulders: list[Boulder] = []
    if sector_ids:
        routes = (
            db.query(Route)
            .filter(Route.sector_id.in_(sector_ids), Route.deleted_at.is_(None))
            .order_by(Route.sort_order, Route.grade, Route.name)
            .all()
        )
        boulders = (
            db.query(Boulder)
            .filter(Boulder.sector_id.in_(sector_ids), Boulder.deleted_at.is_(None))
            .order_by(Boulder.grade, Boulder.name)
            .all()
        )

    route_ids = [int(r.id) for r in routes]
    boulder_ids = [int(b.id) for b in boulders]
    photos_by_climb: dict[tuple[str, int], Photo] = {}
    if route_ids:
        for photo in (
            db.query(Photo)
            .filter(Photo.climb_type == "route", Photo.route_id.in_(route_ids))
            .order_by(Photo.id)
            .all()
        ):
            key = ("route", int(photo.route_id))
            photos_by_climb.setdefault(key, photo)
    if boulder_ids:
        for photo in (
            db.query(Photo)
            .filter(Photo.climb_type == "boulder", Photo.boulder_id.in_(boulder_ids))
            .order_by(Photo.id)
            .all()
        ):
            key = ("boulder", int(photo.boulder_id))
            photos_by_climb.setdefault(key, photo)

    font_path = _resolve_font_path()
    pdf = _GuidePDF(font_path)
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    pdf.section_title(area.name or "Район", size=20)
    generated = datetime.now(timezone.utc).strftime("%d.%m.%Y %H:%M UTC")
    pdf.meta_line(
        f"6А9А · {len(sectors)} секторов · {len(routes)} трасс · {len(boulders)} боулдеров · {generated}"
    )
    pdf.ln(3)

    if area.image_url:
        pdf.try_embed_image(area.image_url, caption="Обложка района")
    _write_guide_block(pdf, area, "О районе")

    routes_by_sector: dict[int, list[Route]] = {sid: [] for sid in sector_ids}
    for route in routes:
        routes_by_sector.setdefault(int(route.sector_id), []).append(route)
    boulders_by_sector: dict[int, list[Boulder]] = {sid: [] for sid in sector_ids}
    for boulder in boulders:
        boulders_by_sector.setdefault(int(boulder.sector_id), []).append(boulder)

    for sector in sectors:
        sid = int(sector.id)
        pdf.add_page()
        pdf.section_title(f"Сектор: {sector.name}", size=16)
        _write_guide_block(pdf, sector, "Описание сектора")

        sector_routes = routes_by_sector.get(sid, [])
        if sector_routes:
            pdf.section_title("Трассы", size=13)
            for route in sector_routes:
                grade = _safe_pdf_text(route.grade)
                category = _safe_pdf_text(route.category)
                head = f"• {route.name} — {grade}"
                if category:
                    head += f" ({category})"
                pdf.body_text(head, size=10)
                if route.description:
                    pdf.body_text(route.description, size=9)
                extra = []
                if route.length_m:
                    extra.append(f"длина {route.length_m} м")
                if route.bolts:
                    extra.append(f"отметок {route.bolts}")
                if extra:
                    pdf.meta_line(", ".join(extra))
                photo = photos_by_climb.get(("route", int(route.id)))
                if photo:
                    cap = "Фото трассы"
                    if photo.markup:
                        cap += " (на фото есть схема линии)"
                    pdf.try_embed_image(photo.image_url, caption=cap)
                pdf.ln(1)

        sector_boulders = boulders_by_sector.get(sid, [])
        if sector_boulders:
            pdf.section_title("Боулдеры", size=13)
            for boulder in sector_boulders:
                grade = _safe_pdf_text(boulder.grade)
                category = _safe_pdf_text(boulder.category)
                head = f"• {boulder.name} — {grade}"
                if category:
                    head += f" ({category})"
                pdf.body_text(head, size=10)
                if boulder.description:
                    pdf.body_text(boulder.description, size=9)
                photo = photos_by_climb.get(("boulder", int(boulder.id)))
                if photo:
                    cap = "Фото боулдера"
                    if photo.markup:
                        cap += " (на фото есть схема)"
                    pdf.try_embed_image(photo.image_url, caption=cap)
                pdf.ln(1)

        if not sector_routes and not sector_boulders:
            pdf.meta_line("В секторе пока нет трасс и боулдеров в каталоге.")

    out = pdf.output()
    return bytes(out)


def area_pdf_filename(area: Area) -> str:
    name = _safe_pdf_text(area.name) or f"area-{area.id}"
    slug = re.sub(r"[^\w\s-]+", "", name, flags=re.UNICODE).strip().replace(" ", "-")
    slug = re.sub(r"-+", "-", slug)[:60] or f"area-{area.id}"
    return f"6a9a-guide-{slug}.pdf"
