import { addDays, dateKey, dayStart } from "@/shared/lib/time";
import type { CalendarEvent } from "./types";
export function calendarRange(date: string, view: string) {
  if (view === "day") return { from: date, to: addDays(date, 1) };
  if (view === "week") {
    return { from: date, to: addDays(date, 7) };
  }
  const first = `${date.slice(0, 7)}-01`;
  const weekday = new Date(`${first}T12:00:00Z`).getUTCDay();
  const from = addDays(first, -((weekday + 6) % 7));
  return { from, to: addDays(from, 42) };
}
// Neighbouring days are rendered with real data before they enter the viewport.
// The server recentres this buffer after horizontal scrolling settles.
export function calendarDataRange(date: string, view: string) {
  const range = calendarRange(date, view);
  return view === "month"
    ? range
    : { from: addDays(range.from, -14), to: addDays(range.to, 14) };
}
export function eventsOnDay(events: CalendarEvent[], day: string) {
  const from = dayStart(day).getTime(),
    to = dayStart(addDays(day, 1)).getTime();
  return events.filter((e) => {
    if (e.startsAt && e.endsAt) {
      const start = new Date(e.startsAt).getTime(),
        end = new Date(e.endsAt).getTime();
      return start === end
        ? start >= from && start < to
        : start < to && end > from;
    }
    return e.startDate && e.endDate && e.startDate <= day && e.endDate > day;
  });
}
export function timedLayout(events: CalendarEvent[], day: string) {
  const start = dayStart(day).getTime();
  const items = events
    .filter((e) => e.startsAt && e.endsAt)
    .map((e) => ({
      event: e,
      start: Math.max(0, (new Date(e.startsAt!).getTime() - start) / 60000),
      end: Math.min(1440, (new Date(e.endsAt!).getTime() - start) / 60000),
      lane: 0,
      lanes: 1,
      conflict: false,
    }))
    .sort((a, b) => a.start - b.start || b.end - a.end);
  let group: typeof items = [];
  let end = 0;
  const close = () => {
    const lanes = Math.max(...group.map((i) => i.lane)) + 1;
    for (const item of group) item.lanes = lanes;
    group = [];
  };
  for (const item of items) {
    item.conflict = items.some(
      (other) =>
        other !== item && other.start < item.end && other.end > item.start,
    );
    if (group.length && item.start >= end) close();
    const occupied = new Set(
      group
        .filter((i) => Math.max(i.end, i.start + 24) > item.start)
        .map((i) => i.lane),
    );
    while (occupied.has(item.lane)) item.lane++;
    group.push(item);
    end = Math.max(...group.map((i) => Math.max(i.end, i.start + 24)));
  }
  if (group.length) close();
  return items;
}
export function nextClasses(events: CalendarEvent[], now: Date) {
  const lessons = events.filter(
    (e) =>
      e.type === "LESSON" &&
      !e.cancelled &&
      e.startsAt &&
      e.endsAt &&
      new Date(e.endsAt) > now,
  );
  const current = lessons.filter((e) => new Date(e.startsAt!) <= now);
  return {
    current,
    next: current.length
      ? []
      : lessons.filter((e) => new Date(e.startsAt!) > now).slice(0, 1),
  };
}
export const eventDate = (e: CalendarEvent) =>
  e.startDate ?? dateKey(e.startsAt!);
