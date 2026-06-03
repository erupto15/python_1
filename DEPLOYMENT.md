# Guide Rus Deployment

Документ описывает новую операционную модель: frontend и backend живут на Timeweb VPS, PostgreSQL — в Timeweb Managed PostgreSQL, внешний HTTPS и reverse proxy — через Caddy.

## Окружения

### Local

Для разработки на ноутбуке. Backend явно читает корневой `.env`, поэтому локальные настройки лежат в одном месте. По умолчанию он ходит в локальный SQLite-файл `climbing-guidebook/backend/climbing.db`, а не в production PostgreSQL.

Локальный Telegram Mini App должен использовать отдельного тестового бота. Его токен хранится в корневом `.env` как `TELEGRAM_BOT_TOKEN`.

```js
window.CLIMBING_API_BASE_URL = '';
```

Локально frontend отдаёт тот же FastAPI-процесс, поэтому достаточно открыть `http://127.0.0.1:8000`.

### Production

Единственный сервер на Timeweb VPS. Caddy принимает HTTPS и проксирует весь трафик в FastAPI на `127.0.0.1:8000`; FastAPI отдаёт и frontend, и API. Данные лежат в Timeweb Managed PostgreSQL.

## Локальный Запуск

Нужен Python 3.10+. Системный Python 3.9 на macOS не подходит, потому что в коде используется современный синтаксис типов. Если `python3 --version` показывает 3.9, используйте Homebrew Python: `/opt/homebrew/bin/python3`.

1. Подготовьте корневой `.env`:

```bash
cp .env.example .env
```

Минимум для локального Telegram Mini App:

```dotenv
TELEGRAM_BOT_TOKEN=<token-of-test-bot>
```

Production-токен и production PostgreSQL при локальном запуске не используются.

2. Запустите приложение:

```bash
cd climbing-guidebook/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Проверка:

```bash
curl http://127.0.0.1:8000/health
open http://127.0.0.1:8000
```

## Переменные Окружения

### Production Runtime

Эти переменные лежат на сервере в `/etc/guide-rus/backend.env`. В репозиторий реальные значения не коммитятся.

```dotenv
APP_ENV=production
DATABASE_URL=postgresql+psycopg2://USER:PASSWORD@HOST:5432/DB?sslmode=require
JWT_SECRET=<long-random-secret>
ADMIN_EMAIL=<admin-email>
ADMIN_PASSWORD=<admin-password>
ADMIN_DISPLAY_NAME=Administrator
TELEGRAM_BOT_TOKEN=<bot-token>
TELEGRAM_AUTH_MAX_AGE_SEC=86400
DISABLE_CATALOG_SEED=1
```

`DISABLE_CATALOG_SEED=1` важен: после миграции каталог должен жить в БД, а не восстанавливаться из seed-файла при рестарте.

### Local `.env`

Локальный корневой `.env` используется приложением при локальном запуске и может содержать операторские переменные для emergency-команд. Приложение игнорирует неизвестные ключи.

Минимальный набор для локальной разработки:

```dotenv
APP_ENV=development
DATABASE_URL=sqlite:///./climbing-guidebook/backend/climbing.db
TELEGRAM_BOT_TOKEN=<local-test-bot-token>
JWT_SECRET=dev-only-change-me
ADMIN_EMAIL=admin@climbing-guidebook.local
ADMIN_PASSWORD=change-me-now
```

## Git Workflow

1. Разработка идёт в feature-ветках.
2. Для infra-переезда используется ветка `infra/timeweb-migration`.
3. Изменения проверяются локально.
4. После проверки ветка мержится в `main`.
5. Сервер деплоит `main`.

Базовые команды:

```bash
git switch main
git pull --ff-only
git switch -c feature/some-change
# правки
git status
git diff
```

## One-Time: Подружить VPS С GitHub

На VPS должен быть отдельный read-only deploy key, а не личный ключ разработчика.

Ключ уже можно сгенерировать так:

```bash
ssh root@<server>
ssh-keygen -t ed25519 -C "guide-rus-timeweb-deploy" -f ~/.ssh/id_ed25519_guide_rus_deploy
cat ~/.ssh/id_ed25519_guide_rus_deploy.pub
```

Публичный ключ нужно добавить в GitHub repository settings как Deploy key с правом read-only. После этого на сервере:

```bash
ssh -T -i ~/.ssh/id_ed25519_guide_rus_deploy git@github.com
```

Ожидаемый результат: GitHub отвечает, что аутентификация прошла, но shell access не предоставляется.

## One-Time: Git Clone На VPS

После добавления deploy key:

```bash
ssh root@<server>
apt-get update
apt-get install -y git python3-venv
mkdir -p /opt/guide-rus
cd /opt/guide-rus
git clone git@github.com:erupto15/python_1.git current
cd current
git switch main
```

Если `/opt/guide-rus/current` уже существует как ручная копия, сначала сохраните backup:

```bash
mv /opt/guide-rus/current /opt/guide-rus/current.manual-backup.$(date +%Y%m%d%H%M%S)
```

## systemd

Файл `/etc/systemd/system/guide-rus-backend.service`:

```ini
[Unit]
Description=Guide Rus FastAPI backend
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/guide-rus/current/climbing-guidebook/backend
EnvironmentFile=/etc/guide-rus/backend.env
ExecStart=/opt/guide-rus/current/climbing-guidebook/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

