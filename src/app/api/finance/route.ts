import { route } from "@/server/http";
import { finances } from "@/modules/finance/service";
export const GET = route(async (_request, student) => finances(student));
