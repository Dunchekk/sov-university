import { db } from "../src/server/db";
import { addDays, atTime } from "../src/shared/lib/time";

const contractStudentRequests = [
  {
    id: "request-b-enrollment",
    serviceSlug: "enrollment",
    status: "IN_REVIEW",
    fields: {
      recipient: "По месту требования",
      language: "ru",
      format: "electronic",
    },
    note: "Учебный офис проверяет сведения для справки.",
  },
  {
    id: "request-b-support",
    serviceSlug: "support",
    status: "SUBMITTED",
    fields: {
      subject: "Расписание в личном кабинете",
      description: "Подскажите, как посмотреть расписание на следующую неделю.",
    },
    note: "Обращение принято и ожидает рассмотрения.",
  },
] as const;

export async function seedContractStudentRequests() {
  const { baseDate } = await db.seedRun.findUniqueOrThrow({
    where: { id: "v1" },
    select: { baseDate: true },
  });
  const submittedAt = atTime(addDays(baseDate, -1), "10:00");
  const dueAt = atTime(addDays(baseDate, 3), "18:00");

  await db.$transaction(async (tx) => {
    for (const {
      id,
      serviceSlug,
      status,
      fields,
      note,
    } of contractStudentRequests) {
      const serviceSnapshot = await tx.service.findUniqueOrThrow({
        where: { slug: serviceSlug },
        select: { title: true, version: true, department: true },
      });
      await tx.studentRequest.upsert({
        where: { id },
        update: {},
        create: {
          id,
          studentId: "student-b",
          serviceSlug,
          status,
          fields,
          serviceSnapshot,
          submittedAt,
          dueAt,
          history: { create: { status, text: note, createdAt: submittedAt } },
        },
      });
    }
  });
}
