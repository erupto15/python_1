#!/usr/bin/env python3
"""
Ежедневная синхронизация PostgreSQL (Supabase) → локальная папка.

1. data/backups/current/  — зеркало «как в облаке сейчас» (полная перезапись:
   удалённые на сервере записи исчезают и локально).
2. data/backups/YYYY-MM-DD/ — снимок на этот день (история).
3. data/local_db/guidebook_mirror.db — локальная SQLite-копия (пересборка раз в сутки).

  cd backend && python backup_supabase_daily.py
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any
from uuid import UUID

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session

_BACKEND = Path(__file__).resolve().parent
DEFAULT_BACKUP_DIR = _BACKEND / "data" / "backups"
MIRROR_DIR_NAME = "current"
DEFAULT_SQLITE_MIRROR = _BACKEND / "data" / "local_db" / "guidebook_mirror.db"

TABLES = (
    "users",
    "areas",
    "sectors",
    "routes",
    "boulders",
    "photos",
    "comments",
)

TABLE_FILES = {f"{t}.json" for t in TABLES} | {"manifest.json", "sync_state.json"}


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


def _json_default(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    raise TypeError(f"Not JSON serializable: {type(value)!r}")


def _pg_dump_url(database_url: str) -> str:
    url = database_url.strip()
    if url.startswith("postgresql+psycopg2://"):
        return "postgresql://" + url[len("postgresql+psycopg2://") :]
    return url


def _export_table(session: Session, table: str) -> list[dict[str, Any]]:
    result = session.execute(text(f'SELECT * FROM "{table}"'))
    columns = list(result.keys())
    return [{columns[i]: row[i] for i in range(len(columns))} for row in result.fetchall()]


def _export_all_tables(session: Session, existing: set[str]) -> dict[str, list[dict[str, Any]]]:
    data: dict[str, list[dict[str, Any]]] = {}
    for table in TABLES:
        if table not in existing:
            print(f"Skip missing table: {table}")
            data[table] = []
            continue
        data[table] = _export_table(session, table)
        print(f"  {table}: {len(data[table])} rows")
    return data


def _row_ids(table: str, rows: list[dict[str, Any]]) -> set[str]:
    ids: set[str] = set()
    for row in rows:
        rid = row.get("id")
        if rid is not None:
            ids.add(str(rid))
    return ids


def _diff_table(
    table: str,
    prev_rows: list[dict[str, Any]] | None,
    curr_rows: list[dict[str, Any]],
) -> dict[str, Any]:
    prev_rows = prev_rows or []
    prev_ids = _row_ids(table, prev_rows)
    curr_ids = _row_ids(table, curr_rows)
    removed = sorted(prev_ids - curr_ids, key=lambda x: (len(x), x))
    added = sorted(curr_ids - prev_ids, key=lambda x: (len(x), x))
    return {
        "previous_count": len(prev_rows),
        "current_count": len(curr_rows),
        "added": len(added),
        "removed": len(removed),
        "added_ids_sample": added[:20],
        "removed_ids_sample": removed[:20],
    }


def _load_previous_tables(mirror_dir: Path) -> dict[str, list[dict[str, Any]]]:
    prev: dict[str, list[dict[str, Any]]] = {}
    if not mirror_dir.is_dir():
        return prev
    for table in TABLES:
        path = mirror_dir / f"{table}.json"
        if not path.is_file():
            continue
        try:
            prev[table] = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            prev[table] = []
    return prev


def _clear_mirror_data_files(target: Path) -> None:
    if not target.is_dir():
        target.mkdir(parents=True, exist_ok=True)
        return
    for child in target.iterdir():
        if not child.is_file():
            continue
        if child.name in TABLE_FILES or child.suffix == ".json" or child.name == "full_dump.sql":
            child.unlink()


def _write_mirror_files(
    target: Path,
    tables_data: dict[str, list[dict[str, Any]]],
    manifest: dict[str, Any],
    sync_state: dict[str, Any],
) -> None:
    _clear_mirror_data_files(target)
    target.mkdir(parents=True, exist_ok=True)

    for table in TABLES:
        rows = tables_data.get(table, [])
        path = target / f"{table}.json"
        path.write_text(
            json.dumps(rows, ensure_ascii=False, indent=2, default=_json_default),
            encoding="utf-8",
        )

    (target / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (target / "sync_state.json").write_text(
        json.dumps(sync_state, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _run_pg_dump(database_url: str, sql_path: Path) -> bool:
    pg_dump = shutil.which("pg_dump")
    if not pg_dump:
        return False
    cmd = [
        pg_dump,
        "--no-owner",
        "--no-privileges",
        "--format=plain",
        "--file",
        str(sql_path),
        _pg_dump_url(database_url),
    ]
    try:
        subprocess.run(cmd, check=True, env=os.environ.copy(), capture_output=True, text=True)
        return True
    except subprocess.CalledProcessError as exc:
        err = (exc.stderr or exc.stdout or str(exc)).strip()
        print(f"pg_dump skipped: {err}", file=sys.stderr)
        return False


def _copy_mirror_to_snapshot(mirror_dir: Path, snapshot_dir: Path) -> None:
    if snapshot_dir.exists():
        shutil.rmtree(snapshot_dir)
    shutil.copytree(
        mirror_dir,
        snapshot_dir,
        ignore=shutil.ignore_patterns("*.tmp"),
    )


def _prune_old_snapshots(backup_root: Path, keep_days: int) -> None:
    if keep_days < 1:
        return
    cutoff = datetime.now(timezone.utc).date() - timedelta(days=keep_days)
    for child in backup_root.iterdir():
        if not child.is_dir() or child.name in (MIRROR_DIR_NAME, "logs"):
            continue
        name = child.name
        if len(name) != 10 or name[4] != "-" or name[7] != "-":
            continue
        try:
            folder_date = date.fromisoformat(name)
        except ValueError:
            continue
        if folder_date < cutoff:
            shutil.rmtree(child, ignore_errors=True)
            print(f"Removed old snapshot: {child}")


def _rebuild_sqlite_mirror(tables_data: dict[str, list[dict[str, Any]]], db_path: Path) -> None:
    from app.db import Base  # noqa: WPS433
    from app.models import Area, Boulder, Comment, Photo, Route, Sector, User  # noqa: WPS433

    model_by_table = {
        "users": User,
        "areas": Area,
        "sectors": Sector,
        "routes": Route,
        "boulders": Boulder,
        "photos": Photo,
        "comments": Comment,
    }

    db_path.parent.mkdir(parents=True, exist_ok=True)
    if db_path.exists():
        db_path.unlink()

    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        for table in TABLES:
            model = model_by_table[table]
            columns = {c.key for c in inspect(model).columns}
            for row in tables_data.get(table, []):
                payload = {k: v for k, v in row.items() if k in columns}
                session.add(model(**payload))
            session.commit()
    engine.dispose()
    print(f"  SQLite mirror → {db_path}")


def run_backup(
    *,
    backup_dir: Path,
    keep_days: int,
    skip_pg_dump: bool,
    skip_sqlite: bool,
    sqlite_path: Path,
) -> Path:
    _load_dotenv()
    sys.path.insert(0, str(_BACKEND))

    from app.config import settings  # noqa: WPS433
    from app.db import engine as pg_engine  # noqa: WPS433

    if settings.database_url.startswith("sqlite"):
        raise SystemExit(
            "Синхронизация настроена для PostgreSQL (Supabase). "
            "В .env укажите DATABASE_URL или POSTGRES_*."
        )

    mirror_dir = backup_dir / MIRROR_DIR_NAME
    previous_tables = _load_previous_tables(mirror_dir)

    inspector = inspect(pg_engine)
    existing = set(inspector.get_table_names())

    print("Fetching from remote database…")
    with Session(pg_engine) as session:
        tables_data = _export_all_tables(session, existing)

    now = datetime.now(timezone.utc)
    changes: dict[str, Any] = {}
    for table in TABLES:
        changes[table] = _diff_table(table, previous_tables.get(table), tables_data.get(table, []))
        ch = changes[table]
        if ch["added"] or ch["removed"]:
            print(
                f"  Δ {table}: +{ch['added']} / -{ch['removed']} "
                f"(было {ch['previous_count']}, стало {ch['current_count']})"
            )

    manifest: dict[str, Any] = {
        "exported_at": now.isoformat(),
        "database_dialect": pg_engine.dialect.name,
        "database_host_hint": settings.database_url.split("@")[-1]
        if "@" in settings.database_url
        else pg_engine.dialect.name,
        "tables": {t: len(tables_data.get(t, [])) for t in TABLES},
        "mode": "full_replace_mirror",
    }

    sync_state: dict[str, Any] = {
        "synced_at": now.isoformat(),
        "changes_since_last_sync": changes,
        "note": "Папка current/ всегда совпадает с облаком; удаления на сервере убирают строки локально.",
    }

    print(f"Updating mirror: {mirror_dir}")
    _write_mirror_files(mirror_dir, tables_data, manifest, sync_state)

    if not skip_pg_dump:
        sql_path = mirror_dir / "full_dump.sql"
        if _run_pg_dump(settings.database_url, sql_path):
            print("  pg_dump → current/full_dump.sql")
        else:
            if sql_path.is_file():
                sql_path.unlink()

    if not skip_sqlite:
        print("Rebuilding local SQLite mirror…")
        _rebuild_sqlite_mirror(tables_data, sqlite_path)

    day = now.strftime("%Y-%m-%d")
    snapshot_dir = backup_dir / day
    print(f"Daily snapshot: {snapshot_dir}")
    _copy_mirror_to_snapshot(mirror_dir, snapshot_dir)

    latest = backup_dir / "latest"
    try:
        if latest.is_symlink() or latest.exists():
            latest.unlink()
        latest.symlink_to(MIRROR_DIR_NAME, target_is_directory=True)
    except OSError:
        try:
            if latest.is_symlink() or latest.exists():
                latest.unlink()
            latest.symlink_to(day, target_is_directory=True)
        except OSError:
            pass

    _prune_old_snapshots(backup_dir, keep_days)
    print("Sync complete.")
    return mirror_dir


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Daily sync Supabase/PostgreSQL → local mirror + snapshots"
    )
    parser.add_argument(
        "--dir",
        type=Path,
        default=Path(os.environ.get("BACKUP_DIR", DEFAULT_BACKUP_DIR)),
        help=f"Backup root (default: {DEFAULT_BACKUP_DIR})",
    )
    parser.add_argument(
        "--sqlite",
        type=Path,
        default=Path(os.environ.get("SQLITE_MIRROR_PATH", DEFAULT_SQLITE_MIRROR)),
        help=f"Local SQLite mirror path (default: {DEFAULT_SQLITE_MIRROR})",
    )
    parser.add_argument(
        "--keep-days",
        type=int,
        default=int(os.environ.get("BACKUP_KEEP_DAYS", "30")),
        help="Keep dated snapshots for N days",
    )
    parser.add_argument("--skip-pg-dump", action="store_true", help="Skip pg_dump SQL file")
    parser.add_argument("--skip-sqlite", action="store_true", help="Skip SQLite mirror rebuild")
    args = parser.parse_args()
    run_backup(
        backup_dir=args.dir.resolve(),
        keep_days=args.keep_days,
        skip_pg_dump=args.skip_pg_dump,
        skip_sqlite=args.skip_sqlite,
        sqlite_path=args.sqlite.resolve(),
    )


if __name__ == "__main__":
    main()
