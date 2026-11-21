"use client";
import { useState } from "react";
import { ExclamationMark } from "lucide-react";
import { Button, ui } from "@/shared/ui/primitives";
import { Dialog } from "@/shared/ui/Dialog";
import type { attendanceStats, Scheme } from "./domain";
import s from "./attendance-indicator.module.css";
export function attendanceExplanation(
  a: ReturnType<typeof attendanceStats>,
  scheme: Scheme,
) {
  const rule = scheme.attendancePenalty
    ? `При посещаемости ниже ${scheme.attendanceThreshold}% итоговая оценка уменьшается на ${scheme.attendancePenalty} балл по десятибалльной шкале. В течение семестра это предварительный риск.`
    : "Посещаемость отображается для информации и не меняет оценку.";
  let text =
    a.percentage === null
      ? `Учтённых занятий пока нет. ${rule}`
      : `Сейчас ${Math.round(a.percentage)}%: ${a.present} из ${a.total} учтённых занятий. ${rule}`;
  if (scheme.attendanceThreshold && a.meets === false)
    text +=
      a.needed === null
        ? " Достичь 100% новыми посещениями после пропуска невозможно."
        : ` Чтобы достичь ${scheme.attendanceThreshold}%, нужно посетить ещё ${a.needed} занятий подряд; по расписанию осталось ${a.remaining}.${a.reachable ? "" : " Оставшихся занятий недостаточно — обсудите ситуацию с преподавателем."}`;
  if (a.unrecorded)
    text += ` Данные неполные: не учтено ${a.unrecorded} занятий.`;
  return text;
}
export function AttendanceIndicator({
  attendance,
  scheme,
  showValue = true,
}: {
  attendance: ReturnType<typeof attendanceStats>;
  scheme: Scheme;
  showValue?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const text = attendanceExplanation(attendance, scheme);
  return (
    <>
      <span className={ui.row}>
        {showValue && (
          <span>
            {attendance.percentage === null
              ? "Нет данных"
              : `${Math.round(attendance.percentage)}%`}
          </span>
        )}
        <Button
          small
          className={
            scheme.attendancePenalty > 0
              ? `${s.indicator} ${s.penalty}`
              : s.indicator
          }
          aria-label="Как посещаемость влияет на результат"
          aria-haspopup="dialog"
          onClick={(e) => {
            e.currentTarget.focus();
            setOpen(true);
          }}
        >
          <ExclamationMark size={16} aria-hidden="true" />
        </Button>
      </span>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Посещаемость и результат"
      >
        <p>{text}</p>
        <p className={ui.caption}>
          Уважительные отсутствия{" "}
          {scheme.excludeExcused
            ? "исключены из знаменателя"
            : "учтены по правилам курса"}
          . Неучтённые, отменённые и будущие занятия не считаются пропусками.
        </p>
      </Dialog>
    </>
  );
}
