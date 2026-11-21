import Link from "next/link";
import { db } from "@/server/db";
import { formatDate, formatTime } from "@/shared/lib/time";
import {
  filterHref,
  filterValue,
  type FilterParams,
} from "@/shared/lib/filters";
import { FilterForm, FilterSelect } from "@/shared/ui/FilterForm";
import { pageStudent } from "@/server/access";
import { myCourses } from "@/modules/courses/service";
import { GradeBreakdown } from "@/modules/assessment/GradeBreakdown";
import { RetakeConsultation } from "@/modules/assessment/RetakeConsultation";
import type { Prisma } from "@/generated/prisma/client";
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
import { ResultDisclosure } from "./ResultDisclosure";

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
type Result = Awaited<ReturnType<typeof myCourses>>[number];
type Retake = Prisma.RetakeGetPayload<{
  include: { consultationLecturer: { select: { id: true; name: true } } };
}>;

function prepareResult(result: Result, retakes: Retake[], now: Date) {
  const { attendance, enrollment, grade } = result;
  const completed = enrollment.status === "COMPLETED";
  const nextRetake = retakes.find((retake) => retake.endsAt > now);
  const debt = enrollment.status === "DEBT" || !!nextRetake;
  const attention =
    !completed && (debt || !grade.admitted || attendance.meets === false);
  const priority = completed ? 3 : debt ? 0 : attention ? 1 : 2;
  const lastRetake = retakes.at(-1);

  return {
    result,
    retakes,
    nextRetake,
    lastRetake,
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
    <ResultDisclosure
      expanded={expanded}
      summary={
        <>
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
              <Badge
                tone={completed ? "success" : attention ? "warning" : "default"}
              >
                {status}
              </Badge>
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
        </>
      }
    >
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
                  <RetakeConsultation
                    text={retake.consultation}
                    lecturer={retake.consultationLecturer}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
        <GradeBreakdown result={result} inline />
        <div className={s.detailsFooter}>
          <Link className={ui.link} href={`/studies/courses/${course.id}`}>
            Открыть дисциплину →
          </Link>
        </div>
      </div>
    </ResultDisclosure>
  );
}

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<FilterParams>;
}) {
  const student = await pageStudent();
  const [query, all, retakes] = await Promise.all([
    searchParams,
    myCourses(student),
    db.retake.findMany({
      where: { enrollment: { studentId: student.id } },
      include: { consultationLecturer: { select: { id: true, name: true } } },
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
    course:
      courses.find((course) => course.id === filterValue(query.course))?.id ??
      "",
    semester:
      semesters.find((semester) => semester === filterValue(query.semester)) ??
      "",
    type: types.find((type) => type === filterValue(query.type)) ?? "",
  };
  const status =
    tabs.find((tab) => tab.id === filterValue(query.status))?.id ?? "all";
  const sort =
    sorts.find((option) => option.id === filterValue(query.sort))?.id ??
    "priority";
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
  const resetHref = filterHref(path, {
    status: status === "all" ? "" : status,
    sort: urlSort,
  });

  return (
    <>
      <PageTitle title="Оценки и посещаемость" />
      <div className={s.controls}>
        <Tabs
          active={status}
          items={tabs.map(({ id, label }) => ({
            id,
            label: `${label} · ${buckets[id].length}`,
            href: filterHref(path, {
              ...filters,
              status: id === "all" ? "" : id,
              sort: urlSort,
            }),
          }))}
        />
        <FilterForm
          action={path}
          className={s.filters}
          aria-label="Фильтры и порядок результатов"
        >
          <input type="hidden" name="status" value={status} />
          <label>
            <span className={s.filterLabel}>Дисциплина</span>
            <FilterSelect name="course" value={filters.course}>
              <option value="">Все дисциплины</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name} · {course.semester} сем.
                </option>
              ))}
            </FilterSelect>
          </label>
          <label>
            <span className={s.filterLabel}>Семестр</span>
            <FilterSelect name="semester" value={filters.semester}>
              <option value="">Все семестры</option>
              {semesters.map((semester) => (
                <option key={semester} value={semester}>
                  {semester} семестр
                </option>
              ))}
            </FilterSelect>
          </label>
          <label>
            <span className={s.filterLabel}>Аттестация</span>
            <FilterSelect name="type" value={filters.type}>
              <option value="">Все виды</option>
              {types.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </FilterSelect>
          </label>
          <label>
            <span className={s.filterLabel}>Порядок</span>
            <FilterSelect name="sort" value={sort}>
              {sorts.map(({ id, label }) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </FilterSelect>
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
        </FilterForm>
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
                <ActionLink href={filterHref(path, { sort: urlSort })}>
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
