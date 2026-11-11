import { z } from "zod";
import { db } from "@/server/db";
import { type StudentContext } from "@/server/access";
import { invariant, notFound } from "@/server/errors";
import { dayStart, addDays, dateKey, TIMEZONE } from "@/shared/lib/time";
import {
  eventTypes,
  type CalendarEvent,
  type ScheduleSelection,
} from "./types";
import type { Prisma } from "@/generated/prisma/client";
export const calendarQuery = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
    types: z.array(z.enum(eventTypes)).default([...eventTypes]),
    course: z.string().max(100).optional(),
    schedules: z
      .array(
        z.object({
          kind: z.enum(["group", "lecturer", "room"]),
          id: z.string().max(100),
        }),
      )
      .max(2)
      .default([]),
    finance: z.boolean().default(false),
  })
  .refine(
    (v) =>
      v.to > v.from &&
      new Date(v.to).getTime() - new Date(v.from).getTime() <= 366 * 86400000,
    "Выберите диапазон до 12 месяцев.",
  );
export type CalendarQuery = z.input<typeof calendarQuery>;
export function parseCalendarQuery(params: URLSearchParams): CalendarQuery {
  return {
    from: params.get("from") ?? dateKey(),
    to: params.get("to") ?? addDays(dateKey(), 7),
    types: params.has("types")
      ? (params
          .get("types")!
          .split(",")
          .filter(Boolean) as (typeof eventTypes)[number][])
      : undefined,
    course: params.get("course") ?? undefined,
    schedules: (params.get("schedules") ?? "")
      .split(",")
      .filter(Boolean)
      .map((item) => {
        const [kind, id] = item.split(":");
        return { kind, id } as ScheduleSelection;
      }),
    finance: params.get("finance") === "true",
  };
}
export async function calendarEvents(
  student: Pick<StudentContext, "id" | "groupId">,
  raw: CalendarQuery,
  options: { includeDeleted?: boolean } = {},
): Promise<CalendarEvent[]> {
  const q = calendarQuery.parse(raw);
  const from = dayStart(q.from),
    to = dayStart(q.to);
  const enrollments = await db.enrollment.findMany({
    where: { studentId: student.id },
    select: { courseId: true },
  });
  const ownCourses = new Set(enrollments.map((e) => e.courseId));
  const own = { groupId: student.groupId, courseId: { in: [...ownCourses] } };
  const other: Prisma.LessonWhereInput[] = q.schedules.map((s) =>
    s.kind === "group"
      ? { groupId: s.id }
      : s.kind === "lecturer"
        ? { lecturerId: s.id }
        : { roomId: s.id },
  );
  const [
    lessons,
    assessments,
    projects,
    personal,
    imported,
    community,
    payments,
  ] = await Promise.all([
    q.types.some((t) => t === "LESSON" || t === "EXAM")
      ? db.lesson.findMany({
          where: {
            startsAt: { lt: to },
            endsAt: { gt: from },
            AND: [
              { OR: [own, ...other] },
              ...(q.course ? [{ courseId: q.course }] : []),
            ],
          },
          include: {
            room: true,
            lecturer: true,
            group: true,
            changes: { orderBy: { createdAt: "desc" }, take: 10 },
          },
          orderBy: { startsAt: "asc" },
          take: 10001,
        })
      : [],
    q.types.some((t) => t === "DEADLINE" || t === "EXAM")
      ? db.assessment.findMany({
          where: {
            course: { enrollments: { some: { studentId: student.id } } },
            ...(q.course ? { courseId: q.course } : {}),
            dueAt: { gte: from, lt: to },
          },
          include: {
            course: { select: { name: true } },
            results: {
              where: { enrollment: { studentId: student.id } },
              select: { status: true },
            },
          },
        })
      : [],
    q.types.includes("DEADLINE") && !q.course
      ? db.studentProject.findMany({
          where: { studentId: student.id, dueAt: { gte: from, lt: to } },
          select: {
            id: true,
            title: true,
            dueAt: true,
            status: true,
            sequence: true,
            updatedAt: true,
            requirements: true,
          },
        })
      : [],
    q.types.includes("PERSONAL") && !q.course
      ? db.personalEvent.findMany({
          where: {
            studentId: student.id,
            ...(options.includeDeleted ? {} : { deletedAt: null }),
            OR: [
              { startsAt: { lt: to }, endsAt: { gt: from } },
              { startDate: { lt: q.to }, endDate: { gt: q.from } },
            ],
          },
        })
      : [],
    q.types.includes("PERSONAL") && !q.course
      ? db.importedEvent.findMany({
          where: {
            source: {
              studentId: student.id,
              ...(options.includeDeleted ? {} : { deletedAt: null }),
            },
            OR: [
              { startsAt: { lt: to }, endsAt: { gt: from } },
              { startDate: { lt: q.to }, endDate: { gt: q.from } },
            ],
          },
          include: { source: { select: { id: true, name: true } } },
          take: 10001,
        })
      : [],
    q.types.includes("COMMUNITY") && !q.course
      ? db.savedEvent.findMany({
          where: {
            studentId: student.id,
            inCalendar: true,
            event: {
              startsAt: { lt: to },
              endsAt: { gt: from },
              OR: [{ groupId: null }, { groupId: student.groupId }],
            },
          },
          include: { event: true },
        })
      : [],
    q.finance && q.types.includes("DEADLINE")
      ? db.paymentSchedule.findMany({
          where: {
            contract: { studentId: student.id },
            dueAt: { gte: from, lt: to },
            paid: false,
          },
        })
      : [],
  ]);
  const retakes = q.types.includes("EXAM")
    ? await db.retake.findMany({
        where: {
          enrollment: {
            studentId: student.id,
            ...(q.course ? { courseId: q.course } : {}),
          },
          startsAt: { lt: to },
          endsAt: { gt: from },
        },
      })
    : [];
  const result: CalendarEvent[] = [];
  const defaults = {
    description: "",
    startsAt: null,
    endsAt: null,
    startDate: null,
    endDate: null,
    timezone: TIMEZONE,
    location: "",
    comparison: false,
    cancelled: false,
    sequence: 0,
    editable: false,
    source: "Учебное расписание",
  };
  for (const r of retakes)
    result.push({
      ...defaults,
      id: r.id,
      uid: `${r.id}@ryadom.local`,
      type: "EXAM",
      title: r.title,
      description: `${r.reason} ${r.consultation}`,
      exportDescription: r.consultation,
      startsAt: r.startsAt.toISOString(),
      endsAt: r.endsAt.toISOString(),
      location: r.location,
      source: "Пересдача",
      href: "/studies/results?status=attention",
      sequence: r.sequence,
      updatedAt: r.updatedAt.toISOString(),
    });
  for (const lesson of lessons) {
    const type = lesson.kind === "Экзамен" ? "EXAM" : "LESSON";
    if (!q.types.includes(type)) continue;
    result.push({
      ...defaults,
      id: lesson.id,
      uid: `${lesson.id}@ryadom.local`,
      type,
      title: lesson.title,
      description: lesson.kind,
      startsAt: lesson.startsAt.toISOString(),
      endsAt: lesson.endsAt.toISOString(),
      timezone: lesson.timezone,
      location: lesson.room
        ? `${lesson.room.building} · ${lesson.room.name}. ${lesson.room.address}. ${lesson.room.directions}`
        : "Онлайн",
      lecturer: lesson.lecturer.name,
      group: lesson.group.name,
      courseId: ownCourses.has(lesson.courseId) ? lesson.courseId : undefined,
      href: ownCourses.has(lesson.courseId)
        ? `/studies/courses/${lesson.courseId}`
        : undefined,
      url: lesson.onlineUrl ?? undefined,
      comparison:
        lesson.groupId !== student.groupId || !ownCourses.has(lesson.courseId),
      cancelled: lesson.cancelled,
      sequence: lesson.sequence,
      updatedAt: lesson.updatedAt.toISOString(),
      changes: lesson.changes.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
      })),
    });
  }
  for (const a of assessments) {
    const type = a.kind === "EXAM" ? "EXAM" : "DEADLINE";
    if (!q.types.includes(type)) continue;
    result.push({
      ...defaults,
      id: a.id,
      uid: `${a.id}@ryadom.local`,
      type,
      title: a.title,
      description: a.instruction,
      startsAt: a.dueAt.toISOString(),
      endsAt: new Date(a.dueAt.getTime() + 60000).toISOString(),
      courseId: a.courseId,
      href: `/studies/courses/${a.courseId}?tab=materials`,
      source: a.course.name,
      sequence: a.sequence,
      updatedAt: a.updatedAt.toISOString(),
      status: a.results[0]?.status ?? "UPCOMING",
    });
  }
  for (const p of projects)
    result.push({
      ...defaults,
      id: p.id,
      uid: `${p.id}@ryadom.local`,
      type: "DEADLINE",
      title: `Отчёт: ${p.title}`,
      description: p.requirements,
      startsAt: p.dueAt.toISOString(),
      endsAt: new Date(p.dueAt.getTime() + 60000).toISOString(),
      href: `/studies/projects/${p.id}`,
      source: "Учебная работа",
      sequence: p.sequence,
      updatedAt: p.updatedAt.toISOString(),
      status: p.status,
    });
  for (const p of personal)
    result.push({
      ...defaults,
      id: p.id,
      uid: `${p.id}@ryadom.local`,
      type: "PERSONAL",
      title: p.title,
      description: p.description,
      startsAt: p.startsAt?.toISOString() ?? null,
      endsAt: p.endsAt?.toISOString() ?? null,
      startDate: p.startDate,
      endDate: p.endDate,
      timezone: p.timezone,
      url: p.url ?? undefined,
      source: "Личный календарь",
      editable: true,
      cancelled: !!p.deletedAt,
      sequence: p.sequence,
      updatedAt: p.updatedAt.toISOString(),
    });
  for (const p of imported)
    result.push({
      ...defaults,
      id: p.id,
      uid: `${p.id}@ryadom.local`,
      type: "PERSONAL",
      title: p.title,
      description: p.description,
      location: p.location,
      startsAt: p.startsAt?.toISOString() ?? null,
      endsAt: p.endsAt?.toISOString() ?? null,
      startDate: p.startDate,
      endDate: p.endDate,
      timezone: p.timezone,
      url: p.url ?? undefined,
      source: `Импорт · ${p.source.name}`,
      sourceId: p.source.id,
      cancelled: p.cancelled,
      sequence: p.sequence,
      updatedAt: p.updatedAt.toISOString(),
    });
  for (const { event: e } of community)
    result.push({
      ...defaults,
      id: e.id,
      uid: `${e.id}@ryadom.local`,
      type: "COMMUNITY",
      title: e.title,
      description: e.description,
      location: e.location,
      startsAt: e.startsAt.toISOString(),
      endsAt: e.endsAt.toISOString(),
      href: `/community/${e.id}`,
      source: e.organizer,
      sequence: e.sequence,
      updatedAt: e.updatedAt.toISOString(),
    });
  for (const p of payments)
    result.push({
      ...defaults,
      id: p.id,
      uid: `${p.id}@ryadom.local`,
      type: "DEADLINE",
      title: "Срок оплаты по договору",
      startsAt: p.dueAt.toISOString(),
      endsAt: new Date(p.dueAt.getTime() + 60000).toISOString(),
      href: "/finance?tab=contracts",
      source: "Финансовый срок",
      updatedAt: p.dueAt.toISOString(),
    });
  invariant(
    result.length <= 10000,
    422,
    "RANGE_LIMIT",
    "Слишком много событий. Уменьшите диапазон.",
  );
  return result.sort((a, b) =>
    (a.startsAt ?? a.startDate ?? "").localeCompare(
      b.startsAt ?? b.startDate ?? "",
    ),
  );
}
export async function calendarEvent(student: StudentContext, id: string) {
  // Discover only the date; calendarEvents performs the complete ownership/public-schedule predicate.
  const lesson = await db.lesson.findUnique({
    where: { id },
    select: { startsAt: true, groupId: true },
  });
  if (lesson) {
    const events = await calendarEvents(student, {
      from: dateKey(lesson.startsAt),
      to: addDays(dateKey(lesson.startsAt), 1),
      schedules: [{ kind: "group", id: lesson.groupId }],
    });
    const item = events.find((e) => e.id === id);
    if (item) return item;
  }
  throw notFound();
}
