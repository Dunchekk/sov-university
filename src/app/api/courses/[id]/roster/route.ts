import { route } from "@/server/http";
import { roster } from "@/modules/courses/service";
import { rosterFilters } from "@/modules/courses/roster-filters";
export const GET = route(async (request, student) => {
  const url = new URL(request.url);
  const filters = rosterFilters(Object.fromEntries(url.searchParams));
  return roster(
    student,
    url.pathname.split("/")[3],
    filters.q,
    filters.group || undefined,
    filters.page,
  );
});
