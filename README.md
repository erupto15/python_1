# Climbing Guidebook

Учебный проект со справочником скалолазных районов, секторов, трасс и боулдеров.

## Что внутри

- `climbing-guidebook/index.html` — фронтенд (Vercel).
- `climbing-guidebook/backend/` — API (FastAPI), БД — **Render PostgreSQL**.
- `render.yaml` — деплой API на Render.

## Быстрый старт

1. Установите зависимости бэкенда:
   - `cd climbing-guidebook/backend`
   - `pip install -r requirements.txt`
2. Запустите API:
   - `uvicorn app.main:app --reload`
3. Откройте фронтенд: `climbing-guidebook/index.html` (или через локальный HTTP-сервер).

Production: фронт — **6a9aguidebook.info**, API — **https://python-1-dicp.onrender.com**.

## Примечания

- Проектные настройки IDE не хранятся в репозитории.
- Для Telegram Mini App желательно открывать фронтенд по HTTPS.
