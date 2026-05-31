#!/usr/bin/env python3
"""
Настройка постоянной БД (PostgreSQL / Supabase) для Telegram Mini App.

Использование:
  1. Создайте проект Supabase → Database → Connection string (URI, Transaction, port 6543).
  2. Скопируйте backend/.env.supabase.example → backend/.env и вставьте DATABASE_URL.
  3. Запустите:
       cd backend && python setup_persistent_db.py
     С миграцией из локального SQLite:
       python setup_persistent_db.py --migrate-sqlite
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse

_BACKEND = Path(__file__).resolve().parent


def _load_dotenv() -> None:
    env_path = _BACKEND / ".env"
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def _print_header(title: str) -> None:
    print(f"\n=== {title} ===")


def main() -> int:
    parser = argparse.ArgumentParser(description="Настройка PostgreSQL для climbing guidebook")
    parser.add_argument(
        "--migrate-sqlite",
        action="store_true",
        help="Перенести данные из backend/climbing.db в PostgreSQL",
    )
    parser.add_argument(
        "--sqlite-path",
        default=str(_BACKEND / "climbing.db"),
        help="Путь к файлу SQLite (по умолчанию backend/climbing.db)",
    )
    args = parser.parse_args()

    _load_dotenv()

    from app.config import settings
    from app.db import engine
    from sqlalchemy import text

    url = settings.database_url
    parsed = urlparse(url)

    _print_header("Проверка DATABASE_URL")
    print(f"Драйвер: {engine.url.drivername}")
    print(f"Хост: {parsed.hostname or '(локальный файл)'}")
    print(f"База: {parsed.path.lstrip('/') or engine.url.database}")

    if url.startswith("sqlite"):
        print(
            "\nОШИБКА: сейчас используется SQLite. На Render / в Telegram Mini App данные будут "
            "пропадать после рестарта.\n\n"
            "Сделайте:\n"
            "  1. Supabase → Project Settings → Database → Connection string (URI, Transaction)\n"
            "  2. cp .env.supabase.example .env\n"
            "  3. В .env задайте DATABASE_URL=postgresql://postgres.<ref>:<password>@....:6543/postgres\n"
            "  4. APP_ENV=production\n"
            "  5. Повторите: python setup_persistent_db.py\n",
            file=sys.stderr,
        )
        return 1

    _print_header("Подключение")
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("PostgreSQL: подключение OK")
    except Exception as exc:
        print(f"Не удалось подключиться: {exc}", file=sys.stderr)
        return 1

    _print_header("Схема и администратор")
    subprocess.run([sys.executable, str(_BACKEND / "bootstrap_database.py")], check=True, cwd=_BACKEND)

    if args.migrate_sqlite:
        sqlite_file = Path(args.sqlite_path)
        if not sqlite_file.is_file():
            print(f"SQLite не найден: {sqlite_file}, миграция пропущена")
        else:
            _print_header("Миграция SQLite → PostgreSQL")
            env = os.environ.copy()
            env["SQLITE_URL"] = f"sqlite:///{sqlite_file.resolve()}"
            env["POSTGRES_URL"] = url
            subprocess.run(
                [sys.executable, str(_BACKEND / "migrate_sqlite_to_postgres.py")],
                check=True,
                cwd=_BACKEND,
                env=env,
            )

    _print_header("Готово")
    print(
        "Таблицы созданы в PostgreSQL. Для Render задайте те же переменные в Environment:\n"
        "  DATABASE_URL, APP_ENV=production, JWT_SECRET, TELEGRAM_BOT_TOKEN\n"
        "Start Command:\n"
        "  python bootstrap_database.py && uvicorn app.main:app --host 0.0.0.0 --port $PORT\n"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
