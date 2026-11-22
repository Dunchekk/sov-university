"use client";
import { useState } from "react";
import { Bookmark, CalendarPlus, Check } from "lucide-react";
import { Button, ui } from "@/shared/ui/primitives";
import { api } from "@/shared/lib/client";
import s from "./community.module.css";

type Selection = { saved: boolean; inCalendar: boolean };

function ActionLabel({
  active,
  on,
  off,
}: {
  active: boolean;
  on: string;
  off: string;
}) {
  return (
    <span className={s.actionLabel}>
      <span aria-hidden={active}>{off}</span>
      <span aria-hidden={!active}>{on}</span>
    </span>
  );
}

export function EventActions({
  id,
  initialSelection,
}: {
  id: string;
  initialSelection: Selection;
}) {
  const [selection, setSelection] = useState(initialSelection);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { saved, inCalendar } = selection;

  const update = async (data: Partial<Selection>) => {
    if (busy) return;
    setError("");
    setBusy(true);
    setSelection({ ...selection, ...data });
    try {
      const updated = await api<Selection>(`/api/community/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      setSelection(updated);
    } catch (e) {
      setSelection(selection);
      setError(e instanceof Error ? e.message : "Не удалось сохранить.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={ui.stack}>
      <div className={ui.row}>
        <Button
          aria-disabled={busy}
          className={s.actionButton}
          aria-pressed={saved}
          onClick={() => update({ saved: !saved })}
        >
          <Bookmark
            size={16}
            fill={saved ? "currentColor" : "none"}
            aria-hidden
          />
          <ActionLabel
            active={saved}
            on="Убрать из сохранённых"
            off="Сохранить событие"
          />
        </Button>
        <Button
          aria-disabled={busy}
          className={s.actionButton}
          variant={inCalendar ? "default" : "primary"}
          onClick={() => update({ inCalendar: !inCalendar })}
        >
          {inCalendar ? (
            <Check size={16} aria-hidden />
          ) : (
            <CalendarPlus size={16} aria-hidden />
          )}
          <ActionLabel
            active={inCalendar}
            on="В моём календаре · убрать"
            off="Добавить в мой календарь"
          />
        </Button>
      </div>
      <p className={ui.caption}>
        Сохранение и добавление в календарь не являются регистрацией или
        подтверждением участия.
      </p>
      {error && (
        <p role="alert" className={ui.error}>
          {error}
        </p>
      )}
    </div>
  );
}
