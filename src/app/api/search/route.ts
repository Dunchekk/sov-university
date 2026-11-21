import { route } from "@/server/http";
import { search } from "@/modules/search/service";
import { searchScopes } from "@/modules/search/types";

export const GET = route(async (request, student) => {
  const params = new URL(request.url).searchParams;
  const scope = searchScopes.find(({ id }) => id === params.get("scope"));
  return search(student, params.get("q") ?? "", scope?.id);
});
