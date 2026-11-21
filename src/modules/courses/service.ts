import { db } from "@/server/db";
import { requireEnrollment, type StudentContext } from "@/server/access";
import type { Prisma } from "@/generated/prisma/client";
import {
  attendanceStats,
  gradeSummary,
  schemeSchema,
} from "@/modules/assessment/domain";
type CourseEnrollment = Awaited<ReturnType<typeof requireEnrollment>>;

async function loadCourseResults(
  student: StudentContext,
  enrollments: CourseEnrollment[],
) {
  if (enrollments.length === 0) return [];
  const now = new Date();
  const enrollmentId = { in: enrollments.map((enrollment) => enrollment.id) };
  const courseId = { in: enrollments.map((enrollment) => enrollment.courseId) };
  const teaching = {
    courseId,
    groupId: student.groupId,
    kind: { not: "Экзамен" },
  };
  const [lessons, remaining, assessments] = await Promise.all([
    db.lesson.findMany({
      where: { ...teaching, endsAt: { lte: now } },
      select: {
        id: true,
        courseId: true,
        startsAt: true,
        endsAt: true,
        title: true,
        cancelled: true,
        attendance: {
          where: { enrollmentId },
          select: { id: true, status: true },
        },
      },
      orderBy: { startsAt: "desc" },
    }),
    db.lesson.groupBy({
      by: ["courseId"],
      where: {
        ...teaching,
        startsAt: { gt: now },
        cancelled: false,
      },
      _count: { _all: true },
    }),
    db.assessment.findMany({
      where: { courseId },
      include: { results: { where: { enrollmentId } } },
      orderBy: { dueAt: "asc" },
    }),
  ]);
  const lessonsByCourse = Map.groupBy(lessons, (lesson) => lesson.courseId);
  const assessmentsByCourse = Map.groupBy(assessments, (item) => item.courseId);
  const remainingByCourse = new Map(
    remaining.map((group) => [group.courseId, group._count._all]),
  );
  return enrollments.map((enrollment) => {
    // Composite foreign keys bind attendance and results to the same course
    // as their enrollment. Each student has one enrollment per course.
    const records = (lessonsByCourse.get(enrollment.courseId) ?? []).map(
      (lesson) => ({
        id: lesson.attendance[0]?.id ?? `unrecorded:${lesson.id}`,
        status: lesson.attendance[0]?.status ?? "UNRECORDED",
        lesson: {
          startsAt: lesson.startsAt,
          endsAt: lesson.endsAt,
          cancelled: lesson.cancelled,
          title: lesson.title,
        },
      }),
    );
    const scheme = schemeSchema.parse(enrollment.course.scheme);
    const items = assessmentsByCourse.get(enrollment.courseId) ?? [];
    const attendance = attendanceStats(
      records,
      scheme,
      remainingByCourse.get(enrollment.courseId) ?? 0,
    );
    const grade = gradeSummary(items, scheme, attendance);
    return {
      enrollment,
      scheme,
      attendance,
      grade,
      assessments: items,
      records,
    };
  });
}

export async function courseResult(student: StudentContext, courseId: string) {
  const enrollment = await requireEnrollment(student, courseId);
  const [result] = await loadCourseResults(student, [enrollment]);
  return result;
}
export async function myCourses(
  student: StudentContext,
  filter: Pick<Prisma.EnrollmentWhereInput, "status"> = {},
) {
  const enrollments = await db.enrollment.findMany({
    where: { studentId: student.id, status: filter.status },
    include: { course: { include: { lecturer: true } } },
  });
  return loadCourseResults(student, enrollments);
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
