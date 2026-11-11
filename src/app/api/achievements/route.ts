import { route, jsonBody } from "@/server/http";
import { db } from "@/server/db";
import {
  achievementCreate,
  createAchievement,
} from "@/modules/achievements/service";
export const GET = route(async (_request, student) =>
  db.achievement.findMany({
    where: { studentId: student.id },
    orderBy: { date: "desc" },
    take: 100,
  }),
);
export const POST = route(async (request, student) =>
  createAchievement(student, await jsonBody(request, achievementCreate)),
);
