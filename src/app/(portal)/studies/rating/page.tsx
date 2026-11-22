import Link from "next/link";
import { pageStudent } from "@/server/access";
import { studentRating } from "@/modules/rating/service";
import {
  filterHref,
  filterValue,
  type FilterParams,
} from "@/shared/lib/filters";
import { formatDate } from "@/shared/lib/time";
import { Empty, PageTitle, Tabs, ui } from "@/shared/ui/primitives";
import s from "./rating.module.css";

const path = "/studies/rating";
const decimal = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const factor = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 4 });

export default async function RatingPage({
  searchParams,
}: {
  searchParams: Promise<FilterParams>;
}) {
  const [student, params] = await Promise.all([pageStudent(), searchParams]);
  const rating = await studentRating(student, filterValue(params.year));
  const { summary, courses } = rating;

  return (
    <>
      <PageTitle
        title="Рейтинг"
        description={student.group.program.name}
        breadcrumb={{
          path,
          label: `${rating.selected}/${rating.selected + 1}`,
        }}
      />
      <Tabs
        active={String(rating.selected)}
        items={rating.years.map((year) => ({
          id: String(year),
          label: `${year}/${year + 1}`,
          href: filterHref(path, {
            year: year === rating.current ? undefined : year,
          }),
        }))}
      />
      {summary ? (
        <div className={s.page}>
          <section className={s.summary} aria-labelledby="rating-summary">
            <div className={s.summaryHeader}>
              <h2 id="rating-summary">
                {rating.selected === rating.current
                  ? "Текущий рейтинг"
                  : "Рейтинг за учебный год"}
              </h2>
              {rating.publishedAt && (
                <time
                  className={ui.caption}
                  dateTime={rating.publishedAt.toISOString()}
                >
                  Срез от {formatDate(rating.publishedAt)}
                </time>
              )}
            </div>
            <dl className={s.metrics}>
              <div className={s.place}>
                <dt>Место</dt>
                <dd>
                  {summary.place ?? "—"}
                  {summary.total && <span> из {summary.total}</span>}
                </dd>
              </div>
              <div>
                <dt>В топе</dt>
                <dd>
                  {summary.topPercent === null ? "—" : `${summary.topPercent}%`}
                </dd>
              </div>
              <div>
                <dt>GPA</dt>
                <dd>{decimal.format(summary.gpa)}</dd>
              </div>
              <div>
                <dt>Средний балл</dt>
                <dd>{decimal.format(summary.average)}</dd>
              </div>
              <div>
                <dt>Минимальная оценка</dt>
                <dd>{summary.minimum}</dd>
              </div>
            </dl>
            <dl className={s.totals}>
              <div>
                <dt>Кредиты</dt>
                <dd>{summary.credits}</dd>
              </div>
              <div>
                <dt>Кредитно-рейтинговая сумма</dt>
                <dd>{summary.creditScore}</dd>
              </div>
              <div>
                <dt>Нормализованная сумма</dt>
                <dd>{factor.format(summary.normalizedScore)}</dd>
              </div>
              <div>
                <dt>Коэффициент нормализации</dt>
                <dd>{factor.format(summary.coefficient)}</dd>
              </div>
            </dl>
            {rating.demo && (
              <p className={ui.caption}>
                Место и процент рассчитаны по демонстрационной выборке.
              </p>
            )}
            {summary.place === null && (
              <p className={ui.caption}>
                Сравнение с другими студентами ещё не опубликовано.
              </p>
            )}
          </section>
          <section className={s.courses} aria-labelledby="rating-courses">
            <h2 id="rating-courses">Дисциплины в расчёте</h2>
            <table className={s.courseTable} aria-labelledby="rating-courses">
              <thead>
                <tr>
                  <th scope="col">Дисциплина</th>
                  <th scope="col">Кредиты × оценка</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course) => (
                  <tr key={course.id}>
                    <th scope="row">
                      <Link
                        className={ui.link}
                        href={`/studies/courses/${encodeURIComponent(course.id)}`}
                      >
                        {course.name}
                      </Link>
                      <span className={ui.caption}>
                        {course.semester} семестр
                      </span>
                    </th>
                    <td>
                      {course.credits} × {course.grade} ={" "}
                      <strong>{course.credits * course.grade}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Сумма</th>
                  <td>{summary.creditScore}</td>
                </tr>
              </tfoot>
            </table>
          </section>
          <section className={s.method} aria-labelledby="rating-method">
            <h2 id="rating-method">Как считается рейтинг</h2>
            <p>
              В расчёт входят завершённые дисциплины с опубликованной числовой
              оценкой и кредитами в учебном плане. Учебный год определяется по
              дате публикации итоговой оценки.
            </p>
            <ul>
              <li>
                Кредитно-рейтинговая сумма складывается из произведений кредитов
                на оценки. GPA равен этой сумме, делённой на количество
                кредитов.
              </li>
              <li>
                При сравнении суммы приводятся к общему числу кредитов.
                Коэффициент равен этому числу, делённому на ваши кредиты.
              </li>
              <li>
                Место зависит от нормализованной суммы. При равных результатах
                место совпадает. Процент — место, делённое на число участников и
                умноженное на 100, с округлением вверх.
              </li>
            </ul>
          </section>
        </div>
      ) : (
        <Empty
          title="Рейтинг за этот учебный год пока не рассчитан"
          description="Здесь появятся дисциплины с опубликованными итоговыми оценками."
        />
      )}
    </>
  );
}
