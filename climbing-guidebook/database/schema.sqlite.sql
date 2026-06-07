-- Та же логика для SQLite (локальная разработка, тесты).
-- JSON хранится в TEXT; UUID — TEXT.

BEGIN;

CREATE TABLE users (
    id              TEXT PRIMARY KEY,
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    display_name    TEXT NOT NULL DEFAULT '',
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE areas (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    description     TEXT,
    latitude        REAL,
    longitude       REAL,
    created_by      TEXT REFERENCES users (id) ON DELETE SET NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at      TEXT
);

CREATE TABLE sectors (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    area_id         INTEGER NOT NULL REFERENCES areas (id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    created_by      TEXT REFERENCES users (id) ON DELETE SET NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at      TEXT
);

CREATE INDEX idx_sectors_area ON sectors (area_id);

CREATE TABLE routes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    sector_id       INTEGER NOT NULL REFERENCES sectors (id) ON DELETE RESTRICT,
    area_id         INTEGER NOT NULL REFERENCES areas (id) ON DELETE RESTRICT,
    created_by      TEXT REFERENCES users (id) ON DELETE SET NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    grade           TEXT NOT NULL,
    length_m        REAL,
    bolts           INTEGER,
    sector_label    TEXT,
    latitude        REAL,
    longitude       REAL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at      TEXT
);

CREATE INDEX idx_routes_sector ON routes (sector_id);
CREATE INDEX idx_routes_area ON routes (area_id);

CREATE TABLE boulders (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    sector_id       INTEGER NOT NULL REFERENCES sectors (id) ON DELETE RESTRICT,
    area_id         INTEGER NOT NULL REFERENCES areas (id) ON DELETE RESTRICT,
    created_by      TEXT REFERENCES users (id) ON DELETE SET NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    grade           TEXT NOT NULL,
    height_m        REAL,
    latitude        REAL,
    longitude       REAL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at      TEXT
);

CREATE INDEX idx_boulders_sector ON boulders (sector_id);

CREATE TABLE photos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    climb_type      TEXT NOT NULL CHECK (climb_type IN ('route', 'boulder')),
    route_id        INTEGER REFERENCES routes (id) ON DELETE CASCADE,
    boulder_id      INTEGER REFERENCES boulders (id) ON DELETE CASCADE,
    uploaded_by     TEXT REFERENCES users (id) ON DELETE SET NULL,
    image_url       TEXT NOT NULL,
    description     TEXT,
    file_name       TEXT,
    mime_type       TEXT,
    file_size_bytes INTEGER,
    markup          TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (
        (climb_type = 'route' AND route_id IS NOT NULL AND boulder_id IS NULL)
        OR (climb_type = 'boulder' AND boulder_id IS NOT NULL AND route_id IS NULL)
    )
);

CREATE INDEX idx_photos_route ON photos (route_id);
CREATE INDEX idx_photos_boulder ON photos (boulder_id);

CREATE TABLE comments (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    climb_type      TEXT NOT NULL CHECK (climb_type IN ('route', 'boulder')),
    route_id        INTEGER REFERENCES routes (id) ON DELETE CASCADE,
    boulder_id      INTEGER REFERENCES boulders (id) ON DELETE CASCADE,
    parent_id       INTEGER REFERENCES comments (id) ON DELETE CASCADE,
    body            TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at      TEXT,
    CHECK (
        (climb_type = 'route' AND route_id IS NOT NULL AND boulder_id IS NULL)
        OR (climb_type = 'boulder' AND boulder_id IS NOT NULL AND route_id IS NULL)
    )
);

CREATE INDEX idx_comments_route ON comments (route_id);
CREATE INDEX idx_comments_boulder ON comments (boulder_id);

COMMIT;
