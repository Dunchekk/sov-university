"use client";
import { useState } from "react";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { Button, ui } from "@/shared/ui/primitives";
import { api } from "@/shared/lib/client";
import { addDays } from "@/shared/lib/time";
import type { CalendarEvent } from "./types";
export function PersonalForm({
  date,
  event,
  onSaved,
}: {
  date: string;
  event?: CalendarEvent;
  onSaved: () => void;
}) {
  const [allDay, setAllDay] = useState(!!event?.startDate),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const datetime = (value: string | null | undefined, fallback: string) =>
    value
      ? formatInTimeZone(value, "Europe/Moscow", "yyyy-MM-dd'T'HH:mm")
      : fallback;
  return (
    <form
      className={ui.form}
      aria-label={
        event ? "Редактирование личного события" : "Новое личное событие"
      }
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const f = new FormData(e.currentTarget);
        try {
          const body = {
            title: f.get("title"),
            description: f.get("description"),
            url: event?.url ?? "",
            timezone: "Europe/Moscow",
            sequence: event?.sequence,
            ...(allDay
              ? {
                  startDate: f.get("startDate"),
                  endDate: addDays(String(f.get("lastDate")), 1),
                }
              : {
                  startsAt: fromZonedTime(
                    String(f.get("start")),
                    "Europe/Moscow",
                  ).toISOString(),
                  endsAt: fromZonedTime(
                    String(f.get("end")),
                    "Europe/Moscow",
                  ).toISOString(),
                }),
          };
          await api(
            `/api/calendar/personal-events${event ? `/${event.id}` : ""}`,
            { method: event ? "PATCH" : "POST", body: JSON.stringify(body) },
          );
          onSaved();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Не удалось сохранить.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Название
        <input
          name="title"
          maxLength={180}
          required
          defaultValue={event?.title}
        />
      </label>
      <label className={ui.row}>
        <input
          type="checkbox"
          checked={allDay}
          onChange={(e) => setAllDay(e.target.checked)}
        />
        Весь день
      </label>
      {allDay ? (
        <div className={ui.grid2}>
          <label>
            Начало
            <input
              type="date"
              name="startDate"
              required
              defaultValue={event?.startDate ?? date}
            />
          </label>
          <label>
            Последний день включительно
            <input
              type="date"
              name="lastDate"
              required
              defaultValue={event?.endDate ? addDays(event.endDate, -1) : date}
            />
          </label>
        </div>
      ) : (
        <div className={ui.grid2}>
          <label>
            Начало, МСК
            <input
              type="datetime-local"
              name="start"
              required
              defaultValue={datetime(event?.startsAt, `${date}T18:00`)}
            />
          </label>
          <label>
            Конец, МСК
            <input
              type="datetime-local"
              name="end"
              required
              defaultValue={datetime(event?.endsAt, `${date}T19:00`)}
            />
          </label>
        </div>
      )}
      <label>
        Заметка
        <textarea
          name="description"
          maxLength={2000}
          defaultValue={event?.description}
        />
      </label>
      {error && (
        <p role="alert" className={`${ui.alert} ${ui.error}`}>
          {error}
        </p>
      )}
      <Button variant="primary" disabled={busy}>
        {busy ? "Сохраняем…" : "Сохранить событие"}
      </Button>
    </form>
  );
}
