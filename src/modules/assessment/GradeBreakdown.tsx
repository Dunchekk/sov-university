import type { ReactNode } from "react";
import type { courseResult } from "@/modules/courses/service";
import { AttendanceIndicator } from "./AttendanceIndicator";
import { ResultHelp } from "./ResultHelp";
import { Card, Badge, ui } from "@/shared/ui/primitives";
import { formatDate } from "@/shared/lib/time";
import { statusLabel } from "@/shared/config/statuses";
import s from "./assessment.module.css";
type CourseResult = Awaited<ReturnType<typeof courseResult>>;

export function GradeBreakdown({
  result,
  inline = false,
}: {
  result: CourseResult;
  inline?: boolean;
}) {
  const { grade, scheme, attendance, enrollment, assessments, records } =
    result;
  if (inline) {
    return (
      <section className={s.inline} aria-label="Оценивание и посещаемость">
        <div className={s.inlineHeader}>
          <div>
            <h2>Работы и оценки</h2>
            {enrollment.officialGrade && enrollment.publishedAt && (
              <p className={ui.caption}>
                Итог опубликован {formatDate(enrollment.publishedAt)}
              </p>
            )}
            {!enrollment.officialGrade && enrollment.status !== "COMPLETED" && (
              <p className={ui.caption}>
                {scheme.type === "PASS"
                  ? grade.passed
                    ? "Условия зачёта выполнены"
                    : "Условия зачёта ещё не выполнены"
                  : `Предварительная оценка — ${grade.projectedGrade} / 10`}
              </p>
            )}
          </div>
          {enrollment.status === "CURRENT" && !grade.admitted && (
            <div className={s.admission}>
              {grade.shortfall > 0 && (
                <p>
                  До допуска не хватает{" "}
                  <strong>{grade.shortfall} баллов</strong>
                </p>
              )}
              {grade.missing.length > 0 && (
                <p>Обязательные работы · {grade.missing.join(", ")}</p>
              )}
              {grade.blockedMandatory.length > 0 && (
                <p>
                  Срок сдачи прошёл. Уточните порядок сдачи у преподавателя.
                </p>
              )}
            </div>
          )}
        </div>
        {assessments.length ? (
          <AssessmentTable assessments={assessments} />
        ) : (
          <p className={ui.caption}>
            Работы по дисциплине пока не опубликованы.
          </p>
        )}
        <div className={s.inlineResources}>
          <AssessmentRules scheme={scheme} />
          <AttendanceJournal records={records} inline>
            {attendance.total > 0 && (
              <p className={ui.caption}>
                {attendance.present} посещено · {attendance.absent} пропущено ·{" "}
                {attendance.excused} уважительных · {attendance.unrecorded} не
                учтено
              </p>
            )}
            <AttendanceIndicator
              attendance={attendance}
              scheme={scheme}
              showValue={false}
            />
          </AttendanceJournal>
        </div>
      </section>
    );
  }
  return (
    <div className={ui.stack}>
      <div className={ui.grid2}>
        <Card className={s.summaryCard}>
          <div>
            <span className={ui.eyebrow}>Накопленные баллы</span>
            <p className={ui.largeNumber}>
              {grade.points} <span className={ui.muted}>/ {grade.maximum}</span>
            </p>
          </div>
          <div className={s.summaryGroup}>
            <progress
              className={ui.progress}
              value={grade.points}
              max={grade.maximum}
              aria-label="Накопленные баллы"
            />
            <p className={ui.caption}>
              Допуск от {scheme.admissionPoints} баллов · зачёт от{" "}
              {scheme.passPoints}
            </p>
          </div>
          <div className={s.summaryGroup}>
            <p>
              {enrollment.officialGrade ? (
                <>
                  Официальный итог: <strong>{enrollment.officialGrade}</strong>{" "}
                  · правила v{enrollment.officialSchemeVersion}
                </>
              ) : (
                <>
                  Предварительный расчёт:{" "}
                  <strong>
                    {scheme.type === "PASS"
                      ? grade.passed
                        ? "Условия зачёта выполнены"
                        : "Пока не зачтено"
                      : `${grade.projectedGrade} / 10`}
                  </strong>
                </>
              )}
            </p>
            {enrollment.officialGrade && (
              <p className={ui.caption}>
                Опубликован{" "}
                {enrollment.publishedAt
                  ? formatDate(enrollment.publishedAt)
                  : "преподавателем"}
                . Корректировка посещаемости:{" "}
                {enrollment.officialAdjustment ?? 0}.
              </p>
            )}
            {!enrollment.officialGrade && grade.penalty > 0 && (
              <p className={ui.caption}>
                База {grade.baseGrade}/10, предварительное влияние посещаемости
                −{grade.penalty}. Официальная оценка пока не опубликована.
              </p>
            )}
          </div>
        </Card>
        <Card className={s.summaryCard}>
          <h3>Посещаемость</h3>
          <AttendanceIndicator attendance={attendance} scheme={scheme} />
          <p className={ui.caption}>
            {attendance.present} посещено · {attendance.absent} пропущено ·{" "}
            {attendance.excused} уважительных · {attendance.unrecorded} не
            учтено
          </p>
          <p className={ui.caption}>
            Правила v{scheme.version}: процент без округления сравнивается с
            порогом. На экране округление до целого.
          </p>
        </Card>
      </div>
      <Card className={s.summaryCard}>
        <div className={`${ui.between} ${s.assessmentHeader}`}>
          <div className={s.assessmentHeading}>
            <h2>Как получить результат</h2>
            {enrollment.status !== "COMPLETED" && (
              <ResultHelp>
                <p>
                  Для допуска нужно {scheme.admissionPoints} баллов и все
                  обязательные работы.{" "}
                  {grade.shortfall
                    ? `Не хватает ${grade.shortfall} баллов.`
                    : "Порог баллов достигнут."}
                </p>
                {grade.missing.length > 0 && (
                  <p>
                    Обязательные работы: {grade.missing.join(", ")}. Баллы за
                    другие задания не заменяют их сдачу.
                  </p>
                )}
                {grade.blockedMandatory.length > 0 && (
                  <p className={ui.error}>
                    Истёк срок обязательных работ:{" "}
                    {grade.blockedMandatory.join(", ")}. Нужна консультация по
                    дальнейшей сдаче.
                  </p>
                )}
                <p>
                  Ещё доступно до {grade.remaining} баллов.{" "}
                  {grade.canReachPass
                    ? "Итог зависит от результатов оставшихся работ."
                    : "Обычных оставшихся баллов недостаточно: обратитесь к преподавателю за консультацией по пересдаче."}
                </p>
              </ResultHelp>
            )}
          </div>
          <Badge tone={grade.admitted ? "success" : "warning"}>
            {enrollment.status === "COMPLETED"
              ? "Аттестация завершена"
              : grade.admitted
                ? "Условия допуска выполнены"
                : "Условия ещё не выполнены"}
          </Badge>
        </div>
        <AssessmentTable assessments={assessments} />
        <AssessmentRules scheme={scheme} />
        <AttendanceJournal records={records} />
      </Card>
    </div>
  );
}