После первого clone:

```bash
cd /opt/guide-rus/current/climbing-guidebook/backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
systemctl daemon-reload
systemctl enable --now guide-rus-backend
```

## Caddy

Caddy занимается только HTTPS и проксирует все запросы в приложение:

```caddyfile
<domain-or-sslip> {
    reverse_proxy 127.0.0.1:8000
}
```

Проверка:

```bash
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
```

## Деплой Через GitHub Actions

Основной деплой должен запускаться из GitHub Actions. Коворкеру не нужен SSH-доступ к VPS: ему достаточно прав в GitHub, чтобы смержить изменения в `main` или вручную запустить workflow.

Workflow использует SSH-ключ из GitHub Secrets и на сервере выполняет тот же pull/restart, который раньше запускался с ноутбука.

В workflow намеренно захардкожены несекретные deploy-параметры:

```yaml
HOST: 92.246.76.142
USER: root
APP_DIR: /opt/guide-rus/current
DEPLOY_KEY_PATH: /root/.ssh/id_ed25519_guide_rus_deploy
```

`DEPLOY_KEY_PATH` — это путь на VPS к read-only ключу, которым сервер читает GitHub-репозиторий при `git pull`. Это не ключ на машине разработчика и не GitHub Secret.

Нужно один раз добавить только один GitHub repository secret:

| Secret | Значение |
|--------|----------|
| `TIMEWEB_SSH_KEY` | private key для подключения GitHub Actions к VPS |

После настройки:

- push в `main` запускает деплой автоматически;
- `workflow_dispatch` позволяет запустить деплой вручную из вкладки GitHub Actions.

Production runtime env workflow не перезаписывает. `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `JWT_SECRET` остаются в `/etc/guide-rus/backend.env`.

### Emergency Fallback С Ноутбука

Если GitHub Actions недоступен, можно разово задеплоить с операторской машины:

```bash
source .env
bash deploy-timeweb.sh
```

Эквивалентные команды на сервере:

```bash
ssh root@<server>
cd /opt/guide-rus/current
GIT_SSH_COMMAND='ssh -i ~/.ssh/id_ed25519_guide_rus_deploy -o IdentitiesOnly=yes' git fetch origin
GIT_SSH_COMMAND='ssh -i ~/.ssh/id_ed25519_guide_rus_deploy -o IdentitiesOnly=yes' git checkout main
GIT_SSH_COMMAND='ssh -i ~/.ssh/id_ed25519_guide_rus_deploy -o IdentitiesOnly=yes' git pull --ff-only
cd climbing-guidebook/backend
. .venv/bin/activate
pip install -r requirements.txt
systemctl restart guide-rus-backend
systemctl reload caddy
```

Проверка после деплоя:

```bash
curl -fsS https://<domain-or-sslip>/health
curl -fsS https://<domain-or-sslip>/api/areas
curl -fsS https://<domain-or-sslip>/api/boulders
systemctl status guide-rus-backend --no-pager
journalctl -u guide-rus-backend -n 100 --no-pager
```

## Telegram Bot

После замены Telegram token или домена нужно прописать frontend URL в меню бота:

1. На VPS обновите runtime token backend:

```bash
ssh root@<server>
nano /etc/guide-rus/backend.env
# TELEGRAM_BOT_TOKEN=<new-real-bot-token>
systemctl restart guide-rus-backend
```

2. На своей машине обновите корневой `.env`:

```dotenv
PROD_TELEGRAM_BOT_HTTP_API=<new-real-bot-token>
PUBLIC_URL=https://<domain-or-sslip>
```

3. Обновите кнопку Mini App у Telegram-бота:

```bash
source .env
curl -X POST "https://api.telegram.org/bot${PROD_TELEGRAM_BOT_HTTP_API}/setChatMenuButton" \
  -H "Content-Type: application/json" \
  -d "{
    \"menu_button\": {
      \"type\": \"web_app\",
      \"text\": \"Открыть гайд\",
      \"web_app\": { \"url\": \"${PUBLIC_URL}/?v=$(date +%s)\" }
    }
  }"
```

`?v=<deploy-id>` помогает Telegram WebView не открыть старый кешированный `index.html`.

## Rollback

Если новый deploy сломался:

```bash
ssh root@<server>
cd /opt/guide-rus/current
git log --oneline -n 10
git checkout <previous-good-sha>
systemctl restart guide-rus-backend
systemctl reload caddy
```

После фикса вернитесь на `main`:

```bash
git checkout main
git pull --ff-only
systemctl restart guide-rus-backend
```

## Секреты

- Реальные `.env`, private keys, DB dumps и backups не коммитятся.
- Backend secrets живут в `/etc/guide-rus/backend.env`.
- Операторские secrets живут в локальном корневом `.env`.
- Deploy key на VPS должен быть read-only.
- Telegram bot token меняется вручную в `/etc/guide-rus/backend.env`; обычный deploy кода его не трогает.
