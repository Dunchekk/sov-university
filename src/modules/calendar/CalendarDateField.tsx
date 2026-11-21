"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { addDays } from "@/shared/lib/time";
import { MiniCalendar } from "./MiniCalendar";
import s from "./calendar.module.css";

export function formatCalendarDate(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year}`;
}

export function parseCalendarDate(value: string) {
  const parts = value.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!parts || parts[3] === "0000") return "";
  const [, day, month, year] = parts;
  const date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const instant = new Date(`${date}T12:00:00Z`);
  return Number.isFinite(instant.getTime()) &&
    instant.toISOString().startsWith(date)
    ? date
    : "";
}

export function CalendarDateField({
  label,
  name,
  value,
  onChange,
  today,
  min = "0001-01-01",
}: {
  label: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  today: string;
  min?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDialogElement>(null);
  const date = parseCalendarDate(value);
  const selected = date && date >= min ? date : today >= min ? today : min;

  useLayoutEffect(() => {
    input.current?.setCustomValidity(
      value !== "" && !date
        ? "Введите корректную дату в формате ДД.ММ.ГГГГ."
        : date && date < min
          ? "Эта дата раньше начала периода."
          : "",
    );
  }, [date, min, value]);

  function close() {
    popup.current?.close();
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }

  useLayoutEffect(() => {
    const dialog = popup.current;
    if (!open || !dialog || !input.current) return;
    const field = input.current;
    const place = () => {
      const bounds = field.getBoundingClientRect();
      dialog.style.width = `${bounds.width}px`;
      const gutter = 12;
      const gap = 4;
      const below = bounds.bottom + gap;
      const above = bounds.top - gap - dialog.offsetHeight;
      const maxTop = innerHeight - gutter - dialog.offsetHeight;
      const top = below > maxTop && above >= gutter ? above : below;
      dialog.style.top = `${Math.max(gutter, Math.min(top, maxTop))}px`;
      dialog.style.left = `${Math.max(gutter, Math.min(bounds.left, innerWidth - gutter - dialog.offsetWidth))}px`;
    };
    if (!dialog.open) dialog.showModal();
    place();
    dialog
      .querySelector<HTMLButtonElement>('[tabindex="0"]')
      ?.focus({ preventScroll: true });
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("resize", place);
      if (dialog.open) dialog.close();
    };
  }, [open]);

  return (
    <div className={s.dateField}>
      <label htmlFor={id}>{label}</label>
      <div className={s.dateEntry}>
        <input
          id={id}
          ref={input}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="ДД.ММ.ГГГГ"
          autoComplete="off"
          required
        />
        {name && <input type="hidden" name={name} value={date} />}
        <button
          type="button"
          className={s.dateTrigger}
          ref={trigger}
          aria-label={`Выбрать дату «${label}»`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? `${id}-calendar` : undefined}
          onClick={() => setOpen(true)}
        >
          <CalendarDays size={17} aria-hidden="true" />
        </button>
        {open && (
          <dialog
            className={s.datePopup}
            id={`${id}-calendar`}
            ref={popup}
            aria-label={`Выбор даты «${label}»`}
            onCancel={(event) => {
              event.preventDefault();
              close();
            }}
            onClick={(event) => {
              if (event.target !== event.currentTarget) return;
              const bounds = event.currentTarget.getBoundingClientRect();
              if (
                event.clientX < bounds.left ||
                event.clientX > bounds.right ||
                event.clientY < bounds.top ||
                event.clientY > bounds.bottom
              )
                close();
            }}
          >
            <MiniCalendar
              visible={{
                from: selected,
                to: selected === "9999-12-31" ? selected : addDays(selected, 1),
              }}
              today={today}
              min={min}
              onSelect={(day) => {
                onChange(formatCalendarDate(day));
                close();
              }}
            />
          </dialog>
        )}
      </div>
    </div>
  );
}
