# Climbing Guidebook API

FastAPI + SQLAlchemy 2.0. Таблицы создаются автоматически из моделей (`Base.metadata.create_all`) при старте приложения.

## Запуск

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Администратор каталога

При первом запуске API создаётся пользователь-администратор (если email ещё не занят):

| | Значение по умолчанию |
|---|------------------------|
| **Логин (email)** | `admin@climbing-guidebook.local` |
| **Пароль** | `admin` |
| Имя в системе | `Administrator` |

Переопределение через переменные окружения: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_DISPLAY_NAME` (см. `.env.example`).

Войдите через `POST /api/auth/login` (`username` = email, `password` = пароль), затем с Bearer-токеном создавайте районы, секторы, трассы и боулдеры.

**В продакшене смените пароль и email** сразу после деплоя.

---

По умолчанию используется SQLite-файл `climbing.db` в текущей директории.

**Render и аналоги:** у web-сервиса диск часто **временный** — после сна инстанса или деплоя SQLite **обнуляется**, трассы и боулдеры «пропадают». В продакшене подключите **PostgreSQL** (в Render: New PostgreSQL → в веб-сервисе **Environment → Link database** — появится `DATABASE_URL`). Достаточно `postgres://...` из панели: приложение само подставит драйвер `psycopg2`.

Приложение дополнительно защищено от тихой потери данных: в `production` запуск с SQLite (или пустым `DATABASE_URL`) завершается ошибкой при старте.

Если в логах `could not translate host name "host"` — в `DATABASE_URL` всё ещё **шаблон** (хост `host`), а не Internal Database URL из панели PostgreSQL.

Для PostgreSQL локально или при явном URL задайте переменную окружения:

```bash
export DATABASE_URL="postgresql+psycopg2://user:pass@localhost:5432/climbing"
```

### Supabase как production БД

Можно использовать Supabase PostgreSQL вместо Render Postgres:

1. В Supabase откройте `Project Settings -> Database` и скопируйте строку подключения (`Connection string`, обычно port `6543` для pooler).
2. В Render (web service backend) задайте:
   - `DATABASE_URL=<строка из Supabase>`
   - `APP_ENV=production`
3. Перезапустите/задеплойте backend.

Для URL Supabase приложение автоматически добавляет `sslmode=require`, если параметр не указан.

### Создание БД и схемы (bootstrap)

Скрипт создаёт таблицы и администратора в БД из `DATABASE_URL`:

```bash
cd backend
python bootstrap_database.py
```

### Render: production-переменные и команды

`Root Directory`: `backend`  
`Build Command`: `pip install -r requirements.txt`  
`Start Command`: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

Переменные окружения (Web Service -> Environment):

- `DATABASE_URL` — из Render PostgreSQL (лучше через **Link database**).
- `APP_ENV=production`
- `JWT_SECRET` — случайная длинная строка (например `openssl rand -hex 32`).
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_DISPLAY_NAME`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_AUTH_MAX_AGE_SEC=86400`

Готовый шаблон значений: `backend/.env.render.example`.

### Перенос данных из SQLite в PostgreSQL

Если у вас уже есть данные в `climbing.db`, перенесите их так:

```bash
cd backend
export SQLITE_URL="sqlite:///./climbing.db"
export POSTGRES_URL="postgresql+psycopg2://user:pass@host:5432/dbname"
python migrate_sqlite_to_postgres.py
```

Для миграции в Supabase укажите `POSTGRES_URL` как Supabase connection string.

Скрипт переносит все основные таблицы (`users`, `areas`, `sectors`, `routes`, `boulders`, `photos`, `comments`) и обновляет sequence в PostgreSQL.

Сервер:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- Документация OpenAPI: http://127.0.0.1:8000/docs  
- Проверка: `GET /health`

Префикс REST: `/api/...`.

## JWT и защита мутаций

- **Регистрация** `POST /api/users` и **логин** `POST /api/auth/login` — без токена.
- Логин: OAuth2 password form — поле **`username`** = email, **`password`** = пароль. Ответ: `access_token`, `token_type: bearer`.
- Telegram Mini App: `POST /api/auth/telegram` с полем `init_data` (строка `Telegram.WebApp.initData`), подпись проверяется на сервере по `TELEGRAM_BOT_TOKEN`.
- Остальные **POST / PATCH / DELETE** (районы, секторы, трассы, боулдеры, фото, комментарии) требуют заголовок:  
  `Authorization: Bearer <access_token>`
- **`GET /api/auth/me`** — текущий пользователь (нужен Bearer).
- При создании `created_by` / `uploaded_by` / `user_id` выставляются **с сервера** из токена (клиент не может подменить чужой id).
- **PATCH/DELETE**: если у ресурса указан владелец (`created_by`, `uploaded_by`, `user_id`) и он **не совпадает** с пользователем из токена — **403**. Если владелец в БД `NULL`, править может любой авторизованный пользователь.

В продакшене задайте **`JWT_SECRET`** (длинная случайная строка), например:

```bash
export JWT_SECRET="$(openssl rand -hex 32)"
```

Для Telegram авторизации в продакшене задайте:

```bash
export TELEGRAM_BOT_TOKEN="<bot_token_from_botfather>"
export TELEGRAM_AUTH_MAX_AGE_SEC="86400"
```

## Маршруты

| Метод | Путь | Описание |
|--------|------|----------|
| POST | `/api/users` | Регистрация (без токена) |
| POST | `/api/users/upsert-telegram` | Upsert пользователя по `telegram_id`/`username` (как в Express примере) |
| POST | `/api/auth/login` | Получить JWT (form: username=email, password) |
| GET | `/api/auth/me` | Текущий пользователь (Bearer) |
| GET | `/api/users/{user_id}` | Профиль (без токена) |
| GET | `/api/areas` | Список районов |
| POST | `/api/areas` | Создание района (**Bearer**) |
| GET/PATCH/DELETE | `/api/areas/{id}` | Чтение / изменение (**Bearer**, владелец) / удаление |
| GET/POST | `/api/areas/{id}/sectors` | Секторы / создание (**Bearer**) |
| GET/PATCH/DELETE | `/api/sectors/{id}` | Сектор |
| GET | `/api/routes` | Список |
| POST/PATCH/DELETE | `/api/routes`, `/api/routes/{id}` | Трассы (**Bearer**, владелец для PATCH/DELETE) |
| Аналогично | `/api/boulders` | Боулдеры |
| GET | `/api/photos/by-route/...`, `by-boulder/...` | Список фото |
| POST/PATCH/DELETE | `/api/photos` | Фото + `markup` (**Bearer**, владелец фото) |
| GET | `/api/comments/by-route/...` | Комментарии |
| POST/PATCH/DELETE | `/api/comments` | Комментарии (**Bearer**; автор комментария для PATCH/DELETE) |

При создании фото API автоматически сохраняет в БД `climb_name` и `climb_category` из связанной трассы/боулдера вместе с `markup`.

## Архитектура (KISS / SOLID)

- **Роутеры** (`app/routers/*`) — только HTTP-слой.
- **Сервисы** (`app/services/*`) — повторяемая бизнес-логика (например `telegram_user.upsert_telegram_user`).
- **Модели** (`app/models.py`) — схема БД.
- Мутации каталога (районы/секторы/трассы/боулдеры) — только для администратора (`assert_admin`).
- На фронте после сохранения — точечное обновление кэша, без полной перезагрузки каталога (чтобы записи не «заменяли» друг друга).
