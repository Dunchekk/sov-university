"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Clock3, Flame } from "lucide-react";
import { Avatar, ui } from "@/shared/ui/primitives";
import { LecturerLink } from "@/shared/ui/LecturerLink";
import { nextClasses, eventDate } from "./layout";
import { formatDate, formatTime, dateKey, addDays } from "@/shared/lib/time";
import type { CalendarEvent } from "./types";
import s from "./calendar.module.css";
export function NextClass({
  events,
  lecturerAvatars,
  now,
}: {
  events: CalendarEvent[];
  lecturerAvatars: Record<string, string>;
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
    <section className={s.nextClass}>
      <h2 className={s.nextStatus}>
        {current.length ? "Сейчас идёт" : "Следующая пара"}
        {current.length > 0 && <Flame size={16} aria-hidden />}
      </h2>
      {list.length === 0 ? (
        <div className={ui.empty}>
          <h3>Неделя без пар</h3>
          <Link href="/calendar" className={ui.link}>
            Посмотреть планы
          </Link>
        </div>
      ) : (
        list.map((event) => (
          <div className={s.nextDetails} key={event.id}>
            <div className={s.nextDetailGroup}>
              <h3 className={s.nextTitle}>
                <Link href={event.href ?? "/calendar"}>{event.title}</Link>
              </h3>
              <p className={ui.caption}>{event.description}</p>
            </div>
            <div className={`${s.nextDetailGroup} ${s.nextMeta}`}>
              <p className={`${ui.row} ${ui.muted}`}>
                <Clock3 size={16} aria-hidden />
                {eventDate(event) === addDays(dateKey(time), 1)
                  ? "Завтра · "
                  : eventDate(event) !== dateKey(time)
                    ? `${formatDate(event.startsAt!)} · `
                    : ""}
                {formatTime(event.startsAt!)}–{formatTime(event.endsAt!)}
              </p>
              {event.location && (
                <Link
                  className={`${ui.row} ${ui.muted}`}
                  href={`/calendar?date=${eventDate(event)}&event=${event.id}`}
                >
                  <MapPin size={16} aria-hidden />
                  {event.location.split(". ")[0]}
                </Link>
              )}
            </div>
            {event.lecturer && (
              <div className={s.nextLecturer}>
                <span className={s.nextLecturerAvatar} aria-hidden>
                  <Avatar
                    name={event.lecturer}
                    src={
                      event.lecturerId
                        ? lecturerAvatars[event.lecturerId]
                        : undefined
                    }
                  />
                </span>
                <div>
                  <p className={s.nextLecturerName}>
                    <LecturerLink id={event.lecturerId} name={event.lecturer} />
                  </p>
                  <p className={ui.caption}>Преподаватель</p>
                </div>
              </div>
            )}
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
