"use client";
import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, formatDate } from "@/shared/lib/time";
import { calendarRange } from "./layout";
import type { ExamPeriod } from "./types";
import s from "./calendar.module.css";

export function MiniCalendar({
  visible,
  today,
  onSelect,
  menu,
  min,
  examPeriod,
}: {
  visible: { from: string; to: string };
  today: string;
  onSelect: (day: string) => void;
  menu?: ReactNode;
  min?: string;
  examPeriod?: ExamPeriod | null;
}) {
  const [browse, setBrowse] = useState({
    reference: visible.from,
    month: visible.from.slice(0, 7),
  });
  const month =
    browse.reference === visible.from ? browse.month : visible.from.slice(0, 7);
  const first = `${month}-01`;
  const range = calendarRange(first, "month");
  const days = Array.from({ length: 42 }, (_, i) =>
    addDays(range.from, i),
  ).filter((day) => !day.startsWith("+"));
  const moveMonth = (direction: number) => {
    const next = new Date(`${first}T12:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + direction);
    setBrowse({
      reference: visible.from,
      month: next.toISOString().slice(0, 7),
    });
  };
  const tabStop = visible.from.startsWith(month) ? visible.from : first;
  const firstFocusable = min && tabStop < min ? min : tabStop;
  const inSession = (day: string) =>
    Boolean(examPeriod && day >= examPeriod.from && day < examPeriod.to);
  return (
    <section className={s.miniCalendar} aria-label="Выбор даты">
      <div className={s.miniHeading}>
        <h2>
          {formatDate(`${first}T12:00:00Z`, {
            month: "long",
            year: "numeric",
          }).replace(" г.", "")}
        </h2>
        <div className={s.miniArrows}>
          <button
            type="button"
            aria-label="Предыдущий месяц"
            disabled={Boolean(min && month <= min.slice(0, 7))}
            onClick={() => moveMonth(-1)}
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            aria-label="Следующий месяц"
            disabled={month === "9999-12"}
            onClick={() => moveMonth(1)}
          >
            <ChevronRight size={15} />
          </button>
          {menu}
        </div>
      </div>
      <div className={s.miniGrid}>
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
          <span key={day} className={s.miniWeekday}>
            {day}
          </span>
        ))}
        {days.map((day, index) => (
          <button
            key={day}
            type="button"
            className={s.miniDay}
            data-date={day}
            data-outside={!day.startsWith(month) || undefined}
            data-session={inSession(day) || undefined}
            data-anchor={day === visible.from || undefined}
            data-range-start={
              day === visible.from || index % 7 === 0 || undefined
            }
            data-range-end={
              day === addDays(visible.to, -1) || index % 7 === 6 || undefined
            }
            aria-label={`${formatDate(`${day}T12:00:00Z`, {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}${inSession(day) ? ", сессия" : ""}`}
            title={inSession(day) ? "Сессия" : undefined}
            aria-pressed={
              day === visible.from || (day > visible.from && day < visible.to)
            }
            aria-current={day === today ? "date" : undefined}
            disabled={Boolean(min && day < min)}
            tabIndex={day === firstFocusable ? 0 : -1}
            onClick={() => onSelect(day)}
            onKeyDown={(e) => {
              const offset = {
                ArrowLeft: -1,
                ArrowRight: 1,
                ArrowUp: -7,
                ArrowDown: 7,
                Home: -(index % 7),
                End: 6 - (index % 7),
              }[e.key];
              if (offset === undefined) return;
              e.preventDefault();
              e.currentTarget.parentElement
                ?.querySelector<HTMLButtonElement>(
                  `[data-date="${addDays(day, offset)}"]`,
                )
                ?.focus();
            }}
          >
            {Number(day.slice(-2))}
          </button>
        ))}
      </div>
    </section>
  );
}
