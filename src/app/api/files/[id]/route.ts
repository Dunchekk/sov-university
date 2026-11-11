import { route } from "@/server/http";
import { downloadFile } from "@/modules/files/service";
export const GET = route(async (request, student) =>
  downloadFile(student, new URL(request.url).pathname.split("/").at(-1)!),
);
import { deleteDraftFile } from "@/modules/requests/service";
export const DELETE = route(async (request, student) =>
  deleteDraftFile(student, new URL(request.url).pathname.split("/").at(-1)!),
);
