#!/usr/bin/env python3
from __future__ import annotations

from app.db import Base, SessionLocal, engine, ensure_optional_columns
from app.seed import bootstrap_catalog


def main() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_optional_columns()

    db = SessionLocal()
    try:
        bootstrap_catalog(db)
    finally:
        db.close()

    print("Database bootstrap completed successfully.")
    print(f"Connected database URL: {engine.url}")


if __name__ == "__main__":
    main()
