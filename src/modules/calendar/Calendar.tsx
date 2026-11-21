"use client";
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  Plus,
  SlidersHorizontal,
  ArrowUpRight,
  Download,
  MapPin,
  UserRound,
  Clock3,
} from "lucide-react";
import { Button, Badge, ui } from "@/shared/ui/primitives";
import { Dialog } from "@/shared/ui/Dialog";
import { api } from "@/shared/lib/client";
import {
  addDays,
  dateKey,
  formatDate,
  formatTime,
  dayStart,
} from "@/shared/lib/time";
import {
  calendarDataRange,
  eventsOnDay,
  timedLayout,
  eventDate,
} from "./layout";
import {
  eventLabels,
  eventTypes,
  type CalendarEvent,
  type ExamPeriod,
  type ScheduleSelection,
} from "./types";
import { PersonalForm } from "./PersonalForm";
import { EventTitle } from "./EventTitle";
import { MiniCalendar } from "./MiniCalendar";
import { useCalendarScroll } from "./useCalendarScroll";
import s from "./calendar.module.css";
const HOUR_HEIGHT = 52;
const SchedulePicker = dynamic(
  () => import("./SchedulePicker").then((module) => module.SchedulePicker),
  {
    loading: () => (
      <div
        className={ui.skeleton}
        role="status"
        aria-label="Загрузка расписаний"
      />
    ),
  },
);

