import { route, jsonBody } from "@/server/http";
import {
  createFeed,
  feedInput,
  integrations,
} from "@/modules/calendar/integrations";
export const GET = route(async (_request, student) => integrations(student.id));
export const POST = route(async (request, student) =>
  createFeed(student.id, await jsonBody(request, feedInput)),
);
