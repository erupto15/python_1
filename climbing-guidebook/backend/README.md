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

Для PostgreSQL локально или при явном URL задайте переменную окружения:

```bash
export DATABASE_URL="postgresql+psycopg2://user:pass@localhost:5432/climbing"
```

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
