import { route, jsonBody } from "@/server/http";
import {
  requestDetail,
  updateSchema,
  updateRequest,
  actionSchema,
  requestAction,
} from "@/modules/requests/service";
const id = (request: Request) =>
  new URL(request.url).pathname.split("/").at(-1)!;
export const GET = route(async (request, student) =>
  requestDetail(student, id(request)),
);
export const PATCH = route(async (request, student) =>
  updateRequest(student, id(request), await jsonBody(request, updateSchema)),
);
export const POST = route(async (request, student) =>
  requestAction(student, id(request), await jsonBody(request, actionSchema)),
);
