import { containsText } from "@/shared/lib/filters";
import { db } from "@/server/db";
import type { StudentContext } from "@/server/access";
import { communityAudience } from "@/modules/community/service";
import { dateKey, formatDate } from "@/shared/lib/time";
import type { SearchResult, SearchScope } from "./types";

const sections = [
  ["/", "Главная", "личный кабинет"],
  ["/calendar", "Календарь", "расписание"],
  ["/studies/results", "Оценки и посещаемость", "баллы результаты пересдачи"],
  ["/studies/rating", "Рейтинг", "место gpa средний балл кредиты"],
  ["/studies/curriculum", "Учебный план", "семестры кредиты"],
  ["/studies/projects", "Практика и проекты", "курсовая стажировка"],
  ["/studies/achievements", "Достижения", ""],
  ["/services", "Справки и заявления", "каталог услуг"],
  ["/services?tab=requests", "Мои обращения", "история обращений"],
  ["/finance", "Финансы", "деньги бюджет"],
  ["/finance?tab=scholarships", "Стипендии", "стипендия"],
  ["/finance?tab=payments", "Выплаты", "деньги платежи"],
  ["/finance?tab=contracts", "Договоры", "оплата контракты"],
  ["/notifications", "Уведомления", ""],
  ["/settings", "Настройки", "тема оформление"],
  ["/profile", "Профиль", "личные данные"],
  ["/support", "Поддержка", "помощь"],
];

export async function search(
  student: StudentContext,
  q: string,
  scope: SearchScope = "all",
): Promise<SearchResult[]> {
  const term = q.trim().slice(0, 80);
  if (term.length < 2) return [];
  const contains = containsText(term);
  const includes = (category: SearchScope) =>
    scope === "all" || scope === category;
  const own = { studentId: student.id };
  const enrolled = { enrollments: { some: own } };
  const audience = communityAudience(student.groupId);
  const requestNumber = term.match(/^(?:№\s*)?(\d{1,9})$/)?.[1];
  const [
    courses,
    projects,
    lessons,
    personal,
    people,
    departments,
    services,
    requests,
    events,
    news,
  ] = await Promise.all([
    includes("study")
      ? db.course.findMany({
          where: {
            ...enrolled,
            OR: [{ name: contains }, { code: contains }],
          },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
          take: 5,
        })
      : [],
    includes("study")
      ? db.studentProject.findMany({
          where: { ...own, title: contains },
          select: { id: true, title: true },
          orderBy: { title: "asc" },
          take: 5,
        })
      : [],
    includes("calendar")
      ? db.lesson.findMany({
          where: {
            groupId: student.groupId,
            course: enrolled,
            OR: [{ title: contains }, { course: { name: contains } }],
          },
          select: { id: true, title: true, startsAt: true },
          orderBy: { startsAt: "desc" },
          take: 5,
        })
      : [],
    includes("calendar")
      ? db.personalEvent.findMany({
          where: { ...own, deletedAt: null, title: contains },
          select: { id: true, title: true, startDate: true, startsAt: true },
          orderBy: { updatedAt: "desc" },
          take: 5,
        })
      : [],
    includes("people")
      ? db.person.findMany({
          where: { name: contains },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
          take: 5,
        })
      : [],
    includes("people")
      ? db.department.findMany({
          where: { OR: [{ name: contains }, { description: contains }] },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
          take: 5,
        })
      : [],
    includes("services")
      ? db.service.findMany({
          where: {
            active: true,
            OR: [{ title: contains }, { keywords: contains }],
          },
          select: { slug: true, title: true },
          orderBy: { title: "asc" },
          take: 5,
        })
      : [],
    includes("services")
      ? db.studentRequest.findMany({
          where: {
            ...own,
            ...(requestNumber
              ? { number: Number(requestNumber) }
              : { service: { title: contains } }),
          },
          select: {
            id: true,
            number: true,
            status: true,
            service: { select: { slug: true, title: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: 5,
        })
      : [],
    includes("events")
      ? db.communityEvent.findMany({
          where: {
            ...audience,
            title: contains,
          },
          select: { id: true, title: true },
          orderBy: { startsAt: "desc" },
          take: 5,
        })
      : [],
    includes("news")
      ? db.newsPost.findMany({
          where: {
            ...audience,
            title: contains,
            publishedAt: { lte: new Date() },
          },
          select: { id: true, title: true },
          orderBy: { publishedAt: "desc" },
          take: 5,
        })
      : [],
  ]);
  return [
    ...courses.map((v) => ({
      id: v.id,
      title: v.name,
      type: "Дисциплины",
      href: `/studies/courses/${v.id}`,
    })),
    ...projects.map((v) => ({
      ...v,
      type: "Проекты",
      href: `/studies/projects/${v.id}`,
    })),
    ...lessons.map(({ id, title, startsAt }) => ({
      id,
      title: `${title} · ${formatDate(startsAt)}`,
      type: "Расписание",
      href: `/calendar?date=${dateKey(startsAt)}&event=${id}`,
    })),
    ...personal.map(({ id, title, startDate, startsAt }) => ({
      id,
      title,
      type: "Личные события",
      href: `/calendar?date=${startDate ?? dateKey(startsAt ?? undefined)}&event=${id}`,
    })),
    ...people.map((v) => ({
      id: v.id,
      title: v.name,
      type: "Преподаватели",
      href: `/people/${v.id}`,
    })),
    ...departments.map((v) => ({
      id: v.id,
      title: v.name,
      type: "Подразделения",
      href: `/people?tab=departments&q=${encodeURIComponent(v.name)}`,
    })),
    ...services.map((v) => ({
      id: v.slug,
      title: v.title,
      type: "Услуги",
      href: `/services/${v.slug}`,
    })),
    ...requests.map((v) => ({
      id: v.id,
      title: `${v.service.title} · № ${String(v.number).padStart(5, "0")}`,
      type: "Обращения",
      href:
        v.status === "DRAFT"
          ? `/services/${v.service.slug}?draft=${v.id}`
          : `/requests/${v.id}`,
    })),
    ...events.map((v) => ({
      id: v.id,
      title: v.title,
      type: "События",
      href: `/community/${v.id}`,
    })),
    ...news.map((v) => ({
      ...v,
      type: "Новости",
      href: `/community/news/${v.id}`,
    })),
    ...(scope === "all"
      ? sections
          .filter(([, title, keywords]) =>
            `${title} ${keywords}`
              .toLocaleLowerCase("ru")
              .includes(term.toLocaleLowerCase("ru")),
          )
          .map(([href, title]) => ({
            id: href,
            href,
            title,
            type: "Разделы кабинета",
          }))
      : []),
  ];
}
