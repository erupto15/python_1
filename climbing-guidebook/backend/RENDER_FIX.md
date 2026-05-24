# Данные снова пропали — что сделать на Render

## Причина

Сайт на Vercel (`6a9aguidebook.info`) ходит в API **https://python-1-dicp.onrender.com**.

Сейчас этот API **не подключён** к вашей PostgreSQL `guidebook` на Render. Он работает со **старой сборкой** и, скорее всего, с **SQLite на временном диске** — после сна/деплоя данные обнуляются.

Проверка: `GET /health` должен отвечать так:

```json
{"status":"ok","database":"postgresql","persistent_storage":true}
```

Если только `{"status":"ok"}` — на Render **ещё старый код** и/или **нет переменных БД**.

## Исправление (5 минут)

1. [dashboard.render.com](https://dashboard.render.com) → Web Service **python-1-dicp** (или climbing-guidebook-api).

2. **Settings** → **Root Directory**: `climbing-guidebook/backend`

3. **Start Command**:
   ```bash
   python bootstrap_database.py && uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```

4. **Environment** → добавьте:

   | Key | Value |
   |-----|--------|
   | `APP_ENV` | `production` |
   | `POSTGRES_HOST` | `dpg-d7tfijbrjlhs73ar905g-a` |
   | `POSTGRES_PORT` | `5432` |
   | `POSTGRES_USER` | `user_optional` |
   | `POSTGRES_DB` | `guidebook` |
   | `POSTGRES_PASSWORD` | пароль из панели PostgreSQL |
   | `JWT_SECRET` | длинная случайная строка |
   | `TELEGRAM_BOT_TOKEN` | токен бота (если Mini App) |

   **Или:** Environment → **Link Database** → выберите вашу БД `guidebook` (появится `DATABASE_URL`).

5. **Manual Deploy** → Deploy latest commit.

6. Проверка:
   ```bash
   curl https://python-1-dicp.onrender.com/health
   curl https://python-1-dicp.onrender.com/api/areas
   ```

## Важно

Данные, сохранённые **до** этого исправления в SQLite на Render, **восстановить нельзя**. После подключения PostgreSQL каталог нужно заполнить заново — новые записи будут сохраняться постоянно.
