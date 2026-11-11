import { route } from "@/server/http";
import { projectDetail } from "@/modules/projects/service";
export const GET = route(async (request, student) =>
  projectDetail(student, new URL(request.url).pathname.split("/").at(-1)!),
);
