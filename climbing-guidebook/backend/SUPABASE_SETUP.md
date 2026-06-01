# Постоянная БД для Telegram Mini App (Supabase)

## Быстрый старт

1. [supabase.com](https://supabase.com) → **New project** → сохраните пароль БД.
2. **Project Settings → Database → Connection string**:
   - Type: **URI**
   - Mode: **Transaction** (pooler, порт **6543**)

```env
POSTGRES_HOST=aws-0-<REGION>.pooler.supabase.com
POSTGRES_PORT=6543
POSTGRES_USER=postgres.<YOUR_PROJECT_REF>
POSTGRES_DB=postgres
```

Пароль — в `backend/.postgres_password` (одна строка, в `.gitignore`) или `POSTGRES_PASSWORD` в `.env` (тоже в `.gitignore`).

Реальные значения для вашего проекта храните в **`SECRETS.local.md`** (скопируйте из `SECRETS.local.md.example`).

3. В репозитории:

```bash
cd backend
cp .env.supabase.example .env
# Заполните .env локально (не коммитить)
python setup_persistent_db.py --migrate-sqlite
```

4. **Render** (ваш Web Service):
   - **Environment** → переменные из `.env` / Dashboard Supabase
   - **Start Command**:  
     `python bootstrap_database.py && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Перезапустите сервис

5. Проверка:

```bash
curl https://ВАШ-API.onrender.com/health
```

Ожидается:

```json
{"status":"ok","database":"postgresql","persistent_storage":true}
```

Если `"database":"sqlite"` — данные снова будут пропадать после рестарта.

## Переменные на Render

| Переменная | Обязательно |
|------------|-------------|
| `DATABASE_URL` | Да — строка Supabase |
| `APP_ENV` | `production` |
| `JWT_SECRET` | Да |
| `TELEGRAM_BOT_TOKEN` | Да — для входа в Mini App |
| `ADMIN_PASSWORD` | Смените после первого входа |

Фронт указывает на API в `index.html` — менять URL не нужно, если backend тот же.
