import { pageStudent } from "@/server/access";
import {
  calendarEvents,
  calendarExamPeriod,
  calendarQuery,
  parseCalendarQuery,
} from "@/modules/calendar/service";
import { calendarDataRange } from "@/modules/calendar/layout";
import { Calendar } from "@/modules/calendar/Calendar";
import { eventTypes } from "@/modules/calendar/types";
import { dateKey } from "@/shared/lib/time";
import { filterValue, type FilterParams } from "@/shared/lib/filters";
import { z } from "zod";

export const metadata = { title: "Календарь" };

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<FilterParams>;
}) {
  const student = await pageStudent();
  const p = await searchParams;
  const requestedDate = filterValue(p.date);
  const requestedView = filterValue(p.view);
  const date = z.iso.date().safeParse(requestedDate).success
    ? requestedDate
    : dateKey();
  const view = ["day", "week", "month"].includes(requestedView)
    ? requestedView
    : (student.preference?.calendarView ?? "week");
  const range = calendarDataRange(date, view);
  const query = parseCalendarQuery(
    new URLSearchParams({
      ...Object.fromEntries(
        Object.entries(p).map(([key, value]) => [key, filterValue(value)]),
      ),
      ...range,
      finance: "false",
    }),
  );
  if (query.types) {
    const selected = new Set(query.types);
    query.types = eventTypes.filter((type) => selected.has(type));
  }
  query.course =
    query.course && query.course.length <= 100 ? query.course : undefined;
  query.schedules =
    calendarQuery.shape.schedules.safeParse(query.schedules).data ?? [];
  const [events, examPeriod] = await Promise.all([
    calendarEvents(student, query),
    calendarExamPeriod(student),
  ]);
  return (
    <>
      <Calendar
        events={events}
        examPeriod={examPeriod}
        date={date}
        view={view}
        types={query.types ?? [...eventTypes]}
        schedules={query.schedules ?? []}
        now={new Date().toISOString()}
        publicAddress={process.env.APP_URL?.startsWith("https://") ?? false}
      />
    </>
  );
}
