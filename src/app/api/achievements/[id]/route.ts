import { route, jsonBody } from "@/server/http";
import {
  achievementDetail,
  achievementUpdate,
  updateAchievement,
  achievementAction,
  submitAchievement,
} from "@/modules/achievements/service";
const id = (r: Request) => new URL(r.url).pathname.split("/").at(-1)!;
export const GET = route(async (r, s) => achievementDetail(s, id(r)));
export const PATCH = route(async (r, s) =>
  updateAchievement(s, id(r), await jsonBody(r, achievementUpdate)),
);
export const POST = route(async (r, s) =>
  submitAchievement(s, id(r), await jsonBody(r, achievementAction)),
);