export function Calendar({
  events,
  examPeriod,
  date,
  view,
  types,
  schedules,
  now,
  connections,
}: {
  events: CalendarEvent[];
  examPeriod: ExamPeriod | null;
  date: string;
  view: string;
  types: string[];
  schedules: ScheduleSelection[];
  now: string;
  connections: ReactNode;
}) {
  const router = useRouter(),
    path = usePathname(),
    params = useSearchParams();
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [comparison, setComparison] = useState<"unopened" | "open" | "closed">(
    "unopened",
  );
  const [create, setCreate] = useState(false),
    [edit, setEdit] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false),
    [error, setError] = useState(""),
    [currentTime, setCurrentTime] = useState(now);
  const { from } = calendarDataRange(date, view);
  const { scrollRef, frameRef, visible, onScroll, move, transitionTo } =
    useCalendarScroll(date, view, from);
  const days = useMemo(
    () =>
      Array.from(
        { length: view === "month" ? 42 : view === "week" ? 35 : 29 },
        (_, i) => addDays(from, i),
      ),
    [from, view],
  );
  const dayEvents = useMemo(
    () =>
      days.map((day) => {
        const eventsForDay = eventsOnDay(events, day);
        return {
          day,
          events: eventsForDay,
          allDay: eventsForDay.filter((event) => event.startDate),
          timed: view === "month" ? [] : timedLayout(eventsForDay, day),
        };
      }),
    [days, events, view],
  );
  const today = dateKey(currentTime);
  const visibleDays =
    view === "month"
      ? {
          from: `${date.slice(0, 7)}-01`,
          to: `${addDays(`${date.slice(0, 7)}-01`, 32).slice(0, 7)}-01`,
        }
      : visible;
  const selected = events.find((e) => e.id === params.get("event"));
  const selectEvent = (event: string | null) => {
    const next = new URLSearchParams(window.location.search);
    next.delete("finance");
    if (event === null) next.delete("event");
    else next.set("event", event);
    const search = next.toString();
    const href = search ? `${path}?${search}` : path;
    if (href !== window.location.pathname + window.location.search)
      window.history.pushState(null, "", href);
  };
  const change = (values: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    next.delete("finance");
    for (const [k, v] of Object.entries(values)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    const commit = () => router.push(`${path}?${next}`, { scroll: false });
    if (values.date || values.view)
      void transitionTo(
        values.date ?? date,
        values.view ?? view,
        commit,
        !!values.date,
      );
    else commit();
  };
  useEffect(() => {
    const update = () => setCurrentTime(new Date().toISOString());
    const timer = setInterval(update, 60000);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  useEffect(() => {
    if (!params.has("view") && matchMedia("(max-width:650px)").matches) {
      const next = new URLSearchParams(params);
      next.set("view", "day");
      router.replace(`${path}?${next}`, { scroll: false });
    }
  }, [params, path, router]);
  const navigate = (direction: number) => {
    if (view === "month") {
      const d = new Date(`${date.slice(0, 7)}-01T12:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() + direction);
      change({ date: d.toISOString().slice(0, 10), event: null });
    } else move(direction);
  };
  const eventButton = (
    e: CalendarEvent,
    compact: false | "month" | "allDay" = false,
    style?: CSSProperties,
    conflict = false,
  ) => (
    <button
      key={e.id}
      className={`${s.event} ${compact ? s.compact : ""} ${compact === "month" ? s.monthEvent : ""} ${style ? s.timedEvent : ""} ${e.cancelled ? s.cancelled : ""} ${e.comparison ? s.comparison : ""}`}
      data-type={e.type}
      style={style}
      onClick={(click) => {
        click.currentTarget.focus();
        setEdit(false);
        setConfirmDelete(false);
        setError("");
        selectEvent(e.id);
      }}
      title={`${eventLabels[e.type]}: ${e.title}${e.location ? ` · ${e.location}` : ""}${conflict ? " · Пересечение" : ""}`}
    >
      {compact === "month" ? (
        <strong>{e.title}</strong>
      ) : (
        <>
          <EventTitle event={e} />
          {!compact && (
            <small>
              {e.startsAt
                ? `${formatTime(e.startsAt)}–${formatTime(e.endsAt!)}`
                : "Весь день"}
            </small>
          )}
        </>
      )}
      {!compact && e.comparison && e.group && <small>{e.group}</small>}
    </button>
  );
  const refresh = () => {
    setCreate(false);
    setEdit(false);
    selectEvent(null);
    router.refresh();
  };
  return (
    <>
      <div className={s.workspace} data-calendar-workspace>
        <section className={s.schedulePanel} aria-label="Календарь занятий">
          <div className={s.scheduleHeading}>
            <h1>Календарь</h1>
            <p aria-label="Видимые даты">
              {formatDate(`${visibleDays.from}T12:00:00Z`, {
                day: "numeric",
                month: "short",
              })}{" "}
              —{" "}
              {formatDate(`${addDays(visibleDays.to, -1)}T12:00:00Z`, {
                day: "numeric",
                month: "short",
              })}
            </p>
          </div>
          <div ref={frameRef} className={s.frame}>
            {view === "month" ? (
              <div className={s.month}>
                {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
                  <div key={d} className={s.weekday}>
                    {d}
                  </div>
                ))}
                {dayEvents.map(({ day, events: list }) => {
                  return (
                    <div
                      key={day}
                      className={`${s.monthDay} ${day === today ? s.today : ""} ${day.slice(0, 7) !== date.slice(0, 7) ? s.outside : ""}`}
                    >
                      <button
                        className={s.dayNumber}
                        aria-label={`Открыть ${formatDate(`${day}T12:00:00Z`)}`}
                        onClick={() =>
                          change({ date: day, view: "day", event: null })
                        }
                      >
                        {Number(day.slice(-2))}
                      </button>
                      {list.slice(0, 3).map((e) => eventButton(e, "month"))}
                      {list.length > 3 && (
                        <button
                          className={s.more}
                          onClick={() =>
                            change({ date: day, view: "day", event: null })
                          }
                        >
                          Ещё {list.length - 3}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                ref={scrollRef}
                className={s.timeScroll}
                role="region"
                aria-label="Расписание по дням"
                tabIndex={0}
                onScroll={onScroll}
                onKeyDown={(e) => {
                  if (
                    e.target !== e.currentTarget ||
                    !["ArrowLeft", "ArrowRight"].includes(e.key)
                  )
                    return;
                  e.preventDefault();
                  move(e.key === "ArrowLeft" ? -1 : 1);
                }}
                style={
                  {
                    "--day-count": days.length,
                    "--hour-height": `${HOUR_HEIGHT}px`,
                  } as CSSProperties
                }
              >
                <div className={s.timeHeader}>
                  <div />
                  {days.map((day) => (
                    <div
                      key={day}
                      data-calendar-day={day}
                      className={`${s.weekday} ${day === today ? s.today : ""}`}
                    >
                      <button
                        className={s.dayNumber}
                        onClick={() =>
                          change({ date: day, view: "day", event: null })
                        }
                      >
                        {formatDate(`${day}T12:00:00Z`, {
                          weekday: "short",
                          day: "numeric",
                        })}
                      </button>
                    </div>
                  ))}
                </div>
                <div className={s.allDay}>
                  <small className={ui.caption}>
                    Весь
                    <br />
                    день
                  </small>
                  {dayEvents.map(({ day, allDay }) => (
                    <div key={day} data-calendar-day={day}>
                      {allDay.map((e) => eventButton(e, "allDay"))}
                    </div>
                  ))}
                </div>
                <div className={s.timeGrid}>
                  <div className={s.hours}>
                    {Array.from({ length: 24 }, (_, h) => (
                      <span
                        key={h}
                        className={s.hour}
                        style={
                          {
                            "--hour-top": `${h * HOUR_HEIGHT}px`,
                          } as CSSProperties
                        }
                      >
                        {String(h).padStart(2, "0")}:00
                      </span>
                    ))}
                  </div>
                  {dayEvents.map(({ day, timed }) => (
                    <div
                      key={day}
                      className={s.dayColumn}
                      data-date={day}
                      data-calendar-day={day}
                    >
                      {timed.map((item) =>
                        eventButton(
                          item.event,
                          false,
                          {
                            "--event-top": `${(item.start * HOUR_HEIGHT) / 60}px`,
                            "--event-height": `${(Math.max(24, item.end - item.start - 3) * HOUR_HEIGHT) / 60}px`,
                            "--event-left": `calc(${(item.lane / item.lanes) * 100}% + 2px)`,
                            "--event-width": `calc(${100 / item.lanes}% - 4px)`,
                          } as CSSProperties,
                          item.conflict,
                        ),
                      )}
                      {day === today && (
                        <div
                          className={s.nowLine}
                          aria-label="Текущее время"
                          style={
                            {
                              "--now-top": `${(((new Date(currentTime).getTime() - dayStart(day).getTime()) / 60000) * HOUR_HEIGHT) / 60}px`,
                            } as CSSProperties
                          }
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <p className={`${ui.caption} ${s.footnote}`}>
            Часовой пояс — Москва (UTC+3). Официальные занятия изменяет учебный
            офис.
          </p>
        </section>
        <aside className={s.calendarSidebar} aria-label="Управление календарём">
          <MiniCalendar
            visible={visibleDays}
            examPeriod={examPeriod}
            today={today}
            onSelect={(day) =>
              change({
                date: day,
                view: view === "month" ? "day" : view,
                event: null,
              })
            }
            menu={
              <button
                type="button"
                aria-label="Импорт и подписки"
                aria-haspopup="dialog"
                onClick={(e) => {
                  e.currentTarget.focus();
                  setConnectionsOpen(true);
                }}
              >
                <Ellipsis size={17} />
              </button>
            }
          />
          <div className={s.periodControls}>
            <Button onClick={() => change({ date: dateKey(), event: null })}>
              Сегодня
            </Button>
            <Button
              className={ui.icon}
              aria-label="Предыдущий период"
              onClick={() => navigate(-1)}
            >
              <ChevronLeft size={16} />
            </Button>
            <Button
              className={ui.icon}
              aria-label="Следующий период"
              onClick={() => navigate(1)}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
          <div className={s.segmented} role="group" aria-label="Вид календаря">
            {[
              ["day", "День"],
              ["week", "Неделя"],
              ["month", "Месяц"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={s.segment}
                aria-pressed={view === id}
                onClick={() => change({ view: id, event: null })}
              >
                {label}
              </button>
            ))}
          </div>
          <fieldset className={s.filters}>
            <legend>Показывать в расписании</legend>
            {eventTypes.map((type) => (
              <label key={type} className={s.filter}>
                <input
                  type="checkbox"
                  checked={types.includes(type)}
                  onChange={() =>
                    change({
                      types: types.includes(type)
                        ? types.filter((t) => t !== type).join(",")
                        : [...types, type].join(","),
                    })
                  }
                />
                <span className={s.filterLabel} data-type={type}>
                  {eventLabels[type]}
                </span>
              </label>
            ))}
          </fieldset>
          {schedules.length > 0 && (
            <div className={s.selectedSchedule}>
              <Badge>Сравнение: {schedules.length + 1} расписания</Badge>
              <span>
                Дополнительные занятия отмечены пунктиром. Пересечения указаны в
                карточках.
              </span>
              <Button small onClick={() => change({ schedules: null })}>
                Убрать сравнение
              </Button>
            </div>
          )}
          {params.get("course") && (
            <p className={ui.row}>
              Выбрана дисциплина{" "}
              <Button small onClick={() => change({ course: null })}>
                Все дисциплины
              </Button>
            </p>
          )}
          <div className={s.sidebarActions}>
            <Button
              variant="primary"
              onClick={(e) => {
                e.currentTarget.focus();
                setCreate(true);
              }}
            >
              <Plus size={16} />
              Событие
            </Button>
            <Button
              aria-label="Сравнить расписания"
              onClick={(e) => {
                e.currentTarget.focus();
                setComparison("open");
              }}
            >
              <SlidersHorizontal size={16} />
              Расписания
            </Button>
          </div>
        </aside>
      </div>
      <Dialog
        open={connectionsOpen}
        onClose={() => setConnectionsOpen(false)}
        title="Импорт и подписки"
        className={s.connectionsDialog}
      >
        {connections}
      </Dialog>
      <Dialog
        open={create}
        onClose={() => setCreate(false)}
        title="Личное событие"
      >
        <PersonalForm date={date} onSaved={refresh} />
      </Dialog>
      <Dialog
        open={comparison === "open"}
        onClose={() => setComparison("closed")}
        title="Сравнение расписаний"
      >
        {comparison !== "unopened" && (
          <SchedulePicker
            selected={schedules}
            onSelect={(v) =>
              change({ schedules: v.map((s) => `${s.kind}:${s.id}`).join(",") })
            }
          />
        )}
      </Dialog>
      <Dialog
        open={!!selected}
        onClose={() => selectEvent(null)}
        title={edit ? "Изменить событие" : (selected?.title ?? "Событие")}
        subtitle={
          !edit && selected?.type === "LESSON"
            ? selected.description
            : undefined
        }
      >
        {selected &&
          (edit ? (
            <PersonalForm
              date={eventDate(selected)}
              event={selected}
              onSaved={refresh}
            />
          ) : (
            <div className={ui.stack}>
              <div className={ui.row}>
                <span
                  className={`${ui.badge} ${s.eventBadge}`}
                  data-type={selected.type}
                >
                  {eventLabels[selected.type]}
                </span>
                {selected.cancelled && <Badge>Отменено</Badge>}
                {selected.source !== "Учебное расписание" && (
                  <small className={ui.muted}>{selected.source}</small>
                )}
              </div>
              <p className={s.eventDetail}>
                <Clock3 size={17} />
                <span>
                  {selected.startDate
                    ? `${formatDate(`${selected.startDate}T12:00:00Z`)} · весь день`
                    : `${formatDate(selected.startsAt!)} · ${formatTime(selected.startsAt!)}–${formatTime(selected.endsAt!)} МСК`}
                </span>
              </p>
              {selected.location && (
                <p className={s.eventDetail}>
                  <MapPin size={17} />
                  <span>{selected.location}</span>
                </p>
              )}
              {selected.lecturer && (
                <p className={s.eventDetail}>
                  <UserRound size={17} />
                  <span>
                    {selected.lecturer} · {selected.group}
                  </span>
                </p>
              )}
              {selected.type !== "LESSON" && <p>{selected.description}</p>}
              {selected.status && (
                <p className={ui.muted}>
                  Состояние:{" "}
                  {selected.status === "PUBLISHED"
                    ? "Результат опубликован"
                    : selected.status === "SUBMITTED"
                      ? "Сдано, ожидает проверки"
                      : "Срок и требования указаны в связанном разделе"}
                </p>
              )}
              {selected.changes?.map((c) => (
                <div key={c.createdAt} className={ui.alert}>
                  {c.before} → {c.after}
                  <small>{formatDate(c.createdAt)}</small>
                </div>
              ))}
              <div className={ui.row}>
                {selected.href && (
                  <Link
                    className={`${ui.button} ${ui.primary}`}
                    href={selected.href}
                  >
                    {selected.courseId
                      ? "Открыть дисциплину"
                      : "Открыть подробности"}
                    <ArrowUpRight size={15} />
                  </Link>
                )}
                {selected.url && (
                  <a
                    className={ui.button}
                    href={selected.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Онлайн-ресурс
                  </a>
                )}
                <a
                  className={ui.button}
                  href={`/api/calendar/export.ics?from=${eventDate(selected)}&to=${addDays(eventDate(selected), 1)}&event=${selected.id}&types=${selected.type}${selected.comparison ? `&schedules=${encodeURIComponent(params.get("schedules") ?? "")}` : ""}`}
                >
                  <Download size={15} />
                  Добавить в свой календарь
                </a>
              </div>
              {selected.editable && !selected.cancelled && (
                <div className={ui.row}>
                  <Button onClick={() => setEdit(true)}>Изменить</Button>
                  <Button
                    variant="danger"
                    onClick={() => setConfirmDelete(true)}
                  >
                    Удалить
                  </Button>
                </div>
              )}
              {confirmDelete && (
                <div className={ui.alert}>
                  <div>
                    <p>Удалить личное событие?</p>
                    <div className={ui.row}>
                      <Button
                        variant="danger"
                        onClick={async () => {
                          try {
                            await api(
                              `/api/calendar/personal-events/${selected.id}`,
                              { method: "DELETE" },
                            );
                            setConfirmDelete(false);
                            refresh();
                          } catch (e) {
                            setError(
                              e instanceof Error
                                ? e.message
                                : "Не удалось удалить.",
                            );
                          }
                        }}
                      >
                        Подтвердить удаление
                      </Button>
                      <Button onClick={() => setConfirmDelete(false)}>
                        Оставить
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              {error && (
                <p className={ui.error} role="alert">
                  {error}
                </p>
              )}
              <small className={ui.caption}>
                Обновлено{" "}
                {formatDate(selected.updatedAt, {
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </small>
            </div>
          ))}
      </Dialog>
    </>
  );
}
