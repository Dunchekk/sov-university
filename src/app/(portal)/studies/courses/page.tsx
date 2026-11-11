import Link from "next/link";
import { BookOpen, ArrowUpRight } from "lucide-react";
import { pageStudent } from "@/server/access";
import { myCourses } from "@/modules/courses/service";
import { AttendanceIndicator } from "@/modules/assessment/AttendanceIndicator";
import {
  Card,
  PageTitle,
  Tabs,
  Badge,
  Empty,
  ui,
} from "@/shared/ui/primitives";
import { formatDate } from "@/shared/lib/time";
export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ semester?: string; q?: string }>;
}) {
  const student = await pageStudent();
  const params = await searchParams;
  const semester = params.semester === "past" ? "past" : "current";
  const all = await myCourses(student);
  const courses = all.filter(
    (r) =>
      (semester === "past"
        ? r.enrollment.status === "COMPLETED"
        : r.enrollment.status !== "COMPLETED") &&
      r.enrollment.course.name
        .toLowerCase()
        .includes((params.q ?? "").toLowerCase()),
  );
  return (
    <>
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
      <form className={ui.row}>
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
      <div className={ui.stack}>
        <p className={ui.caption}>{courses.length} дисциплин</p>
        <div className={ui.grid2}>
          {courses.map((r) => {
            const course = r.enrollment.course;
            const next = r.assessments.find((a) => a.dueAt > new Date());
            return (
              <Card key={course.id}>
                <div className={ui.stack}>
                  <div className={ui.between}>
                    <Badge>{course.assessmentType}</Badge>
                    <BookOpen size={19} className={ui.muted} />
                  </div>
                  <div>
                    <Link
                      href={`/studies/courses/${course.id}`}
                      className={ui.between}
                    >
                      <h2>{course.name}</h2>
                      <ArrowUpRight size={18} />
                    </Link>
                    <p className={ui.caption}>{course.lecturer.name}</p>
                  </div>
                  <div className={ui.between}>
                    <div>
                      <span className={ui.caption}>Результат</span>
                      <p>
                        <strong>
                          {r.enrollment.officialGrade
                            ? `${r.enrollment.officialGrade} / 10`
                            : `${r.grade.points} / ${r.grade.maximum} баллов`}
                        </strong>
                      </p>
                    </div>
                    <div>
                      <span className={ui.caption}>Посещаемость</span>
                      <AttendanceIndicator
                        attendance={r.attendance}
                        scheme={r.scheme}
                      />
                    </div>
                  </div>
                  <progress
                    className={ui.progress}
                    value={r.grade.points}
                    max={r.grade.maximum}
                    aria-label={`Баллы: ${course.name}`}
                  />
                  <p className={ui.caption}>
                    {next
                      ? `Далее: ${next.title} · ${formatDate(next.dueAt)}`
                      : "Учебный период завершён"}
                  </p>
                </div>
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
    </>
  );
}
