"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Clock3, ArrowUpRight } from "lucide-react";
import { Badge, ui } from "@/shared/ui/primitives";
import { nextClasses, eventDate } from "./layout";
import { formatDate, formatTime, dateKey, addDays } from "@/shared/lib/time";
import type { CalendarEvent } from "./types";
import s from "./calendar.module.css";
export function NextClass({
  events,
  now,
}: {
  events: CalendarEvent[];
  now: string;
}) {
  const [time, setTime] = useState(now);
  useEffect(() => {
    const update = () => setTime(new Date().toISOString());
    const timer = setInterval(update, 60000);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  const { current, next } = nextClasses(events, new Date(time));
  const list = current.length ? current : next;
  return (
    <section className={`${ui.card} ${s.nextCard}`}>
      <div className={ui.between}>
        <span className={ui.eyebrow}>
          {current.length ? "Сейчас идёт" : "Следующая пара"}
        </span>
        <Badge tone="info">
          {current.length ? "В процессе" : "По расписанию"}
        </Badge>
      </div>
      {list.length === 0 ? (
        <div className={ui.empty}>
          <h3>Неделя без пар</h3>
          <Link href="/calendar" className={ui.link}>
            Посмотреть планы
          </Link>
        </div>
      ) : (
        list.map((event) => (
          <div key={event.id}>
            <h2 className={s.nextTitle}>
              <Link href={event.href ?? "/calendar"}>{event.title}</Link>
            </h2>
            <p className={`${ui.row} ${ui.muted}`}>
              <Clock3 size={16} />
              {eventDate(event) === addDays(dateKey(time), 1)
                ? "Завтра · "
                : eventDate(event) !== dateKey(time)
                  ? `${formatDate(event.startsAt!)} · `
                  : ""}
              {formatTime(event.startsAt!)}–{formatTime(event.endsAt!)}
            </p>
            <Link
              className={`${ui.row} ${ui.muted}`}
              href={`/calendar?date=${eventDate(event)}&event=${event.id}`}
            >
              <MapPin size={16} />
              {event.location.split(". ")[0]}
            </Link>
            <p className={ui.caption}>
              {event.lecturer} · {event.description}
            </p>
            <div className={ui.listItem}>
              <Link
                className={`${ui.row} ${ui.link}`}
                href={`/calendar?date=${eventDate(event)}&event=${event.id}`}
              >
                В календарь
                <ArrowUpRight size={15} />
              </Link>
            </div>
          </div>
        ))
      )}
      {current.length > 1 && (
        <p className={`${ui.alert} ${ui.warning}`}>
          Пересечение занятий. Уточните расписание у учебного офиса.
        </p>
      )}
    </section>
  );
}
