import { route, jsonBody } from "@/server/http";
import { personalSchema, savePersonal } from "@/modules/calendar/personal";
export const POST = route(async (request, student) =>
  savePersonal(student, await jsonBody(request, personalSchema)),
);
