import { db } from "../src/server/db";
import {
  attendanceStats,
  gradeSummary,
  schemeSchema,
} from "../src/modules/assessment/domain";
import { academicYear } from "../src/modules/rating/domain";
import { addDays, atTime } from "../src/shared/lib/time";

type CourseFixture = {
  slug: string;
  name: string;
  lecturer: number;
  credits: number;
  description: string;
  work: [string, string, string];
  points: [number, number, number | null];
  closed?: true;
};

const common: CourseFixture[] = [
  {
    slug: "accessible-services",
    name: "Доступность цифровых сервисов",
    lecturer: 0,
    credits: 4,
    description:
      "Разбираем доступность интерфейсов на реальных сценариях и проверяем прототипы с клавиатурой и экранным диктором.",
    work: [
      "Аудит интерактивной формы",
      "Тестирование с клавиатуры",
      "Проект доступного сценария",
    ],
    points: [30, 25, null],
  },
  {
    slug: "data-stories",
    name: "Истории на данных",
    lecturer: 18,
    credits: 4,
    description:
      "От исходной таблицы до рассказа с диаграммами. Особое внимание уделяем проверке выводов и подписям.",
    work: [
      "Разбор набора данных",
      "Эскизы диаграмм",
      "Заметка с визуализацией",
    ],
    points: [33, 26, 28],
  },
  {
    slug: "project-estimates",
    name: "Экономика цифровых проектов",
    lecturer: 13,
    credits: 3,
    description:
      "Составляем бюджет небольшого продукта, сравниваем варианты затрат и учимся пересматривать прогноз.",
    work: ["Смета команды", "Сценарии выручки", "Защита бюджета"],
    points: [24, 20, null],
  },
  {
    slug: "team-practice",
    name: "Командная работа и переговоры",
    lecturer: 25,
    credits: 3,
    description:
      "Тренируем переговоры о сроках и распределении задач, разбираем обратную связь после учебных проектов.",
    work: [
      "Протокол встречи",
      "Ролевая игра по переговорам",
      "Ретроспектива команды",
    ],
    points: [32, 28, null],
  },
  {
    slug: "research-sources",
    name: "Проверка источников",
    lecturer: 28,
    credits: 3,
    description:
      "Проверяем документы и цитаты, отделяем первичные источники от пересказов и объясняем степень уверенности.",
    work: ["Карта источников", "Проверка цитат", "Разбор спорного утверждения"],
    points: [27, 25, 31],
    closed: true,
  },
  {
    slug: "field-methods",
    name: "Полевые методы исследования",
    lecturer: 10,
    credits: 4,
    description:
      "Собираем наблюдения по единому протоколу и сравниваем, какие выводы можно сделать по короткому выезду.",
    work: ["План наблюдения", "Дневник выезда", "Отчёт о полевом исследовании"],
    points: [33, 28, 32],
    closed: true,
  },
  {
    slug: "technical-writing",
    name: "Техническая документация",
    lecturer: 4,
    credits: 4,
    description:
      "Пишем инструкции и проектные заметки, проверяем их на читателях, впервые столкнувшихся с задачей.",
    work: [
      "Редактура инструкции",
      "Проверка на читателях",
      "Комплект документации",
    ],
    points: [31, 27, 32],
    closed: true,
  },
];

const design: CourseFixture[] = [
  {
    slug: "editorial-studio",
    name: "Студия редакционного дизайна",
    lecturer: 8,
    credits: 5,
    description:
      "Проектируем небольшое издание от структуры номера и пробного разворота до итогового макета.",
    work: [
      "Модульная сетка журнала",
      "Разворот с иллюстрациями",
      "Защита редакционного проекта",
    ],
    points: [29, 25, 31],
  },
  {
    slug: "motion-design",
    name: "Моушн-дизайн интерфейсов",
    lecturer: 15,
    credits: 4,
    description:
      "Разбираем движение как часть обратной связи и проектируем переходы с учётом разных настроек пользователя.",
    work: ["Карта состояний", "Прототип перехода", "Микроанимации для сервиса"],
    points: [32, 27, null],
  },
  {
    slug: "interaction-games",
    name: "Проектирование игровых механик",
    lecturer: 26,
    credits: 4,
    description:
      "Создаём прототипы настольных игр, проводим плейтесты и изучаем, какие правила мешают участникам.",
    work: [
      "Бумажный прототип",
      "Протокол плейтеста",
      "Итоговый комплект правил",
    ],
    points: [23, 21, null],
  },
];

