import Link from "next/link";
import { addDays, formatDate, formatTime } from "@/shared/lib/time";
import { eventsOnDay, eventDate } from "./layout";
import { eventLabels, type CalendarEvent } from "./types";
import { EventLocation } from "./EventTitle";
import s from "./calendar.module.css";
export function HomeCalendar({
  events,
  date,
}: {
  events: CalendarEvent[];
  date: string;
}) {
  const scheduled = events.filter((event) => !event.cancelled);
  return (
    <div className={s.widget}>
      <h2>
        <Link href={`/calendar?date=${date}`}>Календарь</Link>
      </h2>
      <div className={s.widgetGrid}>
        {Array.from({ length: 3 }, (_, i) => addDays(date, i)).map((day) => {
          const list = eventsOnDay(scheduled, day);
          return (
            <div className={s.widgetDay} key={day}>
              <Link
                className={s.widgetTitle}
                href={`/calendar?date=${day}&view=day`}
              >
                <span>
                  {day === date
                    ? "Сегодня"
                    : formatDate(`${day}T12:00:00Z`, { weekday: "short" })}
                </span>
                <strong>{Number(day.slice(-2))}</strong>
              </Link>
              {list.slice(0, 3).map((event) => (
                <Link
                  key={event.id}
                  className={s.event}
                  data-type={event.type}
                  href={`/calendar?date=${eventDate(event)}&event=${event.id}`}
                >
                  <span className={s.widgetMeta}>
                    <span>
                      {event.startsAt
                        ? formatTime(event.startsAt)
                        : "Весь день"}
                    </span>
                    <span aria-hidden>·</span>
                    <span>{eventLabels[event.type]}</span>
                    {event.location && (
                      <>
                        <span aria-hidden>·</span>
                        <EventLocation event={event} />
                      </>
                    )}
                  </span>
                  <strong className={s.widgetEventTitle}>{event.title}</strong>
                </Link>
              ))}
              {!list.length && <p className={s.widgetEmpty}>Свободный день</p>}
              {list.length > 3 && (
                <Link
                  className={s.more}
                  href={`/calendar?date=${day}&view=day`}
                >
                  Ещё {list.length - 3}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
