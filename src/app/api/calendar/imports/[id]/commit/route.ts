import { z } from "zod";
import { route, jsonBody } from "@/server/http";
import { commitImport } from "@/modules/calendar/integrations";
export const POST = route(async (request, student) => {
  const { replace } = await jsonBody(
    request,
    z.object({ replace: z.boolean().default(false) }).strict(),
  );
  return commitImport(
    student,
    new URL(request.url).pathname.split("/").at(-2)!,
    replace,
  );
});
