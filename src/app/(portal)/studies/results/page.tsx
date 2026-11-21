import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/server/db";
import { formatDate, formatTime } from "@/shared/lib/time";
import { pageStudent } from "@/server/access";
import { myCourses } from "@/modules/courses/service";
import { GradeBreakdown } from "@/modules/assessment/GradeBreakdown";
import {
  ActionLink,
  Badge,
  Button,
  Empty,
  PageTitle,
  Tabs,
  ui,
} from "@/shared/ui/primitives";
import s from "./results.module.css";

const path = "/studies/results";
const tabs = [
  { id: "all", label: "Все результаты" },
  { id: "attention", label: "Требует внимания" },
  { id: "completed", label: "Завершено" },
] as const;
const sorts = [
  { id: "priority", label: "По приоритету" },
  { id: "semester", label: "Сначала новые семестры" },
  { id: "name", label: "По названию (А–Я)" },
] as const;
const byName = new Intl.Collator("ru");
type Query = Record<string, string | string[] | undefined>;
type Result = Awaited<ReturnType<typeof myCourses>>[number];
type Retake = Awaited<ReturnType<typeof db.retake.findMany>>[number];

function resultHref(params: Record<string, string>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  return query.size ? `${path}?${query}` : path;
}

function prepareResult(result: Result, retakes: Retake[], now: Date) {
  const { attendance, enrollment, grade } = result;
  const completed = enrollment.status === "COMPLETED";
  const nextRetake = retakes.find((retake) => retake.endsAt > now);
  const debt = enrollment.status === "DEBT" || !!nextRetake;
  const attention =
    !completed && (debt || !grade.admitted || attendance.meets === false);
  const priority = completed ? 3 : debt ? 0 : attention ? 1 : 2;
  const lastRetake = retakes.at(-1);
  const nextAssessment = result.assessments.find((assessment) => {
    const state = assessment.results[0]?.status;
    return assessment.dueAt >= now && (!state || state === "UPCOMING");
  });

  return {
    result,
    retakes,
    nextRetake,
    lastRetake,
    nextAssessment,
    completed,
    debt,
    attention,
    priority,
  };
}

