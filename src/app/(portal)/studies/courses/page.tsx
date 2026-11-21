import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { pageStudent } from "@/server/access";
import { myCourses } from "@/modules/courses/service";
import { AttendanceIndicator } from "@/modules/assessment/AttendanceIndicator";
import { LecturerLink } from "@/shared/ui/LecturerLink";
import {
  Card,
  PageTitle,
  Tabs,
  Empty,
  ActionLink,
  ui,
} from "@/shared/ui/primitives";
import { FilterForm, FilterText } from "@/shared/ui/FilterForm";
import {
  containsText,
  filterHref,
  filterValue,
  type FilterParams,
} from "@/shared/lib/filters";
import { formatDate } from "@/shared/lib/time";
import s from "./courses.module.css";
const path = "/studies/courses";

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<FilterParams>;
}) {
  const student = await pageStudent();
  const params = await searchParams;
  const semester = filterValue(params.semester) === "past" ? "past" : "current";
  const past = semester === "past";
  const query = filterValue(params.q).trim().slice(0, 80);
  const courses = await myCourses(student, {
    status: past ? "COMPLETED" : { not: "COMPLETED" },
    course: query ? { name: containsText(query) } : undefined,
  });
  const plural = new Intl.PluralRules("ru").select(courses.length);
  const countLabel =
    plural === "one"
      ? "дисциплина"
      : plural === "few"
        ? "дисциплины"
        : "дисциплин";
  const now = new Date();
  return (
    <div className={s.courses}>
      <PageTitle
        title="Дисциплины"
        description={`${student.group.program.name} · ${student.group.name}`}
      />
      <Tabs
        active={semester}
        items={[
          {
            id: "current",
            label: "Текущий семестр",
            href: filterHref(path, { q: query }),
          },
          {
            id: "past",
            label: "Завершённые",
            href: filterHref(path, { semester: "past", q: query }),
          },
        ]}
      />
      <FilterForm action={path} className={ui.filterBar}>
        <input type="hidden" name="semester" value={semester} />
        <FilterText
          className={ui.searchInput}
          name="q"
          value={query}
          maxLength={80}
          placeholder="Поиск..."
          aria-label="Поиск дисциплины"
        />
        <button className={ui.button}>Найти</button>
      </FilterForm>
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
                    <LecturerLink {...course.lecturer} />
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
            action={
              query ? (
                <ActionLink
                  href={filterHref(path, {
                    semester: past ? "past" : undefined,
                  })}
                >
                  Сбросить поиск
                </ActionLink>
              ) : undefined
            }
          />
        )}
      </div>
    </div>
  );
}
