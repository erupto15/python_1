# Постоянная БД для Telegram Mini App (Supabase)

## Быстрый старт

1. [supabase.com](https://supabase.com) → **New project** → сохраните пароль БД.
2. **Project Settings → Database → Connection string**:
   - Type: **URI**
   - Mode: **Transaction** (pooler, порт **6543**)
   - Для проекта `uryaxijckkryzxcpwywz` (регион **eu-west-1**):

```env
POSTGRES_HOST=aws-0-eu-west-1.pooler.supabase.com
POSTGRES_PORT=6543
POSTGRES_USER=postgres.uryaxijckkryzxcpwywz
POSTGRES_DB=postgres
```

Пароль — в `backend/.postgres_password` (одна строка) или `POSTGRES_PASSWORD` в `.env`.
3. В репозитории:

```bash
cd backend
cp .env.supabase.example .env
# Вставьте DATABASE_URL и TELEGRAM_BOT_TOKEN в .env
python setup_persistent_db.py --migrate-sqlite
```

4. **Render** (сервис `python-1-dicp` или новый):
   - **Environment** → добавьте переменные из `.env`
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

Фронт (`6a9aguidebook.info`) уже указывает на API Render в `index.html` — менять URL не нужно, если backend тот же.
