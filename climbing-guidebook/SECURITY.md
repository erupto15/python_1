# Секреты и публичный репозиторий

В Git попадает только код и **примеры** с заглушками (`*.example`, `settings.yaml.example`).

## Локально (не в Git)

| Файл | Назначение |
|------|------------|
| `backend/config/settings.yaml` | YAML-настройки |
| `backend/SECRETS.local.md` | Шпаргалка со всеми секретами (копия из `SECRETS.local.md.example`) |
| `.env` в корне | Только локальные app-переменные и test bot token |
| DB dumps / backups | Локальные или S3-бэкапы с данными |

## Что задавать на сервере

- `TELEGRAM_BOT_TOKEN`, `JWT_SECRET`, `ADMIN_PASSWORD`
- `DATABASE_URL`
- `APP_ENV=production`
- `DISABLE_CATALOG_SEED=1`

Production runtime-секреты хранятся в GitHub Secrets и при deploy синхронизируются в `/etc/guide-rus/backend.env`. Локальные секреты для разработки держите только в корневом `.env`.

Для локального Telegram Mini App используйте отдельного бота: его токен кладётся в корневой `.env` как `TELEGRAM_BOT_TOKEN`.

## Если секрет когда-то попал в историю Git

Смените токен бота в @BotFather, пароль БД и `JWT_SECRET`, затем очистите историю (`git filter-repo` / BFG) или создайте новый приватный репозиторий.
