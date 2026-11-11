import { route, jsonBody } from "@/server/http";
import { db } from "@/server/db";
import { createSchema, createRequest } from "@/modules/requests/service";
export const POST = route(async (request, student) =>
  createRequest(student, await jsonBody(request, createSchema)),
);
export const GET = route(async (request, student) => {
  const page = Math.max(
    1,
    Math.min(100, Number(new URL(request.url).searchParams.get("page")) || 1),
  );
  return db.studentRequest.findMany({
    where: { studentId: student.id },
    select: {
      id: true,
      number: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      service: { select: { title: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
    skip: (page - 1) * 20,
  });
});
