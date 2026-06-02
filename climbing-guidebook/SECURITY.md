# Секреты и публичный репозиторий

В Git попадает только код и **примеры** с заглушками (`*.example`, `settings.yaml.example`).

## Локально (не в Git)

| Файл | Назначение |
|------|------------|
| `backend/.env` | Переменные окружения |
| `backend/config/settings.yaml` | YAML-настройки |
| `backend/SECRETS.local.md` | Шпаргалка со всеми секретами (копия из `SECRETS.local.md.example`) |
| `.env` в корне | Операторские переменные для SSH/Timeweb/Telegram |
| DB dumps / backups | Локальные или S3-бэкапы с данными |

## Что задавать на сервере

- `TELEGRAM_BOT_TOKEN`, `JWT_SECRET`, `ADMIN_PASSWORD`
- `DATABASE_URL`
- `APP_ENV=production`
- `DISABLE_CATALOG_SEED=1`

Runtime-секреты хранятся на VPS в `/etc/guide-rus/backend.env`. Операторские секреты для SSH, Timeweb PostgreSQL/S3 и Telegram держите только в локальном `.env`.

## Если секрет когда-то попал в историю Git

Смените токен бота в @BotFather, пароль БД и `JWT_SECRET`, затем очистите историю (`git filter-repo` / BFG) или создайте новый приватный репозиторий.
