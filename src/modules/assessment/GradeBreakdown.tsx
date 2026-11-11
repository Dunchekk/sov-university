import type { courseResult } from "@/modules/courses/service";
import { AttendanceIndicator } from "./AttendanceIndicator";
import { Card, Badge, ui } from "@/shared/ui/primitives";
import { formatDate } from "@/shared/lib/time";
import { statusLabel } from "@/shared/config/statuses";
export function GradeBreakdown({
  result,
}: {
  result: Awaited<ReturnType<typeof courseResult>>;
}) {
  const { grade, scheme, attendance, enrollment, assessments, records } =
    result;
  return (
    <div className={ui.stack}>
      <div className={ui.grid2}>
        <Card>
          <span className={ui.eyebrow}>Накопленные баллы</span>
          <p className={ui.largeNumber}>
            {grade.points} <span className={ui.muted}>/ {grade.maximum}</span>
          </p>
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
          <p>
            {enrollment.officialGrade ? (
              <>
                Официальный итог: <strong>{enrollment.officialGrade}</strong> ·
                правила v{enrollment.officialSchemeVersion}
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
              . Корректировка посещаемости: {enrollment.officialAdjustment ?? 0}
              .
            </p>
          )}
          {!enrollment.officialGrade && grade.penalty > 0 && (
            <p className={ui.caption}>
              База {grade.baseGrade}/10, предварительное влияние посещаемости −
              {grade.penalty}. Официальная оценка пока не опубликована.
            </p>
          )}
        </Card>
        <Card>
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
      <Card>
        <div className={ui.between}>
          <h2>Как получить результат</h2>
          <Badge tone={grade.admitted ? "success" : "warning"}>
            {enrollment.status === "COMPLETED"
              ? "Аттестация завершена"
              : grade.admitted
                ? "Условия допуска выполнены"
                : "Условия ещё не выполнены"}
          </Badge>
        </div>
        {enrollment.status !== "COMPLETED" && (
          <div className={ui.stack}>
            <p>
              Для допуска нужно {scheme.admissionPoints} баллов и все
              обязательные работы.{" "}
              {grade.shortfall
                ? `Не хватает ${grade.shortfall} баллов.`
                : "Порог баллов достигнут."}
            </p>
            {grade.missing.length > 0 && (
              <p>
                Обязательные работы: {grade.missing.join(", ")}. Баллы за другие
                задания не заменяют их сдачу.
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
          </div>
        )}
        <div className={ui.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Компонент</th>
                <th>Срок</th>
                <th>Результат</th>
                <th>Состояние</th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((a) => {
                const r = a.results[0];
                return (
                  <tr key={a.id}>
                    <td>
                      {a.title}
                      {a.mandatory && (
                        <small className={ui.muted}> · обязательная</small>
                      )}
                    </td>
                    <td>{formatDate(a.dueAt)}</td>
                    <td>
                      {r?.status === "PUBLISHED" && r.points !== null
                        ? `${r.points} / ${a.maxPoints}`
                        : `— / ${a.maxPoints}`}
                    </td>
                    <td>
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
        <details className={ui.details}>
          <summary>Шкала и правила оценивания</summary>
          <p>
            {scheme.type === "PASS"
              ? `Зачёт от ${scheme.passPoints} баллов с обязательными работами.`
              : "Сумма компонентов переводится в десятибалльную оценку по порогам."}
          </p>
          <div className={ui.row}>
            {scheme.thresholds.map((t) => (
              <Badge key={t.points}>
                {t.points}+ баллов → {t.grade}/10
              </Badge>
            ))}
          </div>
          <p className={ui.caption}>
            Сумма ограничена максимумом компонентов. Опубликованный ноль
            отличается от отсутствующего результата. Корректировка посещаемости
            применяется один раз после перевода в итоговую оценку.
          </p>
        </details>
        <details className={ui.details}>
          <summary>Журнал посещаемости</summary>
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
        </details>
      </Card>
    </div>
  );
}
