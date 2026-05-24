#!/usr/bin/env python3
"""Проверка подключения к GuideBook PostgreSQL (локально или на Render)."""
from __future__ import annotations

import sys

from sqlalchemy import inspect, text

from app.config import settings
from app.db import engine


def main() -> int:
    url = engine.url
    print(f"driver: {url.drivername}")
    print(f"host: {url.host}")
    print(f"database: {url.database}")
    print(f"persistent: {url.drivername != 'sqlite'}")

    if url.drivername == "sqlite":
        print("\nОШИБКА: SQLite — на Render данные будут пропадать.", file=sys.stderr)
        return 1

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("\nconnection: OK")
    except Exception as exc:
        print(f"\nconnection: FAILED — {exc}", file=sys.stderr)
        return 1

    insp = inspect(engine)
    for name in insp.get_table_names():
        with engine.connect() as conn:
            count = conn.execute(text(f'SELECT COUNT(*) FROM "{name}"')).scalar()
        print(f"  {name}: {count}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
