import { route, jsonBody } from "@/server/http";
import {
  communityEvent,
  saveEvent,
  saveEventSchema,
} from "@/modules/community/service";
const id = (r: Request) => new URL(r.url).pathname.split("/").at(-1)!;
export const GET = route(async (r, s) => communityEvent(s, id(r)));
export const PATCH = route(async (r, s) =>
  saveEvent(s, id(r), await jsonBody(r, saveEventSchema)),
);
