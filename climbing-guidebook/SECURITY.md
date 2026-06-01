# Секреты и публичный репозиторий

В Git попадает только код и **примеры** с заглушками (`*.example`, `settings.yaml.example`).

## Локально (не в Git)

| Файл | Назначение |
|------|------------|
| `backend/.env` | Переменные окружения |
| `backend/.postgres_password` | Пароль БД одной строкой |
| `backend/config/settings.yaml` | YAML-настройки |
| `backend/SECRETS.local.md` | Шпаргалка со всеми секретами (копия из `SECRETS.local.md.example`) |
| `backend/data/backups/` | Снимки каталога |
| `backend/data/local_db/` | Зеркало SQLite |

## Что задавать в Render / Supabase Dashboard

- `TELEGRAM_BOT_TOKEN`, `JWT_SECRET`, `ADMIN_PASSWORD`
- `POSTGRES_PASSWORD` или `DATABASE_URL`
- `POSTGRES_HOST`, `POSTGRES_USER`, `POSTGRES_DB` (если не используете только `DATABASE_URL`)

## Если секрет когда-то попал в историю Git

Смените токен бота в @BotFather, пароль БД и `JWT_SECRET`, затем очистите историю (`git filter-repo` / BFG) или создайте новый приватный репозиторий.
