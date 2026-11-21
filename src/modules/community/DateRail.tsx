"use client";

import { useEffect, useRef } from "react";
import { FeedLink } from "./FeedNavigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import s from "./community.module.css";

type Day = {
  date: string;
  href: string;
  label: string;
  weekday: string;
  month?: string;
  weekend: boolean;
};

export function DateRail({
  days,
  anchorDate,
  selected,
}: {
  days: Day[];
  anchorDate: string;
  selected?: string;
}) {
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = track.current;
    const anchor = element?.querySelector<HTMLElement>("[data-anchor]");
    if (element && anchor) {
      element.scrollLeft = Math.max(0, anchor.offsetLeft - 16);
    }
  }, [anchorDate]);

  function scroll(direction: number) {
    const element = track.current;
    if (!element) return;
    element.scrollBy({
      left: direction * element.clientWidth * 0.8,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }

  return (
    <nav className={s.dateRail} aria-label="Публикации по дате">
      <button
        type="button"
        className={s.dateArrow}
        aria-label="Предыдущие даты"
        onClick={() => scroll(-1)}
      >
        <ChevronLeft size={20} aria-hidden />
      </button>
      <div ref={track} className={s.dateTrack}>
        {days.map((day) => (
          <div
            key={day.date}
            className={s.dateCell}
            data-anchor={day.date === anchorDate ? "" : undefined}
          >
            <span className={s.month} aria-hidden>
              {day.month}
            </span>
            <FeedLink
              href={day.href}
              className={s.dateLink}
              aria-label={day.label}
              aria-current={day.date === selected ? "date" : undefined}
              data-weekend={day.weekend || undefined}
            >
              <strong>{day.date.slice(-2)}</strong>
              <small>{day.weekday}</small>
            </FeedLink>
          </div>
        ))}
      </div>
      <button
        type="button"
        className={s.dateArrow}
        aria-label="Следующие даты"
        onClick={() => scroll(1)}
      >
        <ChevronRight size={20} aria-hidden />
      </button>
    </nav>
  );
}
