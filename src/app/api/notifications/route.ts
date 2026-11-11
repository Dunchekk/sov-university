import { z } from "zod";
import { route, jsonBody } from "@/server/http";
import { db } from "@/server/db";
export const GET = route(async (request, student) => {
  const cursor = new URL(request.url).searchParams.get("cursor");
  return db.notification.findMany({
    where: { studentId: student.id },
    select: {
      id: true,
      title: true,
      body: true,
      href: true,
      category: true,
      readAt: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 30,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
});
export const POST = route(async (request, student) => {
  const input = await jsonBody(
    request,
    z.union([
      z.object({ all: z.literal(true) }).strict(),
      z.object({ id: z.string().max(100) }).strict(),
    ]),
  );
  await db.notification.updateMany({
    where: {
      studentId: student.id,
      readAt: null,
      ...("id" in input ? { id: input.id } : {}),
    },
    data: { readAt: new Date() },
  });
  return { ok: true };
});
