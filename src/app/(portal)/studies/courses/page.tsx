import Link from "next/link";
import { Suspense } from "react";
import { ArrowUpRight } from "lucide-react";
import { pageStudent, type StudentContext } from "@/server/access";
import { myCourses } from "@/modules/courses/service";
import { AttendanceIndicator } from "@/modules/assessment/AttendanceIndicator";
import { Card, PageTitle, Tabs, Empty, ui } from "@/shared/ui/primitives";
import { formatDate } from "@/shared/lib/time";
import s from "./courses.module.css";

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ semester?: string; q?: string }>;
}) {
  const [student, params] = await Promise.all([pageStudent(), searchParams]);
  const semester = params.semester === "past" ? "past" : "current";
  return (
    <div className={s.courses}>
      <PageTitle
        title="Дисциплины"
        description={`${student.group.program.name} · ${student.group.name}`}
      />
      <Tabs
        active={semester}
        items={[
          { id: "current", label: "Текущий семестр", href: "/studies/courses" },
          {
            id: "past",
            label: "Завершённые",
            href: "/studies/courses?semester=past",
          },
        ]}
      />
      <form className={ui.filterBar}>
        <input type="hidden" name="semester" value={semester} />
        <label className={ui.form}>
          Поиск дисциплины
          <input
            name="q"
            defaultValue={params.q}
            placeholder="Название дисциплины"
          />
        </label>
        <button className={ui.button}>Найти</button>
      </form>
      <Suspense
        key={JSON.stringify([semester, params.q])}
        fallback={
          <div
            className={ui.skeleton}
            role="status"
            aria-label="Загрузка дисциплин"
          />
        }
      >
        <CourseList
          student={student}
          semester={semester}
          query={params.q ?? ""}
        />
      </Suspense>
    </div>
  );
}

async function CourseList({
  student,
  semester,
  query,
}: {
  student: StudentContext;
  semester: "current" | "past";
  query: string;
}) {
  const past = semester === "past";
  const enrolled = await myCourses(student, {
    status: past ? "COMPLETED" : { not: "COMPLETED" },
  });
  const name = query.toLowerCase();
  const courses = enrolled.filter(({ enrollment }) =>
    enrollment.course.name.toLowerCase().includes(name),
  );
  const plural = new Intl.PluralRules("ru").select(courses.length);
  const countLabel =
    plural === "one"
      ? "дисциплина"
      : plural === "few"
        ? "дисциплины"
        : "дисциплин";
  const now = new Date();
  return (
    <div className={ui.stack}>
      <p className={ui.caption}>
        {courses.length} {countLabel}
      </p>
      <div className={ui.grid2}>
        {courses.map((r) => {
          const { course, officialGrade } = r.enrollment;
          const next = r.assessments.find((a) => a.dueAt > now);
          return (
            <Card className={s.courseCard} key={course.id}>
              <div>
                <Link
                  href={`/studies/courses/${course.id}`}
                  className={s.courseTitle}
                >
                  <h2>{course.name}</h2>
                  <ArrowUpRight size={18} aria-hidden="true" />
                </Link>
                <p className={ui.caption}>
                  {course.lecturer.name}
                  {past && ` · ${course.semester} семестр`}
                </p>
              </div>
              <div className={`${ui.between} ${s.courseMetrics}`}>
                <div>
                  <span className={ui.caption}>
                    {past && officialGrade ? "Итоговая оценка" : "Результат"}
                  </span>
                  <p>
                    <strong>
                      {officialGrade
                        ? `${officialGrade} / 10`
                        : `${r.grade.points} / ${r.grade.maximum} баллов`}
                    </strong>
                  </p>
                </div>
                {(!past || r.attendance.percentage !== null) && (
                  <div>
                    <span className={ui.caption}>Посещаемость</span>
                    <AttendanceIndicator
                      attendance={r.attendance}
                      scheme={r.scheme}
                    />
                  </div>
                )}
              </div>
              {r.grade.maximum > 0 && (
                <progress
                  className={`${ui.progress} ${s.courseProgress}`}
                  value={r.grade.points}
                  max={r.grade.maximum}
                  aria-label={`Баллы: ${course.name}`}
                />
              )}
              {next && (
                <p className={ui.caption}>
                  Далее: {next.title} · {formatDate(next.dueAt)}
                </p>
              )}
            </Card>
          );
        })}
      </div>
      {!courses.length && (
        <Empty
          title="Дисциплины не найдены"
          description="Измените поиск или семестр."
        />
      )}
    </div>
  );
}
