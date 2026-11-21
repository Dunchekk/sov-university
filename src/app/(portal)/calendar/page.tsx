import { pageStudent } from "@/server/access";
import {
  calendarEvents,
  calendarExamPeriod,
  parseCalendarQuery,
} from "@/modules/calendar/service";
import { calendarDataRange } from "@/modules/calendar/layout";
import { Calendar } from "@/modules/calendar/Calendar";
import { eventTypes } from "@/modules/calendar/types";
import { dateKey } from "@/shared/lib/time";
import { z } from "zod";
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const student = await pageStudent();
  const p = await searchParams;
  const date = z.iso.date().safeParse(p.date).success ? p.date! : dateKey();
  const view = ["day", "week", "month"].includes(p.view ?? "")
    ? p.view!
    : (student.preference?.calendarView ?? "week");
  const range = calendarDataRange(date, view);
  const query = parseCalendarQuery(
    new URLSearchParams({
      ...(Object.fromEntries(
        Object.entries(p).filter(([, v]) => v !== undefined),
      ) as Record<string, string>),
      ...range,
      finance: "false",
    }),
  );
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
