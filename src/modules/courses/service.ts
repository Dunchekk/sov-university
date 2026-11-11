import { db } from "@/server/db";
import { requireEnrollment, type StudentContext } from "@/server/access";
import {
  attendanceStats,
  gradeSummary,
  schemeSchema,
} from "@/modules/assessment/domain";
export async function courseResult(student: StudentContext, courseId: string) {
  const enrollment = await requireEnrollment(student, courseId);
  const scheme = schemeSchema.parse(enrollment.course.scheme);
  const [lessons, remaining, assessments] = await Promise.all([
    db.lesson.findMany({
      where: {
        courseId,
        groupId: student.groupId,
        endsAt: { lte: new Date() },
        kind: { not: "Экзамен" },
      },
      include: {
        attendance: {
          where: { enrollmentId: enrollment.id },
          select: { id: true, status: true },
        },
      },
      orderBy: { startsAt: "desc" },
    }),
    db.lesson.count({
      where: {
        courseId,
        groupId: student.groupId,
        startsAt: { gt: new Date() },
        cancelled: false,
        kind: { not: "Экзамен" },
      },
    }),
    db.assessment.findMany({
      where: { courseId },
      include: { results: { where: { enrollmentId: enrollment.id } } },
      orderBy: { dueAt: "asc" },
    }),
  ]);
  const records = lessons.map((lesson) => ({
    id: lesson.attendance[0]?.id ?? `unrecorded:${lesson.id}`,
    status: lesson.attendance[0]?.status ?? "UNRECORDED",
    lesson: {
      startsAt: lesson.startsAt,
      endsAt: lesson.endsAt,
      cancelled: lesson.cancelled,
      title: lesson.title,
    },
  }));
  const attendance = attendanceStats(records, scheme, remaining);
  const grade = gradeSummary(assessments, scheme, attendance);
  return { enrollment, scheme, attendance, grade, assessments, records };
}
export async function myCourses(student: StudentContext) {
  const enrolled = await db.enrollment.findMany({
    where: { studentId: student.id },
    select: { courseId: true },
  });
  return Promise.all(enrolled.map((e) => courseResult(student, e.courseId)));
}
export async function roster(
  student: StudentContext,
  courseId: string,
  q = "",
  group?: string,
  page = 1,
) {
  await requireEnrollment(student, courseId);
  const groups = await db.lesson.findMany({
    where: { courseId },
    select: { groupId: true },
    distinct: ["groupId"],
  });
  const ids = groups.map((g) => g.groupId);
  const where = {
    groupId: { in: group && ids.includes(group) ? [group] : ids },
    name: { contains: q.slice(0, 80), mode: "insensitive" as const },
  };
  const [items, total] = await Promise.all([
    db.rosterPerson.findMany({
      where,
      select: { id: true, name: true, group: { select: { name: true } } },
      orderBy: { name: "asc" },
      take: 20,
      skip: (Math.min(100, Math.max(1, page)) - 1) * 20,
    }),
    db.rosterPerson.count({ where }),
  ]);
  return { items, total };
}