const engineering: CourseFixture[] = [
  {
    slug: "service-reliability",
    name: "Надёжность программных сервисов",
    lecturer: 11,
    credits: 5,
    description:
      "Разбираем отказ учебного сервиса по журналу событий, ищем источник и проверяем варианты восстановления.",
    work: [
      "Журнал учебного инцидента",
      "Метрики надёжности",
      "Разбор отказа сервиса",
    ],
    points: [32, 26, 30],
  },
  {
    slug: "network-practice",
    name: "Практикум по моделированию сетей",
    lecturer: 21,
    credits: 4,
    description:
      "Строим модель небольшой сети и наблюдаем, как изменение одного маршрута влияет на прохождение трафика.",
    work: [
      "Модель сети кампуса",
      "Эксперимент с маршрутом",
      "Проверка резервного пути",
    ],
    points: [29, 24, null],
  },
  {
    slug: "model-evaluation",
    name: "Оценка моделей машинного обучения",
    lecturer: 29,
    credits: 4,
    description:
      "Сравниваем качество моделей, разбираем ошибки на редких случаях и документируем ограничения выборки.",
    work: [
      "Отчёт о простом решении",
      "Разбор ошибок",
      "Сравнение двух моделей",
    ],
    points: [23, 21, null],
  },
];

const campuses = [
  {
    programId: "design",
    groupId: "d-21",
    studentId: "student-a",
    courses: design,
  },
  {
    programId: "engineering",
    groupId: "p-22",
    studentId: "student-b",
    courses: engineering,
  },
];

const scoreBands = [
  [6.4, 5],
  [6.8, 8],
  [7.2, 12],
  [7.6, 15],
  [8, 21],
  [8.35, 24],
  [8.65, 17],
  [9, 11],
  [9.35, 6],
  [9.7, 3],
] as const;

