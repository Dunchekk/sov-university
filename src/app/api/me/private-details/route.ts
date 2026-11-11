import { route } from "@/server/http";
import { db } from "@/server/db";
export const GET = route(async (_request, student) =>
  db.studentPrivate.findUnique({
    where: { studentId: student.id },
    select: { contactEmail: true, document: true, address: true },
  }),
);
