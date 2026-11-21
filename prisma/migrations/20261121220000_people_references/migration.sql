BEGIN;

ALTER TABLE "Group" ADD COLUMN "curatorId" TEXT;
ALTER TABLE "RosterPerson" ADD COLUMN "avatar" TEXT;
ALTER TABLE "Retake" ADD COLUMN "consultationLecturerId" TEXT;

ALTER TABLE "Group" ADD CONSTRAINT "Group_curatorId_fkey"
  FOREIGN KEY ("curatorId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Retake" ADD CONSTRAINT "Retake_consultationLecturerId_fkey"
  FOREIGN KEY ("consultationLecturerId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "Group"
SET "curatorId" = 'lecturer-0'
WHERE (id, name) IN (('d-21', 'ДП-21'), ('p-22', 'ПИ-22'))
  AND EXISTS (SELECT 1 FROM "Person" WHERE id = 'lecturer-0' AND email = 'lecturer1@example.org');

UPDATE "RosterPerson" AS roster
SET "avatar" = '/people/students/' || demo.id || '.webp'
FROM (VALUES
  ('roster-0', 'Арина Фомина'),
  ('roster-1', 'Даниил Морозов'),
  ('roster-8', 'Алиса Семёнова'),
  ('roster-14', 'Дарья Антонова'),
  ('roster-22', 'Лидия Данилова'),
  ('roster-24', 'Александра Миронова')
) AS demo(id, name)
WHERE roster.id = demo.id AND roster.name = demo.name;

UPDATE "Retake"
SET "consultationLecturerId" = 'lecturer-2',
    consultation = 'Среда 16:00, кафедра информационных систем. За порядком допуска обратитесь в учебный офис.'
WHERE id = 'retake-a'
  AND consultation = 'Консультация с Еленой Беловой: среда 16:00, кафедра информационных систем. За порядком допуска обратитесь в учебный офис.'
  AND EXISTS (SELECT 1 FROM "Person" WHERE id = 'lecturer-2' AND email = 'lecturer3@example.org');

COMMIT;
