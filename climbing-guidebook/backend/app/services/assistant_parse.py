from __future__ import annotations

import json
import re
from typing import Any, Optional

import httpx

from app.config import settings
from app.schemas import AssistantDraft, AssistantKind, AssistantSearchQuery

_GRADE_RE = re.compile(
    r"\b(?:[4-9][abcABC](?:\+)?(?:/[abcABC]\+?)?|V(?:1[0-7]|[0-9])|[5-9][abcABC]?[+-]?)\b"
)
_COORD_RE = re.compile(
    r"(-?\d{1,2}\.\d{3,})\s*[,;\s]\s*(-?\d{1,3}\.\d{3,})"
)

_SYSTEM = (
    "Ты помощник скального гайдбука. По тексту пользователя и при наличии фото "
    "верни ТОЛЬКО JSON без markdown:\n"
    "{"
    '"kind":"area|sector|route|boulder",'
    '"name":"",'
    '"description":"",'
    '"grade":null,'
    '"area_name":null,'
    '"sector_name":null,'
    '"latitude":null,'
    '"longitude":null'
    "}\n"
    "kind — что нужно СОЗДАТЬ. Если на фото стена/зацепы и не сказано иное — boulder. "
    "grade только для route/boulder. description — текст для карточки, не инструкция."
)


_SEARCH_SYSTEM = (
    "Ты помощник скального гайдбука. По тексту и/или фото определи, что ищет пользователь, "
    "и верни ТОЛЬКО JSON без markdown:\n"
    '{"query":"","kind_hint":null}\n'
    "query — короткая строка для поиска: название трассы/болдера/сектора/района или место для маршрута. "
    "kind_hint — route|boulder|sector|area или null. Не предлагай создавать новые объекты."
)


def extract_assistant_search_query(
    prompt: str,
    image_bytes: bytes | None = None,
    mime_type: str = "image/jpeg",
) -> AssistantSearchQuery:
    text = (prompt or "").strip()
    if settings.assistant_api_key.strip() and image_bytes:
        try:
            result = _search_query_with_llm(text, image_bytes, mime_type)
            if result.query or result.kind_hint:
                return result
        except Exception:
            pass
    if text:
        kind = _kind_from_text(text)
        return AssistantSearchQuery(
            query=text,
            kind_hint=kind,
            source="text",
            note=None if settings.assistant_api_key.strip() else "Поиск по фото на сервере без ASSISTANT_API_KEY недоступен — используйте текст.",
        )
    return AssistantSearchQuery(
        query="",
        source="heuristic",
        note="Добавьте текстовый запрос или настройте ASSISTANT_API_KEY для поиска по фото.",
    )


def _kind_from_text(text: str) -> Optional[AssistantKind]:
    lower = text.lower()
    if re.search(r"\b(?:боулдер|болдер)", lower):
        return "boulder"
    if re.search(r"\bтрасс", lower):
        return "route"
    if re.search(r"\bсектор", lower):
        return "sector"
    if re.search(r"\bрайон", lower):
        return "area"
    return None


