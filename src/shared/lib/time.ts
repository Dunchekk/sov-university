import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
export const TIMEZONE = "Europe/Moscow";
export interface Clock {
  now(): Date;
}
export const systemClock: Clock = { now: () => new Date() };
export const dateKey = (
  date: Date | string = new Date(),
  timezone = TIMEZONE,
) => formatInTimeZone(date, timezone, "yyyy-MM-dd");
export const dayStart = (day: string, timezone = TIMEZONE) =>
  fromZonedTime(`${day}T00:00:00`, timezone);
export function addDays(day: string, n: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}
export const atTime = (day: string, time: string) =>
  fromZonedTime(`${day}T${time}:00`, TIMEZONE);
export const formatDate = (
  date: Date | string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" },
) =>
  new Intl.DateTimeFormat("ru-RU", { timeZone: TIMEZONE, ...options }).format(
    new Date(date),
  );
export const formatTime = (date: Date | string) =>
  formatDate(date, { hour: "2-digit", minute: "2-digit" });
export const money = (kopecks: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(kopecks / 100);
export function workingDayDeadline(start: Date, count: number) {
  let day = dateKey(start);
  for (let n = 0; n < count; ) {
    day = addDays(day, 1);
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    if (weekday !== 0 && weekday !== 6) n++;
  }
  return atTime(day, "18:00");
}
export function validTimezone(zone: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone }).format();
    return true;
  } catch {
    return false;
  }
}
