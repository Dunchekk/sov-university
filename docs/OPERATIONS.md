# Запуск и эксплуатация

## Production HTTPS

Подготовить сервер с Docker Engine/Compose v2.24+, домен с A/AAAA на сервер, открытые80/443, новый `.env` с уникальными секретами. Не копировать локальные demo-секреты в публичную среду. Установить `DOMAIN=portal.example.org`, `APP_URL=https://portal.example.org`, `TRUSTED_ORIGINS=https://portal.example.org`. URL — один origin без завершающего `/`.

```sh
docker compose -f compose.yaml -f compose.production.yaml config --quiet
docker compose -f compose.yaml -f compose.production.yaml up -d --build
```

Caddy автоматически получает TLS-сертификат, проксирует на внутренний app:3000, устанавливает HSTS и перезаписывает X-Real-IP. Прямой порт app и PostgreSQL наружу закрыты. `TRUST_PROXY=1` разрешён только в этой схеме с доверенным reverse proxy. Cookie становятся Secure по HTTPS APP_URL. Caddy HTTP access/error logs отключены, чтобы opaque feed URL не попал и в сообщения об ошибках прокси; приложение пишет безопасный requestId/тип/статус. Не включать внешнюю аналитику, CDN cache и полные request dumps на приватных маршрутах.

Публичный deploy и выпуск сертификата в ходе разработки не выполнялись: инструкция и конфигурация подготовлены для владельца сервера. Наличие внешней подписки проверяется отдельно после появления доступного HTTPS-адреса.

## Резервное копирование

Для создания копии нужны Python 3, `age` и файл публичных ключей получателей. Создайте ключ восстановления `age-keygen` вне сервера и храните его отдельно от копий. На сервер передайте только файл с публичным ключом, выведенным `age-keygen -y`.

Скрипт берёт дамп и список файлов из одного снимка PostgreSQL. Он проверяет размер и SHA-256 каждого файла и сохраняет только зашифрованные `database.dump.age` и `files.tar.age`. Сайт продолжает работать. Если файл удалён или изменён во время копирования, скрипт завершится ошибкой до публикации копии. Повторите запуск с новым снимком.

```sh
export RYADOM_BACKUP_RECIPIENTS=/path/to/recipients.txt
DOCKER_CONTEXT=colima-hackathon bash scripts/backup.sh

# Для standalone на VPS. Настройте libpq service с доступом на чтение БД.
PGSERVICE=ryadom-backup STORAGE_DIR=/path/to/storage bash scripts/backup.sh --standalone /path/to/new/backup
```

В standalone используйте `psql`, `pg_dump` и `tar` на VPS. Задайте параметры подключения через `PGSERVICE` или `PGDATABASE`, `PGHOST`, `PGUSER` и файл `PGPASSFILE` с правами `0600`. Путь назначения должен быть новым каталогом. Настройте регулярный запуск и выгрузку обеих частей копии в закрытое хранилище вне VPS. Проверяйте последнее успешное копирование и уведомляйте об ошибках. Секреты окружения храните отдельной зашифрованной копией.

## Восстановление

Проверять сначала на **новом** Compose-проекте с новыми volumes. Его `POSTGRES_PASSWORD` может отличаться: pg_dump сохраняет таблицы приложения, не роль PostgreSQL. `BETTER_AUTH_SECRET` должен совпадать с сохранённым окружением для продолжения прежних сессий; при компрометации создать новый секрет и удалить сессии/отозвать feeds отдельной административной процедурой.

```sh
export COMPOSE_PROJECT_NAME=ryadom-restore
set -o pipefail
docker compose --env-file .env.restore up -d db
# Дождаться healthy, не запускать миграции/seed в пустую БД перед restore:
age -d -i /path/to/recovery-key BACKUP/database.dump.age |
  docker compose --env-file .env.restore exec -T db pg_restore -U ryadom -d ryadom --exit-on-error --no-owner --no-acl
age -d -i /path/to/recovery-key BACKUP/files.tar.age |
  docker compose --env-file .env.restore run --rm -T --no-deps --entrypoint tar app -C /app/storage -xf -
docker compose --env-file .env.restore up -d app
```

`up app` применит только недостающие миграции из восстановленной `_prisma_migrations`. Проверить health, вход, личную заявку и скачивание PDF; не считать один успешный pg_restore полной проверкой. Замена данных существующего стенда — отдельное осознанное действие владельца, эти команды его не выполняют.

## Обновление и очистка

Перед обновлением сделать backup, прочитать release notes PostgreSQL/Node, собрать новые образы, запустить Compose. Minor PostgreSQL17 сохраняет формат volume; major требует отдельного плана миграции. Применённые миграции не редактируются. Версии образов закреплены; обновляются намеренно после проверки.

Housekeeping стирает истёкший исходный ICS при старте и каждые5минут. Сами записи результата commit остаются для повтора операции. Отменённые импортные события/личные tombstones сохраняются для подписок; старые preview metadata и неактивные feeds можно архивировать отдельной административной миграцией при росте данных. В v1 нет фоновых рассылок, Redis или cron-напоминаний.

Для диагностики: `docker compose ps`, `docker compose logs --tail=50 app migrate`, `/api/health`. Не публиковать `.env`, raw database dump, storage, cookie или секретную ссылку подписки. Ошибки API содержат безопасный requestId.