def _search_query_with_llm(text: str, image_bytes: bytes | None, mime_type: str) -> AssistantSearchQuery:
    import base64

    user_content: list[dict[str, Any]] = []
    if text:
        user_content.append({"type": "text", "text": text})
    if image_bytes:
        b64 = base64.b64encode(image_bytes[: 4 * 1024 * 1024]).decode("ascii")
        safe_mime = mime_type if mime_type.startswith("image/") else "image/jpeg"
        user_content.append(
            {
                "type": "image_url",
                "image_url": {"url": f"data:{safe_mime};base64,{b64}"},
            }
        )
    if not user_content:
        user_content.append({"type": "text", "text": "Что искать на фото?"})

    payload = {
        "model": settings.assistant_model or "gpt-4o-mini",
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": _SEARCH_SYSTEM},
            {"role": "user", "content": user_content},
        ],
    }
    headers = {
        "Authorization": f"Bearer {settings.assistant_api_key.strip()}",
        "Content-Type": "application/json",
    }
    base = settings.assistant_api_base.rstrip("/")
    with httpx.Client(timeout=45.0) as client:
        resp = client.post(f"{base}/chat/completions", headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
    content = (
        ((data.get("choices") or [{}])[0].get("message") or {}).get("content") or "{}"
    )
    parsed = json.loads(content)
    query = str(parsed.get("query") or text or "").strip()
    kind_raw = str(parsed.get("kind_hint") or "").strip().lower()
    kind = kind_raw if kind_raw in {"area", "sector", "route", "boulder"} else _kind_from_text(query)
    return AssistantSearchQuery(
        query=query,
        kind_hint=kind,
        source="llm",
        note="Запрос разобран по фото. Проверьте результаты.",
    )


def parse_assistant_request(prompt: str, image_bytes: bytes | None = None, mime_type: str = "image/jpeg") -> AssistantDraft:
    text = (prompt or "").strip()
    if settings.assistant_api_key.strip():
        try:
            draft = _parse_with_llm(text, image_bytes, mime_type)
            if draft.name or draft.description or draft.kind:
                return draft
        except Exception:
            pass
    return _parse_heuristic(text)


def _parse_heuristic(text: str) -> AssistantDraft:
    raw = text or ""
    lower = raw.lower()
    kind: AssistantKind = "boulder"
    if re.search(r"\bрайон\b", lower):
        kind = "area"
    elif re.search(r"\bсектор\b", lower):
        kind = "sector"
    elif re.search(r"\bтрасс", lower):
        kind = "route"
    elif re.search(r"\bболдер|\bбоулдер", lower):
        kind = "boulder"

    grade_m = _GRADE_RE.search(raw)
    grade = grade_m.group(0) if grade_m else None
    coord_m = _COORD_RE.search(raw)
    lat = float(coord_m.group(1)) if coord_m else None
    lng = float(coord_m.group(2)) if coord_m else None

    area_name = _after_keyword(raw, r"в районе")
    sector_name = _after_keyword(raw, r"в секторе")
    name = _extract_name(raw, kind) or ""

    note = None
    if not settings.assistant_api_key.strip():
        note = "Локальный разбор без ИИ. Проверьте поля в форме. Чтобы включить зрение, задайте ASSISTANT_API_KEY."

    return AssistantDraft(
        kind=kind,
        name=name,
        description=raw,
        grade=grade,
        area_name=area_name,
        sector_name=sector_name,
        latitude=lat,
        longitude=lng,
        source="heuristic",
        note=note,
    )


def _after_keyword(text: str, keyword: str) -> Optional[str]:
    m = re.search(keyword + r"\s+([«\"]?)(.+?)\1(?=\s|$|[.,;])", text, flags=re.IGNORECASE)
    if not m:
        return None
    return m.group(2).strip(" .,—-") or None


def _extract_name(text: str, kind: AssistantKind) -> str:
    labels = {
        "area": r"район",
        "sector": r"сектор",
        "route": r"трасс[ауиы]?",
        "boulder": r"(?:болдер|боулдер)(?:инг)?",
    }
    m = re.search(
        rf"(?:добав(?:ь|ить)|создай(?:те)?|новый|новая)\s+{labels[kind]}\s+(.+?)(?:\s+(?:в\s+|категори|grade|6|7|8|9)|$)",
        text,
        flags=re.IGNORECASE,
    )
    if m:
        return m.group(1).strip(" .,—-«»\"'")
    quoted = re.search(r"[«\"](.+?)[»\"]", text)
    if quoted:
        return quoted.group(1).strip()
    return ""


def _parse_with_llm(text: str, image_bytes: bytes | None, mime_type: str) -> AssistantDraft:
    import base64

    user_content: list[dict[str, Any]] = [
        {"type": "text", "text": text or "Определи, что создать по фото."}
    ]
    if image_bytes:
        b64 = base64.b64encode(image_bytes[: 4 * 1024 * 1024]).decode("ascii")
        safe_mime = mime_type if mime_type.startswith("image/") else "image/jpeg"
        user_content.append(
            {
                "type": "image_url",
                "image_url": {"url": f"data:{safe_mime};base64,{b64}"},
            }
        )

    payload = {
        "model": settings.assistant_model or "gpt-4o-mini",
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": user_content},
        ],
    }
    headers = {
        "Authorization": f"Bearer {settings.assistant_api_key.strip()}",
        "Content-Type": "application/json",
    }
    base = settings.assistant_api_base.rstrip("/")
    with httpx.Client(timeout=45.0) as client:
        resp = client.post(f"{base}/chat/completions", headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
    content = (
        ((data.get("choices") or [{}])[0].get("message") or {}).get("content") or "{}"
    )
    parsed = json.loads(content)
    kind = str(parsed.get("kind") or "boulder").strip().lower()
    if kind not in {"area", "sector", "route", "boulder"}:
        kind = "boulder"
    return AssistantDraft(
        kind=kind,  # type: ignore[arg-type]
        name=str(parsed.get("name") or "").strip(),
        description=str(parsed.get("description") or text or "").strip(),
        grade=(str(parsed.get("grade")).strip() if parsed.get("grade") else None),
        area_name=(str(parsed.get("area_name")).strip() or None) if parsed.get("area_name") else None,
        sector_name=(str(parsed.get("sector_name")).strip() or None) if parsed.get("sector_name") else None,
        latitude=_as_float(parsed.get("latitude")),
        longitude=_as_float(parsed.get("longitude")),
        source="llm",
        note="Черновик от ИИ. Проверьте и поправьте в форме перед сохранением.",
    )


def _as_float(value: Any) -> Optional[float]:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None
