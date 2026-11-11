import { route } from "@/server/http";
import { notFound } from "@/server/errors";
import { parseCalendarQuery, calendarEvents } from "@/modules/calendar/service";
import { exportICS, icsHeaders } from "@/modules/calendar/ics";
export const GET = route(async (request, student) => {
  const params = new URL(request.url).searchParams;
  const query = parseCalendarQuery(params);
  if (!params.has("types")) query.types = ["LESSON", "EXAM", "DEADLINE"];
  let events = await calendarEvents(student, query, { includeDeleted: true });
  if (params.has("event")) {
    events = events.filter((event) => event.id === params.get("event"));
    if (!events.length) throw notFound();
  }
  return new Response(exportICS(events), {
    headers: {
      ...icsHeaders,
      "Content-Disposition": 'attachment; filename="ryadom-calendar.ics"',
    },
  });
});
