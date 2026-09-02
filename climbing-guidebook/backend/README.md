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
ADMIN_PASSWORD=<admin-password>
ADMIN_DISPLAY_NAME=Administrator
TELEGRAM_BOT_TOKEN=<bot-token>
TELEGRAM_AUTH_MAX_AGE_SEC=86400
DISABLE_CATALOG_SEED=1
```

Local development can keep `DATABASE_URL=sqlite:///./climbing-guidebook/backend/climbing.db`. In `APP_ENV=production`, SQLite is rejected to avoid accidental data loss. Production PostgreSQL runs on the VPS at `127.0.0.1`; coworkers do not need it locally.

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

- `POST /api/auth/login`
- `POST /api/auth/telegram`
- `GET /api/auth/me`
- `POST/PATCH/DELETE /api/areas`
- `POST/PATCH/DELETE /api/routes`
- `POST/PATCH/DELETE /api/boulders`
- `POST/PATCH/DELETE /api/photos`

Catalog mutations require an authenticated admin user. Telegram auth validates `Telegram.WebApp.initData` with `TELEGRAM_BOT_TOKEN`.

## Deployment

Use the repository-level `DEPLOYMENT.md` for Timeweb VPS, local PostgreSQL, Caddy, systemd and Git deploy workflow.
