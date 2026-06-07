-- Скалолазный гайдбук: пользователи, районы/секторы, трассы, боулдеры, фото с разметкой, комментарии.
-- PostgreSQL 14+ (JSONB для линии трассы и зацепок боулдера).
--
-- Соответствие полей фронту (14.html / climbingApp_data):
--   routes.sector_label  ↔ route.sector (подпись на стене)
--   routes.length_m      ↔ route.length
--   boulders.height_m     ↔ boulder.height
--   photos.markup        ↔ photo.markup:
--       трасса: { "points": [ { "x","y","nx","ny", ... } ] } — нормализованные координаты;
--       боулдер: { "type": "boulder-holds", "holds": [ { "x","y", ... } ] }
--   Файл картинки: лучше загрузить в объектное хранилище и сохранить image_url;
--   поле image_data (base64) в БД не рекомендуется для продакшена.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Пользователи
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    display_name    VARCHAR(120) NOT NULL DEFAULT '',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users (email);

-- ---------------------------------------------------------------------------
-- Каталог: район → сектор (как во фронте 14.html)
-- ---------------------------------------------------------------------------
CREATE TABLE areas (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    created_by      UUID REFERENCES users (id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE TABLE sectors (
    id              BIGSERIAL PRIMARY KEY,
    area_id         BIGINT NOT NULL REFERENCES areas (id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    created_by      UUID REFERENCES users (id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_sectors_area ON sectors (area_id);

-- ---------------------------------------------------------------------------
-- Трассы (диалог создания / редактирования / удаления)
-- ---------------------------------------------------------------------------
CREATE TABLE routes (
    id              BIGSERIAL PRIMARY KEY,
    sector_id       BIGINT NOT NULL REFERENCES sectors (id) ON DELETE RESTRICT,
    area_id         BIGINT NOT NULL REFERENCES areas (id) ON DELETE RESTRICT,
    created_by      UUID REFERENCES users (id) ON DELETE SET NULL,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    grade           VARCHAR(32) NOT NULL,
    length_m        DOUBLE PRECISION,
    bolts           INTEGER,
    sector_label    VARCHAR(255),
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_routes_sector ON routes (sector_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_routes_area ON routes (area_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_routes_grade ON routes (grade) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Боулдеры
-- ---------------------------------------------------------------------------
CREATE TABLE boulders (
    id              BIGSERIAL PRIMARY KEY,
    sector_id       BIGINT NOT NULL REFERENCES sectors (id) ON DELETE RESTRICT,
    area_id         BIGINT NOT NULL REFERENCES areas (id) ON DELETE RESTRICT,
    created_by      UUID REFERENCES users (id) ON DELETE SET NULL,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    grade           VARCHAR(32) NOT NULL,
    height_m        DOUBLE PRECISION,
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_boulders_sector ON boulders (sector_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_boulders_area ON boulders (area_id) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Фото, привязанные к трассе или боулдеру
-- image_url — предпочтительно ссылка на объект в хранилище (S3, MinIO);
-- при необходимости можно добавить отдельную таблицу файлов.
-- ---------------------------------------------------------------------------
CREATE TABLE photos (
    id              BIGSERIAL PRIMARY KEY,
    climb_type      VARCHAR(16) NOT NULL CHECK (climb_type IN ('route', 'boulder')),
    route_id        BIGINT REFERENCES routes (id) ON DELETE CASCADE,
    boulder_id      BIGINT REFERENCES boulders (id) ON DELETE CASCADE,
    uploaded_by     UUID REFERENCES users (id) ON DELETE SET NULL,
    image_url       TEXT NOT NULL,
    description     TEXT,
    file_name       VARCHAR(255),
    mime_type       VARCHAR(128),
    file_size_bytes BIGINT,
    -- Разметка с фронта: трасса { "points": [ { "x","y","nx","ny" } ], "type": "route-line" };
    -- боулдер { "type": "boulder-holds", "holds": [ { "x","y", ... } ] }
    markup          JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT photos_one_climb CHECK (
        (climb_type = 'route' AND route_id IS NOT NULL AND boulder_id IS NULL)
        OR (climb_type = 'boulder' AND boulder_id IS NOT NULL AND route_id IS NULL)
    )
);

CREATE INDEX idx_photos_route ON photos (route_id) WHERE climb_type = 'route';
CREATE INDEX idx_photos_boulder ON photos (boulder_id) WHERE climb_type = 'boulder';
CREATE INDEX idx_photos_markup ON photos USING gin (markup) WHERE markup IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Комментарии под трассами и боулдерингами
-- ---------------------------------------------------------------------------
CREATE TABLE comments (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    climb_type      VARCHAR(16) NOT NULL CHECK (climb_type IN ('route', 'boulder')),
    route_id        BIGINT REFERENCES routes (id) ON DELETE CASCADE,
    boulder_id      BIGINT REFERENCES boulders (id) ON DELETE CASCADE,
    parent_id       BIGINT REFERENCES comments (id) ON DELETE CASCADE,
    body            TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT comments_one_climb CHECK (
        (climb_type = 'route' AND route_id IS NOT NULL AND boulder_id IS NULL)
        OR (climb_type = 'boulder' AND boulder_id IS NOT NULL AND route_id IS NULL)
    )
);

CREATE INDEX idx_comments_route ON comments (route_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_comments_boulder ON comments (boulder_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_comments_parent ON comments (parent_id) WHERE parent_id IS NOT NULL;

COMMIT;
