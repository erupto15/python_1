# Guide Rus App

Single FastAPI app for the climbing guidebook: API, database bootstrap and `index.html` frontend delivery. Tables are created on startup from SQLAlchemy models.

## Local Run

Requires Python 3.10+. macOS system Python 3.9 is not enough; use Homebrew Python or another Python 3.10+.

From the repository root:

```bash
cp .env.example .env
# Fill TELEGRAM_BOT_TOKEN with a local test bot token.
```

Then run the app:

```bash
cd climbing-guidebook/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Check:

```bash
curl http://127.0.0.1:8000/health
open http://127.0.0.1:8000
open http://127.0.0.1:8000/docs
```

## Configuration

Settings priority:

1. Environment variables.
2. Repository root `.env`.
3. `backend/config/settings.yaml`, if used.

Important runtime variables:

```dotenv
APP_ENV=production
DATABASE_URL=postgresql+psycopg2://guide_rus:PASSWORD@127.0.0.1:5432/guide_rus
JWT_SECRET=<long-random-secret>
ADMIN_EMAIL=<admin-email>
ADMIN_LOGIN=<короткий логин админа>
ADMIN_PASSWORD=<admin-password>
ADMIN_DISPLAY_NAME=Administrator
TELEGRAM_BOT_TOKEN=<bot-token>
DISABLE_CATALOG_SEED=1
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=465
SMTP_SECURITY=ssl
SMTP_USER=<box>@yandex.ru
SMTP_PASSWORD=<app-password>
SMTP_FROM=<box>@yandex.ru
```

Local development can keep `DATABASE_URL=sqlite:///./climbing-guidebook/backend/climbing.db`. In `APP_ENV=production`, SQLite is rejected to avoid accidental data loss, and the app refuses to start with an empty or default `JWT_SECRET` (anyone could forge tokens with it). Production PostgreSQL runs on the VPS at `127.0.0.1`; coworkers do not need it locally.

## Bootstrap

The app runs these steps on startup:

- creates missing tables;
- applies lightweight optional column checks;
- creates the admin user if needed;
- imports `data/catalog_seed.yaml` only when seed is enabled.

On migrated environments keep `DISABLE_CATALOG_SEED=1`.

## API

Main public reads:

- `GET /health`
- `GET /api/areas`
- `GET /api/areas/{area_id}/sectors`
- `GET /api/routes`
- `GET /api/boulders`
- `GET /api/photos/by-route/{route_id}`
- `GET /api/photos/by-boulder/{boulder_id}`

Auth and admin writes:

- `POST /api/auth/register` — `{email, password, display_name}` → 201 `{access_token, token_type, user}`
- `POST /api/auth/login` — JSON `{email, password}` (алиас `admin` → `ADMIN_EMAIL`); 10 неудач за 10 минут с одного IP на почту → 429. IP берётся из `X-Forwarded-For` (самый правый адрес, не входящий в доверенные прокси) только если запрос пришёл от доверенного прокси `TRUSTED_PROXY_IPS` (IP/CIDR через запятую, по умолчанию `127.0.0.1,::1` — Caddy на том же хосте); иначе — адрес TCP-соединения.
- `POST /api/auth/password-reset/request` — `{email}` → `{ok: true}`; на почту уходит временный случайный пароль (свой на каждый запрос, 24 ч, нужен SMTP, иначе 503). До входа с ним прежний пароль работает; вход по временному паролю заменяет прежний и ставит `user.must_change_password = true`, новый запрос отменяет предыдущий временный пароль (только если письмо ушло).
- `POST /api/auth/change-password` (Bearer) — `{current_password?, new_password}` → токен; `current_password` не нужен, если `must_change_password`. Прежний и временный пароли перестают работать.
- `GET /api/auth/me`

Sessions: JWT carries claim `tv` = `users.token_version`. Changing the password, logging in with a temporary password and changing `ADMIN_PASSWORD` increment the version, so all earlier tokens get 401; `change-password` returns a fresh token for the current device. Tokens without `tv` count as version 0. While `must_change_password` is set, every authenticated endpoint except `/api/auth/me` and `/api/auth/change-password` answers 403 «Сначала смените временный пароль» (optional-auth reads treat the user as anonymous).

Uploads (`POST /api/media/upload`): the type is detected from file signatures (JPEG, PNG, WebP, GIF, HEIC/HEIF; MP4, MOV, M4V, 3GP, WebM, MKV, AVI), the stored extension always follows the detected type; anything else → 415. `/uploads` is served with `X-Content-Type-Options: nosniff` and a sandboxing CSP.
- `POST/PATCH/DELETE /api/areas`
- `POST/PATCH/DELETE /api/routes`
- `POST/PATCH/DELETE /api/boulders`
- `POST/PATCH/DELETE /api/photos`

Catalog mutations require an authenticated admin user. Auth is email + password only; password reset codes are sent via SMTP (`SMTP_*` env vars, see root `.env.example`). The Telegram bot (`POST /api/telegram/webhook`) only answers `/start` with the «Открыть гайд» button.

## Deployment

Use the repository-level `DEPLOYMENT.md` for Timeweb VPS, local PostgreSQL, Caddy, systemd and Git deploy workflow.
