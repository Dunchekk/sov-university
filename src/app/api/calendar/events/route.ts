import { route } from "@/server/http";
import { calendarEvents, parseCalendarQuery } from "@/modules/calendar/service";
export const GET = route(async (request, student) =>
  calendarEvents(
    student,
    parseCalendarQuery(new URL(request.url).searchParams),
  ),
);
