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

БД и приватные файлы — одна согласованная копия. Скрипт временно останавливает приложение, делает pg_dump и tar файлов, затем возвращает прежнее состояние app. БД остаётся работающей. На диске копия доступна только владельцу.

```sh
DOCKER_CONTEXT=colima-hackathon bash scripts/backup.sh
# Для отдельного стенда:
COMPOSE_PROJECT_NAME=ryadom-smoke RYADOM_ENV_FILE=.env.smoke DOCKER_CONTEXT=colima-hackathon bash scripts/backup.sh
```

Хранить копии вне сервера в зашифрованном хранилище. Отдельно сохранить `.env` и, если нужны прежние сертификаты, Caddy volumes. Пароли/сессии/хеши токенов находятся в DB dump: не коммитить его. Файл demo-доступов не является резервной копией БД.

## Восстановление

Проверять сначала на **новом** Compose-проекте с новыми volumes. Его `POSTGRES_PASSWORD` может отличаться: pg_dump сохраняет таблицы приложения, не роль PostgreSQL. `BETTER_AUTH_SECRET` должен совпадать с сохранённым окружением для продолжения прежних сессий; при компрометации создать новый секрет и удалить сессии/отозвать feeds отдельной административной процедурой.

```sh
export COMPOSE_PROJECT_NAME=ryadom-restore
docker compose --env-file .env.restore up -d db
# Дождаться healthy, не запускать миграции/seed в пустую БД перед restore:
docker compose --env-file .env.restore exec -T db pg_restore -U ryadom -d ryadom --no-owner --no-acl < BACKUP/database.dump
docker compose --env-file .env.restore run --rm -T --no-deps --entrypoint tar app -C /app/storage -xf - < BACKUP/files.tar
docker compose --env-file .env.restore up -d app
```

`up app` применит только недостающие миграции из восстановленной `_prisma_migrations`. Проверить health, вход, личную заявку и скачивание PDF; не считать один успешный pg_restore полной проверкой. Замена данных существующего стенда — отдельное осознанное действие владельца, эти команды его не выполняют.

## Обновление и очистка

Перед обновлением сделать backup, прочитать release notes PostgreSQL/Node, собрать новые образы, запустить Compose. Minor PostgreSQL17 сохраняет формат volume; major требует отдельного плана миграции. Применённые миграции не редактируются. Версии образов закреплены; обновляются намеренно после проверки.

Housekeeping стирает истёкший исходный ICS при старте и каждые5минут. Сами записи результата commit остаются для повтора операции. Отменённые импортные события/личные tombstones сохраняются для подписок; старые preview metadata и неактивные feeds можно архивировать отдельной административной миграцией при росте данных. В v1 нет фоновых рассылок, Redis или cron-напоминаний.

Для диагностики: `docker compose ps`, `docker compose logs --tail=50 app migrate`, `/api/health`. Не публиковать `.env`, raw database dump, storage, cookie или секретную ссылку подписки. Ошибки API содержат безопасный requestId.
