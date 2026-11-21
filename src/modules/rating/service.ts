import type { StudentContext } from "@/server/access";
import { db } from "@/server/db";
import { academicYear, ratingSummary } from "./domain";

export async function studentRating(
  student: Pick<StudentContext, "id" | "group">,
  requestedYear: string,
  now = new Date(),
) {
  const current = academicYear(now);
  const programId = student.group.programId;
  const entries = await db.enrollment.findMany({
    where: {
      studentId: student.id,
      status: "COMPLETED",
      officialGrade: {
        in: Array.from({ length: 10 }, (_, index) => String(index + 1)),
      },
      publishedAt: { lte: now },
    },
    select: {
      officialGrade: true,
      publishedAt: true,
      course: {
        select: {
          id: true,
          name: true,
          semester: true,
          curriculum: {
            where: { programId, credits: { gt: 0 } },
            select: { semester: true, credits: true },
          },
        },
      },
    },
    orderBy: [
      { course: { semester: "asc" } },
      { course: { name: "asc" } },
      { courseId: "asc" },
    ],
  });
  const weighted = entries.flatMap(({ officialGrade, publishedAt, course }) => {
    const credits = new Set(
      course.curriculum
        .filter((item) => item.semester === course.semester)
        .map((item) => item.credits),
    );
    if (!publishedAt || credits.size !== 1) return [];
    return [
      {
        id: course.id,
        name: course.name,
        semester: course.semester,
        grade: Number(officialGrade),
        credits: [...credits][0],
        publishedAt,
        year: academicYear(publishedAt),
      },
    ];
  });
  const years = [
    ...new Set([current, ...weighted.map((course) => course.year)]),
  ].sort((a, b) => b - a);
  const selected =
    years.find((year) => String(year) === requestedYear) ?? current;
  const studyYear = student.group.year - (current - selected);
  const cohort =
    studyYear > 0
      ? await db.ratingCohort.findFirst({
          where: {
            programId,
            academicYear: selected,
            studyYear,
            publishedAt: { lte: now },
          },
          select: {
            referenceCredits: true,
            scores: true,
            publishedAt: true,
            demo: true,
          },
        })
      : null;
  const courses = weighted.filter(
    (course) =>
      course.year === selected &&
      (!cohort || course.publishedAt <= cohort.publishedAt),
  );
  const summary = ratingSummary(courses, cohort);

  return {
    years,
    current,
    selected,
    courses,
    summary,
    publishedAt: cohort?.publishedAt ?? null,
    demo: cohort?.demo ?? false,
  };
}
