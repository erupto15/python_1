# Climbing Guidebook

Учебный проект со справочником скалолазных районов, секторов, трасс и боулдеров.

## Что внутри

- `climbing-guidebook/14.html` — основной фронтенд интерфейс.
- `climbing-guidebook/backend/` — API (FastAPI) и модели данных.
- `climbing.db` — локальная SQLite база.

## Быстрый старт

1. Установите зависимости бэкенда:
   - `cd climbing-guidebook/backend`
   - `pip install -r requirements.txt`
2. Запустите API:
   - `uvicorn app.main:app --reload`
3. Откройте фронтенд:
   - `climbing-guidebook/14.html` (или через локальный HTTP-сервер).

## Примечания

- Проектные настройки IDE не хранятся в репозитории.
- Для Telegram Mini App желательно открывать фронтенд по HTTPS.
