import { db } from "../src/server/db";
import {
  attendanceStats,
  gradeSummary,
  schemeSchema,
} from "../src/modules/assessment/domain";
import { addDays, atTime } from "../src/shared/lib/time";

type DemoCourse = readonly [
  code: string,
  name: string,
  semester: 1 | 2,
  lecturer: number,
  description: string,
  assessment: string,
  points: number,
];

const common: DemoCourse[] = [
  [
    "GEN-101",
    "Академическое письмо",
    1,
    4,
    "Структура аргумента, работа с источниками и редактирование учебных текстов.",
    "Аргументированное эссе",
    87,
  ],
  [
    "GEN-102",
    "Линейная алгебра",
    1,
    2,
    "Векторы, матрицы, системы линейных уравнений и их применение.",
    "Решение задач по линейной алгебре",
    83,
  ],
  [
    "GEN-103",
    "Английский язык для академических целей",
    2,
    4,
    "Чтение научных текстов, подготовка аннотаций и выступлений.",
    "Презентация по научной статье",
    92,
  ],
  [
    "GEN-104",
    "Основы прикладной статистики",
    2,
    2,
    "Описание выборок, оценка параметров и проверка гипотез.",
    "Анализ данных опроса",
    89,
  ],
];

const design: DemoCourse[] = [
  [
    "DP-101",
    "Визуальные коммуникации",
    1,
    0,
    "Визуальная иерархия, композиция и работа с цветом.",
    "Серия плакатов для выставки",
    96,
  ],
  [
    "DP-102",
    "История дизайна",
    1,
    5,
    "Школы дизайна и развитие графики и предметной среды в XX веке.",
    "Сравнительный анализ двух школ дизайна",
    86,
  ],
  [
    "DP-103",
    "Типографика и вёрстка",
    1,
    0,
    "Шрифтовые пары, модульные сетки и вёрстка многостраничных изданий.",
    "Вёрстка журнального разворота",
    91,
  ],
  [
    "DP-104",
    "Психология восприятия",
    2,
    3,
    "Внимание, память и закономерности зрительного восприятия.",
    "Разбор визуальных сценариев",
    88,
  ],
  [
    "DP-105",
    "Информационный дизайн",
    2,
    5,
    "Понятное представление сложных данных в таблицах, схемах и графиках.",
    "Инфографика о городской среде",
    94,
  ],
  [
    "DP-106",
    "Прототипирование цифровых продуктов",
    2,
    6,
    "Пользовательские сценарии, интерактивные прототипы и проверка гипотез.",
    "Прототип сервиса записи",
    95,
  ],
];

const engineering: DemoCourse[] = [
  [
    "PI-101",
    "Основы программирования",
    1,
    1,
    "Базовые алгоритмы, функции, работа с файлами и тестирование.",
    "Консольное приложение для обработки данных",
    93,
  ],
  [
    "PI-102",
    "Дискретная математика",
    1,
    2,
    "Множества, логика, комбинаторика и графы.",
    "Задачи по комбинаторике и графам",
    87,
  ],
  [
    "PI-103",
    "Архитектура вычислительных машин",
    1,
    7,
    "Наборы команд, организация памяти и взаимодействие компонентов компьютера.",
    "Разбор программы на ассемблере",
    85,
  ],
  [
    "PI-104",
    "Объектно-ориентированное программирование",
    2,
    1,
    "Инкапсуляция, композиция и проектирование интерфейсов классов.",
    "Проект каталога библиотеки",
    91,
  ],
  [
    "PI-105",
    "Тестирование программного обеспечения",
    2,
    6,
    "Проектирование тестов, граничные случаи и автоматизация проверок.",
    "Набор тестов для веб-сервиса",
    96,
  ],
  [
    "PI-106",
    "Математический анализ",
    2,
    2,
    "Пределы, производные и интегралы в прикладных задачах.",
    "Задачи на дифференцирование и интегрирование",
    82,
  ],
];

export async function seedCompletedCourses() {
  const [initial, reference] = await Promise.all([
    db.seedRun.findUniqueOrThrow({ where: { id: "v1" } }),
    db.course.findUniqueOrThrow({ where: { id: "course-6" } }),
  ]);
  const scheme = schemeSchema.parse(reference.scheme);
  const attendance = attendanceStats([], scheme, 0);
  const groups = [
    { courses: common, students: ["student-a", "student-b"] },
    { courses: design, students: ["student-a"] },
    { courses: engineering, students: ["student-b"] },
  ];

  for (const { courses, students } of groups) {
    for (const [
      code,
      name,
      semester,
      lecturer,
      description,
      title,
      points,
    ] of courses) {
      const courseId = `course-archive-${code.toLowerCase()}`;
      const assessmentId = `assessment-${courseId}`;
      const base = addDays(initial.baseDate, semester === 1 ? -300 : -150);
      const dueAt = atTime(base, "18:00");
      const publishedAt = atTime(addDays(base, 2), "10:00");
      const assessment = {
        id: assessmentId,
        title,
        maxPoints: 100,
        mandatory: true,
        dueAt,
      };
      const result = { points, status: "PUBLISHED", publishedAt };
      const { projectedGrade } = gradeSummary(
        [{ ...assessment, results: [result] }],
        scheme,
        attendance,
      );

      await db.$transaction([
        db.course.upsert({
          where: { id: courseId },
          update: {},
          create: {
            id: courseId,
            code,
            name,
            semester,
            description,
            assessmentType: "Экзамен",
            lecturerId: `lecturer-${lecturer}`,
            scheme,
          },
        }),
        db.assessment.upsert({
          where: { id: assessmentId },
          update: {},
          create: {
            courseId,
            ...assessment,
            instruction:
              "Итоговая работа завершена и проверена преподавателем.",
          },
        }),
        ...students.flatMap((studentId) => {
          const enrollmentId = `enroll-${studentId}-${courseId}`;
          return [
            db.enrollment.upsert({
              where: { studentId_courseId: { studentId, courseId } },
              update: {},
              create: {
                id: enrollmentId,
                studentId,
                courseId,
                status: "COMPLETED",
                officialGrade: String(projectedGrade),
                officialSchemeVersion: scheme.version,
                officialAdjustment: 0,
                publishedAt,
              },
            }),
            db.result.upsert({
              where: {
                enrollmentId_assessmentId: { enrollmentId, assessmentId },
              },
              update: {},
              create: { enrollmentId, assessmentId, courseId, ...result },
            }),
          ];
        }),
      ]);
    }
  }
}
