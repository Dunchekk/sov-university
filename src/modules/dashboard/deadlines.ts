import { db } from "@/server/db";

const completedStatuses = ["PUBLISHED", "SUBMITTED", "COMPLETED"];
const limit = 6;

export async function dashboardDeadlines(studentId: string, now: Date) {
  const load = async (overdue: boolean, take: number) => {
    const dueAt = overdue ? { lt: now } : { gte: now };
    const direction = overdue ? ("desc" as const) : ("asc" as const);
    const orderBy = [{ dueAt: direction }, { id: "asc" as const }];
    const [assessments, projects] = await Promise.all([
      db.assessment.findMany({
        where: {
          dueAt,
          kind: { not: "EXAM" },
          course: { enrollments: { some: { studentId } } },
          results: {
            none: {
              enrollment: { studentId },
              status: { in: completedStatuses },
            },
          },
        },
        select: {
          id: true,
          title: true,
          dueAt: true,
          course: { select: { id: true, name: true } },
        },
        orderBy,
        take,
      }),
      db.studentProject.findMany({
        where: { studentId, dueAt, status: { notIn: completedStatuses } },
        select: { id: true, title: true, dueAt: true },
        orderBy,
        take,
      }),
    ]);
    return [
      ...assessments.map(({ course, ...item }) => ({
        ...item,
        discipline: course.name,
        href: `/studies/courses/${course.id}?tab=materials`,
      })),
      ...projects.map(({ title, ...item }) => ({
        ...item,
        title: `Отчёт: ${title}`,
        discipline: null,
        href: `/studies/projects/${item.id}`,
      })),
    ]
      .sort((a, b) =>
        overdue
          ? b.dueAt.getTime() - a.dueAt.getTime()
          : a.dueAt.getTime() - b.dueAt.getTime(),
      )
      .slice(0, take);
  };

  const [overdue, upcoming] = await Promise.all([
    load(true, 1),
    load(false, limit),
  ]);
  return [...overdue, ...upcoming].slice(0, limit);
}