export async function seedAcademicEdition() {
  const [seed, reference] = await Promise.all([
    db.seedRun.findUniqueOrThrow({ where: { id: "v1" } }),
    db.course.findUniqueOrThrow({
      where: { id: "course-6" },
      select: { scheme: true },
    }),
  ]);
  const base = seed.baseDate;
  const year = academicYear(base);
  const yearStart = `${year}-09-01`;
  const scheme = schemeSchema.parse(reference.scheme);
  const attendance = attendanceStats([], scheme, 0);
  const midnight = (day: string) => atTime(day, "00:00");
  const earlier = (days: number) => {
    const date = addDays(base, -days);
    return date < yearStart ? yearStart : date;
  };
  const lastPublished = midnight(base);
  const edition = [...common, ...design, ...engineering];

  await db.$transaction(
    async (tx) => {
      for (const [index, course] of edition.entries()) {
        const audience = campuses.filter(
          (campus) =>
            common.includes(course) || campus.courses.includes(course),
        );
        const courseId = `course-edition-${course.slug}`;
        const semester = 3;
        const assessmentType = "Экзамен";
        const completed = course.closed || false;
        const metadata = {
          semester,
          lecturerId: `lecturer-${course.lecturer}`,
          assessmentType,
          description: course.description,
        };
        await tx.course.upsert({
          where: { id: courseId },
          update: {},
          create: {
            id: courseId,
            code: `ED-${course.slug.toUpperCase()}`,
            name: course.name,
            scheme,
            ...metadata,
          },
        });
        await tx.curriculumItem.createMany({
          data: audience.map(({ programId }) => ({
            id: `plan-${programId}-${courseId}`,
            programId,
            courseId,
            semester,
            title: course.name,
            category: "Обязательная часть",
            credits: course.credits,
            hours: course.credits * 36,
            assessmentType,
            description: course.description,
          })),
          skipDuplicates: true,
        });

        const assessments = course.work.map((title, step) => ({
          id: `assessment-${courseId}-${step}`,
          courseId,
          title,
          maxPoints: [35, 30, 35][step],
          mandatory: step !== 1,
          dueAt: completed
            ? midnight(earlier([35, 19, 5][step]))
            : atTime(addDays(base, [-8, -2, 24 + index][step]), "18:00"),
          instruction:
            "Подготовьте работу и коротко объясните решения. Критерии оценивания указаны в программе дисциплины.",
        }));
        await tx.assessment.createMany({
          data: assessments,
          skipDuplicates: true,
        });

        for (const { studentId, groupId } of audience) {
          const enrollmentId = `enroll-${studentId}-${courseId}`;
          const results = assessments.map((assessment, step) => {
            const points = course.points[step];
            const status =
              points === null
                ? index % 3 === 0
                  ? "SUBMITTED"
                  : "UPCOMING"
                : completed || (step === 1 && index % 2 === 0)
                  ? "PUBLISHED"
                  : "CHECKED";
            return {
              enrollmentId,
              assessmentId: assessment.id,
              courseId,
              points,
              status,
              publishedAt: status === "PUBLISHED" ? lastPublished : null,
            };
          });
          const grade = gradeSummary(
            assessments.map((assessment, step) => ({
              ...assessment,
              results: [results[step]],
            })),
            scheme,
            attendance,
          );
          await tx.enrollment.upsert({
            where: { studentId_courseId: { studentId, courseId } },
            update: {},
            create: {
              id: enrollmentId,
              studentId,
              courseId,
              status: completed ? "COMPLETED" : "CURRENT",
              ...(completed
                ? {
                    officialGrade: String(grade.projectedGrade),
                    officialSchemeVersion: scheme.version,
                    officialAdjustment: 0,
                    publishedAt: lastPublished,
                  }
                : {}),
            },
          });
          await tx.result.createMany({ data: results, skipDuplicates: true });

          if (!completed) {
            const lessons = [-9 - index, 23 + index].map((day, step) => {
              const date = addDays(base, day);
              return {
                id: `lesson-${courseId}-${groupId}-${step}`,
                courseId,
                groupId,
                lecturerId: metadata.lecturerId,
                roomId: "room-0",
                title: course.name,
                kind: step ? "Семинар" : "Лекция",
                startsAt: atTime(date, "16:00"),
                endsAt: atTime(date, "17:30"),
              };
            });
            await tx.lesson.createMany({ data: lessons, skipDuplicates: true });
            await tx.attendance.createMany({
              data: [
                {
                  enrollmentId,
                  courseId,
                  lessonId: lessons[0].id,
                  status: "PRESENT",
                },
              ],
              skipDuplicates: true,
            });
          }
        }
      }

      await tx.ratingCohort.createMany({
        data: campuses.flatMap(({ programId }, program) =>
          [year, year - 1].map((academicYear, offset) => {
            const referenceCredits = offset ? 60 : 11;
            const scores = scoreBands.flatMap(([mean, size], band) =>
              Array.from(
                { length: size - (program && band % 2 ? 2 : 0) },
                (_, index) =>
                  Math.round(
                    referenceCredits * 100 * (mean + (index - size / 2) / 180),
                  ),
              ),
            );
            return {
              programId,
              academicYear,
              studyYear: 2 - offset,
              referenceCredits,
              scores,
              demo: true,
              publishedAt: offset ? midnight(`${year}-08-31`) : lastPublished,
            };
          }),
        ),
        skipDuplicates: true,
      });
    },
    { timeout: 20000 },
  );
}
