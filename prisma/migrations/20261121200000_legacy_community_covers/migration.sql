BEGIN;

-- The original demo rows had no cover. The refreshed catalog reuses their
-- ids, so match the original title as well and preserve existing covers.
UPDATE "CommunityEvent" AS event
SET "cover" = '/community/covers/' || legacy.asset || '.webp'
FROM (VALUES
  ('event-0', 'Открытая мастерская интерфейсов', 'project-prototypes'),
  ('event-1', 'Научный вечер: данные и город', 'data-story'),
  ('event-2', 'Волонтёрская суббота', 'winter-volunteers'),
  ('event-3', 'Разговор о карьере в дизайне', 'portfolio-review'),
  ('event-4', 'Книжный клуб: цифровая культура', 'student-zine'),
  ('event-5', 'Турнир студенческих команд', 'campus-cup'),
  ('event-6', 'Выставка «Точка зрения»', 'winter-print'),
  ('event-7', 'День открытых лабораторий', 'robot-race')
) AS legacy(id, title, asset)
WHERE event.id = legacy.id AND event.title = legacy.title AND event."cover" IS NULL;

UPDATE "NewsPost" AS news
SET "cover" = '/community/covers/' || legacy.asset || '.webp'
FROM (VALUES
  ('news-0', 'Открыт приём стипендиальных заявок', 'course-fair'),
  ('news-1', 'Библиотека продлевает часы работы', 'night-library'),
  ('news-2', 'Новые материалы для учебных проектов', 'material-library'),
  ('news-3', 'Итоги осенней школы', 'urban-lab'),
  ('news-4', 'Консультации учебного офиса', 'access-map'),
  ('news-5', 'Изменения в расписании лабораторий', 'repair-cafe'),
  ('news-6', 'Студенческие инициативы месяца', 'exchange-table'),
  ('news-7', 'Встреча кураторов программ', 'debate-practice')
) AS legacy(id, title, asset)
WHERE news.id = legacy.id AND news.title = legacy.title AND news."cover" IS NULL;

COMMIT;
