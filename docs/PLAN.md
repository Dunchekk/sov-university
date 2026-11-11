# План реализации «Рядом»

Исходный контракт: `SPEC.md`. Работа исключительно локальная; Git без remotes. Основная ветка `main`, тематические ветки с локальным merge после проверки этапа. `/Users/dunchek/mine/hackathon` — корень проекта.

## Этапы и критерии завершения

1. **Основание** (`feat/foundation`): совместимые закреплённые зависимости; PostgreSQL schema и миграция; seed двух вымышленных студентов; Better Auth с Argon2id; session/Origin/ownership; storage; воспроизводимый runtime. Ревью №1 — проектирование; №2 — реализованные границы доступа и данные.
2. **Интерфейс и учёба** (`feat/student-experience`): токены, локальный Inter, обе темы, навигация, глобальный поиск, главная, календарь и расписания, курсы, единая математика оценок и посещаемости, учебный план. Ревью №3 — сквозной учебный сценарий и вычисления.
3. **Личные действия** (`feat/student-workflows`): услуги с типизированными формами, черновики/версии/idempotency, статусы, файлы, работы, достижения, финансы, контент, профиль, настройки и уведомления. Ревью №4 — транзакции, состояния и изоляция.
4. **Календарные интеграции** (`feat/calendar-integrations`): ограниченный ICS preview/commit, recurrence identity, экспорт, отзывные feed tokens, инструкции. Ревью №5 — формат, время, доступ и приватность.
5. **Приёмка** (`feat/release-validation`): production build, Compose, HTTPS-конфигурация, unit/API/E2E, две темы/1440/1280/360, скриншоты, матрица требований, эксплуатационная документация и отчёт ИИ. Ревью №6 — финальные пробелы и регрессии; подтверждённые дефекты исправляются до окончания.

## Архитектурные решения

- Next.js App Router, server components для первичной загрузки, небольшие client islands для действий. Серверные страницы вызывают сервисы напрямую.
- PostgreSQL — единственный источник прикладных данных. Prisma 7 + adapter-pg; нормализованные связи student/enrollment/course/lesson/request/file. JSON только для валидированных правил, snapshot формы и настроек.
- Личные данные выбираются по текущему userId из серверной сессии. Приватные детали отдельным endpoint. Закрытые курсы проверяют enrollment. Опубликованное расписание не возвращает закрытые материалы.
- Календарь — серверная проекция занятий, учебных сроков, проектов, личных/импортированных и сохранённых событий. Учебные дедлайны не копируются в независимые редактируемые события.
- Better Auth endpoints ограничены allowlist вход/выход/get-session. Регистрация и управление аккаунтом закрыты. Origin проверяется всеми мутациями. DB rate limiting, серверные сессии без cookie cache.
- PDF вне public с purpose/owner/resource binding и проверками сигнатуры/размера/квоты. Скачивание attachment. Транзакции связывают файл с записью, неуспешная запись очищает storage.
- У submit requests/project versions/import commit — серверные транзакции и уникальные ключи. Уникальность ключа: user+operation+key; payload hash хранится отдельно, несовпадение возвращает 409. Черновики имеют optimistic version.
- ICS: библиотека ical.js с локальными IANA definitions и VTIMEZONE, лимитом итераций и исходным recurrenceKey, отдельная проверка экспорта через node-ical. Ограничения 5 MiB/2000 исходных/10000 occurrences/12 месяцев; preview хранит исходник временно, commit повторно разбирает его. Feed хранит только hash токена, проверяет отзыв перед ETag, no-store.
- Clock abstraction и DEMO_BASE_DATE для seed/test; production использует реальное время. Europe/Moscow для расписания, UTC для instants, date-only для all-day.
- Docker Compose: db/migrate/app, named volumes, non-root app; отдельный Caddy production profile. Существующие runtime/context/volumes не изменяются. Docker Desktop не используется.

## Проверки

- Unit: посещаемость/пороги/добор/округление; опубликованный итог отдельно от прогноза; обязательные работы; статусы; рабочие дни; ICS recurrence и ограничения.
- API с настоящей test PostgreSQL: два аккаунта, negative ownership по каждому виду приватных объектов; auth/logout/signup/rate limits; Origin; idempotency; файлы; ICS/feed revoke.
- E2E: связные маршруты из таблицы 25.2 спецификации; сохранение после reload; клавиатура/диалоги; mobile; theme.
- Typecheck, lint, production build, Docker clean start/restart persistence. Проверки не объявляются выполненными без фактического запуска.

## Журнал ревью

Ревью запускается 6 раз суммарно. Роль architecture_researcher, Astra High, read-only. Главный агент оценивает серьёзность и вносит изменения. Результаты каждого ревью и решения фиксируются в `REVIEWS.md`.
