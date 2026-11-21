import "dotenv/config";
import { academicExtras } from "./academic-extras";
import { seedCommunity } from "./seed-community";
import { seedCompletedCourses } from "./seed-completed-courses";
import { seedCourseMaterials } from "./seed-course-materials";
import { seedLecturers } from "./seed-lecturers";
import { db } from "../src/server/db";
import { hashPassword } from "../src/server/password";
import { addDays, atTime, dateKey } from "../src/shared/lib/time";
import { catalog } from "../src/modules/requests/catalog";
import { demoPdf } from "./demo-pdf";
import { randomBytes, createHash } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Prisma } from "../src/generated/prisma/client";

async function main() {
  await seedLecturers();
  const base = process.env.DEMO_BASE_DATE || dateKey();
  if (
    !process.env.REGENERATE_DEMO_FILES &&
    (await db.seedRun.findUnique({ where: { id: "v1" } }))
  ) {
    await seedCommunity(base);
    console.log("Demo уже загружено; изменения сохранены.");
    return;
  }
  const day = (n: number, time = "10:00") => atTime(addDays(base, n), time);
  const credentialsPath =
    process.env.DEMO_CREDENTIALS_FILE ?? ".local/demo-credentials.json";
  const storage = process.env.STORAGE_DIR ?? ".data/files";
  await mkdir(storage, { recursive: true });
  await mkdir(".local", { recursive: true });
  const pdf = async (
    id: string,
    title: string,
    lines: string[],
    refs: Partial<Prisma.FileObjectUncheckedCreateInput>,
  ) => {
    const exists = await db.fileObject.findUnique({ where: { id } });
    if (exists && !process.env.REGENERATE_DEMO_FILES) return exists;
    const bytes = await demoPdf(title, lines);
    const storageKey = `seed-${id}`;
    await writeFile(join(storage, storageKey), bytes, { mode: 0o600 });
    return db.fileObject.upsert({
      where: { id },
      update: {
        size: bytes.length,
        checksum: createHash("sha256").update(bytes).digest("hex"),
      },
      create: {
        id,
        purpose: "COURSE_MATERIAL",
        originalName: `${title}.pdf`,
        storageKey,
        size: bytes.length,
        checksum: createHash("sha256").update(bytes).digest("hex"),
        ...refs,
      },
    });
  };
  for (const p of [
    {
      id: "design",
      name: "Цифровые продукты и дизайн",
      faculty: "Институт технологий и дизайна",
    },
    {
      id: "engineering",
      name: "Программная инженерия",
      faculty: "Институт информационных систем",
    },
  ])
    await db.program.upsert({ where: { id: p.id }, update: {}, create: p });
  for (const [id, name, programId, year] of [
    ["d-21", "ДП-21", "design", 2],
    ["p-22", "ПИ-22", "engineering", 2],
    ["d-31", "ДП-31", "design", 3],
    ["p-11", "ПИ-11", "engineering", 1],
  ] as const)
    await db.group.upsert({
      where: { id },
      update: {},
      create: { id, name, programId, year },
    });
  let credentials: Record<string, { email: string; password: string }> = {};
  try {
    credentials = JSON.parse(await readFile(credentialsPath, "utf8"));
  } catch {}
  for (const [index, id, name, email, groupId, funding] of [
    [
      0,
      "student-a",
      "Александра Миронова",
      "alexandra@demo.example.org",
      "d-21",
      "Бюджет",
    ],
    [
      1,
      "student-b",
      "Михаил Соколов",
      "mikhail@demo.example.org",
      "p-22",
      "Договор",
    ],
  ] as const) {
    const userId = `user-${id}`;
    const exists = await db.user.findUnique({ where: { id: userId } });
    if (!exists) {
      const password =
        (index === 0
          ? process.env.DEMO_PASSWORD_A
          : process.env.DEMO_PASSWORD_B) ??
        randomBytes(18).toString("base64url");
      const digest = await hashPassword(password);
      await db.user.create({
        data: {
          id: userId,
          name,
          email,
          emailVerified: true,
          accounts: {
            create: {
              id: `account-${id}`,
              accountId: userId,
              providerId: "credential",
              password: digest,
            },
          },
        },
      });
      credentials[id] = { email, password };
      await writeFile(credentialsPath, JSON.stringify(credentials, null, 2), {
        mode: 0o600,
      });
    }
    await db.student.upsert({
      where: { id },
      update: {},
      create: {
        id,
        userId,
        groupId,
        funding,
        privateDetails: {
          create: {
            contactEmail: `${id}@personal.example.org`,
            document: `DEMO-00000${index + 1}`,
            address: "Демонстрационный адрес, не является местом проживания",
          },
        },
        preference: {
          create: {
            notifications: {
              SCHEDULE: true,
              STUDY: true,
              REQUEST: true,
              COMMUNITY: true,
            },
          },
        },
      },
    });
    await db.personalEvent.upsert({
      where: { id: `personal-${id}` },
      update: {},
      create: {
        id: `personal-${id}`,
        studentId: id,
        title: index ? "Личная встреча Михаила" : "Встреча проектной команды",
        description: "Личная запись — видна только владельцу.",
        startsAt: day(1, "18:00"),
        endsAt: day(1, "19:00"),
      },
    });
    await db.studentOrder.upsert({
      where: { id: `order-${id}` },
      update: {},
      create: {
        id: `order-${id}`,
        studentId: id,
        title: "Перевод на второй курс",
        description:
          "Демонстрационный приказ ДЕМО-2026/42. Переведён на второй курс по итогам аттестации.",
        date: day(-70),
      },
    });
  }
  const names = [
    "Арина Фомина",
    "Даниил Морозов",
    "София Громова",
    "Лев Козлов",
    "Полина Зайцева",
    "Матвей Егоров",
    "Вера Никитина",
    "Тимофей Павлов",
    "Алиса Семёнова",
    "Роман Фёдоров",
    "Ева Медведева",
    "Максим Титов",
    "Кира Захарова",
    "Глеб Киселёв",
    "Дарья Антонова",
    "Иван Андреев",
    "Ника Васильева",
    "Степан Макаров",
    "Яна Борисова",
    "Марк Куликов",
    "Виктория Степанова",
    "Фёдор Романов",
    "Лидия Данилова",
    "Олег Сергеев",
    "Александра Миронова",
    "Михаил Соколов",
  ];
  for (let i = 0; i < names.length; i++)
    await db.rosterPerson.upsert({
      where: { id: `roster-${i}` },
      update: {},
      create: {
        id: `roster-${i}`,
        name: names[i],
        groupId: i < 18 || i === 24 ? "d-21" : "p-22",
      },
    });
  for (const [id, name, description, email, hours, location] of [
    [
      "office",
      "Учебный офис",
      "Справки, учебный план, перевод и ошибки в учебных данных.",
      "office@example.org",
      "Пн–Пт, 10:00–18:00",
      "Корпус А, кабинет 101",
    ],
    [
      "finance",
      "Финансовый отдел",
      "Договоры, начисления и финансовые документы.",
      "finance@example.org",
      "Пн–Пт, 10:00–17:00",
      "Корпус А, кабинет 108",
    ],
    [
      "support",
      "Служба поддержки",
      "Вопросы о работе личного кабинета.",
      "support@example.org",
      "Пн–Пт, 09:00–18:00",
      "Обращение через личный кабинет",
    ],
    [
      "library",
      "Библиотека",
      "Учебные ресурсы и работа с источниками.",
      "library@example.org",
      "Пн–Сб, 09:00–20:00",
      "Корпус Б, этаж 2",
    ],
  ])
    await db.department.upsert({
      where: { id },
      update: {},
      create: { id, name, description, email, hours, location },
    });
  for (let i = 0; i < 4; i++)
    await db.room.upsert({
      where: { id: `room-${i}` },
      update: {},
      create: {
        id: `room-${i}`,
        name: ["312", "405", "210", "Лаборатория 4"][i],
        building: i < 2 ? "Корпус А" : "Корпус Б",
        address: "Учебный городок, Демонстрационная улица, 1",
        directions:
          "От главного входа следуйте указателям к учебному лифту. Номер этажа соответствует первой цифре аудитории.",
      },
    });
  const courseNames = [
    "Проектирование интерфейсов",
    "Базы данных",
    "Математика для анализа данных",
    "Исследование пользовательского опыта",
    "Английский для профессии",
    "История цифровой культуры",
    "Введение в программирование",
    "Алгоритмы и структуры данных",
    "Компьютерные сети",
    "Архитектура программных систем",
  ];
  for (let i = 0; i < courseNames.length; i++) {
    const id = `course-${i}`;
    const completed = i === 6;
    const pass = i === 4 || i === 5;
    const scheme = {
      version: 1,
      type: pass ? "PASS" : "POINTS",
      admissionPoints: 50,
      passPoints: 60,
      attendanceThreshold: i === 0 ? 80 : 0,
      attendancePenalty: i === 0 ? 1 : 0,
      excludeExcused: true,
      thresholds: [
        { points: 0, grade: 1 },
        { points: 30, grade: 3 },
        { points: 50, grade: 4 },
        { points: 60, grade: 5 },
        { points: 65, grade: 6 },
        { points: 75, grade: 7 },
        { points: 85, grade: 8 },
        { points: 90, grade: 9 },
        { points: 95, grade: 10 },
      ],
    };
    await db.course.upsert({
      where: { id },
      update: {},
      create: {
        id,
        name: courseNames[i],
        code: `DP-${200 + i}`,
        semester: completed ? 2 : 3,
        description: `От теории к практике: ${courseNames[i].toLowerCase()}. Разбираем реальные задачи, обсуждаем решения и собираем собственный учебный проект.`,
        assessmentType: pass ? "Зачёт" : "Экзамен",
        lecturerId: `lecturer-${i % 8}`,
        scheme,
      },
    });
    const students =
      i < 7 ? ["student-a", ...(i === 1 ? ["student-b"] : [])] : ["student-b"];
    for (const studentId of students)
      await db.enrollment.upsert({
        where: { id: `enroll-${studentId}-${i}` },
        update: {},
        create: {
          id: `enroll-${studentId}-${i}`,
          studentId,
          courseId: id,
          status: completed ? "COMPLETED" : "CURRENT",
          ...(completed
            ? {
                officialGrade: "8",
                officialSchemeVersion: 1,
                officialAdjustment: 0,
                publishedAt: day(-80),
              }
            : {}),
        },
      });
    const assessed = [
      ["Практические работы", 30, -3, false],
      ["Контрольная работа", 20, -1, false],
      ["Лабораторная №3", 20, 3, true],
      ["Итоговый проект", 30, 14, true],
    ] as const;
    for (let j = 0; j < assessed.length; j++) {
      const [title, maxPoints, offset, mandatory] = assessed[j];
      const assessmentId = `assessment-${i}-${j}`;
      await db.assessment.upsert({
        where: { id: assessmentId },
        update: {},
        create: {
          id: assessmentId,
          courseId: id,
          title,
          maxPoints,
          mandatory,
          dueAt: day(completed ? -90 : offset + (i % 3), "23:59"),
          instruction:
            "Изучите методические материалы курса. Подготовьте решение по указанным критериям. Для передачи преподавателю используйте учебный офис; собственная сдача заданий в этом прототипе не предусмотрена.",
        },
      });
      for (const studentId of students) {
        const points = completed
          ? [27, 18, 18, 25][j]
          : j < 2
            ? studentId === "student-a"
              ? [26, 16][j]
              : [20, 12][j]
            : null;
        await db.result.upsert({
          where: {
            enrollmentId_assessmentId: {
              enrollmentId: `enroll-${studentId}-${i}`,
              assessmentId,
            },
          },
          update: {},
          create: {
            enrollmentId: `enroll-${studentId}-${i}`,
            assessmentId,
            courseId: id,
            points,
            status:
              points !== null
                ? "PUBLISHED"
                : j === 2 && i === 2
                  ? "SUBMITTED"
                  : "UPCOMING",
            publishedAt: points !== null ? day(-1) : null,
            comment:
              points !== null ? "Результат опубликован преподавателем." : null,
          },
        });
      }
    }
    await pdf(
      `material-${i}`,
      `Материалы: ${courseNames[i]}`,
      [
        "Учебное пособие для демонстрационного курса.",
        "1. Определите задачу и ограничения.",
        "2. Сравните несколько подходов и обоснуйте выбор.",
        "3. Подготовьте результат и краткое объяснение решения.",
        "Критерии: корректность, ясность, аргументация.",
      ],
      { courseId: id },
    );
    if (!completed) {
      for (const studentId of students) {
        const groupId = studentId === "student-a" ? "d-21" : "p-22";
        for (let n = -12; n <= 36; n++) {
          if (n >= 0 && n % 6 === 5) continue;
          const startsAt = day(
            n * 2 + (i % 2),
            ["09:00", "11:00", "13:00", "15:00"][i % 4],
          );
          const lessonId = `lesson-${i}-${groupId}-${n}`;
          const endsAt = new Date(startsAt.getTime() + 90 * 60000);
          const cancelled = n === 4 && i === 0;
          const moved = n === 2 && i === 1;
          await db.lesson.upsert({
            where: { id: lessonId },
            update: {},
            create: {
              id: lessonId,
              courseId: id,
              groupId,
              lecturerId: `lecturer-${i % 8}`,
              roomId: i === 4 ? null : `room-${moved ? 1 : i % 4}`,
              title: courseNames[i],
              kind: n % 2 ? "Семинар" : "Лекция",
              startsAt,
              endsAt,
              cancelled,
              sequence: moved || cancelled ? 1 : 0,
              onlineUrl: i === 4 ? "https://example.org/learning-room" : null,
            },
          });
          if (moved || cancelled)
            await db.scheduleChange.upsert({
              where: { id: `change-${lessonId}` },
              update: {},
              create: {
                id: `change-${lessonId}`,
                lessonId,
                kind: moved ? "ROOM" : "CANCEL",
                before: moved ? "Аудитория 312" : "Занятие по расписанию",
                after: moved ? "Аудитория 405" : "Занятие отменено",
                createdAt: day(0, "09:15"),
              },
            });
          if (n < 0) {
            const status =
              n === -12
                ? "EXCUSED"
                : n === -11
                  ? "UNRECORDED"
                  : i === 0 && n >= -3
                    ? "ABSENT"
                    : "PRESENT";
            await db.attendance.upsert({
              where: {
                enrollmentId_lessonId: {
                  enrollmentId: `enroll-${studentId}-${i}`,
                  lessonId,
                },
              },
              update: {},
              create: {
                enrollmentId: `enroll-${studentId}-${i}`,
                lessonId,
                courseId: id,
                status,
              },
            });
          }
        }
      }
    }
  }
  for (const programId of ["design", "engineering"])
    for (let semester = 1; semester <= 8; semester++)
      for (let i = 0; i < 4; i++) {
        const courseIndex = programId === "design" ? i : i === 0 ? 1 : 6 + i;
        const title =
          semester === 3
            ? courseNames[courseIndex]
            : semester === 8
              ? i === 0
                ? "Выпускная квалификационная работа"
                : [
                    "Преддипломная практика",
                    "Проектный семинар",
                    "Итоговая аттестация",
                  ][i - 1]
              : semester === 2 && i === 0
                ? "Введение в программирование"
                : `${["Основы профессии", "Проектный практикум", "Электив: визуальная культура", "Исследовательский семинар"][i]} ${semester}`;
        await db.curriculumItem.upsert({
          where: { id: `plan-${programId}-${semester}-${i}` },
          update: {},
          create: {
            id: `plan-${programId}-${semester}-${i}`,
            programId,
            semester,
            title,
            category:
              i === 2 ? "Электив" : i === 1 ? "Практика" : "Обязательная часть",
            credits: i === 0 ? 9 : 7,
            hours: (i === 0 ? 9 : 7) * 36,
            assessmentType: i === 0 ? "Экзамен" : "Зачёт",
            courseId:
              semester === 3
                ? `course-${courseIndex}`
                : semester === 2 && i === 0 && programId === "design"
                  ? "course-6"
                  : null,
            description:
              "Элемент учебного плана. Подробности и период выбора уточняйте в учебном офисе.",
          },
        });
      }
  for (const [i, studentId, title, kind, status] of [
    [0, "student-a", "Исследование городского сервиса", "Практика", "OPEN"],
    [1, "student-a", "Личный кабинет нового поколения", "Курсовая", "REVISION"],
    [
      2,
      "student-a",
      "Дизайн цифровых образовательных сервисов",
      "ВКР",
      "FUTURE",
    ],
    [
      3,
      "student-b",
      "Надёжный API учебной платформы",
      "Учебный проект",
      "OPEN",
    ],
  ] as const) {
    const id = `project-${i}`;
    await db.studentProject.upsert({
      where: { id },
      update: {},
      create: {
        id,
        studentId,
        title,
        kind,
        status,
        semester: i === 2 ? 8 : 3,
        supervisorId: `lecturer-${i}`,
        organization:
          kind === "Практика" ? "Учебная лаборатория университета" : null,
        description:
          "Самостоятельная работа с руководителем: от постановки задачи до защиты результата.",
        requirements:
          "Отчёт в PDF: задача, метод, результат, выводы и список источников. Оценивание: полнота 40%, обоснование 40%, оформление 20%.",
        allowLate: i === 1,
        dueAt: day(i === 2 ? 180 : 7 + i),
        startsAt: day(-14),
        feedback:
          i === 1
            ? "Уточните метод исследования и добавьте выводы по интервью."
            : null,
      },
    });
    for (let j = 0; j < 4; j++)
      await db.milestone.upsert({
        where: { id: `milestone-${i}-${j}` },
        update: {},
        create: {
          id: `milestone-${i}-${j}`,
          projectId: id,
          title: ["Тема согласована", "План исследования", "Отчёт", "Защита"][
            j
          ],
          dueAt: day(i === 2 ? 160 + j * 10 : -10 + j * 7),
          completed: j < 2 && i !== 2,
        },
      });
    await pdf(
      `template-${i}`,
      "Шаблон учебного отчёта",
      [
        "Тема работы",
        "1. Постановка задачи",
        "2. Метод и материалы",
        "3. Результаты и обсуждение",
        "4. Выводы",
        "5. Источники",
        "Не включайте реальные чувствительные сведения.",
      ],
      { studentId, projectId: id, purpose: "PROJECT_TEMPLATE" },
    );
    if (i === 0 || i === 1) {
      const file = await pdf(
        `submission-file-${i}`,
        `Отчёт: ${title}`,
        [
          "Первая демонстрационная версия отчёта.",
          "Здесь описывается учебный результат; проверка и оценка не выполняются автоматически.",
        ],
        { studentId, projectId: id, purpose: "PROJECT_UPLOAD" },
      );
      await db.submission.upsert({
        where: { id: `submission-${i}` },
        update: {},
        create: {
          id: `submission-${i}`,
          projectId: id,
          fileId: file.id,
          version: 1,
          comment: "Первая версия",
          status: i === 1 ? "REVISION" : "SUBMITTED",
          feedback:
            i === 1 ? "Добавьте выводы и уточните выборку исследования." : null,
          createdAt: day(-2),
        },
      });
    }
  }
  const achievementTitles = [
    "Победитель студенческого дизайн-хакатона",
    "Доклад на научном семинаре",
    "Волонтёр городского фестиваля",
    "Сборная по волейболу",
    "Выставка учебных проектов",
    "Публикация исследования",
    "Проект открытых данных",
  ];
  for (let i = 0; i < 7; i++)
    await db.achievement.upsert({
      where: { id: `achievement-${i}` },
      update: {},
      create: {
        id: `achievement-${i}`,
        studentId: i === 6 ? "student-b" : "student-a",
        title: achievementTitles[i],
        category: [
          "Учёба",
          "Наука",
          "Общественная деятельность",
          "Спорт",
          "Творчество",
          "Наука",
          "Учёба",
        ][i],
        date: addDays(base, -10 - i * 7),
        description:
          "Демонстрационное достижение в рамках университетской программы.",
        organizer: "Студенческий центр",
        status: [
          "CONFIRMED",
          "CONFIRMED",
          "SUBMITTED",
          "DRAFT",
          "NEEDS_INFO",
          "REJECTED",
          "CONFIRMED",
        ][i],
        evidenceUrl: "https://example.org/demo-achievement",
        reviewerComment:
          i === 4
            ? "Добавьте название площадки и дату выставки."
            : i === 5
              ? "Не хватает подтверждения авторства."
              : null,
      },
    });
  for (const item of catalog)
    await db.service.upsert({
      where: { slug: item.slug },
      update: {},
      create: { ...item },
    });
  const requestStates = [
    "SUBMITTED",
    "IN_REVIEW",
    "NEEDS_INFO",
    "READY",
    "DRAFT",
    "REJECTED",
    "CANCELLED",
    "ARCHIVED",
  ];
  for (let i = 0; i < 9; i++) {
    const studentId = i === 8 ? "student-b" : "student-a";
    const id = `request-${i}`;
    const status = i === 8 ? "READY" : requestStates[i];
    const service = catalog[i === 8 ? 6 : i === 2 ? 11 : 0];
    await db.studentRequest.upsert({
      where: { id },
      update: {},
      create: {
        id,
        studentId,
        serviceSlug: service.slug,
        status,
        fields: {
          recipient: "По месту требования",
          format: "electronic",
          language: "ru",
          copies: 1,
          ...(i === 2
            ? {
                category: "Учебный вопрос",
                subject: "Уточнение учебного плана",
                description: "Прошу уточнить период выбора элективов.",
              }
            : {}),
        },
        serviceSnapshot: {
          title: service.title,
          version: 1,
          department: service.department,
        },
        submittedAt: status === "DRAFT" ? null : day(-i - 1),
        dueAt: day(3),
        resultExpiresAt: status === "READY" ? day(60) : null,
        history: {
          create: {
            status,
            text:
              status === "NEEDS_INFO"
                ? "Уточните интересующий семестр."
                : status === "REJECTED"
                  ? "Выбранный документ не соответствует цели; учебный офис поможет выбрать услугу."
                  : "Демонстрационный пример обращения.",
            createdAt: day(-i),
          },
        },
        comments:
          status === "NEEDS_INFO"
            ? {
                create: {
                  authorName: "Учебный офис",
                  authorRole: "STAFF",
                  text: "Пожалуйста, уточните семестр и направление электива.",
                  createdAt: day(-1),
                },
              }
            : undefined,
      },
    });
    if (status === "READY")
      await pdf(
        `result-${i}`,
        service.title,
        [
          `Студент: ${i === 8 ? "Михаил Соколов" : "Александра Миронова"}.`,
          "Программа: демонстрационная образовательная программа.",
          "Настоящий документ создан только для проверки работы личного кабинета.",
        ],
        { studentId, requestId: id, purpose: "REQUEST_RESULT" },
      );
  }
  await db.campaign.upsert({
    where: { id: "campaign-enhanced" },
    update: {},
    create: {
      id: "campaign-enhanced",
      title: "Повышенная академическая стипендия",
      description: "Осенний конкурс студенческих достижений.",
      criteria:
        "Текущий студент, подтверждённые достижения и подача в срок. Решение принимает комиссия; заявка не гарантирует выплату.",
      startsAt: day(-7),
      endsAt: day(21, "23:59"),
      amountKopecks: 1200000,
    },
  });
  await db.scholarshipAward.upsert({
    where: { id: "award-a" },
    update: {},
    create: {
      id: "award-a",
      studentId: "student-a",
      campaignId: "campaign-enhanced",
      amountKopecks: 650000,
      startsAt: day(-60),
      endsAt: day(100),
    },
  });
  for (let i = 0; i < 5; i++)
    await db.payment.upsert({
      where: { id: `payment-${i}` },
      update: {},
      create: {
        id: `payment-${i}`,
        studentId: "student-a",
        title: "Академическая стипендия",
        period: `Учебный месяц ${i + 1}`,
        amountKopecks: 650000,
        status: i === 4 ? "EXPECTED" : "PAID",
        date: day((i - 3) * 30),
      },
    });
  await db.contract.upsert({
    where: { id: "contract-b" },
    update: {},
    create: {
      id: "contract-b",
      studentId: "student-b",
      number: "DEMO-ПИ-2026/022",
      payer: "Михаил Соколов (демонстрационные сведения)",
      title: "Обучение по программе «Программная инженерия»",
      totalKopecks: 32000000,
      status: "Действует",
      supplement:
        "Дополнительное соглашение: стоимость за учебный год, без индексации.",
    },
  });
  for (let i = 0; i < 4; i++)
    await db.paymentSchedule.upsert({
      where: { id: `contract-payment-${i}` },
      update: {},
      create: {
        id: `contract-payment-${i}`,
        contractId: "contract-b",
        dueAt: day(-60 + i * 70),
        amountKopecks: 8000000,
        paid: i === 0,
      },
    });
  await pdf(
    "contract-file",
    "Демонстрационный договор",
    [
      "Договор DEMO-ПИ-2026/022.",
      "Программа: Программная инженерия.",
      "Стоимость учебного года: 320 000 рублей.",
      "График: четыре платежа по 80 000 рублей.",
      "Документ не создаёт обязательств и не содержит платёжных реквизитов.",
    ],
    { studentId: "student-b", contractId: "contract-b", purpose: "CONTRACT" },
  );
  await seedCommunity(base);
  await db.savedEvent.upsert({
    where: {
      studentId_eventId: { studentId: "student-a", eventId: "event-0" },
    },
    update: {},
    create: {
      studentId: "student-a",
      eventId: "event-0",
      saved: true,
      inCalendar: true,
    },
  });
  for (const studentId of ["student-a", "student-b"]) {
    const notices = [
      [
        "SCHEDULE",
        "Аудитория изменилась",
        "Проверьте место следующей пары.",
        "/calendar",
      ],
      [
        "STUDY",
        "Опубликованы результаты",
        "Доступна расшифровка баллов по дисциплинам.",
        "/studies/results",
      ],
      [
        "REQUEST",
        "Обращение требует внимания",
        "Проверьте следующий шаг в обращении.",
        `/requests/${studentId === "student-a" ? "request-2" : "request-8"}`,
      ],
      [
        "COMMUNITY",
        "Открыта стипендиальная кампания",
        "Приём заявок до указанного срока.",
        "/finance?tab=scholarships",
      ],
      [
        "STUDY",
        "Срок сдачи отчёта приближается",
        "Откройте этапы и требования работы.",
        `/studies/projects/${studentId === "student-a" ? "project-0" : "project-3"}`,
      ],
    ];
    for (let i = 0; i < notices.length; i++) {
      const [category, title, body, href] = notices[i];
      await db.notification.upsert({
        where: { studentId_dedupKey: { studentId, dedupKey: `seed-${i}` } },
        update: {},
        create: {
          studentId,
          dedupKey: `seed-${i}`,
          category,
          title,
          body,
          href,
          createdAt: day(-i),
        },
      });
    }
  }
  await db.seedRun.upsert({
    where: { id: "v1" },
    update: {},
    create: { id: "v1", baseDate: base },
  });
  console.log(
    "Демонстрационные данные загружены. Доступы: .local/demo-credentials.json (не добавлять в Git).",
  );
}
main()
  .then(academicExtras)
  .then(seedCompletedCourses)
  .then(seedCourseMaterials)
  .then(async () => {
    const items = await db.achievement.findMany({
      where: { history: { none: {} } },
      select: { id: true, status: true },
    });
    for (const item of items)
      await db.achievementHistory.create({
        data: {
          achievementId: item.id,
          status: item.status,
          text: "Подготовленное демонстрационное состояние.",
        },
      });
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
