import { readFeed } from "@/modules/calendar/integrations";
import { errorResponse } from "@/server/errors";
import { icsHeaders } from "@/modules/calendar/ics";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    return await readFeed(
      request,
      new URL(request.url).pathname.split("/").at(-2)!,
    );
  } catch (error) {
    const response = errorResponse(error);
    response.headers.set("Cache-Control", icsHeaders["Cache-Control"]);
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }
}
