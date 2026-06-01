# Ежедневная синхронизация с Supabase (локально)

Раз в сутки скрипт забирает **актуальное** состояние облачной БД и приводит локальные копии в соответствие с ним: новые записи появляются, изменённые обновляются, **удалённые на сервере исчезают и локально**.

## Три уровня локальных данных

| Путь | Назначение |
|------|------------|
| `data/backups/current/` | **Живое зеркало** — каждый запуск полностью перезаписывает JSON (не накопление) |
| `data/backups/YYYY-MM-DD/` | Снимок на дату (история за 30 дней) |
| `data/local_db/guidebook_mirror.db` | Локальная **SQLite**-копия тех же таблиц (пересборка раз в сутки) |

В `current/sync_state.json` — отчёт: сколько строк добавлено/удалено по сравнению с прошлым запуском.

Ссылка `data/backups/latest` → `current/`.

## Подготовка

В `backend/.env` — подключение к Supabase (`DATABASE_URL` или `POSTGRES_*`), см. `.env.supabase.example`.

```bash
cd climbing-guidebook/backend
source .venv/bin/activate
python backup_supabase_daily.py
cat data/backups/current/sync_state.json
```

## Автозапуск раз в сутки (macOS)

```bash
chmod +x run_daily_backup.sh
cp com.climbing.guidebook.daily-backup.plist.example \
   ~/Library/LaunchAgents/com.climbing.guidebook.daily-backup.plist
# Пути в plist — под ваш Mac
launchctl load ~/Library/LaunchAgents/com.climbing.guidebook.daily-backup.plist
```

Запуск по умолчанию в **03:00**. Логи: `data/backups/logs/`.

## Переменные окружения

```bash
export BACKUP_DIR="$HOME/Backups/climbing-guidebook"
export BACKUP_KEEP_DAYS=60
export SQLITE_MIRROR_PATH="$HOME/Backups/climbing-guidebook/guidebook.db"
python backup_supabase_daily.py
```

## Как это отражает удаления

Облако — источник правды. Скрипт каждый раз:

1. Читает все строки из PostgreSQL.
2. **Удаляет** старые `*.json` в `current/` и записывает новые (полный снимок, не merge).
3. Пересобирает `guidebook_mirror.db` с нуля.
4. Копирует `current/` в папку с сегодняшней датой.

Если трассу удалили в Supabase — в следующем ночном запуске её не будет ни в `current/`, ни в SQLite.

## Безопасность

В бэкапах есть хэши паролей и фото (base64). Не коммитьте `data/backups/` и `data/local_db/` в git.