function ResultRow({
  entry,
  expanded,
}: {
  entry: ReturnType<typeof prepareResult>;
  expanded: boolean;
}) {
  const {
    result,
    retakes,
    nextRetake,
    lastRetake,
    nextAssessment,
    completed,
    debt,
    attention,
  } = entry;
  const { enrollment, grade, attendance, scheme } = result;
  const { course, officialGrade } = enrollment;
  const officialResult =
    officialGrade === null
      ? null
      : scheme.type === "POINTS" && /^\d+$/.test(officialGrade)
        ? `Итог ${officialGrade} / 10`
        : `Итог ${officialGrade}`;
  const status = completed
    ? "Завершено"
    : debt
      ? nextRetake
        ? "Пересдача назначена"
        : "Задолженность"
      : !grade.admitted
        ? "Есть условия допуска"
        : attention
          ? "Посещаемость ниже порога"
          : "Условия допуска выполнены";
  const due = nextRetake ?? lastRetake;
  return (
    <details className={s.result} open={expanded}>
      <summary className={s.summary}>
        <span className={s.discipline}>
          <strong>{course.name}</strong>
          <span className={ui.caption}>
            {course.semester} семестр · {course.assessmentType}
          </span>
        </span>
        <span className={s.points}>
          <span className={s.mobileLabel}>Баллы</span>
          <strong>
            {grade.maximum ? `${grade.points} / ${grade.maximum}` : "—"}
          </strong>
        </span>
        <span className={s.attendance}>
          <span className={s.mobileLabel}>Посещаемость</span>
          {attendance.percentage === null ? (
            <span className={ui.caption}>Нет данных</span>
          ) : (
            <strong
              className={
                !completed && attendance.meets === false ? s.risk : undefined
              }
            >
              {Math.round(attendance.percentage)}%
            </strong>
          )}
        </span>
        <span className={s.outcome}>
          {completed && officialResult ? (
            <>
              <strong>{officialResult}</strong>
              <span className={ui.caption}>{status}</span>
            </>
          ) : (
            <>
              <Badge
                tone={completed ? "success" : attention ? "warning" : "default"}
              >
                {status}
              </Badge>
              {officialResult && (
                <span className={ui.caption}>{officialResult}</span>
              )}
            </>
          )}
          {!completed && debt && due && (
            <span className={ui.caption}>
              {nextRetake ? "" : "Дата прошла · "}
              <time dateTime={due.startsAt.toISOString()}>
                {formatDate(due.startsAt)} · {formatTime(due.startsAt)}
              </time>
            </span>
          )}
        </span>
      </summary>
      <div className={s.details}>
        {retakes.length > 0 && (
          <section className={s.retake}>
            <h2>{retakes.length === 1 ? retakes[0].title : "Пересдачи"}</h2>
            <ul>
              {retakes.map((retake) => (
                <li key={retake.id}>
                  {retakes.length > 1 && <h3>{retake.title}</h3>}
                  <p>
                    <strong>
                      <time dateTime={retake.startsAt.toISOString()}>
                        {formatDate(retake.startsAt, {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}{" "}
                        · {formatTime(retake.startsAt)}
                      </time>
                    </strong>
                    {" · "}
                    {retake.location}
                  </p>
                  <p>{retake.reason}</p>
                  <p className={ui.caption}>{retake.consultation}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
        {!completed && !nextRetake && nextAssessment && (
          <p className={s.next}>
            <strong>Ближайшая работа</strong>
            <span>
              {nextAssessment.title} ·{" "}
              <time dateTime={nextAssessment.dueAt.toISOString()}>
                {formatDate(nextAssessment.dueAt)}
              </time>
            </span>
          </p>
        )}
        <GradeBreakdown result={result} inline />
        <div className={s.detailsFooter}>
          <Link className={ui.link} href={`/studies/courses/${course.id}`}>
            Открыть дисциплину →
          </Link>
        </div>
      </div>
    </details>
  );
}

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const query = await searchParams;
  return (
    <>
      <PageTitle title="Оценки и посещаемость" />
      <Suspense
        key={JSON.stringify(query)}
        fallback={
          <div
            className={ui.skeleton}
            role="status"
            aria-label="Загрузка результатов"
          />
        }
      >
        <ResultsContent query={query} />
      </Suspense>
    </>
  );
}

async function ResultsContent({ query }: { query: Query }) {
  const student = await pageStudent();
  const [all, retakes] = await Promise.all([
    myCourses(student),
    db.retake.findMany({
      where: { enrollment: { studentId: student.id } },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    }),
  ]);
  const courses = all
    .map(({ enrollment }) => enrollment.course)
    .sort(
      (a, b) =>
        byName.compare(a.name, b.name) ||
        b.semester - a.semester ||
        byName.compare(a.code, b.code),
    );
  const semesters = [...new Set(courses.map((course) => course.semester))]
    .sort((a, b) => b - a)
    .map(String);
  const types = [
    ...new Set(courses.map((course) => course.assessmentType)),
  ].sort(byName.compare);
  const filters = {
    course: courses.find((course) => course.id === query.course)?.id ?? "",
    semester: semesters.find((semester) => semester === query.semester) ?? "",
    type: types.find((type) => type === query.type) ?? "",
  };
  const status = tabs.find((tab) => tab.id === query.status)?.id ?? "all";
  const sort =
    sorts.find((option) => option.id === query.sort)?.id ?? "priority";
  const retakesByEnrollment = Map.groupBy(
    retakes,
    (retake) => retake.enrollmentId,
  );
  const now = new Date();
  const matching = all
    .filter(
      ({ enrollment: { course } }) =>
        (!filters.course || course.id === filters.course) &&
        (!filters.semester || String(course.semester) === filters.semester) &&
        (!filters.type || course.assessmentType === filters.type),
    )
    .map((result) =>
      prepareResult(
        result,
        retakesByEnrollment.get(result.enrollment.id) ?? [],
        now,
      ),
    );
  const buckets = {
    all: matching,
    attention: matching.filter((entry) => entry.attention),
    completed: matching.filter((entry) => entry.completed),
  };
  const results = buckets[status].sort((a, b) => {
    const first = a.result.enrollment.course;
    const second = b.result.enrollment.course;
    const priority = sort === "priority" ? a.priority - b.priority : 0;
    const semester = sort !== "name" ? second.semester - first.semester : 0;
    return (
      priority ||
      semester ||
      byName.compare(first.name, second.name) ||
      byName.compare(first.code, second.code)
    );
  });
  const hasFilters = Object.values(filters).some(Boolean);
  const urlSort = sort === "priority" ? "" : sort;
  const resetHref = resultHref({
    status: status === "all" ? "" : status,
    sort: urlSort,
  });

  return (
    <>
      <div className={s.controls}>
        <Tabs
          active={status}
          items={tabs.map(({ id, label }) => ({
            id,
            label: `${label} · ${buckets[id].length}`,
            href: resultHref({
              ...filters,
              status: id === "all" ? "" : id,
              sort: urlSort,
            }),
          }))}
        />
        <form
          action={path}
          method="get"
          className={s.filters}
          aria-label="Фильтры и порядок результатов"
          key={resultHref({ ...filters, status, sort })}
        >
          <input type="hidden" name="status" value={status} />
          <label>
            Дисциплина
            <select name="course" defaultValue={filters.course}>
              <option value="">Все дисциплины</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name} · {course.semester} сем.
                </option>
              ))}
            </select>
          </label>
          <label>
            Семестр
            <select name="semester" defaultValue={filters.semester}>
              <option value="">Все семестры</option>
              {semesters.map((semester) => (
                <option key={semester} value={semester}>
                  {semester} семестр
                </option>
              ))}
            </select>
          </label>
          <label>
            Аттестация
            <select name="type" defaultValue={filters.type}>
              <option value="">Все виды</option>
              {types.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label>
            Порядок
            <select name="sort" defaultValue={sort}>
              {sorts.map(({ id, label }) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className={s.actions}>
            <Button type="submit" variant="primary">
              Применить
            </Button>
            {hasFilters && results.length > 0 && (
              <Link href={resetHref} className={ui.link}>
                Сбросить
              </Link>
            )}
          </div>
        </form>
      </div>
      <section aria-label="Результаты" className={s.results}>
        {results.length > 0 ? (
          <>
            <div className={s.headers} aria-hidden="true">
              <span>Дисциплина</span>
              <span>Баллы</span>
              <span>Посещаемость</span>
              <span>Статус</span>
            </div>
            {results.map((entry) => (
              <ResultRow
                key={entry.result.enrollment.id}
                entry={entry}
                expanded={filters.course === entry.result.enrollment.courseId}
              />
            ))}
          </>
        ) : (
          <Empty
            title={
              hasFilters
                ? "Нет результатов по этим фильтрам"
                : status === "attention"
                  ? "Нет дисциплин, требующих внимания"
                  : status === "completed"
                    ? "Нет завершённых дисциплин"
                    : "Результатов пока нет"
            }
            action={
              hasFilters ? (
                <ActionLink href={resetHref}>Сбросить фильтры</ActionLink>
              ) : status !== "all" && buckets.all.length > 0 ? (
                <ActionLink href={resultHref({ sort: urlSort })}>
                  Все результаты
                </ActionLink>
              ) : undefined
            }
          />
        )}
      </section>
    </>
  );
}
