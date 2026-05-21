#!/usr/bin/env python3
from __future__ import annotations

import json
import os
from pathlib import Path
from urllib.parse import urlparse

from sqlalchemy import MetaData, create_engine, delete, select, text

TABLE_ORDER = ["users", "areas", "sectors", "routes", "boulders", "photos", "comments"]
TABLES_WITH_INT_IDS = ["areas", "sectors", "routes", "boulders", "photos", "comments"]


def normalize_database_url(value: str) -> str:
    s = value.strip()
    if s.startswith("postgres://"):
        return "postgresql+psycopg2://" + s[len("postgres://") :]
    if s.startswith("postgresql://") and not s.startswith("postgresql+"):
        return "postgresql+psycopg2://" + s[len("postgresql://") :]
    return s


def sqlite_url_to_path(sqlite_url: str) -> Path:
    if not sqlite_url.startswith("sqlite:///"):
        raise ValueError("SQLITE_URL должен начинаться с sqlite:///")
    raw_path = sqlite_url[len("sqlite:///") :]
    if not raw_path:
        raise ValueError("SQLITE_URL не содержит путь к файлу базы данных")
    path = Path(raw_path)
    if not path.is_absolute():
        path = (Path.cwd() / path).resolve()
    return path


def _normalize_photo_markup(rows: list[dict]) -> None:
    for row in rows:
        value = row.get("markup")
        if isinstance(value, str):
            try:
                row["markup"] = json.loads(value)
            except Exception:
                # Оставляем как есть, если это не JSON-строка.
                pass


def main() -> None:
    sqlite_url = os.getenv("SQLITE_URL", "sqlite:///./climbing.db")
    postgres_url_raw = os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL", "")
    postgres_url = normalize_database_url(postgres_url_raw)

    if not postgres_url:
        raise SystemExit("POSTGRES_URL/DATABASE_URL не задан. Укажите PostgreSQL URL в окружении.")
    if postgres_url.startswith("sqlite"):
        raise SystemExit("POSTGRES_URL/DATABASE_URL указывает на SQLite. Нужен именно PostgreSQL URL.")

    sqlite_path = sqlite_url_to_path(sqlite_url)
    if not sqlite_path.exists():
        raise SystemExit(f"SQLite-файл не найден: {sqlite_path}")

    source_engine = create_engine(sqlite_url)
    target_engine = create_engine(postgres_url)

    source_md = MetaData()
    source_md.reflect(bind=source_engine, only=TABLE_ORDER)

    target_md = MetaData()
    target_md.reflect(bind=target_engine, only=TABLE_ORDER)

    missing_in_source = [t for t in TABLE_ORDER if t not in source_md.tables]
    missing_in_target = [t for t in TABLE_ORDER if t not in target_md.tables]
    if missing_in_source:
        raise SystemExit(f"В SQLite отсутствуют таблицы: {', '.join(missing_in_source)}")
    if missing_in_target:
        raise SystemExit(
            "В PostgreSQL отсутствуют таблицы. Сначала запустите API, чтобы создать схему, "
            f"затем повторите миграцию. Нет таблиц: {', '.join(missing_in_target)}"
        )

    with source_engine.connect() as src_conn, target_engine.begin() as dst_conn:
        for table_name in reversed(TABLE_ORDER):
            dst_conn.execute(delete(target_md.tables[table_name]))

        copied_counts: dict[str, int] = {}
        for table_name in TABLE_ORDER:
            src_table = source_md.tables[table_name]
            dst_table = target_md.tables[table_name]
            rows = [dict(row) for row in src_conn.execute(select(src_table)).mappings().all()]
            if table_name == "photos":
                _normalize_photo_markup(rows)
            if rows:
                dst_conn.execute(dst_table.insert(), rows)
            copied_counts[table_name] = len(rows)

        for table_name in TABLES_WITH_INT_IDS:
            dst_conn.execute(
                text(
                    f"""
                    SELECT setval(
                        pg_get_serial_sequence('{table_name}', 'id'),
                        COALESCE((SELECT MAX(id) FROM {table_name}), 1),
                        (SELECT COUNT(*) > 0 FROM {table_name})
                    )
                    """
                )
            )

    print(f"SQLite source: {sqlite_path}")
    parsed = urlparse(postgres_url)
    print(f"PostgreSQL target: {parsed.hostname}:{parsed.port}/{(parsed.path or '/').lstrip('/')}")
    for name in TABLE_ORDER:
        print(f"- {name}: {copied_counts[name]}")
    print("Готово: данные перенесены из SQLite в PostgreSQL.")


if __name__ == "__main__":
    main()
