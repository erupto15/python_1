# Guide Rus

Telegram Mini App со справочником скалолазных районов, секторов, трасс, боулдеров и фото.

## Что внутри

| Путь | Назначение |
|------|------------|
| `climbing-guidebook/index.html`, `app.js` | Статический frontend Mini App |
| `climbing-guidebook/backend/` | Единое FastAPI-приложение: REST API, bootstrap БД, отдача frontend и `/uploads` |
| `climbing-guidebook/database/` | SQL-схемы SQLite и PostgreSQL |
| `android-app/` | WebView APK; сборка `./scripts/build-android-apk.sh`, офлайн — [`android-app/README.md`](android-app/README.md) |
| `scripts/` | Postgres на VPS, cutover, бэкапы, teardown managed-ресурсов Timeweb |
| `.env.example` | Шаблон локального `.env` без секретов |
| `DEPLOYMENT.md` | Окружения, env, Git, systemd, Caddy, GitHub Actions, Postgres cutover, rollback |
| `climbing-guidebook/backend/README.md` | Конфигурация, bootstrap, список API |
| `climbing-guidebook/SECURITY.md` | Секреты, что не коммитить, локальный vs production |

## Локальный запуск

Нужен Python 3.10+. На macOS проверьте `python3 --version`; системный 3.9 не подходит — используйте Homebrew Python (`/opt/homebrew/bin/python3`) или другой Python 3.10+.

1. Создайте корневой `.env`:

```bash
cp .env.example .env
```

Минимум для локального Telegram Mini App — отдельный **тестовый** бот (production-токен локально не используйте):

```dotenv
TELEGRAM_BOT_TOKEN=<token-of-test-bot>
```

Полный набор переменных и опциональные ключи (CARTO basemap, assistant API) — в `.env.example`. Приоритет настроек: переменные окружения → корневой `.env` → `climbing-guidebook/backend/config/settings.yaml`.

2. Запустите приложение:

```bash
cd climbing-guidebook/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

3. Проверка:

```bash
curl http://127.0.0.1:8000/health
open http://127.0.0.1:8000
open http://127.0.0.1:8000/docs
```

Локально backend использует SQLite (`climbing-guidebook/backend/climbing.db` из `DATABASE_URL` в `.env`), не production PostgreSQL. Frontend отдаёт тот же процесс FastAPI — отдельный dev-сервер для статики не нужен.

## Production (кратко)

Один Timeweb VPS: **PostgreSQL на `127.0.0.1`**, медиа на диске (`/var/lib/guide-rus/uploads`), HTTPS и reverse proxy через **Caddy** → FastAPI на `127.0.0.1:8000`. Timeweb Managed PostgreSQL и S3 приложением не используются (после cutover managed-БД можно снять скриптом из `scripts/`).

Вход в Mini App: пользователь пишет боту `/start`, backend по webhook отвечает inline-кнопкой Web App на `PUBLIC_URL`. Production-секреты живут в **GitHub Variables/Secrets** и при deploy попадают в `/etc/guide-rus/backend.env`.

Деплой **вручную**: merge в `main`, затем GitHub Actions → **Deploy to Timeweb** (push сам production не выкатывает). Первичная настройка VPS, deploy key, systemd, cutover с managed Postgres, бэкапы, rollback и emergency `deploy-timeweb.sh` — в [`DEPLOYMENT.md`](DEPLOYMENT.md).

## API

Публичные чтения и admin-мутации перечислены в [`climbing-guidebook/backend/README.md`](climbing-guidebook/backend/README.md). Интерактивная схема: `/docs` на запущенном backend.
