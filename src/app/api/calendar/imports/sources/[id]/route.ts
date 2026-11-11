import { route } from "@/server/http";
import { removeSource } from "@/modules/calendar/integrations";
export const DELETE = route(async (request, student) =>
  removeSource(student.id, new URL(request.url).pathname.split("/").at(-1)!),
);
