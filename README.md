# Guide Rus

Telegram Mini App со справочником скалолазных районов, секторов, трасс, боулдеров и фото.

## Что внутри

- `climbing-guidebook/index.html` — статический frontend.
- `climbing-guidebook/backend/` — единое FastAPI-приложение: API, bootstrap БД и отдача frontend.
- `DEPLOYMENT.md` — полный workflow разработки и деплоя на Timeweb.
- `.env.example` и `climbing-guidebook/backend/.env.example` — шаблоны без секретов.

## Локальный запуск

Нужен Python 3.10+. На macOS проверьте `python3 --version`; если это системный 3.9, используйте Homebrew Python (`/opt/homebrew/bin/python3`) или другой Python 3.10+.

```bash
cd climbing-guidebook/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Откройте `http://127.0.0.1:8000`. Локально backend по умолчанию использует SQLite-файл, не production PostgreSQL.

## Деплой

Новая целевая инфраструктура: Timeweb VPS + Timeweb Managed PostgreSQL + Caddy + systemd. Подробный порядок первичной настройки, `.env`, Git deploy key, выката и rollback описан в `DEPLOYMENT.md`.