function AssessmentTable({ assessments }: Pick<CourseResult, "assessments">) {
  return (
    <div className={ui.tableWrap}>
      <table className={s.workTable} role="table">
        <thead role="rowgroup">
          <tr role="row">
            <th scope="col">Компонент</th>
            <th scope="col">Срок</th>
            <th scope="col">Результат</th>
            <th scope="col">Состояние</th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {assessments.map((a) => {
            const r = a.results[0];
            return (
              <tr key={a.id} role="row">
                <td role="cell">
                  {a.title}
                  {a.mandatory && (
                    <small className={ui.muted}> · обязательная</small>
                  )}
                </td>
                <td role="cell">{formatDate(a.dueAt)}</td>
                <td role="cell">
                  {r?.status === "PUBLISHED" && r.points !== null
                    ? `${r.points} / ${a.maxPoints}`
                    : `— / ${a.maxPoints}`}
                </td>
                <td role="cell">
                  {r?.status === "SUBMITTED"
                    ? "Сдано, результат ожидается"
                    : r
                      ? statusLabel(r.status)
                      : "Не назначено"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AssessmentRules({ scheme }: Pick<CourseResult, "scheme">) {
  return (
    <details className={s.disclosure}>
      <summary>Шкала и правила оценивания</summary>
      <div className={s.disclosureBody}>
        <p>
          {scheme.type === "PASS"
            ? `Зачёт от ${scheme.passPoints} баллов с обязательными работами.`
            : "Сумма компонентов переводится в десятибалльную оценку по порогам."}
        </p>
        {scheme.thresholds.length > 0 && (
          <table className={s.scaleTable} aria-label="Шкала оценивания">
            <thead>
              <tr>
                <th scope="col">Минимум баллов</th>
                <th scope="col">Оценка из 10</th>
              </tr>
            </thead>
            <tbody>
              {scheme.thresholds.map(({ points, grade }) => (
                <tr key={points}>
                  <td>{points}</td>
                  <td>{grade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className={ui.caption}>
          Сумма ограничена максимумом компонентов. Опубликованный ноль
          отличается от отсутствующего результата. Корректировка посещаемости
          применяется один раз после перевода в итоговую оценку.
        </p>
      </div>
    </details>
  );
}

function AttendanceJournal({
  records,
  inline = false,
  children,
}: Pick<CourseResult, "records"> & { inline?: boolean; children?: ReactNode }) {
  return (
    <details className={s.disclosure}>
      <summary>Журнал посещаемости</summary>
      <div className={s.disclosureBody}>
        {children}
        {inline && !records.length ? (
          <p className={ui.caption}>Записей о занятиях пока нет.</p>
        ) : (
          <div className={ui.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Занятие</th>
                  <th>Дата</th>
                  <th>Отметка</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td>{r.lesson.title}</td>
                    <td>{formatDate(r.lesson.startsAt)}</td>
                    <td>
                      {r.lesson.cancelled
                        ? "Отменено"
                        : (
                            {
                              PRESENT: "Присутствовал",
                              ABSENT: "Отсутствовал",
                              EXCUSED: "Уважительная причина",
                              UNRECORDED: "Не учтено",
                            } as Record<string, string>
                          )[r.status]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </details>
  );
}
