"use client";
import { useEffect, useState } from "react";
import { Star, X } from "lucide-react";
import { Button, ui } from "@/shared/ui/primitives";
import { LecturerLink } from "@/shared/ui/LecturerLink";
import { api } from "@/shared/lib/client";
import type { ScheduleSelection } from "./types";
import s from "./calendar.module.css";
type Schedule = { kind: ScheduleSelection["kind"]; id: string; label: string };
export function SchedulePicker({
  selected,
  onSelect,
}: {
  selected: ScheduleSelection[];
  onSelect: (v: ScheduleSelection[]) => void;
}) {
  const [q, setQ] = useState(""),
    [items, setItems] = useState<Schedule[]>([]),
    [saved, setSaved] = useState<Schedule[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    const timer = setTimeout(() => {
      api<Schedule[]>(`/api/schedules/search?q=${encodeURIComponent(q)}`, {
        signal: c.signal,
      })
        .then((items) => {
          if (!c.signal.aborted) setItems(items);
        })
        .catch(() => {
          if (!c.signal.aborted) setError("Не удалось найти расписания.");
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [q]);
  const refresh = async () => {
    const result = await api<
      { kind: Schedule["kind"]; targetId: string; label: string }[]
    >("/api/schedules/saved");
    setSaved(
      result.map((v) => ({ kind: v.kind, id: v.targetId, label: v.label })),
    );
  };
  useEffect(() => {
    void api<{ kind: Schedule["kind"]; targetId: string; label: string }[]>(
      "/api/schedules/saved",
    )
      .then((v) =>
        setSaved(
          v.map((i) => ({ kind: i.kind, id: i.targetId, label: i.label })),
        ),
      )
      .catch(() => setError("Избранное временно недоступно."));
  }, []);
  const row = (item: Schedule) => {
    const checked = selected.some(
      (v) => v.kind === item.kind && v.id === item.id,
    );
    const favorite = saved.some(
      (v) => v.kind === item.kind && v.id === item.id,
    );
    const lecturer = item.kind === "lecturer";
    const kind = lecturer
      ? "Преподаватель"
      : item.kind === "group"
        ? "Группа"
        : "Аудитория";
    const checkbox = (
      <input
        type="checkbox"
        aria-label={lecturer ? `${item.label} · ${kind}` : undefined}
        checked={checked}
        disabled={!checked && selected.length >= 2}
        onChange={() =>
          onSelect(
            checked
              ? selected.filter((v) => v.kind !== item.kind || v.id !== item.id)
              : [...selected, { kind: item.kind, id: item.id }],
          )
        }
      />
    );
    const label = (
      <span>
        {lecturer ? (
          <LecturerLink id={item.id} name={item.label} />
        ) : (
          item.label
        )}
        <small className={ui.muted}> · {kind}</small>
      </span>
    );
    return (
      <div key={`${item.kind}:${item.id}`} className={ui.between}>
        {lecturer ? (
          <div className={ui.row}>
            {checkbox}
            {label}
          </div>
        ) : (
          <label className={ui.row}>
            {checkbox}
            {label}
          </label>
        )}
        <Button
          small
          aria-label={
            favorite
              ? `Убрать ${item.label} из избранного`
              : `Сохранить ${item.label}`
          }
          onClick={async () => {
            try {
              await api("/api/schedules/saved", {
                method: favorite ? "DELETE" : "POST",
                body: JSON.stringify({ kind: item.kind, targetId: item.id }),
              });
              await refresh();
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Не удалось сохранить.",
              );
            }
          }}
        >
          {favorite ? <X size={14} /> : <Star size={14} />}
        </Button>
      </div>
    );
  };
  return (
    <div className={ui.stack}>
      <p className={ui.muted}>
        Ваше расписание включено. Можно сравнить ещё два опубликованных
        расписания. Личные записи других студентов недоступны.
      </p>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Поиск..."
        aria-label="Найти группу, преподавателя или аудиторию"
      />
      {saved.length > 0 && (
        <div className={ui.stack}>
          <h3>Избранное</h3>
          {saved.map(row)}
        </div>
      )}
      <div className={s.scheduleResults}>{items.map(row)}</div>
      {error && (
        <p role="alert" className={ui.error}>
          {error}
        </p>
      )}
    </div>
  );
}
