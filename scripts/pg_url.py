#!/usr/bin/env python3
"""Parse SQLAlchemy / libpq database URLs. Stdlib only. Never prints passwords unless asked."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from urllib.parse import parse_qs, quote_plus, unquote, urlparse


LOCAL_HOSTS = {"127.0.0.1", "localhost", "::1"}


def normalize_scheme(url: str) -> str:
    url = (url or "").strip()
    if url.startswith("postgresql+psycopg2://"):
        return "postgresql://" + url[len("postgresql+psycopg2://") :]
    if url.startswith("postgres://"):
        return "postgresql://" + url[len("postgres://") :]
    return url


def parse_db_url(url: str) -> dict[str, str | int | None]:
    raw = (url or "").strip()
    if not raw:
        raise SystemExit("DATABASE_URL is empty")
    libpq = normalize_scheme(raw)
    parsed = urlparse(libpq)
    if parsed.scheme not in {"postgresql", "postgres"}:
        raise SystemExit(f"not a PostgreSQL URL (scheme={parsed.scheme!r})")
    query = parse_qs(parsed.query)
    sslmode = (query.get("sslmode") or [""])[0]
    dbname = unquote((parsed.path or "").lstrip("/"))
    if not dbname:
        raise SystemExit("DATABASE_URL has no database name")
    user = unquote(parsed.username or "")
    password = unquote(parsed.password or "")
    host = parsed.hostname or ""
    port = parsed.port or 5432
    return {
        "user": user,
        "password": password,
        "host": host,
        "port": int(port),
        "dbname": dbname,
        "sslmode": sslmode,
        "local": host.lower() in LOCAL_HOSTS,
    }


def libpq_url(parts: dict[str, str | int | None], *, sslmode: str | None = None) -> str:
    user = quote_plus(str(parts["user"]))
    password = quote_plus(str(parts["password"]))
    host = str(parts["host"])
    port = int(parts["port"] or 5432)
    dbname = quote_plus(str(parts["dbname"]), safe="")
    mode = sslmode if sslmode is not None else str(parts.get("sslmode") or "")
    url = f"postgresql://{user}:{password}@{host}:{port}/{dbname}"
    if mode:
        url += f"?sslmode={quote_plus(mode)}"
    return url


def sqlalchemy_url(parts: dict[str, str | int | None], *, sslmode: str | None = None) -> str:
    return libpq_url(parts, sslmode=sslmode).replace("postgresql://", "postgresql+psycopg2://", 1)


def env_line(key: str, value: str) -> str:
    if value == "":
        return f"{key}=\n"
    if any(ch in value for ch in ' \t#"\n\r\\$`()'):
        escaped = value.replace("\\", "\\\\").replace('"', '\\"')
        return f'{key}="{escaped}"\n'
    return f"{key}={value}\n"


def overlay_backend_env(env_path: str, database_url: str) -> None:
    from pathlib import Path

    path = Path(env_path)
    lines = path.read_text(encoding="utf-8").splitlines(keepends=True) if path.exists() else []
    found = False
    out: list[str] = []
    for line in lines:
        if line.startswith("DATABASE_URL="):
            out.append(env_line("DATABASE_URL", database_url))
            found = True
        else:
            out.append(line if line.endswith("\n") else line + "\n")
    if not found:
        out.append(env_line("DATABASE_URL", database_url))
    path.write_text("".join(out), encoding="utf-8")
    path.chmod(0o600)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "action",
        choices=("is-local", "libpq", "json", "sqlalchemy", "overlay"),
    )
    parser.add_argument("--url", default="", help="Override DATABASE_URL")
    parser.add_argument("--url-file", default="", help="Read DATABASE_URL from a file")
    parser.add_argument("--sslmode", default=None)
    parser.add_argument("--env-file", default="/etc/guide-rus/backend.env")
    args = parser.parse_args()
    url = (args.url or os.environ.get("DATABASE_URL") or "").strip()
    if args.url_file:
        url = Path(args.url_file).read_text(encoding="utf-8").strip()
    if args.action == "overlay":
        if not url:
            raise SystemExit("DATABASE_URL is required for overlay")
        overlay_backend_env(args.env_file, url)
        return
    parts = parse_db_url(url)
    if args.action == "is-local":
        sys.exit(0 if parts["local"] else 1)
    if args.action == "json":
        safe = dict(parts)
        safe["password"] = "***" if parts["password"] else ""
        json.dump(safe, sys.stdout)
        sys.stdout.write("\n")
        return
    if args.action == "libpq":
        sys.stdout.write(libpq_url(parts, sslmode=args.sslmode))
        sys.stdout.write("\n")
        return
    if args.action == "sqlalchemy":
        sys.stdout.write(sqlalchemy_url(parts, sslmode=args.sslmode))
        sys.stdout.write("\n")
        return


if __name__ == "__main__":
    main()
