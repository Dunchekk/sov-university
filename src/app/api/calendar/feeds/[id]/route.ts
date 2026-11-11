import { route } from "@/server/http";
import { revokeFeed } from "@/modules/calendar/integrations";
export const DELETE = route(async (request, student) =>
  revokeFeed(student.id, new URL(request.url).pathname.split("/").at(-1)!),
);
